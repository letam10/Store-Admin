import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { tierForPoints, shippingFee, rewardPrizes } from '../src/customer.js'
import { StoreDb } from '../src/db.js'
import { hashPassword } from '../src/security.js'

async function harness(run) {
  const dir = mkdtempSync(join(tmpdir(), 'store-customer-test-'))
  const storeDb = new StoreDb(join(dir, 'store.sqlite'))
  const { app } = createApp({ storeDb, now: () => new Date('2026-09-24T10:00:00.000Z') })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const root = 'http://127.0.0.1:' + server.address().port
  try { await run({ root, storeDb }) }
  finally {
    await new Promise((resolve) => server.close(resolve))
    storeDb.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

function cookies(response) { return response.headers.get('set-cookie')?.split(';')[0] || '' }
function write(root, path, cookie, csrf, body, method = 'POST') {
  return fetch(root + path, { method, headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) })
}

test('membership thresholds, shipping bands and wheel weights are exact', () => {
  assert.deepEqual([0, 99, 100, 999, 1000, 9999, 10000].map(tierForPoints),
    ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'diamond'])
  assert.equal(shippingFee({ region: 'binh-duong' }, 'bronze'), 30000)
  assert.equal(shippingFee({ region: 'ba-ria-vung-tau' }, 'gold'), 0)
  assert.equal(shippingFee({ region: 'nearby' }, 'silver'), 60000)
  assert.equal(shippingFee({ region: 'far', distanceKm: 20 }, 'silver'), 80000)
  assert.equal(shippingFee({ region: 'far', distanceKm: 20 }, 'diamond'), 0)
  assert.deepEqual(rewardPrizes().reduce((counts, prize) => ({ ...counts, [prize.kind]: (counts[prize.kind] || 0) + 1 }), {}),
    { none: 6, amount: 3, percent: 1 })
})

test('customer rewards require recorded payment, accumulate exact points and consume vouchers once', async () => {
  await harness(async ({ root, storeDb }) => {
    const register = await fetch(root + '/api/customer/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'Tam', email: 'tam@example.com', password: 'very-secure-password' }) })
    assert.equal(register.status, 201)
    const cookie = cookies(register)
    const account = (await register.json()).account
    assert.equal((await fetch(root + '/api/customer/favorites')).status, 401)
    assert.equal((await write(root, '/api/customer/favorites/1', cookie, '', {}, 'PUT')).status, 403)
    assert.equal((await write(root, '/api/customer/favorites/1', cookie, account.csrfToken, {}, 'PUT')).status, 200)
    const adminPassword = hashPassword('correct-horse-battery-staple')
    storeDb.createAdmin({ username: 'owner', passwordSalt: adminPassword.salt, passwordHash: adminPassword.hash })
    const login = await fetch(root + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'owner', password: 'correct-horse-battery-staple' }) })
    const adminCookie = cookies(login)
    const admin = await login.json()
    const issue = await write(root, '/api/admin/customers/' + account.id + '/vouchers', adminCookie, admin.csrfToken,
      { type: 'amount', value: 100000, expiresAt: '2026-10-24T10:00:00.000Z' })
    assert.equal(issue.status, 201)
    const code = (await issue.json()).voucher.code
    assert.match(code, /^[A-Z2-9]{10}$/)
    const body = { items: [{ id: 1, quantity: 1 }], fulfillment: 'delivery', region: 'hcm', voucherCodes: [code] }
    const quote = await write(root, '/api/customer/quote', cookie, account.csrfToken, body)
    assert.equal(quote.status, 200)
    assert.deepEqual(((await quote.json()).total), 820000)
    const created = await write(root, '/api/customer/orders', cookie, account.csrfToken, body)
    assert.equal(created.status, 201)
    const order = (await created.json()).order
    assert.equal(order.goodsTotal, 790000)
    assert.equal((await (await fetch(root + '/api/customer/session', { headers: { cookie } })).json()).account.points, 0)
    assert.equal((await write(root, '/api/customer/quote', cookie, account.csrfToken, body)).status, 400)
    assert.deepEqual((await (await fetch(root + '/api/customer/vouchers', { headers: { cookie } })).json()).vouchers, [])
    const paid = await write(root, '/api/admin/customer-orders/' + order.id + '/paid', adminCookie, admin.csrfToken, {})
    assert.deepEqual(await paid.json(), { alreadyPaid: false, pointsEarned: 790, spinCreditsAdded: 7 })
    assert.equal((await (await fetch(root + '/api/customer/session', { headers: { cookie } })).json()).account.tier, 'silver')
    const again = await write(root, '/api/admin/customer-orders/' + order.id + '/paid', adminCookie, admin.csrfToken, {})
    assert.equal((await again.json()).alreadyPaid, true)
    assert.equal((await (await fetch(root + '/api/customer/session', { headers: { cookie } })).json()).account.points, 790)
  })
})
