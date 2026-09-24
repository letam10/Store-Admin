import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function hashToken(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash: derived }
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = Buffer.from(scryptSync(password, salt, 64).toString('hex'), 'hex')
    const expected = Buffer.from(expectedHash, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLocaleLowerCase('vi')
}

export function parseCookies(header = '') {
  const result = {}
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!key) continue
    try {
      result[key] = decodeURIComponent(value)
    } catch {
      result[key] = value
    }
  }
  return result
}

export function setCookie(res, name, value, {
  maxAge,
  secure = false,
  sameSite = 'Strict',
  httpOnly = true,
  path = '/',
} = {}) {
  const parts = [
    name + '=' + encodeURIComponent(value),
    'Path=' + path,
    'SameSite=' + sameSite,
  ]
  if (httpOnly) parts.push('HttpOnly')
  if (secure) parts.push('Secure')
  if (Number.isFinite(maxAge)) parts.push('Max-Age=' + Math.max(0, Math.floor(maxAge)))
  res.append('Set-Cookie', parts.join('; '))
}

export function clearCookie(res, name, options = {}) {
  setCookie(res, name, '', { ...options, maxAge: 0 })
}

export class SlidingWindowLimiter {
  constructor({ limit, windowMs, maxKeys = 5000, sweepEvery = 100 }) {
    this.limit = limit
    this.windowMs = windowMs
    this.maxKeys = maxKeys
    this.sweepEvery = sweepEvery
    this.entries = new Map()
    this.operations = 0
  }

  get size() {
    return this.entries.size
  }

  #sweep(now) {
    const cutoff = now - this.windowMs
    for (const [key, entry] of this.entries) {
      const timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)
      if (timestamps.length === 0) this.entries.delete(key)
      else this.entries.set(key, { timestamps, touchedAt: entry.touchedAt })
    }
  }

  #evictOldest() {
    let oldestKey = null
    let oldestTouched = Infinity
    for (const [key, entry] of this.entries) {
      if (entry.touchedAt < oldestTouched) {
        oldestTouched = entry.touchedAt
        oldestKey = key
      }
    }
    if (oldestKey !== null) this.entries.delete(oldestKey)
  }

  consume(key) {
    const now = Date.now()
    this.operations += 1
    if (this.operations % this.sweepEvery === 0) this.#sweep(now)

    const cutoff = now - this.windowMs
    const normalizedKey = String(key)
    const existing = this.entries.get(normalizedKey)
    const timestamps = (existing?.timestamps || []).filter((timestamp) => timestamp > cutoff)

    if (!existing && this.entries.size >= this.maxKeys) {
      this.#sweep(now)
      if (this.entries.size >= this.maxKeys) this.#evictOldest()
    }

    if (timestamps.length >= this.limit) {
      this.entries.set(normalizedKey, { timestamps, touchedAt: now })
      return {
        allowed: false,
        retryAfterMs: Math.max(1000, timestamps[0] + this.windowMs - now),
      }
    }

    timestamps.push(now)
    this.entries.set(normalizedKey, { timestamps, touchedAt: now })
    return { allowed: true, retryAfterMs: 0 }
  }
}
