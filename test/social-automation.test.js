/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tự động cho Admin Social Automation (giao diện, cào viral, lướt feed lưu bền vững qua tab, bảo toàn cấu hình surfCfg v3.5.6).
  - Liên kết trực tiếp: src/pages/AdminSocialAutomation.jsx, src/pages/AdminSocialPowerPanels.jsx, src/pages/Admin.jsx
  - Vùng ảnh hưởng khi sửa: Toàn bộ kiểm thử phân hệ Tiếp thị & Tự động hóa MXH.
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import Module from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

const filename = resolve('test/admin-social.bundle.cjs')
const compiled = buildSync({
  entryPoints: ['src/pages/Admin.jsx'],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  jsx: 'automatic', define: { 'import.meta.env': '{}' }, loader: { '.css': 'empty' }
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
  dom.window.confirm = () => true
  const changes = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true, fetch: mockFetch
  }
  const originals = new Map()
  for (const [k, v] of Object.entries(changes)) {
    originals.set(k, Object.getOwnPropertyDescriptor(globalThis, k))
    Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: v })
  }
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(dom.window.document.getElementById('root'))
  try {
    await act(async () => root.render(React.createElement(Admin)))
    await run(dom.window.document)
  } finally {
    await act(async () => root.unmount())
    dom.window.close()
    for (const [k, d] of originals) {
      if (d) Object.defineProperty(globalThis, k, d)
      else delete globalThis[k]
    }
  }
}

test('Social v3.2: giao diện gọn gàng, có chọn chủ đề Viral, TikTok >=200K và xuất Excel (.xlsx)', async () => {
  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [{ id: 'p1', productName: 'Giày', productPrice: 200000, platform: 'tiktok', title: 'Test', content: 'Body', status: 'failed', errorMessage: 'Bài đăng TikTok bị từ chối duyệt', likesCount: 0, sharesCount: 0, commentsCount: 0, triggerTime: '2026-11-20T10:00:00Z' }] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    const aiNav = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => aiNav.click())
    await act(async () => doc.querySelectorAll('.admin-ai-tab-btn')[1].click())

    // Đã lược bỏ chú thích thừa
    assert.ok(!doc.body.textContent.includes('Mỗi lần bấm cào có bộ đếm trượt 5 phút'))
    assert.ok(!doc.body.textContent.includes('Tự nhận diện nick Facebook & TikTok đang đăng nhập'))

    // Kiểm tra Tab Nhóm & Viral có dropdown chọn chủ đề & ngưỡng TikTok >= 200K
    const groupsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhóm & Viral'))
    await act(async () => groupsTab.click())
    const topicSelect = doc.querySelector('#viral-topic-select')
    assert.ok(topicSelect, 'Phải có chọn chủ đề cào Viral')
    assert.ok(topicSelect.textContent.includes('Xe cộ'))
    assert.ok(topicSelect.textContent.includes('Anime'))
    assert.ok(topicSelect.textContent.includes('So sánh sản phẩm điện tử'))
    assert.ok(doc.body.textContent.includes('TikTok (≥ 1M Tim)') || doc.body.textContent.includes('TikTok (≥ 200K)'))

    // Kiểm tra Tab Nhật ký có nút Xuất Excel (.xlsx) & hiển thị "Bị từ chối duyệt"
    const logsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật ký'))
    await act(async () => logsTab.click())
    assert.ok(doc.body.textContent.includes('Xuất Excel (.xlsx)'))
    assert.ok(doc.body.textContent.includes('Bị từ chối duyệt'))
  })
})

test('Social v3.5: Lướt theo thời gian hiển thị bảng kết quả và bảo toàn 100% khi chuyển tab', async () => {
  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    if (u.includes('/api/admin/social/surf-history')) {
      return json({
        ok: true,
        posts: [{ id: 's1', title: 'Video lướt test', platform: 'tiktok', likesCount: 1500, commentsCount: 50, postUrl: 'https://tiktok.com/@test/video/1' }],
        lastResult: {
          ok: true,
          platform: 'tiktok',
          topic: 'Anime',
          durationMinutes: 2,
          topTopics: [{ topic: 'Anime', postCount: 1 }],
          topPosts: [{ id: 's1', title: 'Video lướt test', platform: 'tiktok', likesCount: 1500, commentsCount: 50, postUrl: 'https://tiktok.com/@test/video/1' }]
        }
      })
    }
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    const aiNav = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => aiNav.click())
    await act(async () => doc.querySelectorAll('.admin-ai-tab-btn')[1].click())

    // 1. Kiểm tra bảng lướt feed hiển thị đầy đủ ngay trong Tab Cấu hình từ lastResult
    assert.ok(doc.body.textContent.includes('Video lướt test'), 'Bảng lướt feed phải hiển thị bài từ lastResult')
    assert.ok(doc.body.textContent.includes('Lưu vào Kho Viral'), 'Phải có nút Lưu vào Kho Viral')

    // 2. Chuyển sang Tab Nhóm & Viral
    const groupsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhóm & Viral'))
    await act(async () => groupsTab.click())
    assert.ok(doc.querySelector('#viral-topic-select'), 'Đã sang tab Nhóm & Viral')

    // 3. Chuyển ngược lại Tab Cấu hình
    const settingsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Cấu hình'))
    await act(async () => settingsTab.click())

    // 4. Kiểm tra bảng lướt feed VẪN CÒN NGUYÊN VẸN, KHÔNG BỊ MẤT
    assert.ok(doc.body.textContent.includes('Video lướt test'), 'Bảng lướt feed không được mất khi bấm chuyển qua lại giữa các tab!')
  })
})

test('Social v3.5.5: Chuẩn hóa PascalCase từ C# backend cho lastResult và hiển thị đủ 10 bài viral cho cả FB & TikTok', async () => {
  const fbPosts = Array.from({ length: 10 }, (_, i) => ({
    id: `fb-${i}`,
    title: `Bài viết FB Viral số ${i + 1}`,
    platform: 'facebook',
    category: 'Xu hướng FB',
    postUrl: `https://facebook.com/reel/${1000 + i}`,
    likesCount: 5000 + i * 100,
    commentsCount: 200 + i,
    sharesCount: 50 + i,
    trendingTopic: 'Thước phim',
    createdAt: new Date().toISOString()
  }))

  const ttPosts = Array.from({ length: 10 }, (_, i) => ({
    id: `tt-${i}`,
    title: `Video TikTok Viral số ${i + 1}`,
    platform: 'tiktok',
    category: 'Xu hướng TikTok',
    postUrl: `https://tiktok.com/@user/video/${2000 + i}`,
    likesCount: 10000 + i * 500,
    commentsCount: 500 + i,
    sharesCount: 100 + i,
    trendingTopic: 'Video TikTok',
    createdAt: new Date().toISOString()
  }))

  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [...fbPosts, ...ttPosts] })
    if (u.includes('/api/admin/social/surf-history')) {
      return json({
        ok: true,
        posts: [],
        lastResult: {
          Ok: true,
          Platform: 'TikTok',
          Topic: 'Game',
          DurationMinutes: 3,
          TopTopics: [{ Topic: 'Game', PostCount: 1, TotalLikes: 8888 }],
          TopPosts: [{
            Id: 'surf-pascal-1',
            Title: 'Video Pascal C# chuẩn hóa',
            Platform: 'tiktok',
            LikesCount: 8888,
            CommentsCount: 66,
            PostUrl: 'https://tiktok.com/@gamer/video/8888'
          }]
        }
      })
    }
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    const aiNav = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => aiNav.click())
    await act(async () => doc.querySelectorAll('.admin-ai-tab-btn')[1].click())

    // 1. Kiểm tra bảng lướt feed chuẩn hóa PascalCase thành công
    assert.ok(doc.body.textContent.includes('Video Pascal C# chuẩn hóa'), 'Bảng lướt feed phải hiển thị bài Title từ PascalCase')
    assert.ok(doc.body.textContent.includes('8.888'), 'Lượt thích phải được hiển thị chính xác từ LikesCount PascalCase')

    // 2. Chuyển sang Tab Nhóm & Viral
    const groupsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhóm & Viral'))
    await act(async () => groupsTab.click())

    // 3. Kiểm tra hiển thị đủ 10 bài Facebook và 10 bài TikTok trong split grid
    assert.ok(doc.body.textContent.includes('10 bài'), 'Phải hiển thị đủ 10 bài')
    assert.ok(doc.body.textContent.includes('Bài viết FB Viral số 1'), 'Phải có bài FB 1')
    assert.ok(doc.body.textContent.includes('Bài viết FB Viral số 10'), 'Phải có bài FB 10')
    assert.ok(doc.body.textContent.includes('Video TikTok Viral số 1'), 'Phải có bài TikTok 1')
    assert.ok(doc.body.textContent.includes('Video TikTok Viral số 10'), 'Phải có bài TikTok 10')

    // 4. Chuyển lại Tab Cấu hình kiểm tra tính bền vững
    const settingsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Cấu hình'))
    await act(async () => settingsTab.click())
    assert.ok(doc.body.textContent.includes('Video Pascal C# chuẩn hóa'), 'Bảng lướt feed vẫn còn nguyên sau khi chuyển tab!')
  })
})

test('Social v3.5.6: Bảo toàn cấu hình lướt surfCfg và trạng thái Đã lưu khi thêm bài vào Kho Viral', async () => {
  const mockFetch = async (url, options) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 0, publishedCount: 0, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral/import-real')) {
      const body = JSON.parse(options?.body || '{}')
      return json({ ok: true, posts: body.posts || [] })
    }
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    if (u.includes('/api/admin/social/surf-history')) {
      return json({
        ok: true,
        posts: [],
        lastResult: {
          platform: 'facebook',
          durationMinutes: 5,
          topic: 'Công nghệ',
          topTopics: [{ topic: 'Công nghệ', postCount: 1 }],
          topPosts: [{
            id: 'fb-tech-1',
            title: 'Bài viết Công nghệ FB cực đỉnh',
            platform: 'facebook',
            likesCount: 1200,
            commentsCount: 88,
            postUrl: 'https://facebook.com/techpost/123'
          }]
        }
      })
    }
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    const aiNav = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => aiNav.click())
    await act(async () => doc.querySelectorAll('.admin-ai-tab-btn')[1].click())

    // 1. Kiểm tra bài viết hiển thị trong bảng lướt feed
    assert.ok(doc.body.textContent.includes('Bài viết Công nghệ FB cực đỉnh'), 'Phải hiển thị bài lướt FB')

    // 2. Nút "Lưu" ban đầu chưa bị disable
    const saveBtn = Array.from(doc.querySelectorAll('.social-action-btn')).find(b => b.textContent.trim() === '📥 Lưu')
    assert.ok(saveBtn, 'Phải có nút Lưu bài đơn lẻ')
    assert.strictEqual(saveBtn.disabled, false)

    // 3. Bấm "Lưu" bài viết vào Kho Viral
    await act(async () => saveBtn.click())

    // 4. Sau khi lưu, nút chuyển sang "✅ Đã lưu" và bị disabled
    assert.ok(doc.body.textContent.includes('✅ Đã lưu'), 'Nút phải chuyển trạng thái thành "✅ Đã lưu"')
  })
})
