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

  dom.window.open = () => {}

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



test('Social v3.1: có bộ sắp xếp hội nhóm, bộ sắp xếp 2 cột viral và nút xuất Excel (.xlsx)', async () => {

  assert.strictEqual(privacyForSocialPlatform('facebook', 'public'), 'public')

  const mockFetch = async (url) => {

    const u = String(url)

    if (u.includes('/api/admin/session')) return json(adminSession)

    if (u.includes('/api/admin/presence')) return json({ online: true })

    if (u.includes('/api/admin/settings')) return json({ model: 'qwen3.5:4b', contextSize: 16384, allowedContextSizes: [8192, 16384] })

    if (u.includes('/api/admin/stats')) return json({ grossRevenue: 1000000, refunds: 0, netRevenue: 1000000, includedOrders: 2 })

    if (u.includes('/api/admin/social/stats')) return json({ stats: { totalPostsToday: 1, publishedCount: 1, pendingCount: 0, failedCount: 0, totalLikes: 0, totalShares: 0, totalComments: 0, isActive: true, intervalHours: 2, mode: 'full_auto' } })

    if (u.includes('/api/admin/social/settings')) return json({ settings: { id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, privacy: 'public', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging', includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true, contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}' } })

    if (u.includes('/api/admin/social/posts')) return json({ posts: [{ id: 'p1', productName: 'Giày', productPrice: 200000, platform: 'tiktok', title: 'Test', content: 'Body', status: 'published', likesCount: 0, sharesCount: 0, commentsCount: 0, triggerTime: '2026-11-20T10:00:00Z' }] })

    if (u.includes('/api/admin/social/groups')) return json({ groups: [{ id: 'g1', groupName: 'B Group', groupUrl: 'https://www.facebook.com/groups/b/', category: 'Test', membersCount: 10000, interactionRate: 'Cao', isAutoShare: true }, { id: 'g2', groupName: 'A Group', groupUrl: 'https://www.facebook.com/groups/a/', category: 'Test', membersCount: 50000, interactionRate: 'Rất cao', isAutoShare: true }] })

    if (u.includes('/api/admin/social/viral')) return json({ posts: [{ id: 'v1', title: 'FB Viral', platform: 'facebook', postUrl: 'https://www.facebook.com/posts/1', summary: 'x', likesCount: 9000 }, { id: 'v2', title: 'TT Viral', platform: 'tiktok', postUrl: 'https://www.tiktok.com/@u/video/1', summary: 'y', likesCount: 90000 }] })

    return json({})

  }



  await renderAdmin(mockFetch, async (doc) => {

    const aiNav = Array.from(doc.querySelectorAll('.admin-sidebar nav button')).find(b => b.textContent.includes('AI cục bộ') || b.textContent.includes('Local AI'))

    await act(async () => aiNav.click())

    await act(async () => doc.querySelectorAll('.admin-ai-tab-btn')[1].click())



    // Tab 3: Hội nhóm & Viral

    const groupsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Hội Nhóm'))

    await act(async () => groupsTab.click())

    assert.ok(doc.querySelector('#sort-groups'), 'Phải có bộ sắp xếp hội nhóm')

    assert.ok(doc.querySelector('select[aria-label="Sắp xếp bài viral Facebook"]'), 'Phải có bộ sắp xếp viral Facebook')

    assert.ok(doc.querySelector('select[aria-label="Sắp xếp bài viral TikTok"]'), 'Phải có bộ sắp xếp viral TikTok')



    // Tab 4: Nhật ký -> nút Xuất Excel (.xlsx) thay cho CSV

    const logsTab = Array.from(doc.querySelectorAll('.social-subnav-btn')).find(b => b.textContent.includes('Nhật Ký'))

    await act(async () => logsTab.click())

    const excelBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.includes('Xuất Báo Cáo Excel (.xlsx)'))

    assert.ok(excelBtn, 'Phải có nút Xuất Báo Cáo Excel (.xlsx)')

  })



  const css = readFileSync(resolve('src/pages/AdminSocialAutomation.css'), 'utf-8')

  assert.ok(css.includes('.social-sort-select'))

})
