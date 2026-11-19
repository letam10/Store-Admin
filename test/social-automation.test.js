/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tự động (Unit & Integration tests) cho tính năng Tự động hóa đăng bài Mạng Xã Hội (cuộn độc lập bảng social-table-shell, thead sticky, Dark Mode xanh ngọc #102a1e, cơ chế Bridge Facebook John Harper 61580644871703, nút lấy thêm 5 bài viral thực tế).
  - Liên kết trực tiếp: Store-Admin/src/pages/Admin.jsx, Store-Admin/src/pages/AdminSocialAutomation.jsx, Store-Admin/src/pages/AdminSocialAutomation.css, Store-Admin/src/api/chat.js
  - Vùng ảnh hưởng khi sửa: Đảm bảo độ tin cậy và không hồi quy của luồng giao diện tự động hóa mạng xã hội.
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import Module from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'

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
  if (!dom.window.navigator.clipboard) {
    Object.defineProperty(dom.window.navigator, 'clipboard', {
      value: { writeText: async () => {} },
      configurable: true
    })
  }
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
    await act(async () => {
      root.render(React.createElement(Admin))
    })
    await run(dom.window.document)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  } finally {
    await act(async () => {
      root.unmount()
    })
    dom.window.close()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
}

test('nút chuyển đổi qua lại giữa AI cục bộ và Tự động đăng bài Mạng Xã Hội', async () => {
  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384, 32768, 65536] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 5000000, refunds: 0, netRevenue: 5000000, includedOrders: 10, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 5, publishedCount: 4, pendingCount: 1, failedCount: 0, totalLikes: 250, totalShares: 45, totalComments: 28, lastRunAt: '2026-11-19T02:00:00Z', nextRunAt: '2026-11-19T04:00:00Z', isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [{ id: 'post-1', productName: 'Tai nghe Bluetooth', productPrice: 890000, platform: 'facebook', title: 'Deal hot tai nghe', content: 'Nội dung bài viết', status: 'published', likesCount: 45, sharesCount: 10, commentsCount: 5, triggerTime: '2026-11-19T02:00:00Z', publishedTime: '2026-11-19T02:00:00Z' }] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [{ id: 'grp-1', groupName: 'Hội Mua Sắm', groupUrl: 'https://facebook.com/groups/test', category: 'Gia dụng', membersCount: 50000, interactionRate: 'Cao', isAutoShare: true }] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [{ id: 'v-1', title: 'Top đồ gia dụng', platform: 'facebook', category: 'Gia dụng', postUrl: 'https://facebook.com/p1', viralityScore: 98, likesCount: 2000, sharesCount: 500, commentsCount: 200, trendingTopic: 'Mẹo hay' }] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    // 1. Mở module AI Cục bộ từ sidebar
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    assert.ok(aiNavBtn, 'Phải có nút điều hướng AI cục bộ trong sidebar')

    await act(async () => {
      aiNavBtn.click()
    })

    // 2. Kiểm tra container .admin-workspace-content và nút chuyển đổi tab
    const tabSwitch = doc.querySelector('.admin-ai-tab-switch')
    assert.ok(tabSwitch, 'Phải có thanh chuyển đổi tab trong giao diện AI cục bộ')

    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    assert.strictEqual(tabButtons.length, 2, 'Thanh tab phải có đúng 2 nút chuyển đổi')
    assert.ok(tabButtons[0].textContent.includes('Trò chuyện & Phân tích AI'))
    assert.ok(tabButtons[1].textContent.includes('Tự động đăng bài Mạng Xã Hội'))

    // Mặc định tab chat đang active
    assert.ok(tabButtons[0].classList.contains('is-active'))

    // 3. Bấm chuyển sang tab Tự động đăng bài Mạng Xã Hội
    await act(async () => {
      tabButtons[1].click()
    })

    // 4. Kiểm tra giao diện Social Marketing Automation hiển thị
    assert.ok(tabButtons[1].classList.contains('is-active'), 'Tab Tự động đăng bài MXH phải có class is-active')
    const socialPostingWrapper = doc.querySelector('.admin-social-posting')
    assert.ok(socialPostingWrapper, 'Phải có container div.admin-social-posting')
    const kpiBanner = doc.querySelector('.social-kpi-banner')
    assert.ok(kpiBanner, 'Phải hiển thị banner KPI tiếp thị mạng xã hội')
    assert.ok(kpiBanner.textContent.includes('Hệ Thống Tự Động Hóa Đăng Bài Mạng Xã Hội'))

    // Kiểm tra các subnav tab: Cấu hình, Studio, Hội nhóm, Nhật ký
    const subnavBtns = Array.from(doc.querySelectorAll('.social-subnav-btn'))
    assert.strictEqual(subnavBtns.length, 4, 'Phải có 4 tab con: Cấu hình, Studio, Hội nhóm, Nhật ký')
  })
})

test('module Tự động hóa MXH cấu hình đầy đủ tự động, nhóm Facebook, bài viral và audit log', async () => {
  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 8, publishedCount: 6, pendingCount: 2, failedCount: 0, totalLikes: 890, totalShares: 140, totalComments: 95, lastRunAt: '2026-11-19T02:00:00Z', nextRunAt: '2026-11-19T04:00:00Z', isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [
      { id: 'post-101', productName: 'Tai nghe Bluetooth OmiPro', productPrice: 890000, platform: 'facebook', title: 'Deal hot tai nghe', content: 'Nội dung bài viết đầy đủ', status: 'published', likesCount: 142, sharesCount: 28, commentsCount: 19, triggerTime: '2026-11-19T02:00:00Z', publishedTime: '2026-11-19T02:00:00Z', postUrl: 'https://facebook.com/posts/101' },
      { id: 'post-102', productName: 'Túi vải Canvas', productPrice: 125000, platform: 'tiktok', title: 'Túi xinh đón ngày mới', content: 'Kịch bản tiktok 30s', status: 'pending_approval', likesCount: 0, sharesCount: 0, commentsCount: 0, triggerTime: '2026-11-19T03:00:00Z' }
    ] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [{ id: 'grp-01', groupName: 'Nhóm Khách Hàng Thân Thiết', groupUrl: 'https://facebook.com/groups/feed', category: 'Đồ gia dụng & Gia đình', membersCount: 0, interactionRate: 'Bình thường', isAutoShare: true }] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [{ id: 'v-01', title: 'Mẹo sắp xếp đồ dùng gia đình gọn gàng', platform: 'facebook', category: 'Đồ gia dụng', postUrl: 'https://facebook.com/watch/', viralityScore: 85, likesCount: 0, sharesCount: 0, commentsCount: 0, trendingTopic: 'Lối sống tiện lợi' }] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    // 1. Chuyển sang AI cục bộ
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => {
      aiNavBtn.click()
    })

    // 2. Chuyển sang Tab Mạng Xã Hội
    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    await act(async () => {
      tabButtons[1].click()
    })

    // 3. Tab Cấu hình: Kiểm tra có interval (chu kỳ 2-3 giờ) và các trường cần thiết
    const intervalSelect = doc.querySelector('#cfg-interval')
    assert.ok(intervalSelect, 'Phải có dropdown chọn chu kỳ đăng bài')
    const options = Array.from(intervalSelect.querySelectorAll('option')).map(o => o.value)
    assert.ok(options.includes('2') && options.includes('3'), 'Phải hỗ trợ chu kỳ 2 giờ và 3 giờ')

    // 4. Chuyển sang Tab Nhật Ký Đăng Bài (Logs)
    const logsSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật Ký'))
    assert.ok(logsSubnavBtn, 'Phải có tab Nhật Ký Đăng Bài')
    await act(async () => {
      logsSubnavBtn.click()
    })

    // Kiểm tra nút xuất báo cáo CSV
    const exportCsvBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Xuất Báo Cáo CSV'))
    assert.ok(exportCsvBtn, 'Phải có nút Xuất Báo Cáo CSV trong tab Nhật ký đăng bài')

    // Kiểm tra bảng nhật ký có hiển thị bài đăng và thống kê tương tác
    const rows = doc.querySelectorAll('.social-table tbody tr')
    assert.strictEqual(rows.length, 2, 'Phải hiển thị đúng 2 bài đăng trong bảng nhật ký')
    assert.ok(rows[0].textContent.includes('Tai nghe Bluetooth OmiPro'))
    assert.ok(rows[1].textContent.includes('Túi vải Canvas'))

    // 5. Chuyển sang Tab Hội Nhóm Facebook & Bài Viral
    const groupsSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Hội Nhóm'))
    assert.ok(groupsSubnavBtn, 'Phải có tab Hội Nhóm')
    await act(async () => {
      groupsSubnavBtn.click()
    })

    assert.ok(doc.body.textContent.includes('Nhóm Khách Hàng Thân Thiết'), 'Phải hiển thị nhóm Facebook mục tiêu')
    assert.ok(doc.body.textContent.includes('Mẹo sắp xếp đồ dùng gia đình gọn gàng'), 'Phải hiển thị bài đăng Hot Viral')
  })
})

test('AI Copywriting Studio sinh bài bằng Qwen và bảo toàn productId chính xác khi đăng', async () => {
  let createdPayload = null
  let extensionPostPayload = null
  let publishRealPayload = null
  const mockFetch = async (url, opts) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 10, totalShares: 2, totalComments: 1, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts/create')) {
      createdPayload = JSON.parse(opts.body)
      return json({ ok: true, post: { id: 'new-p1', ...createdPayload } })
    }
    if (u.includes('/api/admin/social/posts/new-p1/publish-real')) {
      publishRealPayload = JSON.parse(opts.body)
      return json({ ok: true, post: { id: 'new-p1', status: 'published', postUrl: publishRealPayload.postUrl } })
    }
    if (u.includes('/api/admin/social/generate')) {
      return json({
        ok: true,
        product: { id: 'prod-canvas-99', name: 'Túi Vải Canvas Siêu Bền', price: 150000, image: '/products/bag.svg', category: 'Thời trang', description: 'Túi canvas phong cách tối giản.' },
        generated: { title: 'Túi canvas xinh xắn', content: 'Bài viết bán túi canvas cực hay', hashtags: '#TuiCanvas', generatedBy: 'Local Qwen (qwen3.5:4b)', platform: 'facebook', tone: 'viral_engaging' }
      })
    }
    if (u.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    doc.defaultView.addEventListener('message', (event) => {
      if (event.data?.source !== 'OMNICART_ADMIN_REQUEST' || event.data.action !== 'AUTO_POST') return
      extensionPostPayload = event.data.payload.post
      doc.defaultView.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId: event.data.requestId,
        ok: true,
        data: {
          ok: true,
          platform: 'facebook',
          privacy: 'only_me',
          postUrl: 'https://www.facebook.com/profile.php?id=61580644871703&story_fbid=99112233',
          realPostId: '99112233',
          publishedTime: '2026-11-19T14:00:00.000Z'
        }
      }, '*')
    })

    // 1. Chuyển sang AI cục bộ
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => {
      aiNavBtn.click()
    })

    // 2. Chuyển sang Tab Mạng Xã Hội
    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    await act(async () => {
      tabButtons[1].click()
    })

    // 3. Mở Tab AI Copywriting Studio
    const studioSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Studio'))
    assert.ok(studioSubnavBtn, 'Phải có tab AI Copywriting Studio')
    await act(async () => {
      studioSubnavBtn.click()
    })

    // 4. Bấm nút sinh bài viết mới từ Qwen
    const generateBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Local Qwen AI Viết Bài Mới'))
    assert.ok(generateBtn, 'Phải có nút sinh bài bằng Qwen AI')
    await act(async () => {
      generateBtn.click()
    })

    // 5. Bấm đăng ngay; mô phỏng phản hồi Extension xác nhận permalink thật
    const publishBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Đăng Ngay Lên Mạng Xã Hội'))
    assert.ok(publishBtn, 'Phải có nút Đăng Ngay Lên Mạng Xã Hội')
    await act(async () => {
      publishBtn.click()
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // Kiểm tra payload gửi lên API posts/create đã bảo toàn đúng productId của sản phẩm
    assert.ok(createdPayload, 'Phải gọi API tạo bài viết')
    assert.strictEqual(createdPayload.productId, 'prod-canvas-99', 'Mã sản phẩm productId phải được giữ nguyên khi đăng bài')
    assert.strictEqual(createdPayload.productName, 'Túi Vải Canvas Siêu Bền')
    assert.strictEqual(createdPayload.publishImmediately, false, 'Bản ghi chỉ được lưu nháp trước khi Extension đăng thật')
    assert.strictEqual(createdPayload.privacy, 'only_me', 'Bản nháp phải giữ quyền riêng tư Chỉ mình tôi')
    assert.ok(extensionPostPayload?.imageUrl.endsWith('/products/bag.svg'), 'Extension phải nhận ảnh sản phẩm đã chọn')
    assert.ok(extensionPostPayload?.content.includes('Túi canvas xinh xắn'), 'Extension phải nhận nội dung AI Local đã tạo')
    assert.strictEqual(extensionPostPayload?.privacy, 'only_me')
    assert.strictEqual(publishRealPayload?.realPostId, '99112233', 'Lịch sử phải lưu mã bài thật do Extension xác nhận')
  })
})

test('Full-Auto tự gửi bài mới trong phiên qua Extension và không dùng trạng thái đăng giả', async () => {
  const automaticPost = {
    id: 'scheduled-post-1',
    productId: 'product-scheduled',
    productName: 'Bình giữ nhiệt',
    productPrice: 250000,
    productImage: '/products/bottle.jpg',
    platform: 'facebook',
    title: 'Tiêu đề AI đã tạo',
    content: 'Mô tả AI đã tạo',
    hashtags: '#OmniCart',
    status: 'ready_for_publish',
    privacy: 'only_me',
    triggerTime: new Date(Date.now() + 10000).toISOString()
  }
  const extensionRequests = []
  const extensionResponses = []
  let publishRealCalls = 0
  let savedPostUrl = ''
  const mockFetch = async (url, options = {}) => {
    const requestUrl = String(url)
    if (requestUrl.includes('/api/admin/session')) return json(adminSession)
    if (requestUrl.includes('/api/admin/presence')) return json({ online: true })
    if (requestUrl.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (requestUrl.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (requestUrl.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 0, publishedCount: 0, pendingCount: 1, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (requestUrl.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', privacy: 'only_me', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (requestUrl.includes('/publish-real')) {
      publishRealCalls += 1
      const payload = JSON.parse(options.body)
      savedPostUrl = payload.postUrl
      return json({ ok: true, post: { id: automaticPost.id, status: 'published', postUrl: payload.postUrl } })
    }
    if (requestUrl.includes('/api/admin/social/posts')) return json({ posts: [automaticPost] })
    if (requestUrl.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (requestUrl.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    doc.defaultView.addEventListener('message', event => {
      if (event.data?.source === 'OMNICART_EXTENSION_RESPONSE') extensionResponses.push(event.data)
    })
    doc.defaultView.addEventListener('message', (event) => {
      const request = event.data
      if (request?.source !== 'OMNICART_ADMIN_REQUEST' || request.action !== 'AUTO_POST') return

      extensionRequests.push(request.payload)
      doc.defaultView.dispatchEvent(new doc.defaultView.MessageEvent('message', {
        data: {
          source: 'OMNICART_EXTENSION_RESPONSE',
          requestId: request.requestId,
          ok: true,
          data: {
            ok: true,
            platform: 'facebook',
            privacy: 'only_me',
            postUrl: 'https://www.facebook.com/profile.php?id=61580644871703&story_fbid=99112235',
            realPostId: '99112235',
            publishedTime: '2026-11-19T14:00:00.000Z'
          }
        },
        origin: doc.defaultView.location.origin
      }))
    })

    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(button => button.textContent.includes('AI cục bộ') || button.textContent.includes('Local AI'))
    await act(async () => aiNavBtn.click())
    const socialTab = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))[1]
    await act(async () => socialTab.click())

    await act(async () => {
      doc.defaultView.dispatchEvent(new doc.defaultView.CustomEvent('omnicart-extension-ready'))
      const deadline = Date.now() + 2000
      while (!savedPostUrl && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    })

    assert.strictEqual(extensionRequests.length, 1, 'Bài mới trong phiên phải được gửi đúng một lần')
    assert.strictEqual(extensionRequests[0].platform, 'facebook')
    assert.strictEqual(extensionRequests[0].post.privacy, 'only_me')
    assert.ok(extensionRequests[0].post.imageUrl.endsWith('/products/bottle.jpg'))
    assert.ok(extensionRequests[0].post.content.includes('Mô tả AI đã tạo'))
    assert.strictEqual(
      savedPostUrl,
      'https://www.facebook.com/profile.php?id=61580644871703&story_fbid=99112235',
      'Lịch sử chưa nhận permalink thật. Thông báo: ' + (doc.querySelector('.social-alert')?.textContent || 'chưa có') +
        '; phản hồi Extension: ' + JSON.stringify(extensionResponses) + '; lệnh lưu: ' + publishRealCalls
    )
  })
})

test('Đăng thử tạo nội dung AI và đăng lần lượt một bài Facebook, một bài TikTok bằng ảnh sản phẩm', async () => {
  const cyclePlatforms = []
  const extensionRequests = []
  const publishedPayloads = []
  const mockFetch = async (url, options = {}) => {
    const requestUrl = String(url)
    if (requestUrl.includes('/api/admin/session')) return json(adminSession)
    if (requestUrl.includes('/api/admin/presence')) return json({ online: true })
    if (requestUrl.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (requestUrl.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (requestUrl.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 0, publishedCount: 0, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (requestUrl.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', privacy: 'only_me', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (requestUrl.includes('/api/admin/social/trigger-cycle?platform=')) {
      const platform = requestUrl.split('platform=')[1]
      cyclePlatforms.push(platform)
      return json({
        ok: true,
        post: {
          id: 'batch-' + platform,
          productId: 'product-' + platform,
          productName: 'Sản phẩm ' + platform,
          productPrice: 10000,
          productImage: '/products/' + platform + '.jpg',
          platform,
          title: 'Tiêu đề AI ' + platform,
          content: 'Mô tả AI ' + platform,
          hashtags: '#OmniCart',
          privacy: 'only_me'
        }
      })
    }
    if (requestUrl.includes('/publish-real')) {
      const payload = JSON.parse(options.body)
      publishedPayloads.push(payload)
      return json({ ok: true, post: { id: 'saved-' + payload.platform, status: 'published', postUrl: payload.postUrl } })
    }
    if (requestUrl.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (requestUrl.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (requestUrl.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    doc.defaultView.addEventListener('message', (event) => {
      const request = event.data
      if (request?.source !== 'OMNICART_ADMIN_REQUEST') return

      let data
      if (request.action === 'CHECK_STATUS') {
        data = { ok: true, tabs: { admin: true, facebook: true, tiktok: true } }
      } else if (request.action === 'AUTO_POST') {
        const { platform, post } = request.payload
        extensionRequests.push({ platform, post })
        data = {
          ok: true,
          platform,
          privacy: 'only_me',
          postUrl: platform === 'facebook'
            ? 'https://www.facebook.com/profile.php?id=61580644871703&story_fbid=99112233'
            : 'https://www.tiktok.com/@harutv666/photo/99112234',
          realPostId: platform === 'facebook' ? '99112233' : '99112234',
          publishedTime: '2026-11-19T14:00:00.000Z'
        }
      } else {
        return
      }

      doc.defaultView.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId: request.requestId,
        ok: true,
        data
      }, '*')
    })

    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(button => button.textContent.includes('AI cục bộ') || button.textContent.includes('Local AI'))
    await act(async () => aiNavBtn.click())
    const socialTab = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))[1]
    await act(async () => socialTab.click())

    const postBatchButton = Array.from(doc.querySelectorAll('button')).find(button => button.textContent.includes('Đăng Thật 2 Bài'))
    assert.ok(postBatchButton, 'Phải có nút đăng thật hai bài trên cả hai nền tảng')
    await act(async () => {
      postBatchButton.click()
      await new Promise(resolve => setTimeout(resolve, 3300))
    })

    assert.deepStrictEqual(cyclePlatforms, ['facebook', 'tiktok'])
    assert.deepStrictEqual(extensionRequests.map(request => request.platform), ['facebook', 'tiktok'])
    assert.strictEqual(extensionRequests[0].post.privacy, 'only_me')
    assert.strictEqual(extensionRequests[1].post.privacy, 'only_me')
    assert.ok(extensionRequests[0].post.imageUrl.endsWith('/products/facebook.jpg'))
    assert.ok(extensionRequests[1].post.imageUrl.endsWith('/products/tiktok.jpg'))
    assert.ok(extensionRequests[0].post.content.includes('Mô tả AI facebook'))
    assert.ok(extensionRequests[1].post.content.includes('Mô tả AI tiktok'))
    assert.deepStrictEqual(publishedPayloads.map(payload => payload.realPostId), ['99112233', '99112234'])
    assert.ok(doc.body.textContent.includes('Đã xác minh 2/2 bài đăng'))
  })
})

test('Giao diện Dark Mode: AdminSocialAutomation.css định nghĩa đầy đủ quy tắc tông xanh ngọc tối #102a1e cho section.social-panel, input và bảng', () => {
  const css = readFileSync(resolve('src/pages/AdminSocialAutomation.css'), 'utf-8')

  assert.ok(css.includes('html[data-admin-theme="dark"] section.social-panel') || css.includes('html[data-admin-theme="dark"] .social-panel'), 'Phải có quy tắc dark theme cho .social-panel')
  assert.ok(css.includes('#102a1e'), 'Dark theme phải dùng nền xanh ngọc đậm #102a1e cho panel')
  assert.ok(css.includes('#0b1d16'), 'Dark theme phải dùng nền xanh đen #0b1d16 cho input/select/textarea')
  assert.ok(css.includes('#28543a'), 'Dark theme phải dùng viền tông xanh ngọc #28543a')
  assert.ok(css.includes('#edf7ef'), 'Dark theme phải dùng chữ sáng #edf7ef tương phản')
  assert.ok(css.includes('html[data-admin-theme="dark"] .social-table th'), 'Phải có dark theme cho header bảng')
  assert.ok(css.includes('html[data-admin-theme="dark"] .social-modal-card'), 'Phải có dark theme cho modal chi tiết bài viết')
  assert.ok(css.includes('html[data-admin-theme="dark"] .social-info-banner'), 'Phải có dark theme cho info banner')
  assert.ok(css.includes('html[data-admin-theme="dark"] .social-alert--error'), 'Phải có dark theme cho alert cards')
})

test('Cấu hình chu kỳ đăng bài hỗ trợ 5 phút, 30 phút, 1 giờ, 2 giờ, 6 giờ và tùy chọn quyền riêng tư Chỉ mình tôi', async () => {
  let savedSettingsPayload = null
  const mockFetch = async (url, opts) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 0, publishedCount: 0, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 0.0833, intervalMinutes: 5, privacy: 'only_me', mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings') && opts?.method === 'POST') {
      savedSettingsPayload = JSON.parse(opts.body)
      return json({ ok: true, settings: { ...savedSettingsPayload } })
    }
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, intervalMinutes: 120, privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    // 1. Chuyển sang AI cục bộ -> Mạng xã hội
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => {
      aiNavBtn.click()
    })
    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    await act(async () => {
      tabButtons[1].click()
    })

    // 2. Kiểm tra dropdown chu kỳ đăng bài có đầy đủ các mốc: 30s, 30m, 1h, 2h, 6h
    const intervalSelect = doc.querySelector('#cfg-interval')
    assert.ok(intervalSelect, 'Phải có dropdown #cfg-interval')
    const options = Array.from(intervalSelect.querySelectorAll('option')).map(o => o.value)
    assert.ok(options.includes('30s'), 'Phải có mốc 30 giây (30s)')
    assert.ok(options.includes('30m'), 'Phải có mốc 30 phút (30m)')
    assert.ok(options.includes('1'), 'Phải có mốc 1 giờ (1)')
    assert.ok(options.includes('2'), 'Phải có mốc 2 giờ (2)')
    assert.ok(options.includes('6'), 'Phải có mốc 6 giờ (6)')

    // 3. Kiểm tra dropdown quyền riêng tư: "Chỉ mình tôi (only_me)" và "Công khai (public)"
    const privacySelect = doc.querySelector('#cfg-privacy')
    assert.ok(privacySelect, 'Phải có dropdown #cfg-privacy')
    const privacyOptions = Array.from(privacySelect.querySelectorAll('option')).map(o => o.value)
    assert.ok(privacyOptions.includes('only_me'), 'Phải có tùy chọn chỉ mình tôi (only_me)')
    assert.ok(privacyOptions.includes('public'), 'Phải có tùy chọn công khai (public)')
    assert.strictEqual(privacySelect.value, 'only_me', 'Mặc định quyền riêng tư phải là only_me')
  })
})

test('Nhật ký bài đăng và Studio hiển thị số liệu trung thực xuất phát từ 0 và trạng thái nháp nội bộ', async () => {
  const mockFetch = async (url) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 0, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts')) return json({ posts: [
      { id: 'post-real-1', productName: 'Tai nghe OmiPro', productPrice: 890000, platform: 'facebook', title: 'Bài viết trung thực', content: 'Nội dung test', status: 'internal_draft', likesCount: 0, sharesCount: 0, commentsCount: 0, triggerTime: '2026-11-19T04:00:00Z', postUrl: null, privacy: 'only_me' }
    ] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral')) return json({ posts: [] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    // Chuyển sang AI cục bộ -> Mạng xã hội -> Nhật ký
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => {
      aiNavBtn.click()
    })
    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    await act(async () => {
      tabButtons[1].click()
    })
    const logsSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật Ký'))
    await act(async () => {
      logsSubnavBtn.click()
    })

    // Kiểm tra dòng hiển thị trong bảng
    const row = doc.querySelector('.social-table tbody tr')
    assert.ok(row, 'Phải có hàng bản ghi nhật ký')
    assert.ok(row.textContent.includes('Bản Nháp') || row.textContent.includes('Nháp nội bộ'), 'Trạng thái bài viết chưa đăng thật phải ghi rõ Bản Nháp hoặc Nháp nội bộ')
    assert.ok(row.textContent.includes('👍 0 · 🔁 0 · 💬 0'), 'Số liệu tương tác khởi tạo phải là 0 thực tế')
    assert.ok(row.textContent.includes('Chưa đăng thật'), 'Khi postUrl là null, phải ghi rõ Chưa đăng thật thay vì link giả')
  })
})

test('Bảng social-table-shell có cấu hình cuộn độc lập (max-height, overflow-y auto, overscroll-behavior contain) và sticky th cố định trên đầu', () => {
  const css = readFileSync(resolve('src/pages/AdminSocialAutomation.css'), 'utf-8')
  assert.ok(css.includes('.social-table-shell'), 'Phải định nghĩa class .social-table-shell')
  assert.ok(css.includes('max-height'), '.social-table-shell phải có giới hạn chiều cao max-height để cuộn nội bộ')
  assert.ok(css.includes('overflow-y: auto'), '.social-table-shell phải có overflow-y: auto')
  assert.ok(css.includes('overscroll-behavior: contain'), '.social-table-shell phải có overscroll-behavior: contain để ngăn cuộn toàn trang')
  assert.ok(css.includes('position: sticky'), '.social-table th phải có position: sticky')
  assert.ok(css.includes('top: 0'), '.social-table th phải có top: 0 để ghim tiêu đề')
})

test('Bridge chỉ ghi nhận bài Facebook sau khi Extension xác nhận permalink thật', async () => {
  let fetchMoreViralCalled = false
  let publishPostCalled = false
  let lastCopiedText = null
  let lastOpenedUrl = null

  const mockFetch = async (url, opts) => {
    const u = String(url)
    if (u.includes('/api/admin/session')) return json(adminSession)
    if (u.includes('/api/admin/presence')) return json({ online: true })
    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })
    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2, from: '2026-11-01', to: '2026-11-19', dataMode: 'real' })
    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 0, pendingCount: 1, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null, isActive: true, intervalHours: 2, mode: 'full_auto' } })
    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'only_me', channels: 'facebook', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })
    if (u.includes('/api/admin/social/posts/post-fb-99/publish')) {
      publishPostCalled = true
      return json({
        ok: true,
        post: {
          id: 'post-fb-99',
          productId: '1',
          productName: 'Tai nghe Bluetooth OmiPro',
          platform: 'facebook',
          title: 'Tai nghe OmiPro cực xịn',
          content: 'Nội dung bài viết OmiPro',
          hashtags: '#OmniCart #TaiNghe',
          status: 'published',
          postUrl: 'https://www.facebook.com/profile.php?id=61580644871703'
        }
      })
    }
    if (u.includes('/api/admin/social/posts/post-fb-99/approve')) {
      return json({
        ok: true,
        post: {
          id: 'post-fb-99',
          productId: '1',
          productName: 'Tai nghe Bluetooth OmiPro',
          platform: 'facebook',
          title: 'Tai nghe OmiPro cực xịn',
          content: 'Nội dung bài viết OmiPro',
          hashtags: '#OmniCart #TaiNghe',
          status: 'published',
          postUrl: 'https://www.facebook.com/profile.php?id=61580644871703'
        }
      })
    }
    if (u.includes('/api/admin/social/posts')) return json({ posts: [
      {
        id: 'post-fb-99',
        productId: '1',
        productName: 'Tai nghe Bluetooth OmiPro',
        productPrice: 890000,
        platform: 'facebook',
        title: 'Tai nghe OmiPro cực xịn',
        content: 'Nội dung bài viết OmiPro',
        hashtags: '#OmniCart #TaiNghe',
        status: 'pending_approval',
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        postUrl: 'https://www.facebook.com/profile.php?id=61580644871703'
      }
    ] })
    if (u.includes('/api/admin/social/groups')) return json({ groups: [] })
    if (u.includes('/api/admin/social/viral/fetch-more') && opts?.method === 'POST') {
      fetchMoreViralCalled = true
      return json({
        ok: true,
        addedCount: 5,
        posts: [
          { id: 'v-new-1', title: 'Top 5 mẹo dùng tai nghe', platform: 'facebook', category: 'Công nghệ', postUrl: 'https://www.facebook.com/profile.php?id=61580644871703', viralityScore: 97, likesCount: 3500, sharesCount: 820, commentsCount: 290, trendingTopic: 'Mẹo công nghệ' }
        ]
      })
    }
    if (u.includes('/api/admin/social/viral')) return json({ posts: [
      { id: 'v-new-1', title: 'Top 5 mẹo dùng tai nghe', platform: 'facebook', category: 'Công nghệ', postUrl: 'https://www.facebook.com/profile.php?id=61580644871703', viralityScore: 97, likesCount: 3500, sharesCount: 820, commentsCount: 290, trendingTopic: 'Mẹo công nghệ' }
    ] })
    return json({})
  }

  await renderAdmin(mockFetch, async (doc) => {
    doc.defaultView.addEventListener('message', (event) => {
      if (event.data?.source !== 'OMNICART_ADMIN_REQUEST' || event.data.action !== 'AUTO_POST') return
      doc.defaultView.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId: event.data.requestId,
        ok: false,
        data: { ok: false, error: 'FACEBOOK_POST_NOT_VERIFIED' },
        error: 'FACEBOOK_POST_NOT_VERIFIED'
      }, '*')
    })

    // Override window.open & navigator.clipboard để spy
    doc.defaultView.open = (url) => { lastOpenedUrl = url }
    if (doc.defaultView.navigator.clipboard) {
      doc.defaultView.navigator.clipboard.writeText = async (txt) => { lastCopiedText = txt }
    }

    // 1. Chuyển sang AI Cục bộ -> Tab Mạng Xã Hội
    const aiNavBtn = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))
    await act(async () => {
      aiNavBtn.click()
    })
    const tabButtons = Array.from(doc.querySelectorAll('.admin-ai-tab-btn'))
    await act(async () => {
      tabButtons[1].click()
    })

    // 2. Chuyển sang Tab Hội nhóm & Viral
    const groupsSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Hội Nhóm'))
    await act(async () => {
      groupsSubnavBtn.click()
    })

    // 3. Kiểm tra nút "🔥 Tải thêm 5 bài viral thực tế" và bấm
    const fetchMoreBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Tải thêm 5 bài viral'))
    assert.ok(fetchMoreBtn, 'Phải có nút 🔥 Tải thêm 5 bài viral thực tế')

    await act(async () => {
      fetchMoreBtn.click()
    })
    assert.strictEqual(fetchMoreViralCalled, true, 'Phải gọi API POST /api/admin/social/viral/fetch-more')

    // 4. Chuyển sang Tab Nhật Ký
    const logsSubnavBtn = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật Ký'))
    await act(async () => {
      logsSubnavBtn.click()
    })

    // Kiểm tra link trỏ tới profile facebook John Harper
    const link = doc.querySelector('.social-table-link')
    assert.ok(link, 'Phải có liên kết bài viết')
    assert.ok(link.getAttribute('href').includes('61580644871703'), 'Link bài viết phải trỏ tới Facebook cá nhân John Harper (id 61580644871703)')

    // 5. Bấm nút Đăng FB
    const publishBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Đăng FB'))
    assert.ok(publishBtn, 'Phải có nút 🚀 Đăng FB')
    await act(async () => {
      publishBtn.click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    assert.strictEqual(publishPostCalled, false, 'Không được dùng API giả để đánh dấu bài là đã đăng')
    assert.strictEqual(lastOpenedUrl, null, 'Luồng tự động không được mở trang cá nhân thay cho đăng bài')
    assert.strictEqual(lastCopiedText, null, 'Luồng tự động không được coi sao chép clipboard là đăng thành công')

    // 6. Kiểm tra nút Duyệt & Đăng cho bài chờ duyệt
    const approveBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Duyệt & Đăng'))
    assert.ok(approveBtn, 'Phải có nút ✓ Duyệt & Đăng cho bài chờ duyệt')
    lastOpenedUrl = null
    lastCopiedText = null
    await act(async () => {
      approveBtn.click()
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    assert.strictEqual(publishPostCalled, false, 'Duyệt bài phải qua Extension thay vì tự ghi trạng thái đã đăng')
    assert.strictEqual(lastOpenedUrl, null)
    assert.strictEqual(lastCopiedText, null)
  })
})
