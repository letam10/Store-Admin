import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { extractStructuredMemory, prepareConversationContext, collectProductHints } from '../src/context.js'
import { StoreDb } from '../src/db.js'

function tempDb() {
  const directory = mkdtempSync(join(tmpdir(), 'store-context-test-'))
  const db = new StoreDb(join(directory, 'test.sqlite'))
  return { db, cleanup: () => { db.close(); rmSync(directory, { recursive: true, force: true }) } }
}

test('clarifying reply preserves pending request until backend confirms exact resolution', () => {
  const memory = extractStructuredMemory([
    { id: 1, role: 'user', content: 'Kiểm tra đơn ORDER-123 giúp tôi?', sources_json: '[]' },
    { id: 2, role: 'assistant', content: 'Bạn cho biết thêm thông tin nhé.', sources_json: '[]' },
  ])
  assert.equal(memory.pendingRequests.length, 1)
  const resolved = extractStructuredMemory([
    { id: 3, role: 'assistant', content: '', sources_json: JSON.stringify([{ id: 'action:1', kind: 'action', confirmed: true, resolvesMessageId: 1 }]) },
  ], memory)
  assert.equal(resolved.pendingRequests.length, 0)
})

test('recent product references precede old compact memory', () => {
  assert.deepEqual(collectProductHints([
    { id: 8, role: 'assistant', sources_json: JSON.stringify([{ kind: 'product', id: 'product:2' }]) },
  ], { entities: [{ kind: 'product', id: '1', messageId: 1 }] }), ['2', '1'])
})

test('structured extraction keeps facts after character 420 and provenance', () => {
  const longPrefix = 'x'.repeat(600)
  const memory = extractStructuredMemory([
    { id: 1, role: 'user', content: longPrefix + ' Tôi thích Tai nghe Everyday và mã đơn ORDER-ABC-123.', sources_json: '[]' },
    { id: 2, role: 'assistant', content: 'model text', sources_json: JSON.stringify([{ kind: 'product', id: 'product:1', label: 'backend product' }]) },
  ])
  assert.ok(memory.preferences.some((item) => item.text.includes('Tai nghe Everyday') && item.provenance === 'user_claim'))
  assert.ok(memory.entities.some((item) => item.kind === 'order' && item.id === 'ORDER-ABC-123' && item.provenance === 'user_claim'))
  assert.ok(memory.entities.some((item) => item.kind === 'product' && item.id === '1' && item.provenance === 'backend_source'))
})

test('prepareConversationContext preserves early structured facts across repeated extraction', () => {
  const { db, cleanup } = tempDb()
  try {
    const conversation = db.createConversation({ kind: 'support', ownerKey: 'owner' })
    db.addMessage({ conversationId: conversation.id, role: 'user', content: 'Tôi thích tai nghe, mã đơn ORDER-OLD-999.' })
    db.addMessage({ conversationId: conversation.id, role: 'assistant', content: 'ok', sources: [{ kind: 'product', id: 'product:1', label: 'p1' }] })
    for (let index = 0; index < 20; index += 1) {
      db.addMessage({ conversationId: conversation.id, role: 'user', content: 'Câu hỏi dài ' + index + ' '.repeat(50) + 'x'.repeat(200) })
      db.addMessage({ conversationId: conversation.id, role: 'assistant', content: 'Trả lời ' + index })
    }
    prepareConversationContext({ storeDb: db, conversation: db.getConversation(conversation.id), systemPrompt: 's', knowledgeText: 'k', numCtx: 8192, outputBudget: 128 })
    const afterFirst = db.getConversation(conversation.id)
    const memoryFirst = db.getConversationMemory(afterFirst)
    assert.ok(memoryFirst.entities.some((item) => item.id === 'ORDER-OLD-999'))
    assert.ok(memoryFirst.entities.some((item) => item.kind === 'product' && item.id === '1'))

    for (let index = 20; index < 38; index += 1) {
      db.addMessage({ conversationId: conversation.id, role: 'user', content: 'Tiếp ' + index + ' ' + 'y'.repeat(220) })
      db.addMessage({ conversationId: conversation.id, role: 'assistant', content: 'ok ' + index })
    }
    prepareConversationContext({ storeDb: db, conversation: db.getConversation(conversation.id), systemPrompt: 's', knowledgeText: 'k', numCtx: 8192, outputBudget: 128 })
    const afterSecond = db.getConversation(conversation.id)
    const memorySecond = db.getConversationMemory(afterSecond)
    assert.ok(memorySecond.entities.some((item) => item.id === 'ORDER-OLD-999'))
    assert.ok(memorySecond.preferences.some((item) => item.provenance === 'user_claim'))
    assert.match(afterSecond.summary, /extractive_compaction/)
    const prepared = prepareConversationContext({ storeDb: db, conversation: afterSecond, systemPrompt: 's', knowledgeText: 'k', numCtx: 65536, outputBudget: 128 })
    const memoryMessage = prepared.messages.find((item) => item.content.includes('BỘ NHỚ HỘI THOẠI'))
    assert.equal(memoryMessage.role, 'user')
    assert.match(memoryMessage.content, /ORDER-OLD-999/)
  } finally { cleanup() }
})

test('failed extraction keeps prior summary, memory and marker intact', () => {
  const { db, cleanup } = tempDb()
  try {
    const conversation = db.createConversation({ kind: 'support', ownerKey: 'owner' })
    db.updateCompact({ conversationId: conversation.id, summary: 'good-summary', memory: { version: 1, entities: [{ kind: 'product', id: '1', provenance: 'backend_source' }], preferences: [], pendingRequests: [], evidence: [], confirmedActions: [] }, status: 'extracted', lastCompactedMessageId: 7 })
    for (let index = 0; index < 10; index += 1) db.addMessage({ conversationId: conversation.id, role: 'user', content: 'z'.repeat(2000) })
    assert.throws(() => prepareConversationContext({ storeDb: db, conversation: db.getConversation(conversation.id), systemPrompt: 's'.repeat(2000), knowledgeText: 'k'.repeat(2000), numCtx: 8192, outputBudget: 1024 }))
    const after = db.getConversation(conversation.id)
    assert.equal(after.summary, 'good-summary')
    assert.equal(after.last_compacted_message_id, 7)
    assert.equal(db.getConversationMemory(after).entities[0].id, '1')
    assert.equal(after.compact_status, 'failed')
  } finally { cleanup() }
})
