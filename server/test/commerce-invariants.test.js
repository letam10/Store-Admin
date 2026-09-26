import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { StoreDb } from '../src/db.js'
import { hashPassword } from '../src/security.js'

function cookiePair(response) { return response.headers.get('set-cookie')?.split(';')[0] || '' }

async function withServer(run) {
  const directory = mkdtempSync(join(tmpdir(), 'store-commerce-invariant-'))
  const storeDb = new StoreDb(join(directory, 'test.sqlite'))
  const { app } = createApp({ storeDb, now: () => new Date('2026-09-26T00:00:00.000Z') })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const root = 'http://127.0.0.1:' + server.address().port
  try { await run({ root, storeDb }) }
  finally {
    await new Promise((resolve) => server.close(resolve))
    storeDb.close()
    rmSync(directory, { recursive: true, force: true })
  }
}

async function adminSession(root, storeDb) {
  const credentials = hashPassword('correct-horse-battery-staple')
  storeDb.createAdmin({ username: 'owner', passwordSalt: credentials.salt, passwordHash: credentials.hash })
  const response = await fetch(root + '/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'correct-horse-battery-staple' }),
  })
  return { cookie: cookiePair(response), body: await response.json() }
}

test('catalog stock defaults to 20, zero stock is unavailable, and voucher management is server-owned', async () => {
  await withServer(async ({ root, storeDb }) => {
    const admin = await adminSession(root, storeDb)
    const headers = { cookie: admin.cookie, 'content-type': 'application/json', 'x-csrf-token': admin.body.csrfToken }
    const returnsSchema = await fetch(root + '/api/admin/records/returns', { headers: { cookie: admin.cookie } })
    assert.equal(returnsSchema.status, 200)
    assert.deepEqual((await returnsSchema.json()).schema.fields, ['customer', 'order', 'reason', 'assignee'])
    const returnRecord = await fetch(root + '/api/admin/records/returns', {
      method: 'POST', headers, body: JSON.stringify({ title: 'Đổi hàng ORDER-1', data: { customer: 'buyer', order: 'ORDER-1', reason: 'Lỗi sản phẩm', assignee: 'CSKH' }, status: 'Đang xử lý' }),
    })
    assert.equal(returnRecord.status, 201)
    const invalidRecord = await fetch(root + '/api/admin/records/returns', {
      method: 'POST', headers, body: JSON.stringify({ title: 'Dữ liệu lạ', data: { unknown: 'x' }, status: 'Nháp' }),
    })
    assert.equal(invalidRecord.status, 400)
    const publicCatalog = await fetch(root + '/api/storefront/catalog')
    const publicProducts = (await publicCatalog.json()).products
    assert.equal(publicProducts.find((item) => item.id === '1').stockCount, 20)
    const missingStock = await fetch(root + '/api/admin/products', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Thiếu tồn kho', price: 1000 }),
    })
    assert.equal(missingStock.status, 400)
    const zeroPrice = await fetch(root + '/api/admin/products', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Giá bằng không', price: 0, stockCount: 20 }),
    })
    assert.equal(zeroPrice.status, 400)

    const created = await fetch(root + '/api/admin/products', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Sản phẩm hết hàng', price: 1000, stockCount: 0 }),
    })
    assert.equal(created.status, 201)
    const product = (await created.json()).product
    assert.equal(product.stockCount, 0)

    storeDb.upsertCatalogProducts([{
      id: 'default-stock-test', source: 'test', sourceId: 'default-stock-test', name: 'Mặc định tồn kho',
      category: 'Điện tử', price: 1000, description: 'test', image: '/products/bag.svg', features: [],
      tone: 'green', symbol: '✦', label: 'Mới', sourceUrl: 'local://test', sourcePriceCents: 1,
      sourceCurrency: 'VND', importedAt: new Date().toISOString(),
    }])
    assert.equal(storeDb.getCatalogProduct('default-stock-test').stockCount, 20)

    const register = await fetch(root + '/api/customer/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'buyer', email: 'buyer@example.com', password: 'secure-password-123' }),
    })
    const customerCookie = cookiePair(register)
    const customer = (await register.json()).account
    const quote = await fetch(root + '/api/customer/quote', {
      method: 'POST', headers: { cookie: customerCookie, 'content-type': 'application/json', 'x-csrf-token': customer.csrfToken },
      body: JSON.stringify({ items: [{ id: product.id, quantity: 1 }], fulfillment: 'pickup', voucherCodes: [] }),
    })
    assert.equal(quote.status, 400)
    assert.equal((await quote.json()).error, 'PRODUCT_UNAVAILABLE')

    storeDb.db.prepare(`INSERT INTO customer_orders
      (id, customer_id, items_json, recipient, phone, address, fulfillment, region, distance_km, weight_kg,
       subtotal, discount, goods_total, shipping_fee, total, voucher_codes_json, tier, status, points_earned, created_at, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`)
      .run('ORDER-DASHBOARD-1', customer.id, '[]', 'Buyer', '0901234567', '', 'pickup', 'pickup', 0, 1,
        250000, 0, 250000, 0, 250000, '[]', 'bronze', 250, '2026-09-26T10:00:00.000Z', '2026-09-26T11:00:00.000Z')
    const dashboard = await fetch(root + '/api/admin/dashboard', { headers: { cookie: admin.cookie } })
    assert.equal(dashboard.status, 200)
    const dashboardBody = await dashboard.json()
    assert.equal(dashboardBody.dashboard.customerOrders, 1)
    assert.ok(dashboardBody.dashboard.revenueByDay.some((item) => item.date === '2026-09-26' && item.revenue === 250000))
    assert.ok(dashboardBody.dashboard.orderStatus.some((item) => item.status === 'paid' && item.count >= 1))
    const dailyStats = storeDb.calculateRevenue({ from: '2026-09-26', to: '2026-09-26' })
    assert.equal(dailyStats.dataMode, 'real')
    assert.equal(dailyStats.includedOrders, 1)
    assert.equal(dailyStats.netRevenue, 250000)

    const invalidScope = await fetch(root + '/api/admin/vouchers', {
      method: 'POST', headers, body: JSON.stringify({ customerId: customer.id, type: 'percent', scope: 'unknown', value: 20, expiresAt: '2026-10-01T00:00:00.000Z' }),
    })
    assert.equal(invalidScope.status, 400)
    const voucherResponse = await fetch(root + '/api/admin/vouchers', {
      method: 'POST', headers, body: JSON.stringify({ customerId: customer.id, type: 'percent', value: 20, expiresAt: '2026-10-01T00:00:00.000Z' }),
    })
    assert.equal(voucherResponse.status, 201)
    const voucher = (await voucherResponse.json()).voucher
    assert.match(voucher.code, /^[A-Z2-9]{10}$/)
    const listing = await fetch(root + '/api/admin/vouchers', { headers: { cookie: admin.cookie } })
    assert.equal((await listing.json()).vouchers[0].code, voucher.code)
    const removed = await fetch(root + '/api/admin/vouchers/' + voucher.code, { method: 'DELETE', headers })
    assert.equal(removed.status, 200)
    const afterRemoval = await fetch(root + '/api/admin/vouchers', { headers: { cookie: admin.cookie } })
    assert.deepEqual((await afterRemoval.json()).vouchers, [])
  })
})
