import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

const DEMO_ORDERS = Object.freeze([
  ['DEMO-1001', '2026-09-01', 'completed', 890000, 0, 1],
  ['DEMO-1002', '2026-09-03', 'paid', 249000, 0, 1],
  ['DEMO-1003', '2026-09-07', 'completed', 1290000, 159000, 1],
  ['DEMO-1004', '2026-09-09', 'cancelled', 159000, 0, 1],
])

function nowIso() {
  return new Date().toISOString()
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export class StoreDb {
  constructor(path, { seedDemoData = false } = {}) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.#migrate()
    this.#seedCatalogSnapshot(path)
    if (seedDemoData) {
      this.seedDemoOrders()
      this.seedDemoOperations()
    }
  }

  close() {
    if (this.backendOwner) {
      this.db.prepare('DELETE FROM backend_owner WHERE token = ?').run(this.backendOwner)
    }
    this.db.close()
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backend_owner (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        pid INTEGER NOT NULL,
        token TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK(kind IN ('support', 'admin')),
        owner_key TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        memory_json TEXT NOT NULL DEFAULT '{}',
        compact_status TEXT NOT NULL DEFAULT 'not_needed',
        last_compacted_message_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_owner
        ON conversations(kind, owner_key, updated_at);

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 1,
        sources_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id, id);

      CREATE TABLE IF NOT EXISTS chat_turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        owner_key TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('support', 'admin')),
        conversation_id TEXT NOT NULL,
        user_message_id INTEGER NOT NULL,
        assistant_message_id INTEGER,
        user_content TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'stopped')),
        assistant_content TEXT NOT NULL DEFAULT '',
        sources_json TEXT NOT NULL DEFAULT '[]',
        report_json TEXT NOT NULL DEFAULT 'null',
        verified_json TEXT NOT NULL DEFAULT 'null',
        error_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_key, request_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_turns_conversation
        ON chat_turns(conversation_id, id);

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        business_date TEXT NOT NULL,
        status TEXT NOT NULL,
        total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
        refund_amount INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS catalog_products (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL CHECK(price >= 0),
        description TEXT NOT NULL,
        image TEXT NOT NULL,
        features_json TEXT NOT NULL DEFAULT '[]',
        tone TEXT NOT NULL,
        symbol TEXT NOT NULL,
        label TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_price_cents INTEGER NOT NULL CHECK(source_price_cents >= 0),
        source_currency TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        UNIQUE(source, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products(category, name);
      CREATE TABLE IF NOT EXISTS product_views (
        product_id TEXT PRIMARY KEY,
        view_count INTEGER NOT NULL DEFAULT 0 CHECK(view_count >= 0)
      );
      CREATE TABLE IF NOT EXISTS admin_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module TEXT NOT NULL,
        title TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'Đang dùng',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_records_module ON admin_records(module, updated_at);
    `)

    const columns = this.db.prepare('PRAGMA table_info(conversations)').all().map((column) => column.name)
    if (!columns.includes('memory_json')) {
      this.db.exec("ALTER TABLE conversations ADD COLUMN memory_json TEXT NOT NULL DEFAULT '{}'")
    }
    const turnColumns = this.db.prepare('PRAGMA table_info(chat_turns)').all().map((column) => column.name)
    if (!turnColumns.includes('assistant_message_id')) this.db.exec('ALTER TABLE chat_turns ADD COLUMN assistant_message_id INTEGER')
    const productColumns = this.db.prepare('PRAGMA table_info(catalog_products)').all().map((column) => column.name)
    if (!productColumns.includes('discount_percent')) {
      this.db.exec('ALTER TABLE catalog_products ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 90)')
      this.db.prepare('UPDATE catalog_products SET discount_percent = 15 WHERE id IN (SELECT id FROM catalog_products ORDER BY rowid LIMIT 8)').run()
    }
    // Every sellable catalog row has a concrete stock value. Older databases
    // used a nullable column to mean "unknown"; migrate those rows to the
    // documented default instead of exposing an unlimited/unknown quantity.
    if (!productColumns.includes('stock_count')) {
      this.db.exec('ALTER TABLE catalog_products ADD COLUMN stock_count INTEGER NOT NULL DEFAULT 20 CHECK(stock_count >= 0)')
    } else {
      this.db.prepare('UPDATE catalog_products SET stock_count = 20 WHERE stock_count IS NULL').run()
    }
  }

  claimBackend() {
    const token = randomUUID()
    this.db.transaction(() => {
      const owner = this.db.prepare('SELECT * FROM backend_owner WHERE singleton = 1').get()
      if (owner) {
        let alive = true
        try { process.kill(owner.pid, 0) } catch (error) {
          if (error.code === 'ESRCH') alive = false
        }
        if (alive) throw new Error('Database đang thuộc một backend còn hoạt động; không phục hồi lượt chat.')
      }
      this.db.prepare('INSERT OR REPLACE INTO backend_owner (singleton, pid, token) VALUES (1, ?, ?)').run(process.pid, token)
      this.db.prepare(`
      UPDATE chat_turns
      SET status = 'failed', error_code = 'SERVER_RESTART', updated_at = ?
      WHERE status = 'running'
      `).run(nowIso())
    }).immediate()
    this.backendOwner = token
  }

  seedDemoOrders() {
    const insert = this.db.prepare(
      'INSERT OR IGNORE INTO orders (id, business_date, status, total_amount, refund_amount, is_demo) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const transaction = this.db.transaction((rows) => {
      for (const row of rows) insert.run(...row)
    })
    transaction(DEMO_ORDERS)
  }

  seedDemoOperations() {
    const rows = [
      ['inventory', 'Nhập kho tuần 39', { kind: 'Nhập', warehouse: 'Kho trung tâm', quantity: '240' }, 'Đã duyệt'],
      ['inventory', 'Xuất kho đơn demo', { kind: 'Xuất', warehouse: 'Kho trung tâm', quantity: '36' }, 'Đang xử lý'],
      ['logistics', 'Tuyến TP.HCM → Bình Dương', { route: 'Nội thành', progress: 'Đang giao', updated: 'Hôm nay 09:30' }, 'Đang dùng'],
      ['logistics', 'Tuyến TP.HCM → Hà Nội', { route: 'Liên tỉnh', progress: 'Chờ lấy hàng', updated: 'Hôm qua 16:10' }, 'Chờ duyệt'],
      ['order-types', 'Đơn giao tận nơi', { priority: 'Cao', sla: '24 giờ', note: 'Ưu tiên hàng đã thanh toán' }, 'Đang dùng'],
      ['staff', 'Nguyễn Minh An', { role: 'Điều phối', shift: '08:00 – 17:00', login: 'an.store' }, 'Đang dùng'],
      ['staff', 'Trần Gia Hân', { role: 'CSKH', shift: '13:00 – 21:00', login: 'han.store' }, 'Đang dùng'],
      ['overtime', 'Trực cuối tuần', { kind: 'Tăng ca', value: '4 giờ', note: 'Hỗ trợ chốt đơn' }, 'Chờ duyệt'],
      ['support', 'CSKH · Đổi sản phẩm', { customer: 'tam.demo', topic: 'Đổi sản phẩm lỗi', assignee: 'Trần Gia Hân' }, 'Đang xử lý'],
    ]
    const exists = this.db.prepare('SELECT 1 FROM admin_records WHERE module = ? AND title = ?')
    const insert = this.db.prepare('INSERT INTO admin_records (module, title, data_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    const now = nowIso()
    this.db.transaction(() => {
      for (const [module, title, data, status] of rows) {
        if (!exists.get(module, title)) insert.run(module, title, JSON.stringify(data), status, now, now)
      }
    })()
  }

  #seedCatalogSnapshot(databasePath) {
    const snapshotPath = resolve(dirname(databasePath), 'catalog-products.json')
    if (!existsSync(snapshotPath)) return
    try {
      const products = JSON.parse(readFileSync(snapshotPath, 'utf8'))
      if (!Array.isArray(products) || products.length === 0) return
      const current = this.db.prepare('SELECT COUNT(*) AS count FROM catalog_products').get().count
      if (current < products.length) this.upsertCatalogProducts(products)
    } catch {
      // A corrupt optional snapshot must not prevent the backend from starting.
    }
  }

  upsertCatalogProducts(products) {
    const upsert = this.db.prepare(`
      INSERT INTO catalog_products (
        id, source, source_id, name, category, price, description, image,
        features_json, tone, symbol, label, source_url, source_price_cents,
        source_currency, imported_at, discount_percent, stock_count
      ) VALUES (
        @id, @source, @sourceId, @name, @category, @price, @description, @image,
        @featuresJson, @tone, @symbol, @label, @sourceUrl, @sourcePriceCents,
        @sourceCurrency, @importedAt, @discountPercent, @stockCount
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, category = excluded.category, price = excluded.price,
        description = excluded.description, image = excluded.image,
        features_json = excluded.features_json, tone = excluded.tone,
        symbol = excluded.symbol, label = excluded.label, source_url = excluded.source_url,
        source_price_cents = excluded.source_price_cents,
        source_currency = excluded.source_currency, imported_at = excluded.imported_at
    `)
    this.db.transaction((items) => {
      for (const [index, product] of items.entries()) {
        upsert.run({
          ...product,
          featuresJson: JSON.stringify(product.features),
          discountPercent: product.discountPercent ?? (index < 8 ? 15 : 0),
          stockCount: Number.isInteger(product.stockCount) && product.stockCount >= 0 ? product.stockCount : 20,
        })
      }
    })(products)
  }

  listCatalogProducts() {
    return this.db.prepare('SELECT p.*, COALESCE(v.view_count, 0) AS view_count FROM catalog_products p LEFT JOIN product_views v ON v.product_id = p.id ORDER BY p.category, p.name').all().map((row) => ({
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      name: row.name,
      category: row.category,
      price: row.price,
      description: row.description,
      image: row.image,
      features: parseJson(row.features_json, []),
      tone: row.tone,
      symbol: row.symbol,
      label: row.label,
      sourceUrl: row.source_url,
      sourcePriceCents: row.source_price_cents,
      sourceCurrency: row.source_currency,
      importedAt: row.imported_at,
      discountPercent: row.discount_percent,
      stockCount: row.stock_count,
      viewCount: row.view_count,
    }))
  }

  storefrontCatalog({ details = false } = {}) {
    if (details) return this.listCatalogProducts()
    const rows = this.db.prepare('SELECT p.id, p.discount_percent, p.stock_count, COALESCE(v.view_count, 0) AS view_count FROM catalog_products p LEFT JOIN product_views v ON v.product_id = p.id').all()
    const featured = this.db.prepare("SELECT product_id AS id, view_count FROM product_views WHERE product_id IN ('1', '2', '3', '4')").all()
    const result = new Map(rows.map((row) => [String(row.id), { id: row.id, discountPercent: row.discount_percent, stockCount: row.stock_count, viewCount: row.view_count }]))
    for (const row of featured) if (!result.has(String(row.id))) result.set(String(row.id), { id: row.id, discountPercent: 0, stockCount: 20, viewCount: row.view_count })
    return [...result.values()]
  }

  updateCatalogOffer(id, { discountPercent, stockCount }) {
    const result = this.db.prepare('UPDATE catalog_products SET discount_percent = ?, stock_count = ? WHERE id = ?').run(discountPercent, stockCount, id)
    return result.changes > 0
  }

  getCatalogProduct(id) {
    return this.listCatalogProducts().find((product) => String(product.id) === String(id)) || null
  }

  updateCatalogProduct(id, patch) {
    const columns = { name: 'name', category: 'category', price: 'price', description: 'description', image: 'image', label: 'label', source_url: 'source_url', stockCount: 'stock_count' }
    const entries = Object.keys(columns).filter((key) => patch[key] !== undefined)
    if (!entries.length) return this.getCatalogProduct(id)
    const assignments = entries.map((key) => `${columns[key]} = ?`).join(', ')
    const values = entries.map((key) => patch[key])
    const result = this.db.prepare(`UPDATE catalog_products SET ${assignments} WHERE id = ?`).run(...values, id)
    return result.changes ? this.getCatalogProduct(id) : null
  }

  deleteCatalogProduct(id) {
    return this.db.prepare('DELETE FROM catalog_products WHERE id = ?').run(id).changes > 0
  }

  listAdminRecords(module) {
    return this.db.prepare('SELECT id, module, title, data_json, status, created_at, updated_at FROM admin_records WHERE module = ? ORDER BY updated_at DESC, id DESC').all(module).map((row) => ({
      id: row.id, module: row.module, title: row.title, data: parseJson(row.data_json, {}), status: row.status,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }))
  }

  createAdminRecord({ module, title, data = {}, status = 'Đang dùng' }) {
    const timestamp = nowIso()
    const result = this.db.prepare('INSERT INTO admin_records (module, title, data_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(module, title, JSON.stringify(data), status, timestamp, timestamp)
    return { id: result.lastInsertRowid, module, title, data, status, createdAt: timestamp, updatedAt: timestamp }
  }

  updateAdminRecord(id, { module, title, data = {}, status = 'Đang dùng' }) {
    const timestamp = nowIso()
    const result = this.db.prepare('UPDATE admin_records SET module = ?, title = ?, data_json = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(module, title, JSON.stringify(data), status, timestamp, id)
    return result.changes ? { id: Number(id), module, title, data, status, updatedAt: timestamp } : null
  }

  deleteAdminRecord(id) {
    return this.db.prepare('DELETE FROM admin_records WHERE id = ?').run(id).changes > 0
  }

  adminOverview() {
    const count = (table) => {
      try { return this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count } catch { return 0 }
    }
    const revenueByDay = this.db.prepare(`
      SELECT business_date AS date,
        COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN total_amount - refund_amount ELSE 0 END), 0) AS revenue,
        SUM(CASE WHEN status IN ('paid','completed') THEN 1 ELSE 0 END) AS orders
      FROM orders GROUP BY business_date ORDER BY business_date ASC
    `).all().map((row) => ({ date: row.date, revenue: Number(row.revenue || 0), orders: Number(row.orders || 0) }))
    // Customer checkout orders live in a separate table from the legacy
    // operations/demo order ledger. Include both sources so the dashboard
    // reflects real payments after an admin marks a customer order paid.
    let customerRevenueByDay = []
    try {
      customerRevenueByDay = this.db.prepare(`
        SELECT substr(COALESCE(paid_at, created_at), 1, 10) AS date,
          COALESCE(SUM(CASE WHEN status IN ('paid','completed') THEN total ELSE 0 END), 0) AS revenue,
          SUM(CASE WHEN status IN ('paid','completed') THEN 1 ELSE 0 END) AS orders
        FROM customer_orders
        GROUP BY substr(COALESCE(paid_at, created_at), 1, 10)
        ORDER BY date ASC
      `).all().map((row) => ({ date: row.date, revenue: Number(row.revenue || 0), orders: Number(row.orders || 0) }))
    } catch {
      // customer_orders is created by the customer route migration; an
      // early direct StoreDb consumer may not have run that migration yet.
    }
    const byDate = new Map()
    for (const item of [...revenueByDay, ...customerRevenueByDay]) {
      const current = byDate.get(item.date) || { date: item.date, revenue: 0, orders: 0 }
      current.revenue += item.revenue
      current.orders += item.orders
      byDate.set(item.date, current)
    }
    const combinedRevenueByDay = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
    const revenue = combinedRevenueByDay.reduce((sum, item) => sum + item.revenue, 0)
    const includedOrders = combinedRevenueByDay.reduce((sum, item) => sum + item.orders, 0)
    const customerOrders = count('customer_orders')
    const legacyOrders = count('orders')
    let orderStatus = ['pending', 'paid', 'completed', 'cancelled'].map((status) => ({
      status, count: this.db.prepare('SELECT COUNT(*) AS count FROM orders WHERE status = ?').get(status).count,
    }))
    try {
      const customerStatus = this.db.prepare('SELECT status, COUNT(*) AS count FROM customer_orders GROUP BY status').all()
      const counts = new Map(orderStatus.map((item) => [item.status, Number(item.count || 0)]))
      for (const item of customerStatus) counts.set(item.status, (counts.get(item.status) || 0) + Number(item.count || 0))
      orderStatus = [...counts.entries()].map(([status, value]) => ({ status, count: value }))
    } catch {
      // Keep the legacy status report when customer routes are not migrated.
    }
    return {
      products: count('catalog_products'), customers: count('customers'), orders: legacyOrders + customerOrders,
      customerOrders, legacyOrders,
      reviews: count('product_reviews'), favorites: count('customer_favorites'), records: count('admin_records'),
      openSupport: this.db.prepare("SELECT COUNT(*) AS count FROM conversations WHERE kind = 'support'").get()?.count || 0,
      totalViews: this.totalProductViews(), revenue, includedOrders,
      revenueByDay: combinedRevenueByDay, orderStatus,
    }
  }

  recordProductView(id) {
    const exists = /^[1-4]$/.test(id) || Boolean(this.db.prepare('SELECT 1 FROM catalog_products WHERE id = ?').get(id))
    if (!exists) return null
    this.db.prepare('INSERT INTO product_views (product_id, view_count) VALUES (?, 1) ON CONFLICT(product_id) DO UPDATE SET view_count = view_count + 1').run(id)
    return this.db.prepare('SELECT view_count FROM product_views WHERE product_id = ?').get(id).view_count
  }

  getProductViewCount(id) {
    return this.db.prepare('SELECT view_count FROM product_views WHERE product_id = ?').get(id)?.view_count || 0
  }

  totalProductViews() {
    return this.db.prepare('SELECT COALESCE(SUM(view_count), 0) AS total FROM product_views').get().total
  }

  clearOrders() {
    this.db.prepare('DELETE FROM orders').run()
  }

  insertOrder({ id, businessDate, status, totalAmount, refundAmount = 0, isDemo = false }) {
    this.db.prepare(`
      INSERT INTO orders (id, business_date, status, total_amount, refund_amount, is_demo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, businessDate, status, totalAmount, refundAmount, isDemo ? 1 : 0)
  }

  getSetting(key) {
    return this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null
  }

  setSetting(key, value) {
    const now = nowIso()
    this.db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(value), now)
  }

  createAdmin({ username, passwordSalt, passwordHash }) {
    return this.db.prepare(
      'INSERT INTO admins (username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?)',
    ).run(username, passwordSalt, passwordHash, nowIso())
  }

  getAdminByUsername(username) {
    return this.db.prepare('SELECT * FROM admins WHERE username = ? COLLATE NOCASE').get(username) ?? null
  }

  createAdminSession({ tokenHash, adminId, expiresAt }) {
    this.db.prepare(
      'INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    ).run(tokenHash, adminId, expiresAt, nowIso())
  }

  getAdminSession(tokenHash) {
    return this.db.prepare(`
      SELECT s.token_hash, s.expires_at, a.id AS admin_id, a.username
      FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = ?
    `).get(tokenHash) ?? null
  }

  expireAdminSessionForTest(tokenHash) {
    this.db.prepare('UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ?').run('2000-01-01T00:00:00.000Z', tokenHash)
  }

  deleteAdminSession(tokenHash) {
    this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash)
  }

  cleanupExpiredSessions() {
    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(nowIso())
  }

  createConversation({ kind, ownerKey }) {
    const now = nowIso()
    const conversation = {
      id: randomUUID(),
      kind,
      owner_key: ownerKey,
      summary: '',
      memory_json: '{}',
      compact_status: 'not_needed',
      last_compacted_message_id: 0,
      created_at: now,
      updated_at: now,
    }
    this.db.prepare(`
      INSERT INTO conversations
        (id, kind, owner_key, summary, memory_json, compact_status, last_compacted_message_id, created_at, updated_at)
      VALUES
        (@id, @kind, @owner_key, @summary, @memory_json, @compact_status, @last_compacted_message_id, @created_at, @updated_at)
    `).run(conversation)
    return conversation
  }

  getConversation(id) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) ?? null
  }

  getMessages(conversationId) {
    return this.db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    ).all(conversationId)
  }

  getPublicHistory(conversationId) {
    const messages = this.getMessages(conversationId)
    const turns = this.db.prepare('SELECT * FROM chat_turns WHERE conversation_id = ? ORDER BY id').all(conversationId)
    const linked = new Set(turns.map((turn) => turn.user_message_id))
    const assistantIds = new Set()
    for (const turn of turns) {
      if (turn.status !== 'completed') continue
      if (turn.assistant_message_id) { assistantIds.add(turn.assistant_message_id); continue }
      const nextUser = messages.find((message) => message.id > turn.user_message_id && message.role === 'user')
      const reply = messages.find((message) => message.id > turn.user_message_id &&
        (!nextUser || message.id < nextUser.id) && message.role === 'assistant' && message.content === turn.assistant_content)
      if (reply) assistantIds.add(reply.id)
    }
    const result = []
    // Preserve historical messages created before turn metadata existed.
    for (const message of messages) {
      if (message.role === 'user' && linked.has(message.id)) continue
      if (assistantIds.has(message.id)) continue
      result.push({ ...message, sources: parseJson(message.sources_json, []), status: 'complete', position: message.id })
    }
    for (const turn of turns) {
      result.push({ id: turn.user_message_id, role: 'user', content: turn.user_content, sources: [], status: 'complete', position: turn.user_message_id })
      result.push({
        id: 'turn-' + turn.id, role: 'assistant', content: turn.assistant_content,
        sources: parseJson(turn.sources_json, []), verified: parseJson(turn.verified_json, null),
        report: parseJson(turn.report_json, null),
        status: turn.status === 'completed' ? 'complete' : turn.status === 'failed' ? 'error' : turn.status === 'running' ? 'pending' : 'stopped',
        requestId: turn.request_id, retryContent: turn.user_content,
        error: turn.error_code ? 'Lượt trước chưa hoàn tất. Bạn có thể thử lại.' : '',
        position: turn.user_message_id + 0.5,
      })
    }
    return result.sort((a, b) => a.position - b.position).map((message) => {
      const copy = { ...message }
      delete copy.position
      return copy
    })
  }

  addMessage({ conversationId, role, content, sources = [], completed = true }) {
    const now = nowIso()
    const result = this.db.prepare(`
      INSERT INTO messages (conversation_id, role, content, completed, sources_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(conversationId, role, content, completed ? 1 : 0, JSON.stringify(sources), now)
    this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId)
    return Number(result.lastInsertRowid)
  }

  getTurn(ownerKey, requestId) {
    return this.db.prepare(
      'SELECT * FROM chat_turns WHERE owner_key = ? AND request_id = ?',
    ).get(ownerKey, requestId) ?? null
  }

  startTurn({ ownerKey, kind, conversationId, requestId, message }) {
    const transaction = this.db.transaction(() => {
      const existing = this.getTurn(ownerKey, requestId)
      if (existing) {
        if (existing.kind !== kind || existing.user_content !== message) {
          return { state: 'conflict', turn: existing }
        }
        if (conversationId && existing.conversation_id !== conversationId) {
          return { state: 'conflict', turn: existing }
        }
        if (existing.status === 'completed') return { state: 'completed', turn: existing }
        if (existing.status === 'running') return { state: 'running', turn: existing }
        this.db.prepare(`
          UPDATE chat_turns
          SET status = 'running', assistant_content = '', sources_json = '[]', report_json = 'null',
              verified_json = 'null', error_code = NULL, updated_at = ?
          WHERE id = ?
        `).run(nowIso(), existing.id)
        return { state: 'retry', turn: this.db.prepare('SELECT * FROM chat_turns WHERE id = ?').get(existing.id) }
      }

      let conversation
      if (conversationId) {
        conversation = this.getConversation(conversationId)
        if (!conversation || conversation.kind !== kind || conversation.owner_key !== ownerKey) {
          return { state: 'conversation_not_found', turn: null }
        }
      } else {
        conversation = this.createConversation({ kind, ownerKey })
      }

      const userMessageId = this.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: message,
      })
      const now = nowIso()
      const result = this.db.prepare(`
        INSERT INTO chat_turns
          (request_id, owner_key, kind, conversation_id, user_message_id, user_content, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)
      `).run(requestId, ownerKey, kind, conversation.id, userMessageId, message, now, now)
      const turn = this.db.prepare('SELECT * FROM chat_turns WHERE id = ?').get(Number(result.lastInsertRowid))
      return { state: 'created', turn }
    })
    return transaction()
  }

  completeTurn({ turnId, content, sources = [], report = null, verified = null }) {
    const transaction = this.db.transaction(() => {
      const turn = this.db.prepare('SELECT * FROM chat_turns WHERE id = ?').get(turnId)
      if (!turn || turn.status !== 'running') return false
      const assistantMessageId = this.addMessage({
        conversationId: turn.conversation_id,
        role: 'assistant',
        content,
        sources,
        completed: true,
      })
      this.db.prepare(`
        UPDATE chat_turns
        SET status = 'completed', assistant_content = ?, sources_json = ?, report_json = ?, verified_json = ?, assistant_message_id = ?,
            error_code = NULL, updated_at = ?
        WHERE id = ?
      `).run(content, JSON.stringify(sources), JSON.stringify(report), JSON.stringify(verified), assistantMessageId, nowIso(), turnId)
      return true
    })
    return transaction()
  }

  failTurn(turnId, { status = 'failed', errorCode = 'AI_ERROR', partialContent = '' } = {}) {
    this.db.prepare(`
      UPDATE chat_turns
      SET status = ?, assistant_content = ?, error_code = ?, updated_at = ?
      WHERE id = ? AND status = 'running'
    `).run(status, partialContent, errorCode, nowIso(), turnId)
  }

  getConversationMemory(conversation) {
    return parseJson(conversation?.memory_json || '{}', {})
  }

  updateCompact({ conversationId, summary, memory, status, lastCompactedMessageId }) {
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE conversations
        SET summary = ?, memory_json = ?, compact_status = ?, last_compacted_message_id = ?, updated_at = ?
        WHERE id = ?
      `).run(summary, JSON.stringify(memory), status, lastCompactedMessageId, nowIso(), conversationId)
    })
    transaction()
  }

  markCompactFailure(conversationId) {
    this.db.prepare(`
      UPDATE conversations SET compact_status = 'failed', updated_at = ? WHERE id = ?
    `).run(nowIso(), conversationId)
  }

  calculateRevenue({ from, to }) {
    const row = this.db.prepare(`
      SELECT
        COUNT(*) AS all_orders,
        SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END) AS included_orders,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount ELSE 0 END), 0) AS gross_revenue,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN refund_amount ELSE 0 END), 0) AS refunds,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN total_amount - refund_amount ELSE 0 END), 0) AS net_revenue,
        SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) AS demo_orders,
        SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END) AS real_orders
      FROM orders
      WHERE business_date BETWEEN ? AND ?
    `).get(from, to)

    const allOrders = Number(row.all_orders || 0)
    const demoOrders = Number(row.demo_orders || 0)
    const realOrders = Number(row.real_orders || 0)
    let dataMode = 'none'
    if (allOrders > 0 && demoOrders === allOrders) dataMode = 'demo'
    else if (allOrders > 0 && realOrders === allOrders) dataMode = 'real'
    else if (allOrders > 0) dataMode = 'mixed'

    return {
      from,
      to,
      timezone: 'Asia/Ho_Chi_Minh',
      includedStatuses: ['paid', 'completed'],
      excludedStatuses: ['cancelled'],
      allOrders,
      includedOrders: Number(row.included_orders || 0),
      grossRevenue: Number(row.gross_revenue || 0),
      refunds: Number(row.refunds || 0),
      netRevenue: Number(row.net_revenue || 0),
      currency: 'VND',
      dataMode,
    }
  }
}
