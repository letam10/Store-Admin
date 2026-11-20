/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tích hợp giao diện AdminSocialAutomation v3.0 (đa tài khoản, bảng Viral chia đôi 2 cột, nút lấy 5 nhóm FB, nút xóa toàn bộ viral & nhật ký).
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import Module from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { privacyForSocialPlatform } from '../src/pages/socialPrivacy.js'

const filename = resolve('test/admin-social.bundle.cjs')
const compiled = buildSync({
  entryPoints: ['src/pages/Admin.jsx'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  loader: { '.css': 'empty' }
})
const componentModule = new Module(filename)
componentModule.filename = filename
componentModule.paths = Module._nodeModulePaths(resolve('test'))
componentModule._compile(compiled.outputFiles[0].text, filename)
const Admin = componentModule.exports.default

const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const adminSession = { authenticated: true, role: 'admin', username: 'admin', csrfToken: 'csrf-admin' }

async function renderAdmin(mockFetch, run) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin' })
  dom.window.open = () => {}
  dom.window.confirm = () => true
  const changes = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    localStorage: dom.window.localStorage,
    sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: mockFetch
  }
  const originals = new Map()
  for (const [key, value] of Object.entries(changes)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(Admin)))
    await run(dom.window.document)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

test('Quyền riêng tư áp dụng đồng nhất cho Facebook và TikTok', () => {
  assert.strictEqual(privacyForSocialPlatform('facebook', 'public'), 'public')
  assert.strictEqual(privacyForSocialPlatform('tiktok', 'only_me'), 'only_me')
  assert.strictEqual(privacyForSocialPlatform('other'), null)
})

test('Giao diện Social v3.0: có bảng Viral chia đôi 2 cột, nút lấy 5 hội nhóm FB, nút xóa toàn bộ viral và xóa toàn bộ nhật ký', async () => {
  let clearedViral = false
  let clearedLogs = false

  const mockFetch = async (url, opts = {}) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'public', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/viral/clear-all') && opts.method === 'DELETE') {
      clearedViral = true
      return json({ ok: true, deletedCount: 2 })
    }
    if (u.includes('/api/admin/social/posts/clear-all') && opts.method === 'DELETE') {
      clearedLogs = true
      return json({ ok: true, deletedCount: 1 })
    }
    if (u.includes('/api/admin/social/posts')) return json({ posts: [{ id: 'p1', productName: 'Giày', productPrice: 200000, platform: 'tiktok', title: 'Test', content: 'Body', status: 'pending_review', likesCount: 0, sharesCount: 0, commentsCount: 0, triggerTime: '2026-11-20T10:00:00Z' }] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({
      posts: [
        { id: 'vfb1', title: 'FB Viral 10K', platform: 'facebook', category: 'Bài Ảnh', postUrl: 'https://www.facebook.com/posts/123', summary: 'Hay', likesCount: 10500, sharesCount: 300, commentsCount: 200 },
        { id: 'vtt1', title: 'TikTok Viral 80K', platform: 'tiktok', category: 'Video', postUrl: 'https://www.tiktok.com/@creator/video/987654', summary: 'Trend', likesCount: 82000, sharesCount: 1200, commentsCount: 900 }
      ]
    })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => aiNavBtn.click())
    const socialTab = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))[1]
    await act(async () => socialTab.click())

    // Kiểm tra Tab 3: Hội nhóm & Bảng Viral chia đôi
    const groupsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Hội Nhóm'))
    await act(async () => groupsTab.click())

    assert.ok(doc.querySelector('.social-viral-split-grid'), 'Phải có lưới chia đôi 2 cột cho bảng Viral')
    assert.ok(doc.body.textContent.includes('FB Viral 10K'))
    assert.ok(doc.body.textContent.includes('TikTok Viral 80K'))

    const autoGroupsBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Tự động lấy 5 hội nhóm Facebook'))
    assert.ok(autoGroupsBtn, 'Phải có nút tự động lấy 5 hội nhóm Facebook')

    const clearViralBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Xóa toàn bộ bài viral'))
    assert.ok(clearViralBtn, 'Phải có nút xóa toàn bộ bài viral')
    await act(async () => clearViralBtn.click())
    assert.strictEqual(clearedViral, true)

    // Kiểm tra Tab 4: Nhật ký + trạng thái Chờ duyệt (3-5p) + nút Xóa toàn bộ
    const logsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật Ký'))
    await act(async () => logsTab.click())
    assert.ok(doc.body.textContent.includes('Chờ duyệt (3–5p)'))

    const clearLogsBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Xóa toàn bộ nhật ký đăng bài'))
    assert.ok(clearLogsBtn, 'Phải có nút xóa toàn bộ nhật ký đăng bài')
    await act(async () => clearLogsBtn.click())
    assert.strictEqual(clearedLogs, true)
  })
})

test('CSS có quy tắc chia đôi bảng viral và Dark Mode xanh ngọc tối #102a1e', () => {
  const css = readFileSync(resolve('src/pages/AdminSocialAutomation.css'), 'utf-8')
  assert.ok(css.includes('.social-viral-split-grid'))
  assert.ok(css.includes('#102a1e'))
})
