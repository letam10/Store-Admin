import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { products as baseProducts } from '../../shared/products.js'
import { clearCookie, hashPassword, hashToken, normalizeUsername, parseCookies, randomToken, setCookie, verifyPassword } from './security.js'

const COOKIE = 'store_customer_session'
const SESSION_SECONDS = 60 * 60 * 24 * 30
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PRIZES = Object.freeze([
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
  { kind: 'amount', label: 'Voucher 100K', value: 100000 },
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
  { kind: 'percent', label: 'Voucher giảm 20%', value: 20 },
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
  { kind: 'amount', label: 'Voucher 100K', value: 100000 },
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
  { kind: 'amount', label: 'Voucher 100K', value: 100000 },
  { kind: 'none', label: 'Chúc bạn may mắn lần sau' },
])

export function tierForPoints(points) {
  if (points >= 10000) return 'diamond'
  if (points >= 1000) return 'gold'
  if (points >= 100) return 'silver'
  return 'bronze'
}

export function rewardPrizes() { return PRIZES }

export function pointsForPaidGoods(amount, tier) {
  const basePoints = Math.floor(Math.max(0, amount) / 1000)
  return Math.floor(basePoints * (tier === 'diamond' ? 1.5 : tier === 'gold' ? 1.2 : 1))
}

export function shippingFee({ region, distanceKm = 0, fulfillment = 'delivery' }) {
  if (fulfillment === 'pickup') return 0
  if (!['hcm', 'binh-duong', 'ba-ria-vung-tau', 'nearby', 'far'].includes(region) ||
    (region === 'far' && (!Number.isInteger(distanceKm) || distanceKm < 0 || distanceKm > 3000))) throw new Error('INVALID_DELIVERY_REGION')
  if (region === 'hcm' || region === 'binh-duong' || region === 'ba-ria-vung-tau') return 30000
  if (region === 'nearby') return 60000
  if (region === 'far' && Number.isInteger(distanceKm) && distanceKm >= 0 && distanceKm <= 3000) return 60000 + distanceKm * 1000
  throw new Error('INVALID_DELIVERY_REGION')
}

function publicVoucher(row) {
  return { code: row.code, label: row.label, type: row.type, value: row.value, expiresAt: row.expires_at, source: row.source }
}

function cleanExpired(sql, time) {
  sql.prepare('DELETE FROM customer_vouchers WHERE expires_at <= ?').run(time)
}

function createCode() {
  const bytes = randomBytes(10)
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join('')
}

export function registerCustomerRoutes(app, { storeDb, config, now, requireAdmin, requireCsrf }) {
  const sql = storeDb.db
  sql.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
      paid_goods_total INTEGER NOT NULL DEFAULT 0, spin_credits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_sessions (
      token_hash TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS voucher_codes (code TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customer_vouchers (
      code TEXT PRIMARY KEY REFERENCES voucher_codes(code),
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      label TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('amount','percent')),
      value INTEGER NOT NULL CHECK(value > 0), expires_at TEXT NOT NULL,
      source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customer_vouchers_owner ON customer_vouchers(customer_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_customer_vouchers_expiry ON customer_vouchers(expires_at);
    CREATE TABLE IF NOT EXISTS customer_favorites (
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(customer_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL, admin_reply TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, replied_at TEXT,
      UNIQUE(customer_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, created_at);
    CREATE TABLE IF NOT EXISTS customer_orders (
      id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      items_json TEXT NOT NULL, recipient TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '', fulfillment TEXT NOT NULL, region TEXT NOT NULL,
      distance_km INTEGER NOT NULL DEFAULT 0, subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL, goods_total INTEGER NOT NULL, shipping_fee INTEGER NOT NULL,
      total INTEGER NOT NULL, voucher_codes_json TEXT NOT NULL, tier TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending','paid')),
      points_earned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, paid_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_customer_orders_owner ON customer_orders(customer_id, created_at);
  `)
  const orderColumns = sql.prepare('PRAGMA table_info(customer_orders)').all().map((column) => column.name)
  for (const field of ['recipient', 'phone', 'address']) {
    if (!orderColumns.includes(field)) sql.exec(`ALTER TABLE customer_orders ADD COLUMN ${field} TEXT NOT NULL DEFAULT ''`)
  }

  const customerLimiter = new Map()
  function limited(ip) {
    const time = Date.now()
    const entries = (customerLimiter.get(ip) || []).filter((stamp) => time - stamp < 600000)
    entries.push(time)
    customerLimiter.set(ip, entries)
    if (customerLimiter.size > 5000) customerLimiter.clear()
    return entries.length > 30
  }
  function customer(req, res) {
    const token = parseCookies(req.headers.cookie)[COOKIE]
    if (!token) return null
    const row = sql.prepare(`SELECT c.*, s.expires_at FROM customer_sessions s
      JOIN customers c ON c.id = s.customer_id WHERE s.token_hash = ?`).get(hashToken(token))
    if (!row || row.expires_at <= now().toISOString()) {
      sql.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(hashToken(token))
      clearCookie(res, COOKIE, { secure: config.cookieSecure })
      return null
    }
    return { ...row, rawToken: token, csrfToken: hashToken('customer-csrf:' + token) }
  }
  function requireCustomer(req, res, next) {
    const row = customer(req, res)
    if (!row) return res.status(401).json({ error: 'LOGIN_REQUIRED' })
    req.customer = row
    next()
  }
  function customerCsrf(req, res, next) {
    if (req.get('x-csrf-token') !== req.customer.csrfToken) return res.status(403).json({ error: 'CSRF_INVALID' })
    next()
  }
  function publicCustomer(row) {
    return { id: row.id, username: row.username, email: row.email, points: row.points,
      tier: tierForPoints(row.points), spinCredits: row.spin_credits, csrfToken: row.csrfToken }
  }
  function beginSession(res, row) {
    const token = randomToken()
    sql.prepare('INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)')
      .run(hashToken(token), row.id, new Date(now().getTime() + SESSION_SECONDS * 1000).toISOString())
    setCookie(res, COOKIE, token, { maxAge: SESSION_SECONDS, secure: config.cookieSecure })
    return publicCustomer({ ...row, csrfToken: hashToken('customer-csrf:' + token) })
  }
  function productById(id) {
    const basic = baseProducts.find((item) => String(item.id) === id)
    if (basic) return { ...basic, stockCount: null, discountPercent: 0 }
    const item = sql.prepare('SELECT id, name, category, price, discount_percent AS discountPercent, stock_count AS stockCount FROM catalog_products WHERE id = ?').get(id)
    return item || null
  }
  function issueVoucher(customerId, { label, type, value, expiresAt, source }) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const code = createCode()
      try {
        sql.prepare('INSERT INTO voucher_codes (code, created_at) VALUES (?, ?)').run(code, now().toISOString())
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') continue
        throw error
      }
      sql.prepare(`INSERT INTO customer_vouchers (code, customer_id, label, type, value, expires_at, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(code, customerId, label, type, value, expiresAt, source, now().toISOString())
      return { code, label, type, value, expiresAt, source }
    }
    throw new Error('VOUCHER_CODE_EXHAUSTED')
  }
  function vouchersFor(id) {
    cleanExpired(sql, now().toISOString())
    return sql.prepare('SELECT * FROM customer_vouchers WHERE customer_id = ? ORDER BY created_at DESC').all(id).map(publicVoucher)
  }
  function quote(row, body) {
    if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 99 ||
      !['delivery', 'pickup'].includes(body.fulfillment)) throw new Error('INVALID_ORDER')
    const ids = new Set()
    const items = body.items.map((line) => {
      const id = String(line.id || '')
      if (ids.has(id) || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) throw new Error('INVALID_ORDER')
      ids.add(id)
      const product = productById(id)
      if (!product || product.stockCount === 0 || (product.stockCount !== null && product.stockCount < line.quantity)) throw new Error('PRODUCT_UNAVAILABLE')
      const price = Math.round(product.price * (100 - product.discountPercent) / 1000) * 10
      return { id, name: product.name, quantity: line.quantity, price }
    })
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const tier = tierForPoints(row.points)
    const codes = body.voucherCodes || []
    if (!Array.isArray(codes) || codes.length > 20 || new Set(codes).size !== codes.length) throw new Error('INVALID_VOUCHER')
    cleanExpired(sql, now().toISOString())
    let remaining = subtotal
    for (const code of codes) {
      if (typeof code !== 'string' || !/^[A-Z2-9]{10}$/.test(code)) throw new Error('INVALID_VOUCHER')
      const voucher = sql.prepare('SELECT * FROM customer_vouchers WHERE code = ? AND customer_id = ? AND expires_at > ?').get(code, row.id, now().toISOString())
      if (!voucher) throw new Error('INVALID_VOUCHER')
      const raw = voucher.type === 'amount' ? voucher.value : Math.floor(remaining * voucher.value / 100)
      remaining -= Math.min(remaining, raw)
    }
    const tierRate = { bronze: 0, silver: 1, gold: 2, diamond: 5 }[tier]
    remaining -= Math.min(remaining, Math.floor(remaining * tierRate / 100))
    const discount = subtotal - remaining
    const fulfillment = body.fulfillment
    const region = fulfillment === 'pickup' ? 'pickup' : String(body.region || '')
    const distanceKm = fulfillment === 'pickup' ? 0 : Number(body.distanceKm || 0)
    const fee = shippingFee({ region, distanceKm, fulfillment }, tier)
    return { items, subtotal, discount, goodsTotal: remaining, shippingFee: fee,
      total: remaining + fee, tier, voucherCodes: codes, fulfillment, region, distanceKm }
  }
  function fail(res, error) {
    const code = error.message
    const status = ['INVALID_ORDER', 'PRODUCT_UNAVAILABLE', 'INVALID_VOUCHER', 'INVALID_DELIVERY_REGION'].includes(code) ? 400 : 500
    return res.status(status).json({ error: status === 400 ? code : 'INTERNAL_ERROR' })
  }

  app.use('/api/customer', (req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  app.post('/api/customer/register', (req, res) => {
    if (limited(req.ip)) return res.status(429).json({ error: 'RATE_LIMITED' })
    const username = String(req.body?.username || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const password = req.body?.password
    if (username.length < 2 || username.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      typeof password !== 'string' || password.length < 8 || password.length > 256) return res.status(400).json({ error: 'INVALID_REGISTRATION' })
    const { salt, hash } = hashPassword(password)
    try {
      const result = sql.prepare('INSERT INTO customers (username, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(username, email, salt, hash, now().toISOString())
      res.status(201).json({ account: beginSession(res, { id: result.lastInsertRowid, username, email, points: 0, spin_credits: 0 }) })
    } catch (error) {
      if (error.code?.startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'ACCOUNT_EXISTS' })
      throw error
    }
  })
  app.post('/api/customer/login', (req, res) => {
    if (limited(req.ip)) return res.status(429).json({ error: 'RATE_LIMITED' })
    const login = normalizeUsername(req.body?.username)
    const password = req.body?.password
    if (!login || typeof password !== 'string' || password.length > 256) return res.status(400).json({ error: 'INVALID_CREDENTIALS' })
    const row = sql.prepare('SELECT * FROM customers WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE').get(login, login)
    if (!row || !verifyPassword(password, row.password_salt, row.password_hash)) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    res.json({ account: beginSession(res, row) })
  })
  app.get('/api/customer/session', (req, res) => {
    const row = customer(req, res)
    if (!row) return res.status(401).json({ authenticated: false })
    res.json({ authenticated: true, account: publicCustomer(row) })
  })
  app.post('/api/customer/logout', requireCustomer, customerCsrf, (req, res) => {
    sql.prepare('DELETE FROM customer_sessions WHERE token_hash = ?').run(hashToken(req.customer.rawToken))
    clearCookie(res, COOKIE, { secure: config.cookieSecure })
    res.json({ ok: true })
  })
  app.get('/api/customer/vouchers', requireCustomer, (req, res) => res.json({ vouchers: vouchersFor(req.customer.id) }))
  app.get('/api/customer/favorites', requireCustomer, (req, res) => {
    res.json({ ids: sql.prepare('SELECT product_id FROM customer_favorites WHERE customer_id = ? ORDER BY created_at DESC').all(req.customer.id).map((item) => item.product_id) })
  })
  app.put('/api/customer/favorites/:id', requireCustomer, customerCsrf, (req, res) => {
    const id = String(req.params.id)
    if (!productById(id)) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' })
    sql.prepare('INSERT OR IGNORE INTO customer_favorites (customer_id, product_id, created_at) VALUES (?, ?, ?)').run(req.customer.id, id, now().toISOString())
    res.json({ saved: true })
  })
  app.delete('/api/customer/favorites/:id', requireCustomer, customerCsrf, (req, res) => {
    sql.prepare('DELETE FROM customer_favorites WHERE customer_id = ? AND product_id = ?').run(req.customer.id, req.params.id)
    res.json({ saved: false })
  })
  app.get('/api/storefront/products/:id/reviews', (req, res) => {
    const id = String(req.params.id)
    if (!productById(id)) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' })
    const rows = sql.prepare(`SELECT r.id, r.rating, r.comment, r.admin_reply AS adminReply,
      r.created_at AS createdAt, r.replied_at AS repliedAt, c.username
      FROM product_reviews r JOIN customers c ON c.id = r.customer_id
      WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 200`).all(id)
    res.json({ reviews: rows, total: rows.length })
  })
  app.post('/api/storefront/products/:id/reviews', requireCustomer, customerCsrf, (req, res) => {
    const id = String(req.params.id)
    const rating = req.body?.rating
    const comment = String(req.body?.comment || '').trim()
    if (!productById(id)) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' })
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) return res.status(400).json({ error: 'INVALID_REVIEW' })
    sql.prepare(`INSERT INTO product_reviews (customer_id, product_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(customer_id, product_id) DO UPDATE SET rating=excluded.rating,
      comment=excluded.comment, admin_reply='', replied_at=NULL, created_at=excluded.created_at`).run(req.customer.id, id, rating, comment, now().toISOString())
    res.json({ ok: true })
  })
  app.post('/api/customer/spin', requireCustomer, customerCsrf, (req, res) => {
    const outcome = sql.transaction(() => {
      const current = sql.prepare('SELECT spin_credits FROM customers WHERE id = ?').get(req.customer.id)
      if (current.spin_credits < 1) return null
      sql.prepare('UPDATE customers SET spin_credits = spin_credits - 1 WHERE id = ?').run(req.customer.id)
      const index = randomInt(PRIZES.length)
      const prize = PRIZES[index]
      const voucher = prize.kind === 'none' ? null : issueVoucher(req.customer.id, {
        label: prize.label, type: prize.kind, value: prize.value,
        expiresAt: new Date(now().getTime() + 30 * 86400000).toISOString(), source: 'wheel',
      })
      return { index, prize: prize.label, voucher, spinCredits: current.spin_credits - 1 }
    })()
    if (!outcome) return res.status(409).json({ error: 'NO_SPIN_CREDITS' })
    res.json(outcome)
  })
  app.post('/api/customer/quote', requireCustomer, customerCsrf, (req, res) => {
    try { res.json(quote(req.customer, req.body)) } catch (error) { fail(res, error) }
  })
  app.post('/api/customer/orders', requireCustomer, customerCsrf, (req, res) => {
    try {
      const recipient = String(req.body?.recipient || '').trim()
      const phone = String(req.body?.phone || '').trim()
      const address = String(req.body?.address || '').trim()
      if (recipient.length < 2 || recipient.length > 100 || !/^[+0-9 ()-]{9,20}$/.test(phone) ||
        (req.body?.fulfillment === 'delivery' && (address.length < 5 || address.length > 300))) throw new Error('INVALID_ORDER')
      const order = sql.transaction(() => {
        const fresh = sql.prepare('SELECT * FROM customers WHERE id = ?').get(req.customer.id)
        const data = quote(fresh, req.body)
        const id = 'ST-' + randomUUID().slice(0, 12).toUpperCase()
        const createdAt = now().toISOString()
        sql.prepare(`INSERT INTO customer_orders (id, customer_id, items_json, recipient, phone, address, fulfillment, region, distance_km,
          subtotal, discount, goods_total, shipping_fee, total, voucher_codes_json, tier, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`).run(id, fresh.id,
          JSON.stringify(data.items), recipient, phone, address, data.fulfillment, data.region, data.distanceKm, data.subtotal,
          data.discount, data.goodsTotal, data.shippingFee, data.total, JSON.stringify(data.voucherCodes), data.tier, createdAt)
        for (const code of data.voucherCodes) sql.prepare('DELETE FROM customer_vouchers WHERE customer_id = ? AND code = ?').run(fresh.id, code)
        return { id, ...data, status: 'pending', createdAt, pointsEarned: 0 }
      })()
      res.status(201).json({ order })
    } catch (error) { fail(res, error) }
  })
  app.get('/api/customer/orders', requireCustomer, (req, res) => {
    const orders = sql.prepare('SELECT * FROM customer_orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100').all(req.customer.id)
      .map((item) => ({ id: item.id, items: JSON.parse(item.items_json), itemCount: JSON.parse(item.items_json).reduce((sum, line) => sum + line.quantity, 0),
        fulfillment: item.fulfillment, subtotal: item.subtotal, discount: item.discount, goodsTotal: item.goods_total,
        shippingFee: item.shipping_fee, total: item.total, voucherCodes: JSON.parse(item.voucher_codes_json),
        tier: item.tier, status: item.status, pointsEarned: item.points_earned, createdAt: item.created_at }))
    res.json({ orders })
  })
  app.get('/api/admin/customers', requireAdmin, (req, res) => {
    const customers = sql.prepare(`SELECT id, username, email, points, paid_goods_total AS paidGoodsTotal,
      spin_credits AS spinCredits, created_at AS createdAt FROM customers ORDER BY points DESC, id ASC`).all()
      .map((item) => ({ ...item, tier: tierForPoints(item.points) }))
    res.json({ customers })
  })
  app.post('/api/admin/customers/:id/vouchers', requireAdmin, requireCsrf, (req, res) => {
    const customerId = Number(req.params.id)
    const type = req.body?.type
    const value = req.body?.value
    const date = new Date(req.body?.expiresAt)
    if (!sql.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)) return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND' })
    if (!['amount', 'percent'].includes(type) || !Number.isInteger(value) || value < 1 || value > (type === 'percent' ? 100 : 10000000) ||
      !Number.isFinite(date.getTime()) || date <= now() || date.getTime() > now().getTime() + 365 * 86400000) return res.status(400).json({ error: 'INVALID_VOUCHER' })
    const label = type === 'amount' ? `Giảm ${new Intl.NumberFormat('vi-VN').format(value)} ₫` : `Giảm ${value}%`
    res.status(201).json({ voucher: issueVoucher(customerId, { label, type, value, expiresAt: date.toISOString(), source: 'admin' }) })
  })
  app.get('/api/admin/favorites', requireAdmin, (req, res) => {
    const favorites = sql.prepare('SELECT product_id AS id, COUNT(*) AS count FROM customer_favorites GROUP BY product_id ORDER BY count DESC, product_id').all()
      .map((item) => ({ ...item, name: productById(item.id)?.name || item.id }))
    res.json({ favorites })
  })
  app.get('/api/admin/reviews', requireAdmin, (req, res) => {
    const reviews = sql.prepare(`SELECT r.id, r.product_id AS productId, r.rating, r.comment,
      r.admin_reply AS adminReply, r.created_at AS createdAt, c.username
      FROM product_reviews r JOIN customers c ON c.id = r.customer_id ORDER BY r.created_at DESC`).all()
      .map((item) => ({ ...item, productName: productById(item.productId)?.name || item.productId }))
    res.json({ reviews })
  })
  app.patch('/api/admin/reviews/:id/reply', requireAdmin, requireCsrf, (req, res) => {
    const reply = String(req.body?.reply || '').trim()
    if (reply.length < 1 || reply.length > 2000) return res.status(400).json({ error: 'INVALID_REPLY' })
    const result = sql.prepare('UPDATE product_reviews SET admin_reply = ?, replied_at = ? WHERE id = ?').run(reply, now().toISOString(), Number(req.params.id))
    if (!result.changes) return res.status(404).json({ error: 'REVIEW_NOT_FOUND' })
    res.json({ ok: true, reply })
  })
  app.get('/api/admin/customer-orders', requireAdmin, (req, res) => {
    const orders = sql.prepare(`SELECT o.id, o.recipient, o.phone, o.address, o.region,
      o.distance_km AS distanceKm, o.goods_total AS goodsTotal, o.shipping_fee AS shippingFee,
      o.total, o.status, o.created_at AS createdAt, o.points_earned AS pointsEarned, c.username
      FROM customer_orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT 200`).all()
    res.json({ orders })
  })
  app.post('/api/admin/customer-orders/:id/paid', requireAdmin, requireCsrf, (req, res) => {
    const result = sql.transaction(() => {
      const order = sql.prepare('SELECT * FROM customer_orders WHERE id = ?').get(req.params.id)
      if (!order) return null
      if (order.status === 'paid') return { alreadyPaid: true, pointsEarned: order.points_earned }
      const account = sql.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id)
      const tier = tierForPoints(account.points)
      const pointsEarned = pointsForPaidGoods(order.goods_total, tier)
      const before = Math.floor(account.paid_goods_total / 100000)
      const after = Math.floor((account.paid_goods_total + order.goods_total) / 100000)
      sql.prepare('UPDATE customers SET points = points + ?, paid_goods_total = paid_goods_total + ?, spin_credits = spin_credits + ? WHERE id = ?')
        .run(pointsEarned, order.goods_total, after - before, account.id)
      sql.prepare("UPDATE customer_orders SET status = 'paid', paid_at = ?, points_earned = ? WHERE id = ?")
        .run(now().toISOString(), pointsEarned, order.id)
      return { alreadyPaid: false, pointsEarned, spinCreditsAdded: after - before }
    })()
    if (!result) return res.status(404).json({ error: 'ORDER_NOT_FOUND' })
    res.json(result)
  })
  return { requireCustomer, customerCsrf }
}
