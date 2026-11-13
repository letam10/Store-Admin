/**
 * @codex-vn-doc
 * Tệp: test/admin-component.test.js
 * Mục đích: Tệp kiểm thử tự động cho các luồng chính và tình huống biên của module này.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: node:assert/strict, node:test, node:module, node:path, esbuild, jsdom, react, react-dom/client.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import Module from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

// Compile the real component in memory; no generated files or dev server.
const filename = resolve('test/admin-component.bundle.cjs')
const compiled = buildSync({ entryPoints: ['src/pages/Admin.jsx'], bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' } })
const componentModule = new Module(filename)
componentModule.filename = filename
componentModule.paths = Module._nodeModulePaths(resolve('test'))
componentModule._compile(compiled.outputFiles[0].text, filename)
const Admin = componentModule.exports.default

// Chức năng json: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
// Chức năng session: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
const session = (username) => ({ authenticated: true, role: 'admin', username, csrfToken: 'csrf-' + username })
const settings = { model: 'test-model', contextSize: 8192, allowedContextSizes: [8192, 16384] }

// Chức năng mounted: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
async function mounted(mockFetch, run) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin' })
  const changes = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true, fetch: mockFetch }
  const originals = new Map()
  for (const [key, value] of Object.entries(changes)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.getElementById('root'))
  // Chức năng button: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const button = (label) => {
    const buttons = [...document.querySelectorAll('button')]
    return buttons.find((item) => item.textContent.trim() === label) || buttons.find((item) => item.textContent.includes(label))
  }
  // Chức năng click: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const click = async (label) => { const target = button(label); assert.ok(target, label); await act(async () => target.click()) }
  // Chức năng submit: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const submit = async (selector) => { await act(async () => document.querySelector(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))) }
  try {
    await act(async () => root.render(React.createElement(Admin)))
    await run({ click, submit, dom })
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

// Kiểm thử edge case: real Admin ignores late stats/settings from A after B logs in.
test('real Admin ignores late stats/settings from A after B logs in', async () => {
  let resolveStats, resolveSettings
  const delayedStats = new Promise((resolve) => { resolveStats = resolve })
  const delayedSettings = new Promise((resolve) => { resolveSettings = resolve })
  await mounted(async (url, options = {}) => {
    if (url === '/api/admin/session') return json(session('alice'))
    if (url === '/api/admin/login') return json(session('bob'))
    if (url === '/api/admin/logout') return json({ ok: true })
    if (url.startsWith('/api/admin/stats')) return delayedStats
    if (url === '/api/admin/settings' && options.method === 'PUT') return delayedSettings
    if (url === '/api/admin/settings') return json(settings)
    throw new Error('Unexpected URL ' + url)
  }, async ({ click, submit }) => {
    await click('AI cục bộ')
    await submit('.admin-range')
    await click('Lưu')
    await click('Đăng xuất')
    await submit('.admin-login')
    await act(async () => {
      resolveStats(json({ report: { netRevenue: 999999, grossRevenue: 999999, refunds: 0, from: 'SECRET-ALICE', to: '2026-09-18', dataMode: 'real' } }))
      resolveSettings(json({ contextSize: 65536 }))
    })
    assert.match(document.body.textContent, /bob/)
    assert.doesNotMatch(document.body.textContent, /SECRET-ALICE|999\.999/)
    const contextTrigger = document.querySelector('.admin-context [role="combobox"]')
    assert.ok(contextTrigger)
    assert.match(contextTrigger.textContent, /8K/)
  })
})

// Kiểm thử edge case: real Admin does not restore old history over a new live chat.
test('real Admin does not restore old history over a new live chat', async () => {
  let restore
  const delayedRestore = new Promise((resolve) => { restore = resolve })
  await mounted(async (url) => {
    if (url === '/api/admin/session') {
      sessionStorage.setItem('storeAdminConversationId:alice', 'old-conversation')
      return json(session('alice'))
    }
    if (url === '/api/admin/settings') return json(settings)
    if (url.includes('/conversations/')) return delayedRestore
    if (url === '/api/admin/chat') return new Response([
      { type: 'conversation', conversationId: 'new-conversation' },
      { type: 'delta', content: 'NEW-REPLY' },
      { type: 'done', conversationId: 'new-conversation' },
    ].map((event) => JSON.stringify(event)).join('\n'))
    throw new Error('Unexpected URL ' + url)
  }, async ({ click, submit, dom }) => {
    await click('AI cục bộ')
    const textarea = document.querySelector('.admin-chat textarea')
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'Xin chào')
      textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    await submit('.admin-chat__form')
    await act(async () => restore(json({ conversationId: 'old-conversation', messages: [{ id: 1, role: 'assistant', content: 'OLD-REPLY' }] })))
    assert.match(document.querySelector('.admin-chat__log').textContent, /NEW-REPLY/)
    assert.doesNotMatch(document.querySelector('.admin-chat__log').textContent, /OLD-REPLY/)
    assert.equal(document.querySelectorAll('.admin-chat__message').length, 2)
  })
})

// Kiểm thử edge case: grouped admin navigation and dashboard shortcut open top-view analytics.
test('grouped admin navigation and dashboard shortcut open top-view analytics', async () => {
  await mounted(async (url) => {
    if (url === '/api/admin/session') return json(session('owner'))
    if (url === '/api/admin/settings') return json(settings)
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (url === '/api/admin/product-views') return json({ products: [{ id: '1', name: 'Tai nghe Everyday', category: 'Điện tử', image: null, symbol: '🎧', viewCount: 2, rank: 1 }], totalViews: 2 })
    throw new Error('Unexpected URL ' + url)
  }, async ({ click }) => {
    assert.match(document.querySelector('.admin-sidebar').textContent, /Hàng hóa & cửa hàng/)
    assert.ok(document.querySelector('.admin-workspace-card'))
    assert.ok(document.querySelector('.admin-workspace-card .admin-sidebar'))
    assert.ok(document.querySelector('.admin-main__card'))
    assert.ok(document.querySelector('.admin-main__card .admin-theme-toggle'))
    assert.ok(document.querySelector('.admin-main__card .admin-language-control'))
    await click('Sản phẩm xem nhiều')
    assert.match(document.querySelector('.admin-main').textContent, /20 sản phẩm được xem nhiều nhất/)
    assert.match(document.querySelector('.admin-view-list').textContent, /Tai nghe Everyday/)
  })
})


test('staff manages products, orders and inventory while customer credentials and management settings stay private', async () => {
  const urls = []
  await mounted(async url => {
    urls.push(url)
    if (url === '/api/admin/session') return json({ ...session('support-agent'), role: 'staff' })
    if (url === '/api/admin/records/support') return json({ records: [] })
    if (url === '/api/admin/customer-orders') return json({ orders: [] })
    if (url === '/api/admin/records/inventory') return json({ records: [] })
    if (url === '/api/admin/customers') return json({ customers: [{ id: 1, username: 'Test Customer', email: 'test@example.invalid', points: 0, paidGoodsTotal: 0, spinCredits: 0 }] })
    if (url.startsWith('/api/admin/products')) return json({ products: [{ id: 'test', name: 'Test Product', price: 5000, stockCount: 4 }], total: 1 })
    throw new Error('Forbidden/unexpected URL ' + url)
  }, async ({ click }) => {
    const labels = [...document.querySelectorAll('nav button')].map(button => button.textContent)
    assert.equal(labels.length, 7)
    for (const label of ['Tổng quan', 'Thống kê', 'AI local', 'Nhân viên', 'Voucher']) {
      assert.ok(labels.every(text => !text.includes(label)), label)
    }
    await click('Khách hàng')
    await click('Test Customer')
    assert.doesNotMatch(document.body.textContent, /Sửa thông tin|Đổi mật khẩu/)
    await click('Hàng hóa')
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 450)) })
    assert.match(document.body.textContent, /Test Product/)
    assert.match(document.body.textContent, /Thêm sản phẩm/)
    assert.equal(document.querySelectorAll('.admin-offer-form').length, 1)
    assert.ok(document.querySelector('a[href="/api/admin/exports/products.xlsx"]'))
    await click('Đơn thanh toán')
    assert.match(document.body.textContent, /Đơn hàng khách hàng/)
    assert.doesNotMatch(document.body.textContent, /Cấu hình ngân hàng nhận tiền/)
    assert.ok(document.querySelector('a[href="/api/admin/exports/customer-orders.xlsx"]'))
    await click('Xuất nhập kho')
    assert.ok(document.querySelector('.admin-crud-module'))
    assert.ok(document.querySelector('a[href="/api/admin/exports/inventory.xlsx"]'))
    assert.ok(!urls.some(url => /settings|overview|appearance|events|conversations/.test(url)))
  })
})


test('statistics exports the displayed date range as XLSX and printable HTML', async () => {
  let loadedQuery
  await mounted(async url => {
    if (url === '/api/admin/session') return json(session('admin'))
    if (url.startsWith('/api/admin/stats?')) {
      loadedQuery = url.split('?')[1]
      const range = Object.fromEntries(new URLSearchParams(loadedQuery))
      return json({ report: { ...range, grossRevenue: 350000, refunds: 100000, netRevenue: 250000, includedOrders: 3, revenueByDay: [], orderStatus: [] } })
    }
    return json({ overview: {}, appearance: {} })
  }, async ({ click, dom }) => {
    const opened = []
    dom.window.open = url => opened.push(url)
    await click('Thống kê')
    assert.match(document.querySelector('.statistics-summary').textContent, /250.000/)
    await click('Xuất Excel')
    await click('In / lưu PDF')
    assert.deepEqual(opened, ['/api/admin/stats/export?' + loadedQuery + '&format=xlsx', '/api/admin/stats/export?' + loadedQuery + '&format=html'])
  })
})
