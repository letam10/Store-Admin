/*
  FILE NOTE
  - Mục đích: Service Worker nền (Manifest V3) v3.2.0 — Vận hành 24/7 đa tài khoản.
  - Nâng cấp v3.2.0:
    1. Cơ chế Checkpoint tự phục hồi (tối đa 3 lần) khi FB hoặc TikTok bị văng về trang chủ, tải lại trang hoặc rớt cổng kết nối giữa chừng.
    2. Hỗ trợ cào bài Viral theo chủ đề (xe cộ, anime, hoạt hình, game, quảng bá sản phẩm mới, so sánh sản phẩm điện tử, hoặc từ khóa tự nhập) trên 2 Tab riêng (FB >= 5K, TikTok >= 200K) với bộ đếm trượt 5 phút.
    3. Theo dõi xét duyệt TikTok nghiêm ngặt: chờ hết nhãn "Nội dung đang được xét duyệt" mới báo thành công; báo ngay "rejected" nếu gặp dòng thông báo đỏ từ chối duyệt!
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

const DEFAULT_VISION_CONFIG = {
  showHud: true,
  pacingMode: 'normal',
  aiMode: 'layout',
  provider: 'ollama',
  endpoint: 'http://localhost:11434/api/chat',
  model: 'qwen2.5vl:7b',
  apiKey: ''
}

const GROUP_SEARCH_KEYWORDS = [
  'mua sắm review', 'nghiện nhà decor', 'đồ gia dụng tiện ích',
  'thời trang săn deal', 'mẹ và bé review', 'công nghệ phụ kiện',
  'ẩm thực nấu ăn ngon', 'làm đẹp chăm sóc da'
]

// Cấu hình nguồn & từ khóa cào Viral theo từng chủ đề cho cả Facebook & TikTok
const VIRAL_TOPIC_PRESETS = {
  all: {
    label: '',
    fbSources: [
      'https://www.facebook.com/',
      'https://www.facebook.com/reel/',
      'https://www.facebook.com/groups/feed/',
      'https://www.facebook.com/watch/'
    ],
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
    fbQuery: 'hoạt hình review phim hoạt hình',
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
const scraperTabIds = { fbViral: null, ttViral: null, fbGroups: null }
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
    }, 18000)
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
// HÀNG ĐỢI THEO DÕI XÉT DUYỆT TIKTOK (30 GIÂY/LẦN — BÁO DUYỆT THÀNH CÔNG HOẶC TỪ CHỐI ĐỎ!)
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
        const onStudioPosts = Boolean(tab.url && /tiktok\.com\/tiktokstudio\/(content|home)?(\?|$)/i.test(tab.url))
        if (!onStudioPosts) tab = await navigateTabAndWait(tab.id, TIKTOK_CONTENT_URL, 2600)

        let check = await sendTabMessageWithRetry(
          tab.id,
          { type: 'TIKTOK_CHECK_POST_STATUS', options: { titleProbe: item.titleProbe, accountHandle: item.account, refreshViaSidebar: onStudioPosts } },
          scripts
        )

        // BỊ TỪ CHỐI DUYỆT (dòng thông báo đỏ / vi phạm nguyên tắc) -> BÁO NGAY LẬP TỨC!
        if (check?.status === 'rejected') {
          const rejectEvent = {
            postId: item.postId,
            platform: 'tiktok',
            status: 'failed',
            rejected: true,
            error: check.error || 'Bài đăng TikTok bị từ chối duyệt.'
          }
          resolvedList.unshift(rejectEvent)
          await saveResolvedVerifications(resolvedList)
          pushLog({ platform: 'tiktok', step: 'review_rejected', level: 'error', message: `🔴 ${rejectEvent.error}` })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: rejectEvent })
          continue
        }

        // CHỈ KHI BÀI ĐÃ HẾT NHÃN "NỘI DUNG ĐANG ĐƯỢC XÉT DUYỆT" MỚI SANG PROFILE LẤY LINK THẬT!
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
// QUẢN LÝ TAB & CHECKPOINT PHỤC HỒI KHI VĂNG TRANG / TẢI LẠI TRANG
// =========================================================================

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete') return tab
    } catch (_) { throw new Error('TAB_CLOSED_UNEXPECTEDLY') }
    await new Promise((r) => setTimeout(r, 350))
  }
  throw new Error('TAB_LOAD_TIMEOUT')
}

async function navigateTabAndWait(tabId, url, settleMs = 2200) {
  await chrome.tabs.update(tabId, { url })
  await waitForTabComplete(tabId, 24000)
  await new Promise((r) => setTimeout(r, settleMs))
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
      await new Promise((r) => setTimeout(r, 950))
      const retryRes = await chrome.tabs.sendMessage(tabId, message)
      if (retryRes) return retryRes
      throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
    }
    throw err
  }
}

function isScraperTabId(tabId) {
  return tabId === scraperTabIds.fbViral || tabId === scraperTabIds.ttViral || tabId === scraperTabIds.fbGroups
}

async function findOrCreateFacebookPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => !isScraperTabId(tab.id) && tab.url && /(^|\.)facebook\.com/i.test(new URL(tab.url).hostname))
  if (existing) return existing
  const created = await chrome.tabs.create({ url: FB_POST_HOME_URL, active: false })
  await waitForTabComplete(created.id, 22000)
  await new Promise((r) => setTimeout(r, 2400))
  return created
}

async function findOrCreateTikTokPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => !isScraperTabId(tab.id) && tab.url && /(^|\.)tiktok\.com/i.test(new URL(tab.url).hostname) && /\/(tiktokstudio|creator-center|upload)/i.test(tab.url))
  if (existing) return existing
  const created = await chrome.tabs.create({ url: TIKTOK_STUDIO_HOME_URL, active: false })
  await waitForTabComplete(created.id, 22000)
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
  await waitForTabComplete(created.id, 24000)
  await new Promise((r) => setTimeout(r, settleMs))
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
    postId: postData.postId || postData.id || null,
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

// Chạy tác vụ đăng bài với Checkpoint phục hồi tối đa 3 lần nếu trang bị tải lại / văng về trang chủ!
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

    let response = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        let tab = platform === 'facebook' ? await findOrCreateFacebookPostTab() : await findOrCreateTikTokPostTab()
        chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})

        response = await sendTabMessageWithRetry(tab.id, { type: msgType, payload: preparedPost }, scripts)

        if (response?.needsNavigation && response.targetUrl) {
          pushLog({ platform, step: 'recover', level: 'warn', message: `Phát hiện trang lệch/tải lại (lần ${attempt}/3), tự quay lại đúng trang để tiếp tục...` })
          await navigateTabAndWait(tab.id, response.targetUrl, 2600)
          continue
        }
        break
      } catch (err) {
        const recoverable = /message port closed|tab_closed|receiving end|no content script/i.test(err.message || '')
        if (recoverable && attempt < 3) {
          pushLog({ platform, step: 'recover', level: 'warn', message: `Tab ${platform} vừa tải lại giữa chừng, đang tự nối lại (lần ${attempt + 1}/3)...` })
          await new Promise((r) => setTimeout(r, 2000))
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
    activeJobs.delete(platform)
    ensureKeepAlive()
  }
}

// =========================================================================
// CÀO 20 BÀI VIRAL THEO CHỦ ĐỀ (2 TAB: FB >= 5K • TIKTOK >= 200K • BỘ ĐẾM TRƯỢT 5 PHÚT!)
// =========================================================================

function resolveTopicConfig(topicKey, customTopic) {
  const cleanCustom = String(customTopic || '').trim()
  if (topicKey === 'custom' && cleanCustom) {
    return {
      label: cleanCustom,
      fbSources: [
        `https://www.facebook.com/search/posts/?q=${encodeURIComponent(cleanCustom)}`,
        `https://www.facebook.com/search/videos/?q=${encodeURIComponent(cleanCustom)}`,
        'https://www.facebook.com/reel/'
      ],
      ttSources: [`https://www.tiktok.com/search/video?q=${encodeURIComponent(cleanCustom)}`],
      ttExploreTab: ''
    }
  }
  const preset = VIRAL_TOPIC_PRESETS[topicKey] || VIRAL_TOPIC_PRESETS.all
  if (preset.fbSources) return preset
  return {
    label: preset.label,
    fbSources: [
      `https://www.facebook.com/search/posts/?q=${encodeURIComponent(preset.fbQuery)}`,
      `https://www.facebook.com/search/videos/?q=${encodeURIComponent(preset.fbQuery)}`,
      'https://www.facebook.com/reel/'
    ],
    ttSources: [
      `https://www.tiktok.com/search/video?q=${encodeURIComponent(preset.ttQuery)}`,
      'https://www.tiktok.com/explore'
    ],
    ttExploreTab: preset.ttExploreTab || ''
  }
}

async function scrapeFacebookViralWithSliding5Min(targetCount, minLikes, initialExcludeUrls, topicCfg) {
  const SLIDING_IDLE_MS = 5 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
  const config = await getVisionConfig()
  const sources = topicCfg.fbSources

  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  let lastFoundAt = Date.now()
  let sourceIdx = 0

  while (allPosts.length < targetCount && Date.now() - lastFoundAt < SLIDING_IDLE_MS) {
    const sourceUrl = sources[sourceIdx % sources.length]
    sourceIdx++
    try {
      const tab = await openOrReuseScraperTab('fbViral', sourceUrl, 2800)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'FB_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes, maxRoundsOnPage: 16, idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt, totalAlreadyFound: allPosts.length,
            topicLabel: topicCfg.label,
            excludeUrls: Array.from(seenUrls)
          }
        },
        scripts
      )
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') return { ok: false, error: res.error, posts: allPosts, timedOut: false }
      if (res?.lastFoundAt && res.lastFoundAt > lastFoundAt) lastFoundAt = res.lastFoundAt
      for (const p of res?.posts || []) {
        if (allPosts.length >= targetCount) break
        const key = String(p.postUrl || '').trim().toLowerCase()
        if (key && !seenUrls.has(key)) { seenUrls.add(key); allPosts.push(p); lastFoundAt = Date.now() }
      }
      if (res?.timedOut) break
    } catch (_) { await new Promise((r) => setTimeout(r, 2000)) }
  }
  return { ok: true, posts: allPosts, timedOut: allPosts.length < targetCount && Date.now() - lastFoundAt >= SLIDING_IDLE_MS }
}

async function scrapeTikTokViralWithSliding5Min(targetCount, minLikes, initialExcludeUrls, topicCfg) {
  const SLIDING_IDLE_MS = 5 * 60 * 1000
  const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const config = await getVisionConfig()
  const cursors = await getScrapeCursors()
  let categoryIndex = cursors.tiktokRunCount || 0
  await saveScrapeCursors({ tiktokRunCount: categoryIndex + 2 })

  const sources = topicCfg.ttSources
  const allPosts = []
  const seenUrls = new Set(initialExcludeUrls.map((u) => String(u).trim().toLowerCase()))
  let lastFoundAt = Date.now()
  let sourceIdx = 0

  while (allPosts.length < targetCount && Date.now() - lastFoundAt < SLIDING_IDLE_MS) {
    const sourceUrl = sources[sourceIdx % sources.length]
    sourceIdx++
    try {
      const tab = await openOrReuseScraperTab('ttViral', sourceUrl, 3000)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'TIKTOK_SCRAPE_VIRAL',
          options: {
            targetCount: targetCount - allPosts.length,
            minLikes, maxRoundsOnPage: 16, idleTimeoutMs: SLIDING_IDLE_MS,
            lastFoundAt, totalAlreadyFound: allPosts.length,
            categoryIndex: categoryIndex++,
            preferredExploreTab: topicCfg.ttExploreTab || '',
            topicLabel: topicCfg.label,
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
    } catch (_) { await new Promise((r) => setTimeout(r, 2000)) }
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
    const excludeUrls = Array.isArray(options.excludeUrls) ? options.excludeUrls : []
    const topicCfg = resolveTopicConfig(options.topic || 'all', options.customTopic || '')

    pushLog({ platform: 'system', step: 'scrape_both', level: 'info', message: `🔥 Đang cào 2 Tab (${topicCfg.label || 'Tất cả'} • FB ≥5K • TikTok ≥200K)...` })

    const [fbRes, ttRes] = await Promise.all([
      scrapeFacebookViralWithSliding5Min(fbTarget, fbMinLikes, excludeUrls, topicCfg),
      scrapeTikTokViralWithSliding5Min(ttTarget, ttMinLikes, excludeUrls, topicCfg)
    ])

    const facebookPosts = fbRes?.posts || []
    const tiktokPosts = ttRes?.posts || []
    const combined = [...facebookPosts, ...tiktokPosts]
    pushLog({ platform: 'system', step: 'scrape_done', level: combined.length > 0 ? 'success' : 'warn', message: `✅ Hoàn tất cào Viral → FB: ${facebookPosts.length}/${fbTarget} • TikTok: ${tiktokPosts.length}/${ttTarget}` })
    return { ok: true, facebookPosts, tiktokPosts, posts: combined, timedOut: { facebook: Boolean(fbRes?.timedOut), tiktok: Boolean(ttRes?.timedOut) } }
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
      const job = activeJobs.get(message.platform)
      if (job) job.step = message.step
      pushLog({ platform: message.platform || 'system', step: message.step || 'step', level: message.level || 'info', message: message.message || '' })
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
    case 'CANCEL_JOB': { activeJobs.clear(); ensureKeepAlive(); return { ok: true } }
    default: return { ok: false, error: 'UNKNOWN_COMMAND' }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false
  dispatchCommand(message, sender).then(sendResponse).catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
  return true
})
