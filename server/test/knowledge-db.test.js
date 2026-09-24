import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { StoreDb } from '../src/db.js'
import { buildSupportKnowledge } from '../src/knowledge.js'

test('follow-up product lookup uses prior entity hint and normalized đ/stop words', () => {
  const result = buildSupportKnowledge('Cái đó giá bao nhiêu?', { productHints: ['3'] })
  assert.equal(result.matchedProducts.length, 1)
  assert.equal(result.matchedProducts[0].name, 'Đồng hồ Minimal')
})

test('fresh database does not seed demo orders unless explicitly enabled and dataMode is exact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'store-data-mode-'))
  try {
    const db = new StoreDb(join(directory, 'none.sqlite'))
    assert.equal(db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' }).dataMode, 'none')
    db.insertOrder({ id: 'REAL-1', businessDate: '2026-09-01', status: 'paid', totalAmount: 100, isDemo: false })
    assert.equal(db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' }).dataMode, 'real')
    db.insertOrder({ id: 'DEMO-X', businessDate: '2026-09-02', status: 'paid', totalAmount: 100, isDemo: true })
    assert.equal(db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' }).dataMode, 'mixed')
    db.close()
    const demo = new StoreDb(join(directory, 'demo.sqlite'), { seedDemoData: true })
    assert.equal(demo.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' }).dataMode, 'demo')
    demo.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('opening another database connection cannot recover live backend turns', () => {
  const directory = mkdtempSync(join(tmpdir(), 'store-owner-test-'))
  let first, second
  try {
    const path = join(directory, 'store.sqlite')
    first = new StoreDb(path)
    first.claimBackend()
    const { turn } = first.startTurn({ ownerKey: 'owner', kind: 'support', requestId: 'live_request', message: 'hello' })
    second = new StoreDb(path)
    assert.equal(second.getTurn('owner', 'live_request').status, 'running')
    assert.throws(() => second.claimBackend(), /backend còn hoạt động/)
    assert.equal(first.completeTurn({ turnId: turn.id, content: 'reply', verified: { text: 'verified' } }), true)
    const history = second.getPublicHistory(turn.conversation_id)
    assert.equal(history.length, 2)
    assert.equal(history[1].verified.text, 'verified')
    second.close(); second = null
    first.close(); first = null
  } finally {
    second?.close(); first?.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
