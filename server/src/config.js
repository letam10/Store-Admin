import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(serverRoot, '.env')

function loadLocalEnv() {
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadLocalEnv()

export const ALLOWED_CONTEXT_SIZES = Object.freeze([8192, 16384, 32768, 65536])

function integerEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback
}

function allowedContext(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return ALLOWED_CONTEXT_SIZES.includes(parsed) ? parsed : fallback
}

const configuredDbPath = process.env.DB_PATH || 'data/store.sqlite'

export const config = Object.freeze({
  serverRoot,
  port: integerEnv('PORT', 3001, { min: 1, max: 65535 }),
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3.5:4b',
  dbPath: resolve(serverRoot, configuredDbPath),
  supportContextSize: allowedContext(process.env.SUPPORT_NUM_CTX, 8192),
  adminDefaultContextSize: allowedContext(process.env.ADMIN_DEFAULT_NUM_CTX, 16384),
  supportNumPredict: integerEnv('SUPPORT_NUM_PREDICT', 384, { min: 64, max: 4096 }),
  adminNumPredict: integerEnv('ADMIN_NUM_PREDICT', 1024, { min: 64, max: 8192 }),
  ollamaTimeoutMs: integerEnv('OLLAMA_TIMEOUT_MS', 120000, { min: 5000, max: 600000 }),
  generationQueueMax: integerEnv('GENERATION_QUEUE_MAX', 4, { min: 0, max: 50 }),
  generationQueueWaitMs: integerEnv('GENERATION_QUEUE_WAIT_MS', 30000, { min: 1000, max: 300000 }),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  enableDemoData: process.env.ENABLE_DEMO_DATA === 'true',
})
