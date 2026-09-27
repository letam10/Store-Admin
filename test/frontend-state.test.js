/**
 * @codex-vn-doc
 * Tệp: test/frontend-state.test.js
 * Mục đích: Tệp kiểm thử tự động cho các luồng chính và tình huống biên của module này.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: node:assert/strict, node:test, ../src/api/requestGate.js, ../src/components/ui/customerSupportState.js, ../src/pages/adminState.js.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequestGate } from '../src/api/requestGate.js'
import { applyRestore, createRestoreGuard, mapServerMessages } from '../src/components/ui/customerSupportState.js'
import { adminConversationKey } from '../src/pages/adminState.js'

// Kiểm thử edge case: slow restore cannot overwrite first active streaming turn.
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

// Kiểm thử edge case: reload restore applies once when no request is active.
test('reload restore applies once when no request is active', () => {
  const restore = createRestoreGuard('saved')
  const token = restore.begin()
  const result = applyRestore([], [{ id: 1, role: 'user', content: 'hello', sources: [] }], {
    canApply: restore.canApply(token, { requestActive: false, currentConversationId: 'saved' }),
  })
  assert.equal(result.length, 1)
  assert.equal(result[0].content, 'hello')
})

// Kiểm thử edge case: synchronous request gate rejects rapid double send and cancel releases it.
test('synchronous request gate rejects rapid double send and cancel releases it', () => {
  const gate = createRequestGate()
  const first = gate.tryBegin()
  assert.ok(first)
  assert.equal(gate.tryBegin(), null)
  gate.cancel()
  assert.ok(gate.tryBegin())
})


// Kiểm thử edge case: restore guard preserves exactly one local user/assistant pair during first stream.
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

// Kiểm thử edge case: admin conversation storage is isolated by normalized account identity.
test('admin conversation storage is isolated by normalized account identity', () => {
  assert.equal(adminConversationKey(' Alice '), adminConversationKey('alice'))
  assert.notEqual(adminConversationKey('alice'), adminConversationKey('bob'))
})

// Kiểm thử edge case: restore preserves verified data, report and retry metadata.
test('restore preserves verified data, report and retry metadata', () => {
  const [message] = mapServerMessages([{ id: 'turn-1', role: 'assistant', content: '',
    verified: { text: 'price' }, report: { netRevenue: 100 }, status: 'error',
    requestId: 'retry-123', retryContent: 'hello' }])
  assert.equal(message.verified.text, 'price')
  assert.equal(message.report.netRevenue, 100)
  assert.equal(message.status, 'error')
  assert.equal(message.requestId, 'retry-123')
})
