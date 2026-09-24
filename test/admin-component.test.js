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

const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
const session = (username) => ({ authenticated: true, username, csrfToken: 'csrf-' + username })
const settings = { model: 'test-model', contextSize: 8192, allowedContextSizes: [8192, 16384] }

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
  const button = (label) => {
    const buttons = [...document.querySelectorAll('button')]
    return buttons.find((item) => item.textContent.trim() === label) || buttons.find((item) => item.textContent.includes(label))
  }
  const click = async (label) => { const target = button(label); assert.ok(target, label); await act(async () => target.click()) }
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
    await click('AI local')
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
    assert.equal(document.querySelector('.admin-context select').value, '8192')
  })
})

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
    await click('AI local')
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
