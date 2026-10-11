/**
 * Tệp: server/src/totp.js
 * Mục đích: TOTP RFC6238 không thêm dep mới (dùng node:crypto), phục vụ 2FA QR/Authenticator.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31]
  return output
}

export function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(bytes = 20) {
  return base32Encode(randomBytes(bytes))
}

export function totpCode(secret, timeMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(Number(timeMs) / 1000 / step)
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const key = base32Decode(secret)
  const hmac = createHmac('sha1', key).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(code % (10 ** digits)).padStart(digits, '0')
}

export function verifyTotp(secret, token, { window = 1, timeMs = Date.now() } = {}) {
  const clean = String(token || '').replace(/\s/g, '')
  if (!/^\d{6,8}$/.test(clean)) return false
  const key = base32Decode(secret)
  if (!key.length) return false
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = totpCode(secret, Number(timeMs) + drift * 30 * 1000)
    try {
      const a = Buffer.from(expected)
      const b = Buffer.from(clean)
      if (a.length === b.length && timingSafeEqual(a, b)) return true
    } catch { /* continue */ }
  }
  return false
}

export function otpauthUrl({ secret, email, issuer = 'Store' }) {
  const label = encodeURIComponent(issuer + ':' + String(email || 'customer'))
  return 'otpauth://totp/' + label + '?secret=' + encodeURIComponent(secret) + '&issuer=' + encodeURIComponent(issuer) + '&digits=6&period=30'
}

export function generateBackupCodes(count = 10) {
  const codes = []
  for (let i = 0; i < count; i += 1) {
    codes.push(randomBytes(5).toString('hex').toUpperCase().slice(0, 8))
  }
  return codes
}
