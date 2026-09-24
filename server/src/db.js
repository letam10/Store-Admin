import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
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
    if (seedDemoData) this.seedDemoOrders()
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
    `)

    const columns = this.db.prepare('PRAGMA table_info(conversations)').all().map((column) => column.name)
    if (!columns.includes('memory_json')) {
      this.db.exec("ALTER TABLE conversations ADD COLUMN memory_json TEXT NOT NULL DEFAULT '{}'")
    }
    const turnColumns = this.db.prepare('PRAGMA table_info(chat_turns)').all().map((column) => column.name)
    if (!turnColumns.includes('assistant_message_id')) this.db.exec('ALTER TABLE chat_turns ADD COLUMN assistant_message_id INTEGER')
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
