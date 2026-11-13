import assert from 'node:assert/strict'
import test from 'node:test'
import { apiJson, streamChat } from '../src/api/chat.js'
import { mapServerMessages } from '../src/services/customerSupportState.js'
import { formatAdminNotification, listenAdminNotifications } from '../src/services/adminNotifications.js'
import { statusLabel, fieldLabel, tierLabel, categoryLabel, dateOnlyLabel } from '../src/services/vietnameseLabels.js'

test('lỗi mạng, dữ liệu lỗi và lỗi máy chủ của quản trị đều có tiếng Việt', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(apiJson('/api/admin/products'), /Không thể kết nối/)
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'UNKNOWN_INTERNAL_CODE', message: 'SQL password private failure' }), { status: 500 })
    await assert.rejects(apiJson('/api/admin/products'), error => /Hệ thống đang gặp lỗi/.test(error.message) && !/SQL|private|UNKNOWN/.test(error.message))
    globalThis.fetch = async () => new Response('{not-json', { status: 200 })
    await assert.rejects(apiJson('/api/admin/products'), /Dữ liệu phản hồi chưa hợp lệ/)
    const cancelled = new DOMException('cancelled', 'AbortError')
    globalThis.fetch = async () => { throw cancelled }
    await assert.rejects(apiJson('/api/admin/products'), error => error === cancelled)
  } finally { globalThis.fetch = original }
})

test('lỗi hội thoại trực tiếp và lỗi lịch sử quản trị không lộ tiếng Anh', async () => {
  const original = globalThis.fetch
  const events = []
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ type: 'error', code: 'AI_EMPTY_RESPONSE', message: 'model returned empty' }) + '\n')
    await assert.rejects(streamChat({ endpoint: '/api/admin/chat', message: 'Xin chào', onEvent: event => events.push(event) }), /AI chưa tạo được câu trả lời/)
    assert.equal(events[0].message, 'AI chưa tạo được câu trả lời. Vui lòng thử lại.')
    assert.match(mapServerMessages([{ id: 1, role: 'assistant', status: 'failed', error: 'AI_TIMEOUT' }])[0].error, /quá thời gian chờ/)
  } finally { globalThis.fetch = original }
})

test('nhãn dữ liệu quản trị không hiện mã trạng thái hoặc tên trường nội bộ', () => {
  assert.equal(statusLabel('paid'), 'Đã thanh toán')
  assert.equal(statusLabel('pending', true), 'Đang chờ xử lý')
  assert.equal(statusLabel('awaiting_refund', true), 'Chờ hoàn tiền')
  assert.equal(statusLabel('Đang dùng', true), 'Đang dùng')
  assert.equal(fieldLabel('createdAt'), 'Ngày tạo')
  assert.equal(fieldLabel('customerId'), 'Mã khách hàng')
  assert.equal(tierLabel('diamond'), 'Kim cương')
  assert.equal(categoryLabel('Laptop'), 'Máy tính xách tay')
  assert.equal(dateOnlyLabel('2026-11-13'), '13/11/2026')
})

test('thông báo đơn, thanh toán, đánh giá và hỗ trợ dùng thời điểm sự kiện thật', () => {
  const occurredAt = '2026-11-13T02:00:00Z'
  const paid = formatAdminNotification('order:paid', { orderId: 'ST-TEST', pointsEarned: 5, occurredAt }, '7')
  assert.equal(paid.id, '7')
  assert.match(paid.text, /Đã xác nhận thanh toán đơn ST-TEST · cộng 5 điểm/)
  assert.match(paid.time, /09:00:00/)
  assert.match(formatAdminNotification('review:created', { productId: '1', productName: 'Tai nghe', rating: 5, customer: 'Khách' }, '8').text, /Đánh giá 5 sao.*Tai nghe/)
  assert.match(formatAdminNotification('support:created', { requestId: 'HT-1', customer: 'Khách', topic: 'Góp ý' }, '9').text, /Yêu cầu hỗ trợ HT-1.*Góp ý/)
  assert.equal(formatAdminNotification('unknown', {}, '10'), null)
  let source
  class FakeSource {
    constructor(url) { this.url = url; this.listeners = {}; source = this }
    addEventListener(kind, callback) { this.listeners[kind] = callback }
    close() { this.closed = true }
  }
  const received = []
  const stop = listenAdminNotifications(item => received.push(item), FakeSource)
  source.listeners['order:paid']({ lastEventId: '12', data: JSON.stringify({ orderId: 'ST-TEST', occurredAt }) })
  source.listeners['order:paid']({ data: 'bad-json' })
  assert.equal(received.length, 1)
  assert.equal(received[0].id, '12')
  stop()
  assert.equal(source.closed, true)
})
