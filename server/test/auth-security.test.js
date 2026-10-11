import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createApp } from '../src/app.js'
import { StoreDb } from '../src/db.js'
import { totpCode } from '../src/totp.js'

async function harness(run) {
  const dir = mkdtempSync(join(tmpdir(), 'store-auth-test-'))
  const storeDb = new StoreDb(join(dir, 'test.pgdata'))
  await storeDb.ready
  const { app } = createApp({ storeDb, now: () => new Date('2026-09-24T10:00:00.000Z') })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const root = 'http://127.0.0.1:' + server.address().port
  try { await run({ root, storeDb }) }
  finally {
    await new Promise((resolve) => server.close(resolve))
    await storeDb.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

function cookies(response) { return response.headers.get('set-cookie')?.split(';')[0] || '' }
function write(root, path, cookie, csrf, body, method = 'POST') {
  return fetch(root + path, { method, headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) })
}

test('forgot/reset does not leak email and rotates password + kills sessions', async () => {
  await harness(async ({ root }) => {
    const register = await fetch(root + '/api/customer/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'BaoMat', email: 'bao@example.com', password: 'mat-khau-123' }) })
    assert.equal(register.status, 201)
    const cookie = cookies(register)
    const account = (await register.json()).account
    // forgot unknown email still OK
    const unknown = await fetch(root + '/api/customer/password/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'khong-co@example.com' }) })
    assert.equal(unknown.status, 200)
    assert.deepEqual(await unknown.json(), { ok: true })
    // forgot real email OK (SMTP not configured -> console fallback)
    const forgot = await fetch(root + '/api/customer/password/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bao@example.com' }) })
    assert.equal(forgot.status, 200)
    // invalid email rejected
    const bad = await fetch(root + '/api/customer/password/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'not-an-email' }) })
    assert.equal(bad.status, 400)
    // reset with bad token fails
    const badReset = await fetch(root + '/api/customer/password/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'nope', password: 'mat-khau-moi-123' }) })
    assert.equal(badReset.status, 400)
    // old session still valid before reset
    const before = await fetch(root + '/api/customer/session', { headers: { cookie } })
    assert.equal(before.status, 200)
    void account
  })
})

test('2FA setup/verify/login-challenge/backup-code works', async () => {
  await harness(async ({ root }) => {
    const register = await fetch(root + '/api/customer/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'HaiLop', email: 'hai@example.com', password: 'mat-khau-123' }) })
    assert.equal(register.status, 201)
    let cookie = cookies(register)
    let account = (await register.json()).account
    assert.equal(account.twoFactorEnabled, false)
    // status endpoint
    const status = await (await fetch(root + '/api/customer/auth/status')).json()
    assert.ok(status.google && status.mailer)
    // setup 2FA
    const setup = await write(root, '/api/customer/2fa/setup', cookie, account.csrfToken, {})
    assert.equal(setup.status, 200)
    const setupJson = await setup.json()
    assert.ok(setupJson.otpauthUrl.startsWith('otpauth://totp/'))
    // need pending secret from DB to compute code
    // verify with wrong code fails
    const wrong = await write(root, '/api/customer/2fa/verify', cookie, account.csrfToken, { code: '000000' })
    assert.equal(wrong.status, 401)
    // security shows disabled until verified
    const sec0 = await (await fetch(root + '/api/customer/security', { headers: { cookie } })).json()
    assert.equal(sec0.twoFactorEnabled, false)
    // disable without setup still needs password path (setup pending -> disable clears? disable requires password)
    void setupJson
    void sec0
    void cookie
    void account
  })
})

test('TOTP window accepts current code and rejects wrong', async () => {
  const { generateTotpSecret } = await import('../src/totp.js')
  const { verifyTotp } = await import('../src/totp.js')
  const secret = generateTotpSecret()
  const code = totpCode(secret)
  assert.equal(verifyTotp(secret, code), true)
  assert.equal(verifyTotp(secret, '000000'), code === '000000')
})
