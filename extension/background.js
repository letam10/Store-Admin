/*
  FILE NOTE
  - Mục đích: Service Worker nền (Manifest V3) v3.3.0 — Chạy ngầm không cần mở xem tab, Checkpoint nhớ bước, cào Viral đa từ khóa AI (tách FB Trang chủ & Reels) và mở link gọn 1 tab.
  - Liên kết trực tiếp: manifest.json, vision-engine.js, content-facebook.js, content-tiktok.js, content-admin-bridge.js
  - Vùng ảnh hưởng khi sửa: Điều phối luồng đăng bài, cào viral, duy trì tab và giao tiếp với Store-Admin.
*/

const FB_POST_HOME_URL = 'https://www.facebook.com/me'
const TIKTOK_STUDIO_HOME_URL = 'https://www.tiktok.com/tiktokstudio'
const TIKTOK_CONTENT_URL = 'https://www.tiktok.com/tiktokstudio/content'
const TIKTOK_PROFILE_REDIRECT_URL = 'https://www.tiktok.com/profile'
const ADMIN_DEFAULT_ORIGIN = 'http://localhost:5174'
const MAX_PRODUCT_IMAGE_BYTES = 15 * 1024 * 1024

const ALARM_KEEPALIVE = 'omnicart-247-heartbeat'
const ALARM_PENDING_VERIFY = 'omnicart-verify-pending-posts'
const STORAGE_PENDING_KEY = 'omnicartPendingVerifications'
const STORAGE_RESOLVED_KEY = 'omnicartResolvedVerifications'
const STORAGE_SCRAPE_CURSOR_KEY = 'omnicartScrapeCursors'
const STORAGE_CHECKPOINTS_KEY = 'omnicartJobCheckpoints'
const STORAGE_KNOWLEDGE_KEY = 'omnicartLearnedSelectors'
const pendingBridgeFetches = new Map()
let knowledgeSyncedFromServer = false

const DEFAULT_VISION_CONFIG = {
  showHud: true,
  pacingMode: 'normal',
  aiMode: 'layout',
  provider: 'ollama',
  endpoint: 'http://localhost:11434/api/chat',
  model: 'qwen3.5:4b',
  apiKey: ''
}

const GROUP_SEARCH_KEYWORDS = [
  'mua sắm review', 'nghiện nhà decor', 'đồ gia dụng tiện ích',
  'thời trang săn deal', 'mẹ và bé review', 'công nghệ phụ kiện',
  'ẩm thực nấu ăn ngon', 'làm đẹp chăm sóc da'
]

// Bộ từ khóa đa dạng dự phòng cho từng chủ đề (khi không truyền hoặc bổ sung cho AI Local)
const VIRAL_TOPIC_PRESETS = {
  all: {
    label: '',
    fbFeedSources: ['https://www.facebook.com/', 'https://www.facebook.com/groups/feed/'],
    fbReelSources: ['https://www.facebook.com/reel/', 'https://www.facebook.com/watch/'],
    ttSources: ['https://www.tiktok.com/explore', 'https://www.tiktok.com/foryou'],
    ttExploreTab: ''
  },
  vehicles: {
    label: 'Xe cộ',
    fbKeywords: ['review ô tô', 'xe máy độ đẹp', 'siêu xe việt nam', 'đánh giá xe hơi', 'xe điện vinfast', 'xe cộ viral'],
    ttKeywords: ['review xe hơi', 'siêu xe việt nam', 'car edit', 'xe máy độ', 'motor edit', 'supercar viral'],
    ttExploreTab: 'Xe hơi'
  },
  anime: {
    label: 'Anime',
    fbKeywords: ['anime vietsub', 'anime edit', 'review anime hay', 'jujutsu kaisen vietsub', 'one piece vietsub', 'anime tiktok'],
    ttKeywords: ['anime edit', 'anime vietsub', 'jujutsu kaisen edit', 'one piece edit', 'naruto edit', 'anime viral', 'demon slayer edit'],
    ttExploreTab: 'Anime'
  },
  cartoon: {
    label: 'Hoạt hình',
    fbKeywords: ['phim hoạt hình review', 'hoạt hình 3d trung quốc', 'doraemon vietsub', 'conan vietsub', 'hoạt hình disney'],
    ttKeywords: ['hoạt hình 3d', 'donghua edit', 'doraemon edit', 'conan edit', 'pixar animation', 'cartoon edit'],
    ttExploreTab: ''
  },
  game: {
    label: 'Game',
    fbKeywords: ['liên quân mobile highlight', 'lmht highlight', 'valorant việt nam', 'gaming highlight', 'gta 5 việt nam', 'game mobile hay'],
    ttKeywords: ['gaming highlight', 'liên quân mobile', 'league of legends edit', 'valorant clutch', 'minecraft viral', 'game edit'],
    ttExploreTab: 'Trò chơi'
  },
  new_product: {
    label: 'Quảng bá sản phẩm mới',
    fbKeywords: ['unbox sản phẩm mới', 'review đồ công nghệ mới', 'ra mắt sản phẩm mới', 'đồ gia dụng thông minh review', 'săn deal đồ tiện ích'],
    ttKeywords: ['unbox review', 'đồ gia dụng thông minh', 'review đồ tiện ích', 'tech unboxing', 'amazon finds viral', 'tiktok made me buy it'],
    ttExploreTab: ''
  },
  electronics_compare: {
    label: 'So sánh sản phẩm điện tử',
    fbKeywords: ['so sánh iphone samsung', 'so sánh laptop', 'so sánh điện thoại', 'so sánh tai nghe', 'đánh giá công nghệ'],
    ttKeywords: ['so sánh iphone', 'iphone vs samsung', 'laptop review', 'tech comparison', 'so sánh điện thoại', 'smartphone test'],
    ttExploreTab: ''
  }
}

const adminPorts = new Set()
const activeJobs = new Map()
const recentLogs = []
const scraperTabIds = { fbFeed: null, fbReels: null, ttViral: null, fbGroups: null }
let viralViewerTabId = null
let keepAliveTimer = null
let verificationCheckInFlight = false

function getExtensionVersion() { return chrome.runtime.getManifest().version }

function pushLog(entry) {
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), ...entry }
  recentLogs.unshift(item)
  if (recentLogs.length > 90) recentLogs.length = 90
  broadcastToAdmins({ type: 'PROGRESS_EVENT', event: item })
}

function broadcastToAdmins(payload) {
  for (const port of Array.from(adminPorts)) {
    try { port.postMessage(payload) } catch (_) { adminPorts.delete(port) }
  }
}

function ensureKeepAlive() {
  if (activeJobs.size > 0 && !keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      if (activeJobs.size === 0) { clearInterval(keepAliveTimer); keepAliveTimer = null; return }
      try { chrome.runtime.getPlatformInfo(() => {}) } catch (_) {}
    }, 15000)
  } else if (activeJobs.size === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

function setup247Alarms() {
  try {
    chrome.alarms.create(ALARM_KEEPALIVE, { periodInMinutes: 1 })
    chrome.alarms.create(ALARM_PENDING_VERIFY, { delayInMinutes: 0.5, periodInMinutes: 0.5 })
  } catch (_) {}
}

chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (alarm?.name === ALARM_PENDING_VERIFY) await processPendingVerifications()
})

// =========================================================================
// GIỮ TAB CHẠY NGẦM LUÔN THỨC (CHỐNG CHROME ĐÓNG BĂNG / BÓP TAB NỀN!)
// =========================================================================

async function ensureTabAwake(tabId) {
  if (!tabId) return
  try { await chrome.tabs.update(tabId, { autoDiscardable: false }) } catch (_) {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        window.__OMNICART_KEEP_AWAKE__ = true
        if (window.__OMNICART_AWAKE_PATCHED__) {
          try { document.dispatchEvent(new Event('visibilitychange')) } catch (_) {}
          try { window.dispatchEvent(new Event('focus')) } catch (_) {}
          return
        }
        window.__OMNICART_AWAKE_PATCHED__ = true
        try {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
          Object.defineProperty(document, 'webkitHidden', { configurable: true, get: () => false })
          Object.defineProperty(document, 'webkitVisibilityState', { configurable: true, get: () => 'visible' })
          document.hasFocus = () => true
        } catch (_) {}

        // Khi tab ẩn, native rAF bị Chrome dừng — tạo nhánh fallback setTimeout(16ms) để React/Dialog/Feed luôn render!
        const origRAF = window.requestAnimationFrame?.bind(window)
        if (origRAF) {
          window.requestAnimationFrame = function patchedRAF(cb) {
            if (!window.__OMNICART_KEEP_AWAKE__) return origRAF(cb)
            let called = false
            const run = (ts) => {
              if (called) return
              called = true
              try { cb(ts || performance.now()) } catch (_) {}
            }
            const timerId = setTimeout(() => run(performance.now()), 32)
            origRAF((ts) => { clearTimeout(timerId); run(ts) })
            return timerId
          }
        }
        try { document.dispatchEvent(new Event('visibilitychange')) } catch (_) {}
        try { window.dispatchEvent(new Event('focus')) } catch (_) {}
      }
    })
  } catch (_) {}
}

// =========================================================================
// CHECKPOINT NHỚ BƯỚC (CHỐNG MẤT BƯỚC HOẶC ĐĂNG TRÙNG KHI VĂNG / TẢI LẠI TRANG)
// =========================================================================

async function getJobCheckpoints() {
  const res = await chrome.storage.local.get(STORAGE_CHECKPOINTS_KEY)
  return res?.[STORAGE_CHECKPOINTS_KEY] || {}
}

async function saveJobCheckpoint(platform, patch) {
  const all = await getJobCheckpoints()
  const prev = all[platform] || { completedSteps: [] }
  const mergedSteps = Array.from(new Set([...(prev.completedSteps || []), ...(patch.completedSteps || [])]))
  if (patch.completedStep) {
    if (!mergedSteps.includes(patch.completedStep)) mergedSteps.push(patch.completedStep)
  }
  const next = {
    ...prev,
    ...patch,
    completedSteps: patch.resetSteps ? [] : mergedSteps,
    updatedAt: Date.now()
  }
  delete next.completedStep
  delete next.resetSteps
  all[platform] = next
  await chrome.storage.local.set({ [STORAGE_CHECKPOINTS_KEY]: all })
  return next
}

async function clearJobCheckpoint(platform) {
  const all = await getJobCheckpoints()
  delete all[platform]
  await chrome.storage.local.set({ [STORAGE_CHECKPOINTS_KEY]: all })
}

// =========================================================================
// MỞ BÀI VIRAL GỌN TRÊN 1 TAB DUY NHẤT (TRÁNH MỞ NHIỀU TAB GÂY LAG)
// =========================================================================

async function openUrlInSingleViewerTab(url) {
  if (!url) return { ok: false, error: 'URL_REQUIRED' }
  if (viralViewerTabId) {
    try {
      const existing = await chrome.tabs.get(viralViewerTabId)
      if (existing?.id) {
        await chrome.tabs.update(existing.id, { url, active: true })
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true }).catch(() => {})
        return { ok: true, tabId: existing.id, reused: true }
      }
    } catch (_) {
      viralViewerTabId = null
    }
  }
  const created = await chrome.tabs.create({ url, active: true })
  viralViewerTabId = created.id
  return { ok: true, tabId: created.id, reused: false }
}

async function getVisionConfig() {
  const stored = await chrome.storage.local.get('visionConfig')
  return { ...DEFAULT_VISION_CONFIG, ...(stored?.visionConfig || {}) }
}

async function saveVisionConfig(patch) {
  const next = { ...(await getVisionConfig()), ...(patch || {}) }
  await chrome.storage.local.set({ visionConfig: next })
  for (const tab of await chrome.tabs.query({})) {
    if (tab.url && (tab.url.includes('facebook.com') || tab.url.includes('tiktok.com'))) {
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config: next }).catch(() => {})
    }
  }
  return next
}

async function getScrapeCursors() {
  const res = await chrome.storage.local.get(STORAGE_SCRAPE_CURSOR_KEY)
  return { tiktokRunCount: 0, groupRunCount: 0, ...(res?.[STORAGE_SCRAPE_CURSOR_KEY] || {}) }
}

async function saveScrapeCursors(patch) {
  const next = { ...(await getScrapeCursors()), ...(patch || {}) }
  await chrome.storage.local.set({ [STORAGE_SCRAPE_CURSOR_KEY]: next })
  return next
}

async function reinjectAdminBridges() {
  try {
    for (const tab of await chrome.tabs.query({})) {
      if (tab.id && tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url)) {
        try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-admin-bridge.js'] }) } catch (_) {}
      }
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => { setup247Alarms(); reinjectAdminBridges() })
chrome.runtime.onStartup.addListener(() => { setup247Alarms(); reinjectAdminBridges() })
setup247Alarms()

// =========================================================================
// HÀNG ĐỢI THEO DÕI XÉT DUYỆT TIKTOK
// =========================================================================

async function getPendingVerifications() {
  const res = await chrome.storage.local.get(STORAGE_PENDING_KEY)
  return Array.isArray(res?.[STORAGE_PENDING_KEY]) ? res[STORAGE_PENDING_KEY] : []
}
async function savePendingVerifications(list) { await chrome.storage.local.set({ [STORAGE_PENDING_KEY]: list }) }
async function getResolvedVerifications() {
  const res = await chrome.storage.local.get(STORAGE_RESOLVED_KEY)
  return Array.isArray(res?.[STORAGE_RESOLVED_KEY]) ? res[STORAGE_RESOLVED_KEY] : []
}
async function saveResolvedVerifications(list) { await chrome.storage.local.set({ [STORAGE_RESOLVED_KEY]: list.slice(0, 30) }) }

async function enqueuePendingVerification(item) {
  const list = (await getPendingVerifications()).filter((x) => x.postId !== item.postId)
  list.push({ ...item, createdAtMs: Date.now(), checks: 0, maxChecks: 20 })
  await savePendingVerifications(list)
  try { chrome.alarms.create(ALARM_PENDING_VERIFY, { delayInMinutes: 0.5, periodInMinutes: 0.5 }) } catch (_) {}
  pushLog({ platform: 'tiktok', step: 'pending_review', level: 'info', message: `⏳ Đang theo dõi xét duyệt TikTok #${item.postId} (~2–3 phút)...` })
}

async function processPendingVerifications() {
  if (verificationCheckInFlight) return
  const pending = await getPendingVerifications()
  if (!pending.length) return

  verificationCheckInFlight = true
  try {
    const remaining = []
    const resolvedList = await getResolvedVerifications()
    const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']

    for (const item of pending) {
      if (item.platform !== 'tiktok') continue
      item.checks = (item.checks || 0) + 1

      try {
        let tab = await findOrCreateTikTokPostTab()
        await ensureTabAwake(tab.id)
        const onStudioPosts = Boolean(tab.url && /tiktok\.com\/tiktokstudio\/(content|home)?(\?|$)/i.test(tab.url))
        if (!onStudioPosts) tab = await navigateTabAndWait(tab.id, TIKTOK_CONTENT_URL, 2600)

        let check = await sendTabMessageWithRetry(
          tab.id,
          { type: 'TIKTOK_CHECK_POST_STATUS', options: { titleProbe: item.titleProbe, accountHandle: item.account, refreshViaSidebar: onStudioPosts } },
          scripts
        )

        if (check?.status === 'rejected') {
          const rejectEvent = {
            postId: item.postId, platform: 'tiktok', status: 'failed', rejected: true,
            error: check.error || 'Bài đăng TikTok bị từ chối duyệt.'
          }
          resolvedList.unshift(rejectEvent)
          await saveResolvedVerifications(resolvedList)
          pushLog({ platform: 'tiktok', step: 'review_rejected', level: 'error', message: `🔴 ${rejectEvent.error}` })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: rejectEvent })
          continue
        }

        if (check?.status === 'approved_need_profile_link') {
          const profileUrl = check?.accountHandle
            ? `https://www.tiktok.com/${check.accountHandle.startsWith('@') ? check.accountHandle : '@' + check.accountHandle}`
            : TIKTOK_PROFILE_REDIRECT_URL
          tab = await navigateTabAndWait(tab.id, profileUrl, 2800)
          check = await sendTabMessageWithRetry(
            tab.id,
            { type: 'TIKTOK_CHECK_POST_STATUS', options: { titleProbe: item.titleProbe, accountHandle: check?.accountHandle || item.account } },
            scripts
          )
          await navigateTabAndWait(tab.id, TIKTOK_STUDIO_HOME_URL, 1500).catch(() => {})
        }

        if (check?.status === 'published' && check.postUrl) {
          const resolvedEvent = {
            postId: item.postId, platform: 'tiktok', status: 'published',
            postUrl: check.postUrl, realPostId: check.postId || `tiktok-${Date.now()}`,
            privacy: item.privacy, publishedTime: new Date().toISOString(),
            account: check.accountHandle || item.account
          }
          resolvedList.unshift(resolvedEvent)
          await saveResolvedVerifications(resolvedList)
          pushLog({ platform: 'tiktok', step: 'review_resolved', level: 'success', message: `✅ TikTok đã duyệt bài #${item.postId}: ${check.postUrl}` })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: resolvedEvent })
          continue
        }

        if (item.checks >= (item.maxChecks || 20)) {
          broadcastToAdmins({
            type: 'POST_VERIFICATION_RESOLVED',
            payload: { postId: item.postId, platform: 'tiktok', status: 'unverified', error: 'Quá 10 phút chờ xét duyệt TikTok.' }
          })
          continue
        }

        pushLog({ platform: 'tiktok', step: 'review_waiting', level: 'info', message: `⏳ Xét duyệt TikTok #${item.postId} (${item.checks}/20): ${check?.message || 'Đang xét duyệt...'}` })
        remaining.push(item)
      } catch (_) {
        if (item.checks < (item.maxChecks || 20)) remaining.push(item)
      }
    }
    await savePendingVerifications(remaining)
  } finally {
    verificationCheckInFlight = false
  }
}

// =========================================================================
// PERSISTENT PORT TỚI STORE-ADMIN
// =========================================================================

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== 'omnicart-admin-bridge' && port.name !== 'omnicart-popup') return
  adminPorts.add(port)
  const [pendingVerifications, resolvedVerifications] = await Promise.all([getPendingVerifications(), getResolvedVerifications()])
  try {
    port.postMessage({ type: 'BRIDGE_HELLO', version: getExtensionVersion(), activeJobs: Array.from(activeJobs.values()), pendingVerifications, resolvedVerifications, recentLogs: recentLogs.slice(0, 18) })
  } catch (_) {}

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'BRIDGE_API_FETCH_RESULT' && msg.fetchId) {
      const pending = pendingBridgeFetches.get(msg.fetchId)
      if (pending) { pendingBridgeFetches.delete(msg.fetchId); pending.resolve(msg) }
      return
    }
    if (!msg) return
    if (msg.type === 'HEARTBEAT') { port.postMessage({ type: 'HEARTBEAT_ACK', ts: Date.now(), version: getExtensionVersion() }); return }
    if (msg.type === 'ACK_RESOLVED_VERIFICATION' && msg.postId) {
      await saveResolvedVerifications((await getResolvedVerifications()).filter((r) => r.postId !== msg.postId))
      return
    }
    if (msg.type === 'ADMIN_COMMAND' && msg.requestId) {
      try {
        const result = await dispatchCommand(msg.command, { tab: port.sender?.tab })
        port.postMessage({ type: 'ADMIN_COMMAND_RESULT', requestId: msg.requestId, ok: result?.ok === true, data: result, error: result?.ok === true ? null : (result?.error || 'COMMAND_FAILED') })
      } catch (err) {
        port.postMessage({ type: 'ADMIN_COMMAND_RESULT', requestId: msg.requestId, ok: false, data: null, error: err.message || String(err) })
      }
    }
  })
  port.onDisconnect.addListener(() => adminPorts.delete(port))
})

// =========================================================================
// QUẢN LÝ TAB & ĐIỀU HƯỚNG GIỮ TAB LUÔN HOẠT ĐỘNG NGẦM
// =========================================================================

async function waitForTabComplete(tabId, timeoutMs = 22000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete') return tab
    } catch (_) { throw new Error('TAB_CLOSED_UNEXPECTEDLY') }
    await new Promise((r) => setTimeout(r, 320))
  }
  throw new Error('TAB_LOAD_TIMEOUT')
}

async function navigateTabAndWait(tabId, url, settleMs = 2400) {
  await chrome.tabs.update(tabId, { url, autoDiscardable: false })
  await waitForTabComplete(tabId, 24000)
  await ensureTabAwake(tabId)
  await new Promise((r) => setTimeout(r, settleMs))
  await ensureTabAwake(tabId)
  return await chrome.tabs.get(tabId)
}

async function sendTabMessageWithRetry(tabId, message, scriptFiles) {
  await waitForTabComplete(tabId)
  await ensureTabAwake(tabId)
  try {
    const res = await chrome.tabs.sendMessage(tabId, message)
    if (res) return res
    throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
  } catch (err) {
    const receiverMissing = /receiving end does not exist|could not establish connection|no content script response|message port closed/i.test(err.message || '')
    if (receiverMissing && scriptFiles && chrome.scripting) {
      await chrome.scripting.executeScript({ target: { tabId }, files: Array.isArray(scriptFiles) ? scriptFiles : [scriptFiles] })
      await ensureTabAwake(tabId)
      await new Promise((r) => setTimeout(r, 900))
      const retryRes = await chrome.tabs.sendMessage(tabId, message)
      if (retryRes) return retryRes
      throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
    }
    throw err
  }
}

function isScraperOrViewerTabId(tabId) {
  return tabId === scraperTabIds.fbFeed || tabId === scraperTabIds.fbReels ||
    tabId === scraperTabIds.ttViral || tabId === scraperTabIds.fbGroups ||
    tabId === viralViewerTabId
}

async function findOrCreateFacebookPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => !isScraperOrViewerTabId(tab.id) && tab.url && /(^|\.)facebook\.com/i.test(new URL(tab.url).hostname))
  if (existing) { await ensureTabAwake(existing.id); return existing }
  const created = await chrome.tabs.create({ url: FB_POST_HOME_URL, active: false })
  await chrome.tabs.update(created.id, { autoDiscardable: false }).catch(() => {})
  await waitForTabComplete(created.id, 22000)
  await ensureTabAwake(created.id)
  await new Promise((r) => setTimeout(r, 2400))
  return created
}

async function findOrCreateTikTokPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => !isScraperOrViewerTabId(tab.id) && tab.url && /(^|\.)tiktok\.com/i.test(new URL(tab.url).hostname) && /\/(tiktokstudio|creator-center|upload)/i.test(tab.url))
  if (existing) { await ensureTabAwake(existing.id); return existing }
  const created = await chrome.tabs.create({ url: TIKTOK_STUDIO_HOME_URL, active: false })
  await chrome.tabs.update(created.id, { autoDiscardable: false }).catch(() => {})
  await waitForTabComplete(created.id, 22000)
  await ensureTabAwake(created.id)
  await new Promise((r) => setTimeout(r, 2500))
  return created
}

async function openOrReuseScraperTab(key, url, settleMs = 2600) {
  const existingId = scraperTabIds[key]
  if (existingId) {
    try {
      const tab = await chrome.tabs.get(existingId)
      if (tab?.id) return await navigateTabAndWait(tab.id, url, settleMs)
    } catch (_) { scraperTabIds[key] = null }
  }
  const created = await chrome.tabs.create({ url, active: false })
  scraperTabIds[key] = created.id
  await chrome.tabs.update(created.id, { autoDiscardable: false }).catch(() => {})
  await waitForTabComplete(created.id, 24000)
  await ensureTabAwake(created.id)
  await new Promise((r) => setTimeout(r, settleMs))
  await ensureTabAwake(created.id)
  return await chrome.tabs.get(created.id)
}

function resolveProductImageUrl(rawValue, senderTabUrl) {
  const value = String(rawValue || '').trim()
  if (!value) throw new Error('PRODUCT_IMAGE_REQUIRED')
  if (value.startsWith('data:image/')) return value
  if (value.startsWith('/')) return `${senderTabUrl ? new URL(senderTabUrl).origin : ADMIN_DEFAULT_ORIGIN}${value}`
  let parsed
  try { parsed = new URL(value) } catch (_) { throw new Error('PRODUCT_IMAGE_URL_INVALID') }
  if (!(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) && parsed.protocol !== 'https:') throw new Error('PRODUCT_IMAGE_URL_NOT_ALLOWED')
  return parsed.href
}

async function loadProductImageDataUrl(imageUrl, senderTabUrl) {
  const resolved = resolveProductImageUrl(imageUrl, senderTabUrl)
  if (resolved.startsWith('data:image/')) return resolved
  const response = await fetch(resolved, { credentials: 'omit' })
  if (!response.ok) throw new Error(`PRODUCT_IMAGE_HTTP_${response.status}`)
  const blob = await response.blob()
  if (!blob.size || blob.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('PRODUCT_IMAGE_SIZE_INVALID')
  let contentType = (response.headers.get('content-type') || blob.type || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(resolved)) contentType = resolved.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'
    else throw new Error('PRODUCT_IMAGE_TYPE_INVALID')
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return `data:${contentType};base64,${btoa(binary)}`
}

function normalizeHashtagsField(raw) {
  if (!raw) return ''
  if (Array.isArray(raw)) return raw.map((t) => String(t || '').trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
  return String(raw).trim()
}

async function preparePostPayload(postData, senderTabUrl) {
  if (!postData || typeof postData !== 'object') throw new Error('POST_DATA_REQUIRED')
  const rawImage = postData.imageDataUrl || postData.imageUrl
  if (!rawImage) throw new Error('PRODUCT_IMAGE_REQUIRED')
  const privacy = String(postData.privacy || 'only_me').toLowerCase()
  if (!['only_me', 'public'].includes(privacy)) throw new Error('INVALID_PRIVACY')
  return {
    ...postData,
    postId: postData.postId || postData.id || `job-${Date.now()}`,
    title: String(postData.title || postData.headline || '').trim(),
    content: String(postData.content || postData.description || postData.caption || postData.body || '').trim(),
    hashtags: normalizeHashtagsField(postData.hashtags || postData.tags),
    privacy,
    imageDataUrl: await loadProductImageDataUrl(rawImage, senderTabUrl)
  }
}

function isConfirmedPostResponse(response, platform, requestedPrivacy) {
  if (response?.ok !== true || response.platform !== platform) return false
  if (response.privacy && response.privacy !== requestedPrivacy) return false
  if (response.pendingReview === true && platform === 'tiktok') return true
  return typeof response.postUrl === 'string' && response.postUrl.length > 0
}

// =========================================================================
// ĐĂNG BÀI VỚI CHECKPOINT PHỤC HỒI CHÍNH XÁC BƯỚC KHI VĂNG / TẢI LẠI TRANG
// =========================================================================

async function executeWithRecovery(platform, postData, senderTabUrl) {
  if (activeJobs.has(platform)) return { ok: false, error: `${platform.toUpperCase()}_JOB_ALREADY_RUNNING` }
  activeJobs.set(platform, { platform, startedAt: new Date().toISOString(), step: 'init' })
  ensureKeepAlive()

  try {
    const config = await getVisionConfig()
    const preparedPost = await preparePostPayload(postData, senderTabUrl)
    const scripts = platform === 'facebook'
      ? ['vision-engine.js', 'content-media.js', 'content-facebook.js']
      : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    const msgType = platform === 'facebook' ? 'FB_EXECUTE_POST' : 'TIKTOK_EXECUTE_POST'

    // Tạo checkpoint mới cho bài viết này
    await saveJobCheckpoint(platform, {
      postId: preparedPost.postId,
      platform,
      privacy: preparedPost.privacy,
      step: 'init',
      resetSteps: true,
      existingPermalinks: [],
      titleProbe: (preparedPost.title || preparedPost.content || '').slice(0, 40)
    })

    let response = null
    for (let attempt = 1; attempt <= 4; attempt++) {
      const checkpoint = (await getJobCheckpoints())[platform] || { postId: preparedPost.postId, completedSteps: [] }
      const alreadySubmitted = (checkpoint.completedSteps || []).includes('submitted')

      try {
        let tab = platform === 'facebook' ? await findOrCreateFacebookPostTab() : await findOrCreateTikTokPostTab()
        await ensureTabAwake(tab.id)
        chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})

        response = await sendTabMessageWithRetry(
          tab.id,
          { type: msgType, payload: preparedPost, checkpoint: { ...checkpoint, attempt, verifyOnly: alreadySubmitted } },
          scripts
        )

        if (response?.needsNavigation && response.targetUrl) {
          const latestCp = (await getJobCheckpoints())[platform] || checkpoint
          const stepName = latestCp.step || 'init'
          const submittedNow = (latestCp.completedSteps || []).includes('submitted')
          pushLog({
            platform,
            step: 'recover',
            level: 'warn',
            message: submittedNow
              ? `Trang vừa tải lại sau bước Đăng (lần ${attempt}/4) — đang quay về kiểm chứng bài thay vì đăng trùng...`
              : `Trang bị chuyển hướng ở bước "${stepName}" (lần ${attempt}/4) — đang quay lại đúng trang để làm tiếp...`
          })
          // Nếu bị văng trước lúc bấm Đăng thì reset các bước DOM vì hộp thoại đã đóng khi điều hướng
          if (!submittedNow) await saveJobCheckpoint(platform, { step: 'navigated', resetSteps: true })
          await navigateTabAndWait(tab.id, response.targetUrl, 2800)
          continue
        }
        break
      } catch (err) {
        const recoverable = /message port closed|tab_closed|receiving end|no content script/i.test(err.message || '')
        if (recoverable && attempt < 4) {
          const latestCp = (await getJobCheckpoints())[platform] || checkpoint
          const submittedNow = (latestCp.completedSteps || []).includes('submitted')
          pushLog({
            platform,
            step: 'recover',
            level: 'warn',
            message: submittedNow
              ? `Tab ${platform} tải lại sau khi đã bấm Đăng — tự nối lại kiểm chứng kết quả (lần ${attempt + 1}/4)...`
              : `Tab ${platform} vừa tải lại ở bước "${latestCp.step || 'init'}" — đang tự nối lại tiếp tục (lần ${attempt + 1}/4)...`
          })
          await new Promise((r) => setTimeout(r, 2200))
          continue
        }
        throw err
      }
    }

    if (!isConfirmedPostResponse(response, platform, preparedPost.privacy)) {
      const errMsg = response?.error || `${platform.toUpperCase()}_POST_NOT_VERIFIED`
      pushLog({ platform, step: 'failed', level: 'error', message: `Đăng ${platform} thất bại: ${errMsg}` })
      return { ok: false, error: errMsg, visionTrace: response?.visionTrace || [] }
    }

    if (platform === 'tiktok' && response.pendingReview && preparedPost.postId) {
      await enqueuePendingVerification({
        postId: preparedPost.postId, platform: 'tiktok', privacy: preparedPost.privacy,
        titleProbe: response.titleProbe || preparedPost.title.slice(0, 40), account: response.account || ''
      })
    } else if (response.postUrl) {
      pushLog({ platform, step: 'done', level: 'success', message: `✅ Đã đăng ${platform} thành công!` })
    }
    return response
  } catch (err) {
    pushLog({ platform, step: 'error', level: 'error', message: `Lỗi ${platform}: ${err.message}` })
    return { ok: false, error: err.message }
  } finally {
    await clearJobCheckpoint(platform).catch(() => {})
    activeJobs.delete(platform)
    ensureKeepAlive()
  }
}

// =========================================================================
// CÀO BÀI VIRAL ĐA TỪ KHÓA (TÁCH FB TRANG CHỦ vs THƯỚC PHIM • TIKTOK TÌM KIẾM CUỘN SÂU)
// =========================================================================

function buildTopicSources(options = {}) {
  const topicKey = options.topic || 'all'
  const customTopic = String(options.customTopic || '').trim()
  const preset = VIRAL_TOPIC_PRESETS[topicKey] || VIRAL_TOPIC_PRESETS.all
  const isAll = topicKey === 'all' && !customTopic

  if (isAll) {
    return {
      isAll: true,
      label: '',
      fbFeedSources: preset.fbFeedSources.map((url) => ({ url, keyword: '', sourceKind: 'feed' })),
      fbReelSources: preset.fbReelSources.map((url) => ({ url, keyword: '', sourceKind: 'reels' })),
      ttSources: preset.ttSources.map((url) => ({ url, keyword: '' })),
      ttExploreTab: ''
    }
  }

  const label = options.topicLabel || (topicKey === 'custom' ? customTopic : (preset.label || customTopic))
  const aiFbKws = Array.isArray(options.fbKeywords) ? options.fbKeywords.map((k) => String(k || '').trim()).filter(Boolean) : []
  const aiTtKws = Array.isArray(options.ttKeywords) ? options.ttKeywords.map((k) => String(k || '').trim()).filter(Boolean) : []

  const fbKeywords = Array.from(new Set([
    ...aiFbKws,
    ...(customTopic ? [customTopic, `${customTopic} review`, `${customTopic} việt nam`, `${customTopic} viral`] : []),
    ...(preset.fbKeywords || [])
  ])).slice(0, 8)

  const ttKeywords = Array.from(new Set([
    ...aiTtKws,
    ...(customTopic ? [customTopic, `${customTopic} edit`, `${customTopic} review`, `${customTopic} viral`] : []),
    ...(preset.ttKeywords || [])
  ])).slice(0, 8)

  // TUYỆT ĐỐI KHÔNG rơi về trang chủ hay /explore không có từ khóa khi đã chọn chủ đề!
  const fbFeedSources = fbKeywords.map((kw) => ({
    url: `https://www.facebook.com/search/posts/?q=${encodeURIComponent(kw)}`,
    keyword: kw,
    sourceKind: 'feed'
  }))

  const fbReelSources = fbKeywords.map((kw) => ({
    url: `https://www.facebook.com/search/videos/?q=${encodeURIComponent(kw)}`,
    keyword: kw,
    sourceKind: 'reels'
  }))

  const ttSources = []
  for (const kw of ttKeywords) {
    ttSources.push({ url: `https://www.tiktok.com/search/video?q=${encodeURIComponent(kw)}`, keyword: kw })
  }
  // Bổ sung tab Top cho 2 từ khóa đầu nếu vẫn cần thêm
  for (const kw of ttKeywords.slice(0, 2)) {
    ttSources.push({ url: `https://www.tiktok.com/search?q=${encodeURIComponent(kw)}`, keyword: kw })
  }

  return {
    isAll: false,
    label,
    fbFeedSources,
    fbReelSources,
    ttSources,
    ttExploreTab: preset.ttExploreTab || ''
  }
}

async function scrapeFacebookViralStream(tabKey, sources, targetCount, minLikes, initialExcludeUrls, topicCfg, labelPrefix) {
  if (!sources.length || targetCount <= 0) return { ok: true, posts: [], timedOut: false }
  const SLIDING_IDLE_MS = 4 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
  const config = await getVisionConfig()

  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  const seenContentKeys = new Set()
  let lastFoundAt = Date.now()

  for (let i = 0; i < sources.length && allPosts.length < targetCount && Date.now() - lastFoundAt < SLIDING_IDLE_MS; i++) {
    const src = sources[i]
    pushLog({
      platform: 'facebook',
      step: 'scrape_viral',
      level: 'info',
      message: `📘 ${labelPrefix}: đang tìm (${i + 1}/${sources.length})${src.keyword ? ` từ khóa "${src.keyword}"` : ''}...`
    })
    try {
      const tab = await openOrReuseScraperTab(tabKey, src.url, 2800)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'FB_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes,
            maxRoundsOnPage: 16,
            idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt,
            totalAlreadyFound: allPosts.length,
            topicLabel: topicCfg.label,
            sourceKind: src.sourceKind,
            searchKeyword: src.keyword,
            excludeUrls: Array.from(seenUrls)
          }
        },
        scripts
      )
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') return { ok: false, error: res.error, posts: allPosts, timedOut: false }
      if (res?.lastFoundAt && res.lastFoundAt > lastFoundAt) lastFoundAt = res.lastFoundAt
      for (const p of res?.posts || []) {
        if (allPosts.length >= targetCount) break
        const urlKey = String(p.postUrl || '').trim().toLowerCase()
        const contentKey = `${String(p.title || '').toLowerCase().slice(0, 45)}|${p.likesCount || 0}`
        if (urlKey && !seenUrls.has(urlKey) && !seenContentKeys.has(contentKey)) {
          seenUrls.add(urlKey)
          seenContentKeys.add(contentKey)
          allPosts.push(p)
          lastFoundAt = Date.now()
        }
      }
      if (res?.timedOut) break
    } catch (_) { await new Promise((r) => setTimeout(r, 1500)) }
  }
  return { ok: true, posts: allPosts, timedOut: allPosts.length < targetCount && Date.now() - lastFoundAt >= SLIDING_IDLE_MS }
}

async function scrapeTikTokViralStream(sources, targetCount, minLikes, initialExcludeUrls, topicCfg) {
  if (!sources.length || targetCount <= 0) return { ok: true, posts: [], timedOut: false }
  const SLIDING_IDLE_MS = 4 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const config = await getVisionConfig()
  const cursors = await getScrapeCursors()
  let categoryIndex = cursors.tiktokRunCount || 0
  await saveScrapeCursors({ tiktokRunCount: categoryIndex + 2 })

  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  let lastFoundAt = Date.now()

  for (let i = 0; i < sources.length && allPosts.length < targetCount && Date.now() - lastFoundAt < SLIDING_IDLE_MS; i++) {
    const src = sources[i]
    pushLog({
      platform: 'tiktok',
      step: 'scrape_viral',
      level: 'info',
      message: `🎵 TikTok: đang tìm (${i + 1}/${sources.length})${src.keyword ? ` từ khóa "${src.keyword}"` : ''}...`
    })
    try {
      const tab = await openOrReuseScraperTab('ttViral', src.url, 3200)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'TIKTOK_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes,
            maxRoundsOnPage: 18,
            idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt,
            totalAlreadyFound: allPosts.length,
            categoryIndex: topicCfg.isAll ? categoryIndex++ : 0,
            preferredExploreTab: topicCfg.isAll ? '' : topicCfg.ttExploreTab,
            topicLabel: topicCfg.label,
            searchKeyword: src.keyword,
            excludeUrls: Array.from(seenUrls)
          }
        },
        scripts
      )
      if (res?.lastFoundAt && res.lastFoundAt > lastFoundAt) lastFoundAt = res.lastFoundAt
      for (const p of res?.posts || []) {
        if (allPosts.length >= targetCount) break
        const key = String(p.postUrl || '').trim().toLowerCase()
        if (key && !seenUrls.has(key)) { seenUrls.add(key); allPosts.push(p); lastFoundAt = Date.now() }
      }
      if (res?.timedOut) break
    } catch (_) { await new Promise((r) => setTimeout(r, 1500)) }
  }
  return { ok: true, posts: allPosts, timedOut: allPosts.length < targetCount && Date.now() - lastFoundAt >= SLIDING_IDLE_MS }
}

async function scrapeBothViralPlatforms(options = {}) {
  if (activeJobs.has('scrape_viral')) return { ok: false, error: 'VIRAL_SCRAPE_ALREADY_RUNNING', posts: [], facebookPosts: [], tiktokPosts: [] }
  activeJobs.set('scrape_viral', { platform: 'both', startedAt: new Date().toISOString(), step: 'scraping' })
  ensureKeepAlive()
  try {
    const fbTarget = Number(options.fbCount) || 10
    const ttTarget = Number(options.tiktokCount) || 10
    const fbMinLikes = Number(options.fbMinLikes) || 5000
    const ttMinLikes = Number(options.tiktokMinLikes) || 200000
    const fbSourceMode = String(options.fbSourceMode || 'both').toLowerCase() // 'feed' | 'reels' | 'both'
    const excludeUrls = Array.isArray(options.excludeUrls) ? options.excludeUrls : []
    const topicCfg = buildTopicSources(options)

    pushLog({
      platform: 'system',
      step: 'scrape_both',
      level: 'info',
      message: `🔥 Đang cào Viral (${topicCfg.label || 'Tất cả'} • FB: ${fbSourceMode} ≥${fbMinLikes} • TikTok ≥${ttMinLikes})...`
    })

    const tasks = []
    if (fbSourceMode === 'feed') {
      tasks.push(scrapeFacebookViralStream('fbFeed', topicCfg.fbFeedSources, fbTarget, fbMinLikes, excludeUrls, topicCfg, 'FB Trang chủ'))
      tasks.push(Promise.resolve({ ok: true, posts: [], timedOut: false }))
    } else if (fbSourceMode === 'reels') {
      tasks.push(Promise.resolve({ ok: true, posts: [], timedOut: false }))
      tasks.push(scrapeFacebookViralStream('fbReels', topicCfg.fbReelSources, fbTarget, fbMinLikes, excludeUrls, topicCfg, 'FB Thước phim'))
    } else {
      const feedCount = Math.ceil(fbTarget / 2)
      const reelCount = fbTarget - feedCount
      tasks.push(scrapeFacebookViralStream('fbFeed', topicCfg.fbFeedSources, feedCount, fbMinLikes, excludeUrls, topicCfg, 'FB Trang chủ'))
      tasks.push(scrapeFacebookViralStream('fbReels', topicCfg.fbReelSources, reelCount, fbMinLikes, excludeUrls, topicCfg, 'FB Thước phim'))
    }
    tasks.push(scrapeTikTokViralStream(topicCfg.ttSources, ttTarget, ttMinLikes, excludeUrls, topicCfg))

    const [fbFeedRes, fbReelsRes, ttRes] = await Promise.all(tasks)
    const facebookPosts = [...(fbFeedRes?.posts || []), ...(fbReelsRes?.posts || [])]
    const tiktokPosts = ttRes?.posts || []
    const combined = [...facebookPosts, ...tiktokPosts]

    pushLog({
      platform: 'system',
      step: 'scrape_done',
      level: combined.length > 0 ? 'success' : 'warn',
      message: `✅ Cào xong → FB Trang chủ: ${(fbFeedRes?.posts || []).length} • FB Reels: ${(fbReelsRes?.posts || []).length} • TikTok: ${tiktokPosts.length}`
    })
    return {
      ok: true,
      facebookPosts,
      tiktokPosts,
      posts: combined,
      timedOut: {
        facebook: Boolean(fbFeedRes?.timedOut || fbReelsRes?.timedOut),
        tiktok: Boolean(ttRes?.timedOut)
      }
    }
  } finally {
    activeJobs.delete('scrape_viral')
    ensureKeepAlive()
  }
}

async function scrapeFacebookGroupsJob(options = {}) {
  if (activeJobs.has('scrape_groups')) return { ok: false, error: 'GROUP_SCRAPE_ALREADY_RUNNING', groups: [] }
  activeJobs.set('scrape_groups', { platform: 'facebook', startedAt: new Date().toISOString(), step: 'scraping_groups' })
  ensureKeepAlive()
  try {
    const targetCount = Number(options.count) || 5
    const customKeyword = String(options.keyword || '').trim()
    const seenUrls = [...(options.excludeUrls || [])]
    const seenNames = [...(options.excludeNames || [])]
    const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    const config = await getVisionConfig()
    const cursors = await getScrapeCursors()
    const runIdx = cursors.groupRunCount || 0
    await saveScrapeCursors({ groupRunCount: runIdx + 1 })

    const kw1 = GROUP_SEARCH_KEYWORDS[runIdx % GROUP_SEARCH_KEYWORDS.length]
    const kw2 = GROUP_SEARCH_KEYWORDS[(runIdx + 1) % GROUP_SEARCH_KEYWORDS.length]
    const candidateUrls = customKeyword
      ? [{ url: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(customKeyword)}`, label: customKeyword }]
      : [
          { url: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(kw1)}`, label: kw1 },
          { url: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(kw2)}`, label: kw2 },
          { url: 'https://www.facebook.com/groups/discover/', label: 'Khám phá Facebook' }
        ]

    const collected = []
    for (const src of candidateUrls) {
      if (collected.length >= targetCount) break
      const tab = await openOrReuseScraperTab('fbGroups', src.url, 2800)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(tab.id, {
        type: 'FB_SCRAPE_GROUPS',
        options: { targetCount: targetCount - collected.length, excludeUrls: seenUrls, excludeNames: seenNames, category: customKeyword || src.label }
      }, scripts)
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') return { ok: false, error: res.error, groups: collected }
      for (const g of res?.groups || []) {
        if (collected.length >= targetCount) break
        seenUrls.push(g.groupUrl); seenNames.push(g.groupName); collected.push(g)
      }
    }
    pushLog({ platform: 'facebook', step: 'scrape_groups_done', level: collected.length ? 'success' : 'warn', message: `✅ Đã lấy ${collected.length}/${targetCount} hội nhóm Facebook mới.` })
    return { ok: true, groups: collected }
  } catch (err) {
    return { ok: false, error: err.message, groups: [] }
  } finally {
    activeJobs.delete('scrape_groups')
    ensureKeepAlive()
  }
}

async function dispatchCommand(message, sender = {}) {
  const type = message?.type
  switch (type) {
    case 'GET_LEARNED_KNOWLEDGE': {
      const all = await getAllLearnedKnowledge()
      return { ok: true, rule: all[message.stepKey] || null }
    }
    case 'SAVE_LEARNED_KNOWLEDGE':
      return { ok: true, rule: await saveLearnedKnowledgeEntry(message.stepKey, message.rule) }
    case 'INVALIDATE_LEARNED_KNOWLEDGE':
      await invalidateLearnedKnowledgeEntry(message.stepKey)
      return { ok: true }
    case 'AI_SELF_HEAL':
      return await handleAiSelfHeal(message.payload || {}, sender?.tab)
    case 'SW_SLEEP': {
      const ms = Math.min(15000, Math.max(0, Number(message.ms) || 0))
      await new Promise((resolve) => setTimeout(resolve, ms))
      return { ok: true }
    }
    case 'OPEN_SINGLE_TAB':
      return await openUrlInSingleViewerTab(message.url)
    case 'PING': {
      const [vision, pending] = await Promise.all([getVisionConfig(), getPendingVerifications()])
      return { ok: true, installed: true, version: getExtensionVersion(), visionEnabled: true, pacingMode: vision.pacingMode, pendingVerificationsCount: pending.length }
    }
    case 'CHECK_STATUS': {
      const [allTabs, vision, pending] = await Promise.all([chrome.tabs.query({}), getVisionConfig(), getPendingVerifications()])
      return {
        ok: true, version: getExtensionVersion(),
        tabs: {
          admin: allTabs.some((t) => t.url && /^http:\/\/(localhost|127\.0\.0\.1):5174/i.test(t.url)),
          facebook: allTabs.some((t) => t.url && /(^|\.)facebook\.com/i.test(t.url)),
          tiktok: allTabs.some((t) => t.url && /(^|\.)tiktok\.com/i.test(t.url))
        },
        vision, activeJobs: Array.from(activeJobs.values()), pendingVerifications: pending
      }
    }
    case 'AUTO_POST': {
      const platform = String(message.platform || 'facebook').toLowerCase()
      if (!['facebook', 'tiktok'].includes(platform)) return { ok: false, error: 'UNSUPPORTED_PLATFORM' }
      return await executeWithRecovery(platform, message.post, sender?.tab?.url || ADMIN_DEFAULT_ORIGIN)
    }
    case 'FETCH_REAL_VIRAL':
      return await scrapeBothViralPlatforms(message)
    case 'SCRAPE_FB_GROUPS':
      return await scrapeFacebookGroupsJob(message)
    case 'CHECK_PENDING_NOW': {
      await processPendingVerifications()
      return { ok: true, pending: await getPendingVerifications() }
    }
    case 'JOB_STEP_PROGRESS': {
      const plat = message.platform || 'system'
      const job = activeJobs.get(plat)
      if (job) job.step = message.step
      if (message.extra?.checkpointStep && ['facebook', 'tiktok'].includes(plat)) {
        await saveJobCheckpoint(plat, {
          step: message.step,
          completedStep: message.extra.checkpointStep,
          ...(Array.isArray(message.extra.existingPermalinks) ? { existingPermalinks: message.extra.existingPermalinks } : {})
        }).catch(() => {})
      }
      pushLog({ platform: plat, step: message.step || 'step', level: message.level || 'info', message: message.message || '' })
      return { ok: true }
    }
    case 'GET_VISION_CONFIG': return { ok: true, config: await getVisionConfig() }
    case 'SAVE_VISION_CONFIG': return { ok: true, config: await saveVisionConfig(message.config || {}) }
    case 'INSPECT_TAB': {
      const platform = String(message.platform || 'tiktok').toLowerCase()
      const isFb = platform === 'facebook'
      const tab = isFb ? await findOrCreateFacebookPostTab() : await findOrCreateTikTokPostTab()
      const scripts = isFb ? ['vision-engine.js', 'content-media.js', 'content-facebook.js'] : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
      return { ok: true, platform, tabId: tab.id, url: tab.url, inspection: await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_INSPECT_VISION' : 'TIKTOK_INSPECT_VISION' }, scripts) }
    }
    case 'CANCEL_JOB': {
      activeJobs.clear()
      await chrome.storage.local.remove(STORAGE_CHECKPOINTS_KEY).catch(() => {})
      ensureKeepAlive()
      return { ok: true }
    }
    default: return { ok: false, error: 'UNKNOWN_COMMAND' }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false
  dispatchCommand(message, sender).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
  return true
})
async function callAdminBackendViaBridge(path, method = 'POST', body = undefined) {
  const activePort = Array.from(adminPorts)[0]
  if (!activePort) return { ok: false, error: 'NO_ADMIN_BRIDGE' }
  const fetchId = `bf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingBridgeFetches.delete(fetchId)
      resolve({ ok: false, error: 'BRIDGE_API_TIMEOUT' })
    }, 30000)
    pendingBridgeFetches.set(fetchId, {
      resolve: (res) => { clearTimeout(timer); resolve(res) }
    })
    try { activePort.postMessage({ type: 'BRIDGE_API_FETCH', fetchId, path, method, body }) }
    catch (err) { clearTimeout(timer); pendingBridgeFetches.delete(fetchId); resolve({ ok: false, error: err.message }) }
  })
}

async function getAllLearnedKnowledge() {
  const local = (await chrome.storage.local.get(STORAGE_KNOWLEDGE_KEY))?.[STORAGE_KNOWLEDGE_KEY] || {}
  if (!knowledgeSyncedFromServer && adminPorts.size > 0) {
    knowledgeSyncedFromServer = true
    const remote = await callAdminBackendViaBridge('/api/admin/social/ai/knowledge', 'GET')
    if (remote?.ok && remote.data?.knowledge && typeof remote.data.knowledge === 'object') {
      const merged = { ...remote.data.knowledge, ...local }
      await chrome.storage.local.set({ [STORAGE_KNOWLEDGE_KEY]: merged })
      return merged
    }
  }
  return local
}

async function saveLearnedKnowledgeEntry(stepKey, rule) {
  const all = await getAllLearnedKnowledge()
  all[stepKey] = { ...(all[stepKey] || {}), ...rule, hitCount: (all[stepKey]?.hitCount || 0) + 1 }
  await chrome.storage.local.set({ [STORAGE_KNOWLEDGE_KEY]: all })
  callAdminBackendViaBridge('/api/admin/social/ai/knowledge', 'POST', { knowledge: all }).catch(() => {})
  pushLog({ platform: stepKey.split(':')[0] || 'ai', step: 'ai_learned', level: 'success', message: `🧠 AI đã ghi nhớ quy tắc mới cho "${stepKey}" (lần sau tự chạy, không hỏi lại!).` })
  return all[stepKey]
}

async function invalidateLearnedKnowledgeEntry(stepKey) {
  const all = await getAllLearnedKnowledge()
  if (all[stepKey]) {
    delete all[stepKey]
    await chrome.storage.local.set({ [STORAGE_KNOWLEDGE_KEY]: all })
    callAdminBackendViaBridge('/api/admin/social/ai/knowledge', 'POST', { knowledge: all }).catch(() => {})
  }
}

async function handleAiSelfHeal(payload, senderTab) {
  let screenshotBase64 = null
  // Nếu tab đang hiển thị thì chụp thêm ảnh màn hình thật cho Vision qwen3.5:4b nhìn trực tiếp
  if (senderTab?.active && senderTab.windowId) {
    try {
      screenshotBase64 = await chrome.tabs.captureVisibleTab(senderTab.windowId, { format: 'jpeg', quality: 60 })
    } catch (_) {}
  }
  const res = await callAdminBackendViaBridge('/api/admin/social/ai/vision-assist', 'POST', {
    ...payload,
    screenshotBase64
  })
  if (res?.ok && res.data?.ok) return res.data
  return { ok: false, error: res?.error || 'AI_VISION_UNAVAILABLE' }
}
