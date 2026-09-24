import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestGate } from '../src/api/requestGate.js'
import { applyRestore, createRestoreGuard, mapServerMessages } from '../src/components/ui/customerSupportState.js'
import { adminConversationKey } from '../src/pages/adminState.js'

test('slow restore cannot overwrite first active streaming turn', () => {
  const gate = createRequestGate()
  const restore = createRestoreGuard('old-conversation')
  const token = restore.begin()
  const active = gate.tryBegin()
  restore.invalidate()
  const current = [
    { id: 'user-local', role: 'user', content: 'xin chào' },
    { id: 'assistant-local', role: 'assistant', content: 'đang stream' },
  ]
  const result = applyRestore(current, [{ id: 1, role: 'user', content: 'old' }], {
    canApply: restore.canApply(token, { requestActive: gate.locked, currentConversationId: 'new-conversation' }),
  })
  assert.deepEqual(result, current)
  gate.finish(active.epoch)
})

test('reload restore applies once when no request is active', () => {
  const restore = createRestoreGuard('saved')
  const token = restore.begin()
  const result = applyRestore([], [{ id: 1, role: 'user', content: 'hello', sources: [] }], {
    canApply: restore.canApply(token, { requestActive: false, currentConversationId: 'saved' }),
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].content, 'hello')
})

test('synchronous request gate rejects rapid double send and cancel releases it', () => {
  const gate = createRequestGate()
  const first = gate.tryBegin()
  assert.ok(first)
  assert.equal(gate.tryBegin(), null)
  gate.cancel()
  assert.ok(gate.tryBegin())
})


test('restore guard preserves exactly one local user/assistant pair during first stream', () => {
  const gate = createRequestGate()
  const restore = createRestoreGuard('saved')
  const token = restore.begin()
  const active = gate.tryBegin()
  restore.invalidate()
  const current = [
    { id: 'u1', role: 'user', content: 'hello' },
    { id: 'a1', role: 'assistant', content: 'partial', status: 'streaming' },
  ]
  const result = applyRestore(current, [{ id: 7, role: 'user', content: 'server copy' }], {
    canApply: restore.canApply(token, { requestActive: gate.locked, currentConversationId: 'new-id' }),
  })
  assert.equal(result.length, 2)
  assert.equal(result.filter((item) => item.role === 'user').length, 1)
  assert.equal(result.filter((item) => item.role === 'assistant').length, 1)
  gate.finish(active.epoch)
})

test('admin conversation storage is isolated by normalized account identity', () => {
  assert.equal(adminConversationKey(' Alice '), adminConversationKey('alice'))
  assert.notEqual(adminConversationKey('alice'), adminConversationKey('bob'))
})

test('restore preserves verified data, report and retry metadata', () => {
  const [message] = mapServerMessages([{ id: 'turn-1', role: 'assistant', content: '',
    verified: { text: 'price' }, report: { netRevenue: 100 }, status: 'error',
    requestId: 'retry-123', retryContent: 'hello' }])
  assert.equal(message.verified.text, 'price')
  assert.equal(message.report.netRevenue, 100)
  assert.equal(message.status, 'error')
  assert.equal(message.requestId, 'retry-123')
})
