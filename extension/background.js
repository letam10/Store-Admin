/*
  FILE NOTE
  - Mục đích: Service Worker điều phối ngầm OmniVision v3.5.2 cho Chrome Extension Manifest V3.
  - Nâng cấp:
    1. Sửa triệt để lỗi onConnect Extension context invalidated bằng cách gắn listeners đồng bộ ngay lập tức.
    2. Đánh thức giấc ngủ SW_SLEEP & runSurfAndCollect tức thì khi có lệnh dừng (surfWakeups).
    3. Bổ sung LIVE_VIRAL_POST bắn progressive VIRAL_BATCH_READY về Admin ngay khi bắt được bài mới.
  - Liên kết trực tiếp: extension/manifest.json, extension/vision-engine.js, extension/content-facebook.js, extension/content-tiktok.js
  - Vùng ảnh hưởng khi sửa: Toàn bộ điều phối ngầm các tác vụ đăng bài, cào viral, xem video, lướt feed, cầu nối API với Store-Admin Web API.
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
const STORAGE_KNOWLEDGE_KEY = 'omnicartLearnedSelectors'

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
    fbQuery: 'xe cộ review ô tô xe máy',
    ttQuery: 'xe cộ review xe',
    ttExploreTab: 'Xe hơi'
  },
  anime: {
    label: 'Anime',
    fbQuery: 'anime vietsub review',
    ttQuery: 'anime edit vietsub',
    ttExploreTab: 'Anime'
  },
  cartoon: {
    label: 'Hoạt hình',
    fbQuery: 'hoạt hình 3d review phim',
    ttQuery: 'hoạt hình 3d review phim',
    ttExploreTab: ''
  },
  game: {
    label: 'Game',
    fbQuery: 'game highlight gaming việt nam',
    ttQuery: 'game highlight gaming',
    ttExploreTab: 'Trò chơi'
  },
  new_product: {
    label: 'Quảng bá sản phẩm mới',
    fbQuery: 'unbox review sản phẩm mới ra mắt',
    ttQuery: 'unbox review sản phẩm mới',
    ttExploreTab: ''
  },
  electronics_compare: {
    label: 'So sánh sản phẩm điện tử',
    fbQuery: 'so sánh điện thoại laptop công nghệ',
    ttQuery: 'so sánh điện thoại công nghệ',
    ttExploreTab: ''
  }
}

const adminPorts = new Set()
const activeJobs = new Map()
const recentLogs = []
const scraperTabIds = { fbFeed: null, fbReels: null, ttViral: null, fbGroups: null }
const singleViewTabIds = { facebook: null, tiktok: null }
const viralStopFlags = { facebook: false, tiktok: false }
const surfStopFlags = { facebook: false, tiktok: false }
const surfWakeups = { facebook: null, tiktok: null }
const viralLiveContext = { topic: 'all', topicLabel: '' }
const bridgeApiWaiters = new Map()
let keepAliveTimer = null
let verificationCheckInFlight = false

function getExtensionVersion() {
  return chrome.runtime.getManifest().version
}

function randomBetween(minMs, maxMs) {
  return Math.round(minMs + Math.random() * Math.max(0, maxMs - minMs))
}

function pushLog(entry) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry
  }
  recentLogs.unshift(item)
  if (recentLogs.length > 90) recentLogs.length = 90
  broadcastToAdmins({ type: 'PROGRESS_EVENT', event: item })
}

function broadcastToAdmins(payload) {
  for (const port of Array.from(adminPorts)) {
    try {
      port.postMessage(payload)
    } catch (_) {
      adminPorts.delete(port)
    }
  }
}

function ensureKeepAlive() {
  if (activeJobs.size > 0 && !keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      if (activeJobs.size === 0) {
        clearInterval(keepAliveTimer)
        keepAliveTimer = null
        return
      }
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
  if (alarm?.name === ALARM_PENDING_VERIFY) {
    await processPendingVerifications()
  }
})

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

async function getLearnedKnowledge() {
  const res = await chrome.storage.local.get(STORAGE_KNOWLEDGE_KEY)
  return res?.[STORAGE_KNOWLEDGE_KEY] || {}
}

async function saveLearnedKnowledge(patch) {
  const next = { ...(await getLearnedKnowledge()), ...(patch || {}) }
  await chrome.storage.local.set({ [STORAGE_KNOWLEDGE_KEY]: next })
  callAdminApiViaBridge('/api/admin/social/ai/knowledge', 'POST', { knowledge: next }).catch(() => {})
  return next
}

async function invalidateLearnedKnowledgeKey(stepKey) {
  if (!stepKey) return {}
  const cur = await getLearnedKnowledge()
  if (stepKey in cur) {
    delete cur[stepKey]
    await chrome.storage.local.set({ [STORAGE_KNOWLEDGE_KEY]: cur })
    callAdminApiViaBridge('/api/admin/social/ai/knowledge', 'POST', { knowledge: cur }).catch(() => {})
  }
  return cur
}

async function callAdminApiViaBridge(path, method = 'POST', body = null, timeoutMs = 48000) {
  const bridgePort = Array.from(adminPorts).find((p) => p.name === 'omnicart-admin-bridge')
  if (!bridgePort) throw new Error('ADMIN_BRIDGE_NOT_CONNECTED')
  const fetchId = `bf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridgeApiWaiters.delete(fetchId)
      reject(new Error('BRIDGE_API_TIMEOUT'))
    }, timeoutMs)
    bridgeApiWaiters.set(fetchId, {
      resolve: (data) => { clearTimeout(timer); resolve(data) },
      reject: (err) => { clearTimeout(timer); reject(err) }
    })
    try {
      bridgePort.postMessage({ type: 'BRIDGE_API_FETCH', fetchId, path, method, body })
    } catch (err) {
      clearTimeout(timer)
      bridgeApiWaiters.delete(fetchId)
      reject(err)
    }
  })
}

async function reinjectAdminBridges() {
  try {
    for (const tab of await chrome.tabs.query({})) {
      if (tab.id && tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url)) {
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-admin-bridge.js'] })
        } catch (_) {}
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

async function savePendingVerifications(list) {
  await chrome.storage.local.set({ [STORAGE_PENDING_KEY]: list })
}

async function getResolvedVerifications() {
  const res = await chrome.storage.local.get(STORAGE_RESOLVED_KEY)
  return Array.isArray(res?.[STORAGE_RESOLVED_KEY]) ? res[STORAGE_RESOLVED_KEY] : []
}

async function saveResolvedVerifications(list) {
  await chrome.storage.local.set({ [STORAGE_RESOLVED_KEY]: list.slice(0, 30) })
}

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

chrome.runtime.onConnect.addListener((port) => {
  if (!port || (port.name !== 'omnicart-admin-bridge' && port.name !== 'omnicart-popup')) return
  adminPorts.add(port)

  try {
    port.onDisconnect.addListener(() => { adminPorts.delete(port) })
    port.onMessage.addListener(async (msg) => {
      if (!msg) return
      if (msg.type === 'HEARTBEAT') {
        try { port.postMessage({ type: 'HEARTBEAT_ACK', ts: Date.now(), version: getExtensionVersion() }) } catch (_) {}
        return
      }
      if (msg.type === 'ACK_RESOLVED_VERIFICATION' && msg.postId) {
        await saveResolvedVerifications((await getResolvedVerifications()).filter((r) => r.postId !== msg.postId))
        return
      }
      if (msg.type === 'BRIDGE_API_FETCH_RESULT' && msg.fetchId) {
        const waiter = bridgeApiWaiters.get(msg.fetchId)
        if (waiter) {
          bridgeApiWaiters.delete(msg.fetchId)
          if (msg.ok) waiter.resolve(msg.data)
          else waiter.reject(new Error(msg.error || 'BRIDGE_API_ERROR'))
        }
        return
      }
      if (msg.type === 'ADMIN_COMMAND' && msg.requestId) {
        try {
          const result = await dispatchCommand(msg.command, { tab: port.sender?.tab })
          port.postMessage({
            type: 'ADMIN_COMMAND_RESULT',
            requestId: msg.requestId,
            ok: result?.ok === true,
            data: result,
            error: result?.ok === true ? null : (result?.error || 'COMMAND_FAILED')
          })
        } catch (err) {
          try {
            port.postMessage({
              type: 'ADMIN_COMMAND_RESULT',
              requestId: msg.requestId,
              ok: false,
              data: null,
              error: err.message || String(err)
            })
          } catch (_) {}
        }
      }
    })
  } catch (_) {
    adminPorts.delete(port)
    return
  }

  Promise.all([getPendingVerifications(), getResolvedVerifications()])
    .then(([pendingVerifications, resolvedVerifications]) => {
      if (!adminPorts.has(port)) return
      try {
        port.postMessage({
          type: 'BRIDGE_HELLO',
          version: getExtensionVersion(),
          activeJobs: Array.from(activeJobs.values()),
          pendingVerifications,
          resolvedVerifications,
          recentLogs: recentLogs.slice(0, 18)
        })
      } catch (_) { adminPorts.delete(port) }
    })
    .catch(() => {})
})

// =========================================================================
// QUẢN LÝ TAB & PHỤC HỒI CHECKPOINT
// =========================================================================

async function waitForTabComplete(tabId, timeoutMs = 24000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete') return tab
    } catch (_) {
      throw new Error('TAB_CLOSED_UNEXPECTEDLY')
    }
    await new Promise((r) => setTimeout(r, 350))
  }
  throw new Error('TAB_LOAD_TIMEOUT')
}

async function navigateTabAndWait(tabId, url, settleMs = 2600) {
  await chrome.tabs.update(tabId, { url })
  await waitForTabComplete(tabId, 26000)
  await new Promise((r) => setTimeout(r, settleMs + randomBetween(200, 750)))
  return await chrome.tabs.get(tabId)
}

async function sendTabMessageWithRetry(tabId, message, scriptFiles) {
  await waitForTabComplete(tabId)
  try {
    const res = await chrome.tabs.sendMessage(tabId, message)
    if (res) return res
    throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
  } catch (err) {
    const receiverMissing = /receiving end does not exist|could not establish connection|no content script response|message port closed/i.test(err.message || '')
    if (receiverMissing && scriptFiles && chrome.scripting) {
      await chrome.scripting.executeScript({ target: { tabId }, files: Array.isArray(scriptFiles) ? scriptFiles : [scriptFiles] })
      await new Promise((r) => setTimeout(r, 1000))
      const retryRes = await chrome.tabs.sendMessage(tabId, message)
      if (retryRes) return retryRes
      throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
    }
    throw err
  }
}

function isScraperTabId(tabId) {
  return (
    tabId === scraperTabIds.fbFeed ||
    tabId === scraperTabIds.fbReels ||
    tabId === scraperTabIds.ttViral ||
    tabId === scraperTabIds.fbGroups
  )
}

async function findOrCreateFacebookPostTab(targetUrl = FB_POST_HOME_URL) {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => !isScraperTabId(tab.id) && tab.url && /(^|\.)facebook\.com/i.test(new URL(tab.url).hostname))
  if (existing) {
    if (targetUrl && targetUrl !== FB_POST_HOME_URL && !String(existing.url || '').startsWith(targetUrl.replace(/\/+$/, ''))) {
      return await navigateTabAndWait(existing.id, targetUrl, 2600)
    }
    return existing
  }
  const created = await chrome.tabs.create({ url: targetUrl || FB_POST_HOME_URL, active: false })
  await waitForTabComplete(created.id, 24000)
  await new Promise((r) => setTimeout(r, 2600))
  return created
}

async function findOrCreateTikTokPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find(
    (tab) => !isScraperTabId(tab.id) && tab.url && /(^|\.)tiktok\.com/i.test(new URL(tab.url).hostname) && /\/(tiktokstudio|creator-center|upload)/i.test(tab.url)
  )
  if (existing) return existing
  const created = await chrome.tabs.create({ url: TIKTOK_STUDIO_HOME_URL, active: false })
  await waitForTabComplete(created.id, 24000)
  await new Promise((r) => setTimeout(r, 2700))
  return created
}

async function openOrReuseScraperTab(key, url, settleMs = 3000) {
  const existingId = scraperTabIds[key]
  if (existingId) {
    try {
      const tab = await chrome.tabs.get(existingId)
      if (tab?.id) return await navigateTabAndWait(tab.id, url, settleMs)
    } catch (_) {
      scraperTabIds[key] = null
    }
  }
  const created = await chrome.tabs.create({ url, active: false })
  scraperTabIds[key] = created.id
  await waitForTabComplete(created.id, 26000)
  await new Promise((r) => setTimeout(r, settleMs + randomBetween(300, 900)))
  return await chrome.tabs.get(created.id)
}

async function openOrReuseSingleViewTab(url, platform = 'facebook') {
  const key = String(platform || '').toLowerCase() === 'tiktok' ? 'tiktok' : 'facebook'
  const existingId = singleViewTabIds[key]
  if (existingId) {
    try {
      const tab = await chrome.tabs.get(existingId)
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url, active: true })
        if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {})
        return { ok: true, tabId: tab.id, reused: true }
      }
    } catch (_) {
      singleViewTabIds[key] = null
    }
  }
  const created = await chrome.tabs.create({ url, active: true })
  singleViewTabIds[key] = created.id
  return { ok: true, tabId: created.id, reused: false }
}

function resolveProductImageUrl(rawValue, senderTabUrl) {
  const value = String(rawValue || '').trim()
  if (!value) throw new Error('PRODUCT_IMAGE_REQUIRED')
  if (value.startsWith('data:image/')) return value
  if (value.startsWith('/')) return `${senderTabUrl ? new URL(senderTabUrl).origin : ADMIN_DEFAULT_ORIGIN}${value}`
  let parsed
  try { parsed = new URL(value) } catch (_) { throw new Error('PRODUCT_IMAGE_URL_INVALID') }
  if (!(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) && parsed.protocol !== 'https:') {
    throw new Error('PRODUCT_IMAGE_URL_NOT_ALLOWED')
  }
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
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(resolved)) {
      contentType = resolved.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg'
    } else {
      throw new Error('PRODUCT_IMAGE_TYPE_INVALID')
    }
  }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

function normalizeHashtagsField(raw) {
  if (!raw) return ''
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t || '').trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ')
  }
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
    postId: postData.postId || postData.id || null,
    title: String(postData.title || postData.headline || '').trim(),
    content: String(postData.content || postData.description || postData.caption || postData.body || '').trim(),
    hashtags: normalizeHashtagsField(postData.hashtags || postData.tags),
    targetGroupUrl: String(postData.targetGroupUrl || '').trim(),
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
// VISION AI CỨU CÁNH GIAO DIỆN (qwen3.5:4b) & TỰ HỌC SELECTOR
// =========================================================================

async function handleVisionAiAssist(rawPayload, sender) {
  const message = rawPayload?.payload || rawPayload || {}
  let screenshotBase64 = null
  try {
    if (sender?.tab?.active && sender?.tab?.windowId) {
      screenshotBase64 = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 65 })
    }
  } catch (_) {}

  try {
    const payload = {
      platform: message.platform || 'facebook',
      stepKey: message.stepKey || '',
      goal: message.goal || '',
      url: message.url || sender?.tab?.url || '',
      errorReason: message.errorReason || '',
      viewportWidth: Number(message.viewportWidth) || 1280,
      viewportHeight: Number(message.viewportHeight) || 720,
      scrollY: Number(message.scrollY) || 0,
      screenshotBase64,
      elements: Array.isArray(message.elements) ? message.elements : []
    }
    const res = await callAdminApiViaBridge('/api/admin/social/ai/vision-assist', 'POST', payload, 48000)
    if (res?.ok && res?.learnedRule && payload.stepKey) {
      await saveLearnedKnowledge({ [payload.stepKey]: res.learnedRule })
    }
    return res || { ok: false, error: 'AI_VISION_NO_RESPONSE' }
  } catch (err) {
    return { ok: false, error: err.message || 'AI_VISION_ERROR' }
  }
}

// =========================================================================
// ĐĂNG BÀI SONG SONG ĐỘC LẬP FACEBOOK & TIKTOK VỚI CHECKPOINT PHỤC HỒI
// =========================================================================

async function executeWithRecovery(platform, postData, senderTabUrl) {
  const jobKey = `post:${platform}`
  if (activeJobs.has(jobKey)) return { ok: false, error: `${platform.toUpperCase()}_JOB_ALREADY_RUNNING` }
  const checkpoint = { completedSteps: [], existingPermalinks: [], verifyOnly: false }
  activeJobs.set(jobKey, { platform, startedAt: new Date().toISOString(), step: 'init', checkpoint })
  ensureKeepAlive()

  try {
    const config = await getVisionConfig()
    const preparedPost = await preparePostPayload(postData, senderTabUrl)
    const scripts = platform === 'facebook'
      ? ['vision-engine.js', 'content-media.js', 'content-facebook.js']
      : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    const msgType = platform === 'facebook' ? 'FB_EXECUTE_POST' : 'TIKTOK_EXECUTE_POST'
    const fbTargetUrl = (platform === 'facebook' && preparedPost.targetGroupUrl) ? preparedPost.targetGroupUrl : FB_POST_HOME_URL

    let response = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tab = platform === 'facebook'
          ? await findOrCreateFacebookPostTab(fbTargetUrl)
          : await findOrCreateTikTokPostTab()
        chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
        response = await sendTabMessageWithRetry(tab.id, { type: msgType, payload: preparedPost, checkpoint }, scripts)

        if (response?.needsNavigation && response.targetUrl) {
          pushLog({ platform, step: 'recover', level: 'warn', message: `Phát hiện trang lệch/tải lại (lần ${attempt}/3), tự quay lại đúng trang...` })
          await navigateTabAndWait(tab.id, response.targetUrl, 2800)
          continue
        }
        break
      } catch (err) {
        const recoverable = /message port closed|tab_closed|receiving end|no content script/i.test(err.message || '')
        if (recoverable && attempt < 3) {
          pushLog({ platform, step: 'recover', level: 'warn', message: `Tab ${platform} vừa tải lại giữa chừng, đang tự nối lại (lần ${attempt + 1}/3)...` })
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
        titleProbe: response.titleProbe || preparedPost.title.slice(0, 40),
        account: response.account || ''
      })
    } else if (response.postUrl) {
      pushLog({ platform, step: 'done', level: 'success', message: `✅ Đã đăng ${platform} thành công!` })
    }
    return response
  } catch (err) {
    pushLog({ platform, step: 'error', level: 'error', message: `Lỗi ${platform}: ${err.message}` })
    return { ok: false, error: err.message }
  } finally {
    activeJobs.delete(jobKey)
    ensureKeepAlive()
  }
}

// =========================================================================
// CÀO BÀI VIRAL PROGRESSIVE (FB BÀI >= 1K • FB REELS >= 5K • TIKTOK >= 1M)
// =========================================================================

function buildTopicSources(options = {}) {
  const topicKey = String(options.topic || 'all').toLowerCase()
  const customTopic = String(options.customTopic || '').trim()
  const ttSourceMode = String(options.ttSourceMode || (topicKey === 'all' && !customTopic ? 'explore' : 'search')).toLowerCase()
  const expandedFb = Array.isArray(options.fbKeywords) ? options.fbKeywords.filter(Boolean) : []
  const expandedTt = Array.isArray(options.ttKeywords) ? options.ttKeywords.filter(Boolean) : []

  const preset = VIRAL_TOPIC_PRESETS[topicKey] || {}
  const label = customTopic || options.topicLabel || preset.label || ''
  const fbQueries = expandedFb.length ? expandedFb : [customTopic || preset.fbQuery || label].filter(Boolean)
  const ttQueries = expandedTt.length ? expandedTt : [customTopic || preset.ttQuery || label].filter(Boolean)

  const fbFeedSources = fbQueries.length
    ? [
        ...fbQueries.map((q) => `https://www.facebook.com/search/top/?q=${encodeURIComponent(q)}`),
        ...fbQueries.map((q) => `https://www.facebook.com/search/posts/?q=${encodeURIComponent(q)}`),
        'https://www.facebook.com/'
      ]
    : VIRAL_TOPIC_PRESETS.all.fbFeedSources

  const fbReelSources = fbQueries.length
    ? [...fbQueries.map((q) => `https://www.facebook.com/search/videos/?q=${encodeURIComponent(q)}`), 'https://www.facebook.com/reel/', 'https://www.facebook.com/watch/']
    : VIRAL_TOPIC_PRESETS.all.fbReelSources

  const ttSources = ttSourceMode === 'explore'
    ? ['https://www.tiktok.com/explore', 'https://www.tiktok.com/foryou']
    : (ttQueries.length
      ? [
          ...ttQueries.map((q) => `https://www.tiktok.com/search/video?q=${encodeURIComponent(q)}`),
          ...ttQueries.map((q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`)
        ]
      : ['https://www.tiktok.com/explore'])

  return { label, fbFeedSources, fbReelSources, ttSources, ttExploreTab: preset.ttExploreTab || '', ttSourceMode }
}

async function scrapeFacebookViralStream(tabKey, sources, targetCount, minLikes, initialExcludeUrls, topicCfg, sourceLabel, emitBatch) {
  const SLIDING_IDLE_MS = 3 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
  const config = await getVisionConfig()
  const list = Array.isArray(sources) && sources.length ? sources : ['https://www.facebook.com/']

  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  let lastFoundAt = Date.now()
  let sourceIdx = 0

  while (allPosts.length < targetCount && !viralStopFlags.facebook) {
    const sourceUrl = list[sourceIdx % list.length]
    sourceIdx++
    try {
      const tab = await openOrReuseScraperTab(tabKey, sourceUrl, 3400)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'FB_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes,
            minRoundsOnPage: 12,
            maxRoundsOnPage: 28,
            perSourceMaxMs: 150000,
            idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt,
            totalAlreadyFound: allPosts.length,
            topicLabel: topicCfg.label || sourceLabel,
            sourceKind: tabKey === 'fbReels' ? 'reels' : 'feed',
            excludeUrls: Array.from(seenUrls)
          }
        },
        scripts
      )
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') {
        return { ok: false, error: res.error, posts: allPosts, timedOut: false }
      }
      if (res?.lastFoundAt && res.lastFoundAt > lastFoundAt) lastFoundAt = res.lastFoundAt
      const fresh = []
      for (const p of res?.posts || []) {
        if (allPosts.length >= targetCount) break
        const key = String(p.postUrl || '').trim().toLowerCase()
        if (key && !seenUrls.has(key)) {
          seenUrls.add(key)
          allPosts.push(p)
          fresh.push(p)
          lastFoundAt = Date.now()
        }
      }
      if (fresh.length > 0 && typeof emitBatch === 'function') emitBatch('facebook', sourceLabel, fresh)
    } catch (_) {
      await new Promise((r) => setTimeout(r, randomBetween(1800, 3200)))
    }
  }
  return { ok: true, posts: allPosts, timedOut: allPosts.length < targetCount && Date.now() - lastFoundAt >= SLIDING_IDLE_MS }
}

async function scrapeTikTokViralStream(sources, targetCount, minLikes, initialExcludeUrls, topicCfg, emitBatch) {
  const SLIDING_IDLE_MS = 3 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const config = await getVisionConfig()
  const cursors = await getScrapeCursors()
  let categoryIndex = cursors.tiktokRunCount || 0
  await saveScrapeCursors({ tiktokRunCount: categoryIndex + 2 })

  const list = Array.isArray(sources) && sources.length ? sources : ['https://www.tiktok.com/explore']
  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  let lastFoundAt = Date.now()
  let sourceIdx = 0

  while (allPosts.length < targetCount && !viralStopFlags.tiktok) {
    const sourceUrl = list[sourceIdx % list.length]
    sourceIdx++
    try {
      const tab = await openOrReuseScraperTab('ttViral', sourceUrl, 3600)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'TIKTOK_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes,
            minRoundsOnPage: 12,
            maxRoundsOnPage: 28,
            perSourceMaxMs: 150000,
            idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt,
            totalAlreadyFound: allPosts.length,
            categoryIndex: categoryIndex++,
            preferredExploreTab: topicCfg.ttExploreTab || '',
            topicLabel: topicCfg.label || '',
            excludeUrls: Array.from(seenUrls)
          }
        },
        scripts
      )
      if (res?.lastFoundAt && res.lastFoundAt > lastFoundAt) lastFoundAt = res.lastFoundAt
      const fresh = []
      for (const p of res?.posts || []) {
        if (allPosts.length >= targetCount) break
        const key = String(p.postUrl || '').trim().toLowerCase()
        if (key && !seenUrls.has(key)) {
          seenUrls.add(key)
          allPosts.push(p)
          fresh.push(p)
          lastFoundAt = Date.now()
        }
      }
      if (fresh.length > 0 && typeof emitBatch === 'function') emitBatch('tiktok', 'TikTok', fresh)
    } catch (_) {
      await new Promise((r) => setTimeout(r, randomBetween(1800, 3200)))
    }
  }
  return { ok: true, posts: allPosts, timedOut: allPosts.length < targetCount && Date.now() - lastFoundAt >= SLIDING_IDLE_MS }
}

async function scrapeBothViralPlatforms(options = {}) {
  if (activeJobs.has('scrape_viral')) {
    return { ok: false, error: 'VIRAL_SCRAPE_ALREADY_RUNNING', posts: [], facebookPosts: [], tiktokPosts: [] }
  }
  activeJobs.set('scrape_viral', { platform: 'both', startedAt: new Date().toISOString(), step: 'scraping' })
  ensureKeepAlive()
  try {
    const fbTarget = Number(options.fbCount) || 10
    const ttTarget = Number(options.tiktokCount) || 10
    const fbFeedMinLikes = Number(options.fbFeedMinLikes) || 1000
    const fbReelMinLikes = Number(options.fbReelMinLikes) || 5000
    const ttMinLikes = Number(options.tiktokMinLikes) || 1000000
    const fbSourceMode = String(options.fbSourceMode || 'both').toLowerCase()
    const targetPlatform = String(options.platform || 'both').toLowerCase()
    const excludeUrls = Array.isArray(options.excludeUrls) ? options.excludeUrls : []
    const topicCfg = buildTopicSources(options)
    viralLiveContext.topic = options.topic || 'all'
    viralLiveContext.topicLabel = topicCfg.label || ''

    pushLog({
      platform: 'system', step: 'scrape_both', level: 'info',
      message: `🔥 Cào Viral (${topicCfg.label || 'Tất cả'} • FB bài ≥${fbFeedMinLikes.toLocaleString('vi-VN')} • FB Reels ≥${fbReelMinLikes.toLocaleString('vi-VN')} • TikTok ≥${ttMinLikes.toLocaleString('vi-VN')})...`
    })

    const emitBatch = (plat, sourceLabel, posts) => {
      if (Array.isArray(posts) && posts.length > 0) {
        broadcastToAdmins({
          type: 'VIRAL_BATCH_READY',
          payload: { platform: plat, sourceLabel, topic: options.topic || 'all', topicLabel: topicCfg.label, posts }
        })
      }
    }

    if (targetPlatform !== 'tiktok') viralStopFlags.facebook = false
    if (targetPlatform !== 'facebook') viralStopFlags.tiktok = false

    const fbFeedPromise = (targetPlatform !== 'tiktok' && (fbSourceMode === 'feed' || fbSourceMode === 'both'))
      ? scrapeFacebookViralStream('fbFeed', topicCfg.fbFeedSources, fbSourceMode === 'feed' ? fbTarget : Math.ceil(fbTarget / 2), fbFeedMinLikes, excludeUrls, topicCfg, 'FB Bài viết', emitBatch)
      : Promise.resolve({ ok: true, posts: [], timedOut: false })

    const fbReelPromise = (targetPlatform !== 'tiktok' && (fbSourceMode === 'reels' || fbSourceMode === 'both'))
      ? scrapeFacebookViralStream('fbReels', topicCfg.fbReelSources, fbSourceMode === 'reels' ? fbTarget : Math.floor(fbTarget / 2), fbReelMinLikes, excludeUrls, topicCfg, 'FB Thước phim', emitBatch)
      : Promise.resolve({ ok: true, posts: [], timedOut: false })

    const ttPromise = (targetPlatform !== 'facebook')
      ? scrapeTikTokViralStream(topicCfg.ttSources, ttTarget, ttMinLikes, excludeUrls, topicCfg, emitBatch)
      : Promise.resolve({ ok: true, posts: [], timedOut: false })

    const [fbFeedRes, fbReelsRes, ttRes] = await Promise.all([fbFeedPromise, fbReelPromise, ttPromise])
    const facebookPosts = [...(fbFeedRes?.posts || []), ...(fbReelsRes?.posts || [])]
    const tiktokPosts = ttRes?.posts || []
    const combined = [...facebookPosts, ...tiktokPosts]

    pushLog({
      platform: 'system', step: 'scrape_done', level: combined.length > 0 ? 'success' : 'warn',
      message: `✅ Hoàn tất cào Viral → FB Bài viết: ${(fbFeedRes?.posts || []).length} • FB Reels: ${(fbReelsRes?.posts || []).length} • TikTok: ${tiktokPosts.length}`
    })
    return {
      ok: true, facebookPosts, tiktokPosts, posts: combined, streamed: true,
      timedOut: { facebook: Boolean(fbFeedRes?.timedOut || fbReelsRes?.timedOut), tiktok: Boolean(ttRes?.timedOut) }
    }
  } finally {
    activeJobs.delete('scrape_viral')
    ensureKeepAlive()
  }
}

// =========================================================================
// CÀO 5 HỘI NHÓM FACEBOOK & 4 TÁC VỤ TỰ ĐỘNG (ĐÚNG THỜI GIAN + DELAY NGẪU NHIÊN)
// =========================================================================

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
      const tab = await openOrReuseScraperTab('fbGroups', src.url, 3200)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(tab.id, {
        type: 'FB_SCRAPE_GROUPS',
        options: { targetCount: targetCount - collected.length, excludeUrls: seenUrls, excludeNames: seenNames, category: customKeyword || src.label }
      }, scripts)
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') return { ok: false, error: res.error, groups: collected }
      for (const g of res?.groups || []) {
        if (collected.length >= targetCount) break
        seenUrls.push(g.groupUrl)
        seenNames.push(g.groupName)
        collected.push(g)
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

async function runAutoWatchTask(options = {}) {
  const jobKey = `watch:${options.platform || 'tiktok'}`
  activeJobs.set(jobKey, { platform: options.platform || 'tiktok', startedAt: new Date().toISOString(), step: 'auto_watch' })
  ensureKeepAlive()
  try {
    const platform = String(options.platform || 'tiktok').toLowerCase()
    const repeatCount = Math.max(1, Math.min(50, Number(options.repeatCount) || 5))
    const dwellSeconds = Math.max(3, Math.min(120, Number(options.dwellSeconds) || 8))
    const customUrl = String(options.url || '').trim()
    const startUrl = customUrl || (platform === 'facebook' ? 'https://www.facebook.com/reel/' : 'https://www.tiktok.com/foryou')
    const scripts = platform === 'facebook' ? ['vision-engine.js', 'content-media.js', 'content-facebook.js'] : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    const tabKey = platform === 'facebook' ? 'fbReels' : 'ttViral'

    pushLog({ platform, step: 'auto_watch', level: 'info', message: `👁️ Bắt đầu xem ${repeatCount} lượt (~${dwellSeconds}s/lượt ngẫu nhiên)...` })
    let tab = await openOrReuseScraperTab(tabKey, startUrl, 2800)
    let watched = 0

    for (let i = 1; i <= repeatCount; i++) {
      if (customUrl && i > 1) {
        tab = await navigateTabAndWait(tab.id, customUrl, 2200)
      }
      const res = await sendTabMessageWithRetry(
        tab.id,
        { type: platform === 'facebook' ? 'FB_WATCH_ITEM' : 'TT_WATCH_ITEM', options: { dwellSeconds, stepIndex: i, total: repeatCount, advanceNext: !customUrl } },
        scripts
      ).catch(() => null)
      watched++
      const actualSec = Math.round((res?.watchedMs || dwellSeconds * 1000) / 1000)
      pushLog({ platform, step: 'auto_watch', level: 'info', message: `👁️ Đã xem xong lượt ${watched}/${repeatCount} (${actualSec}s).` })
      if (i < repeatCount) await new Promise((r) => setTimeout(r, randomBetween(900, 2400)))
    }
    pushLog({ platform, step: 'done', level: 'success', message: `✅ Hoàn tất xem tự động ${watched}/${repeatCount} lượt!` })
    return { ok: true, watched, repeatCount, platform }
  } finally {
    activeJobs.delete(jobKey)
    ensureKeepAlive()
  }
}

async function runScrapePostComments(options = {}) {
  const url = String(options.postUrl || '').trim()
  if (!url) return { ok: false, error: 'URL_REQUIRED', comments: [] }
  const isFb = /facebook\.com/i.test(url)
  const platform = isFb ? 'facebook' : 'tiktok'
  const maxComments = Math.max(10, Math.min(120, Number(options.maxComments) || 40))
  const scripts = isFb ? ['vision-engine.js', 'content-media.js', 'content-facebook.js'] : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']

  pushLog({ platform, step: 'scrape_comments', level: 'info', message: `💬 Đang mở bài và đọc tối đa ${maxComments} bình luận...` })
  const tab = await openOrReuseScraperTab(isFb ? 'fbFeed' : 'ttViral', url, 3600)
  const res = await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_SCRAPE_COMMENTS' : 'TT_SCRAPE_COMMENTS', options: { maxComments } }, scripts)
  pushLog({ platform, step: 'done', level: 'success', message: `✅ Đã đọc ${(res?.comments || []).length} bình luận.` })
  return { ok: true, platform, postTitle: res?.postTitle || '', comments: res?.comments || [] }
}

async function runScrapeChannelProfiles(options = {}) {
  const urls = (Array.isArray(options.channelUrls) ? options.channelUrls : []).map((u) => String(u || '').trim()).filter(Boolean).slice(0, 15)
  if (!urls.length) return { ok: false, error: 'CHANNEL_URLS_REQUIRED', channels: [] }

  const results = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    const isFb = /facebook\.com/i.test(url)
    const platform = isFb ? 'facebook' : 'tiktok'
    const scripts = isFb ? ['vision-engine.js', 'content-media.js', 'content-facebook.js'] : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    pushLog({ platform, step: 'scan_channel', level: 'info', message: `🕵️ Đang soi kênh ${i + 1}/${urls.length}...` })
    try {
      const tab = await openOrReuseScraperTab(isFb ? 'fbFeed' : 'ttViral', url, 3400)
      const res = await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_SCRAPE_CHANNEL' : 'TT_SCRAPE_CHANNEL', options: { channelUrl: url } }, scripts)
      if (res?.channel) results.push(res.channel)
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, randomBetween(1100, 2600)))
    } catch (_) {}
  }
  pushLog({ platform: 'system', step: 'done', level: 'success', message: `✅ Đã quét xong ${results.length}/${urls.length} kênh/trang.` })
  return { ok: true, channels: results }
}

async function runSurfAndCollect(options = {}) {
  const platform = String(options.platform || 'tiktok').toLowerCase()
  const isFb = platform === 'facebook'
  const jobKey = `surf:${platform}`
  surfStopFlags[platform] = false
  activeJobs.set(jobKey, { platform, startedAt: new Date().toISOString(), step: 'surf' })
  ensureKeepAlive()

  try {
    const durationMinutes = Math.max(1, Math.min(30, Number(options.durationMinutes) || 3))
    const targetTopic = String(options.topic || '').trim()
    const ttSourceMode = String(options.ttSourceMode || (targetTopic ? 'search' : 'explore')).toLowerCase()
    const scripts = isFb ? ['vision-engine.js', 'content-media.js', 'content-facebook.js'] : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    const startUrl = isFb
      ? (options.fbMode === 'reels' ? 'https://www.facebook.com/reel/' : (targetTopic ? `https://www.facebook.com/search/top/?q=${encodeURIComponent(targetTopic)}` : 'https://www.facebook.com/'))
      : (ttSourceMode === 'explore' ? 'https://www.tiktok.com/explore' : `https://www.tiktok.com/search/video?q=${encodeURIComponent(targetTopic || 'xu hướng')}`)

    const totalMs = durationMinutes * 60 * 1000
    const startedAt = Date.now()
    const endAt = startedAt + totalMs
    const collected = []
    const seenUrls = new Set()
    let stepIndex = 0
    let sameCountSteps = 0
    let lastCardCount = 0

    pushLog({ platform, step: 'surf', level: 'info', message: `🧭 Bắt đầu lướt ${platform.toUpperCase()} trong đúng ${durationMinutes} phút...` })
    const tab = await openOrReuseScraperTab(isFb ? 'fbFeed' : 'ttViral', startUrl, 3400)

    while (Date.now() < endAt && !surfStopFlags[platform]) {
      stepIndex++
      const switchExplore = !isFb && sameCountSteps >= 4
      if (switchExplore) sameCountSteps = 0

      try {
        const res = await sendTabMessageWithRetry(
          tab.id,
          {
            type: isFb ? 'FB_SURF_STEP' : 'TT_SURF_STEP',
            options: { minLikes: isFb ? 300 : 5000, topicLabel: targetTopic, excludeUrls: Array.from(seenUrls), stepIndex, switchExplore }
          },
          scripts
        )
        for (const p of res?.posts || []) {
          const key = String(p.postUrl || '').trim().toLowerCase()
          if (key && !seenUrls.has(key)) { seenUrls.add(key); collected.push(p) }
        }
        if (typeof res?.cardCount === 'number') {
          if (res.cardCount <= lastCardCount) sameCountSteps++
          else { sameCountSteps = 0; lastCardCount = res.cardCount }
        }
      } catch (_) {}

      if (Date.now() >= endAt || surfStopFlags[platform]) break

      // Delay ngẫu nhiên giống người thật (2,6s → 6,8s; thỉnh thoảng dừng đọc bài 7–10s)
      const waitMs = Math.random() < 0.2 ? randomBetween(6800, 10200) : randomBetween(2600, 6400)
      const clampedWait = Math.min(waitMs, Math.max(500, endAt - Date.now()))
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      const totalSec = durationMinutes * 60
      pushLog({
        platform, step: 'surf', level: 'info',
        message: `🧭 Lướt lượt #${stepIndex} (${Math.floor(elapsedSec / 60)}p${String(elapsedSec % 60).padStart(2, '0')}s / ${Math.floor(totalSec / 60)}p00s) · Đã gặp ${collected.length} bài`
      })
      await new Promise((resolve) => {
        const t = setTimeout(() => { surfWakeups[platform] = null; resolve() }, clampedWait)
        surfWakeups[platform] = () => { clearTimeout(t); surfWakeups[platform] = null; resolve() }
      })
    }

    const stoppedManual = surfStopFlags[platform]
    pushLog({ platform, step: 'done', level: 'success', message: stoppedManual ? `⏹ Đã dừng lướt — thu thập ${collected.length} bài.` : `✅ Đã lướt đủ ${durationMinutes} phút — thu thập ${collected.length} bài.` })
    return { ok: true, platform, durationMinutes, posts: collected, stoppedManual }
  } finally {
    activeJobs.delete(jobKey)
    ensureKeepAlive()
  }
}

// =========================================================================
// ĐIỀU PHỐI LỆNH TỪ ADMIN / POPUP / CONTENT SCRIPTS
// =========================================================================

async function dispatchCommand(message, sender = {}) {
  const type = message?.type
  switch (type) {
    case 'SW_SLEEP': {
      const waitMs = Math.min(25000, Math.max(10, Math.round(Number(message.ms) || 100)))
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      return { ok: true, sleptMs: waitMs }
    }
    case 'PING': {
      const [vision, pending] = await Promise.all([getVisionConfig(), getPendingVerifications()])
      return {
        ok: true, installed: true, version: getExtensionVersion(),
        visionEnabled: true, pacingMode: vision.pacingMode, pendingVerificationsCount: pending.length
      }
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
    case 'AUTO_WATCH_TASK':
      return await runAutoWatchTask(message)
    case 'SCRAPE_POST_COMMENTS':
      return await runScrapePostComments(message)
    case 'SCRAPE_CHANNEL_PROFILES':
      return await runScrapeChannelProfiles(message)
    case 'SURF_AND_COLLECT':
      return await runSurfAndCollect(message)
    case 'STOP_VIRAL_PLATFORM': {
      const p = String(message.platform || 'all').toLowerCase()
      if (p === 'facebook' || p === 'all') {
        viralStopFlags.facebook = true
        for (const key of ['fbFeed', 'fbReels']) {
          if (scraperTabIds[key]) chrome.tabs.sendMessage(scraperTabIds[key], { type: 'ABORT_SCRAPE' }).catch(() => {})
        }
        pushLog({ platform: 'facebook', step: 'stop', level: 'warn', message: '⏹ Đã dừng cào bài Viral Facebook theo yêu cầu.' })
      }
      if (p === 'tiktok' || p === 'all') {
        viralStopFlags.tiktok = true
        if (scraperTabIds.ttViral) chrome.tabs.sendMessage(scraperTabIds.ttViral, { type: 'ABORT_SCRAPE' }).catch(() => {})
        pushLog({ platform: 'tiktok', step: 'stop', level: 'warn', message: '⏹ Đã dừng cào bài Viral TikTok theo yêu cầu.' })
      }
      return { ok: true }
    }
    case 'STOP_SURF': {
      const p = String(message.platform || 'all').toLowerCase()
      if (p === 'facebook' || p === 'all') { surfStopFlags.facebook = true; surfWakeups.facebook?.() }
      if (p === 'tiktok' || p === 'all') { surfStopFlags.tiktok = true; surfWakeups.tiktok?.() }
      return { ok: true }
    }
    case 'LIVE_VIRAL_POST': {
      if (message.post?.postUrl) {
        broadcastToAdmins({
          type: 'VIRAL_BATCH_READY',
          payload: {
            platform: message.platform || message.post.platform,
            sourceLabel: message.sourceLabel || 'Viral',
            topic: viralLiveContext.topic,
            topicLabel: viralLiveContext.topicLabel,
            posts: [message.post]
          }
        })
      }
      return { ok: true }
    }
    case 'OPEN_SINGLE_TAB':
      return await openOrReuseSingleViewTab(message.url, message.platform)
    case 'AI_SELF_HEAL':
    case 'VISION_AI_ASSIST':
    case 'VISION_AI_ANALYZE':
      return await handleVisionAiAssist(message, sender)
    case 'TEST_VISION_AI': {
      const testRes = await handleVisionAiAssist({
        platform: 'system', stepKey: 'vision:health_check',
        goal: 'Kiểm tra kết nối Vision AI qwen3.5:4b',
        url: ADMIN_DEFAULT_ORIGIN, errorReason: 'Health check',
        elements: [{ id: 1, tag: 'button', role: 'button', text: 'Đăng', label: 'Đăng', x: 100, y: 100, w: 80, h: 36 }]
      }, sender)
      return { ok: Boolean(testRes?.ok), message: testRes?.ok ? `Kết nối tốt (${testRes.generatedBy || 'qwen3.5:4b'})` : (testRes?.error || 'Chưa kết nối được Ollama / Tab Admin') }
    }
    case 'GET_LEARNED_KNOWLEDGE': {
      const knowledge = await getLearnedKnowledge()
      return { ok: true, rule: message.stepKey ? (knowledge[message.stepKey] || null) : null, knowledge }
    }
    case 'SAVE_LEARNED_KNOWLEDGE': {
      const patch = message.stepKey && message.rule ? { [message.stepKey]: message.rule } : (message.patch || {})
      return { ok: true, knowledge: await saveLearnedKnowledge(patch) }
    }
    case 'INVALIDATE_LEARNED_KNOWLEDGE':
      return { ok: true, knowledge: await invalidateLearnedKnowledgeKey(message.stepKey) }
    case 'CHECK_PENDING_NOW': {
      await processPendingVerifications()
      return { ok: true, pending: await getPendingVerifications() }
    }
    case 'JOB_STEP_PROGRESS': {
      const job = activeJobs.get(`post:${message.platform}`) || activeJobs.get(message.platform)
      if (job) {
        job.step = message.step
        if (job.checkpoint && message.extra) {
          if (message.extra.checkpointStep && !job.checkpoint.completedSteps.includes(message.extra.checkpointStep)) {
            job.checkpoint.completedSteps.push(message.extra.checkpointStep)
          }
          if (message.extra.checkpointStep === 'submitted') job.checkpoint.verifyOnly = true
          if (Array.isArray(message.extra.existingPermalinks)) job.checkpoint.existingPermalinks = message.extra.existingPermalinks
        }
      }
      pushLog({
        platform: message.platform || 'system',
        step: message.step || 'step',
        level: message.level || 'info',
        message: message.message || ''
      })
      return { ok: true }
    }
    case 'GET_VISION_CONFIG':
      return { ok: true, config: await getVisionConfig() }
    case 'SAVE_VISION_CONFIG':
      return { ok: true, config: await saveVisionConfig(message.config || {}) }
    case 'INSPECT_TAB': {
      const platform = String(message.platform || 'tiktok').toLowerCase()
      const isFb = platform === 'facebook'
      const tab = isFb ? await findOrCreateFacebookPostTab() : await findOrCreateTikTokPostTab()
      const scripts = isFb
        ? ['vision-engine.js', 'content-media.js', 'content-facebook.js']
        : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
      return {
        ok: true, platform, tabId: tab.id, url: tab.url,
        inspection: await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_INSPECT_VISION' : 'TIKTOK_INSPECT_VISION' }, scripts)
      }
    }
    case 'CANCEL_JOB': {
      activeJobs.clear()
      ensureKeepAlive()
      return { ok: true }
    }
    default:
      return { ok: false, error: 'UNKNOWN_COMMAND' }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false
  dispatchCommand(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
  return true
})
