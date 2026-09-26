import assert from 'node:assert/strict'
import test from 'node:test'
import { StoreDb } from '../src/db.js'
import { buildSupportKnowledge } from '../src/knowledge.js'

test('follow-up product lookup uses prior entity hint and normalized đ/stop words', () => {
  const result = buildSupportKnowledge('Cái đó giá bao nhiêu?', { productHints: ['3'] })
  assert.equal(result.matchedProducts.length, 1)
  assert.equal(result.matchedProducts[0].name, 'Đồng hồ Minimal')
})

test('fresh database does not seed demo orders unless explicitly enabled and dataMode is exact', async () => {
  const db = new StoreDb(':memory:')
  await db.ready
  assert.equal((await db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' })).dataMode, 'none')
  await db.insertOrder({ id: 'REAL-1', businessDate: '2026-09-01', status: 'paid', totalAmount: 100, isDemo: false })
  assert.equal((await db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' })).dataMode, 'real')
  await db.insertOrder({ id: 'DEMO-X', businessDate: '2026-09-02', status: 'paid', totalAmount: 100, isDemo: true })
  assert.equal((await db.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' })).dataMode, 'mixed')
  await db.close()

  const demo = new StoreDb(':memory:', { seedDemoData: true })
  await demo.ready
  assert.equal((await demo.calculateRevenue({ from: '2026-01-01', to: '2026-12-31' })).dataMode, 'demo')
  await demo.close()
})

test('opening another database connection cannot recover live backend turns', async () => {
  const first = new StoreDb(':memory:')
  await first.ready
  await first.claimBackend()
  const { turn } = await first.startTurn({ ownerKey: 'owner', kind: 'support', requestId: 'live_request', message: 'hello' })
  assert.equal((await first.getTurn('owner', 'live_request')).status, 'running')
  await assert.rejects(() => first.claimBackend(), /backend còn hoạt động/)
  assert.equal(await first.completeTurn({ turnId: turn.id, content: 'reply', verified: { text: 'verified' } }), true)
  const history = await first.getPublicHistory(turn.conversation_id)
  assert.equal(history.length, 2)
  assert.equal(history[1].verified.text, 'verified')
  await first.close()
})

