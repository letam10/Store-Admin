/*
  FILE NOTE
  - Mục đích: Service Worker nền (Manifest V3) v3.0.0 — Vận hành 24/7 đa tài khoản (không hardcode bất kỳ tên/ID tài khoản nào).
  - Tính năng v3.0.0:
    1. chrome.alarms 24/7 Keep-Alive + Trình theo dõi duyệt bài TikTok 3–5 phút (pendingVerifications lưu trong chrome.storage.local, tự kiểm tra mỗi 45 giây tối đa 8 phút để lấy đúng link thật và báo về Admin!).
    2. Mở 2 Tab chuyên biệt song song để cào 10 bài Viral Facebook (>= 5K tương tác) + 10 bài Viral TikTok (>= 50K tim) có đường dẫn chính xác.
    3. Mở Tab chuyên biệt tự động lấy 5 Hội Nhóm Facebook thật (/groups/discover & /search/groups).
    4. Hỗ trợ mọi tài khoản Facebook & TikTok đang đăng nhập trên Chrome (dùng facebook.com/me và tiktok.com/tiktokstudio/upload).
*/

const FB_POST_HOME_URL = 'https://www.facebook.com/me'
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'
const TIKTOK_CONTENT_URL = 'https://www.tiktok.com/tiktokstudio/content'
const ADMIN_DEFAULT_ORIGIN = 'http://localhost:5174'
const MAX_PRODUCT_IMAGE_BYTES = 15 * 1024 * 1024

const ALARM_KEEPALIVE = 'omnicart-247-heartbeat'
const ALARM_PENDING_VERIFY = 'omnicart-verify-pending-posts'
const STORAGE_PENDING_KEY = 'omnicartPendingVerifications'
const STORAGE_RESOLVED_KEY = 'omnicartResolvedVerifications'

const DEFAULT_VISION_CONFIG = {
  showHud: true,
  pacingMode: 'normal',
  aiMode: 'layout',
  provider: 'ollama',
  endpoint: 'http://localhost:11434/api/chat',
  model: 'qwen2.5vl:7b',
  apiKey: ''
}

const adminPorts = new Set()
const activeJobs = new Map()
const recentLogs = []
const scraperTabIds = { fbViral: null, ttViral: null, fbGroups: null }
let keepAliveTimer = null
let verificationCheckInFlight = false

function getExtensionVersion() {
  return chrome.runtime.getManifest().version
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
    }, 18000)
  } else if (activeJobs.size === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

function setup247Alarms() {
  try {
    chrome.alarms.create(ALARM_KEEPALIVE, { periodInMinutes: 1 })
    chrome.alarms.create(ALARM_PENDING_VERIFY, { delayInMinutes: 0.75, periodInMinutes: 0.75 })
  } catch (_) {}
}

chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (alarm?.name === ALARM_PENDING_VERIFY || alarm?.name === ALARM_KEEPALIVE) {
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
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.url && (tab.url.includes('facebook.com') || tab.url.includes('tiktok.com'))) {
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config: next }).catch(() => {})
    }
  }
  return next
}

async function reinjectAdminBridges() {
  try {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id && tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url)) {
        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content-admin-bridge.js'] })
        } catch (_) {}
      }
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  setup247Alarms()
  reinjectAdminBridges()
})

chrome.runtime.onStartup.addListener(() => {
  setup247Alarms()
  reinjectAdminBridges()
})

setup247Alarms()

// =========================================================================
// HÀNG ĐỢI THEO DÕI DUYỆT BÀI TIKTOK 3–5 PHÚT BỀN VỮNG (CHROME.STORAGE + ALARMS)
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
  const list = await getPendingVerifications()
  const filtered = list.filter((x) => x.postId !== item.postId)
  filtered.push({
    ...item,
    createdAtMs: Date.now(),
    checks: 0,
    maxChecks: 12 // ~12 lần x 45s = 9 phút theo dõi bền bỉ!
  })
  await savePendingVerifications(filtered)
  try {
    chrome.alarms.create(ALARM_PENDING_VERIFY, { delayInMinutes: 0.75, periodInMinutes: 0.75 })
  } catch (_) {}
  pushLog({
    platform: item.platform,
    step: 'pending_review',
    level: 'info',
    message: `⏳ Đã đưa bài #${item.postId} vào hàng đợi theo dõi duyệt TikTok 3–5 phút (kiểm tra mỗi 45 giây).`
  })
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
        // Mở trang Quản lý bài đăng TikTok Studio để kiểm tra trạng thái duyệt
        tab = await navigateTabAndWait(tab.id, TIKTOK_CONTENT_URL, 2600)
        let check = await sendTabMessageWithRetry(
          tab.id,
          {
            type: 'TIKTOK_CHECK_POST_STATUS',
            options: { titleProbe: item.titleProbe, accountHandle: item.account }
          },
          scripts
        )

        // Nếu bài đã duyệt trên Studio Content nhưng cần mở Profile để lấy URL /@handle/photo/id
        if (check?.status === 'approved_need_profile_link' && check.accountHandle) {
          const handle = check.accountHandle.startsWith('@') ? check.accountHandle : `@${check.accountHandle}`
          tab = await navigateTabAndWait(tab.id, `https://www.tiktok.com/${handle}`, 2600)
          check = await sendTabMessageWithRetry(
            tab.id,
            {
              type: 'TIKTOK_CHECK_POST_STATUS',
              options: { titleProbe: item.titleProbe, accountHandle: handle }
            },
            scripts
          )
        }

        if (check?.status === 'published' && check.postUrl) {
          const resolvedEvent = {
            postId: item.postId,
            platform: 'tiktok',
            status: 'published',
            postUrl: check.postUrl,
            realPostId: check.postId || `tiktok-${Date.now()}`,
            privacy: item.privacy,
            publishedTime: new Date().toISOString(),
            account: check.accountHandle || item.account
          }
          resolvedList.unshift(resolvedEvent)
          await saveResolvedVerifications(resolvedList)
          pushLog({
            platform: 'tiktok',
            step: 'review_resolved',
            level: 'success',
            message: `🎉 TikTok đã duyệt bài #${item.postId}! Link thật: ${check.postUrl}`
          })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: resolvedEvent })
          continue
        }

        if (check?.status === 'rejected') {
          const failedEvent = {
            postId: item.postId,
            platform: 'tiktok',
            status: 'failed',
            error: check.error || 'TIKTOK_POST_REJECTED_IN_REVIEW'
          }
          pushLog({
            platform: 'tiktok',
            step: 'review_rejected',
            level: 'error',
            message: `❌ Bài TikTok #${item.postId} không được duyệt: ${failedEvent.error}`
          })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: failedEvent })
          continue
        }

        if (item.checks >= (item.maxChecks || 12)) {
          const timeoutEvent = {
            postId: item.postId,
            platform: 'tiktok',
            status: 'unverified',
            error: 'TIKTOK_REVIEW_TIMEOUT_9M'
          }
          pushLog({
            platform: 'tiktok',
            step: 'review_timeout',
            level: 'warn',
            message: `⏱️ Quá 9 phút chờ duyệt bài TikTok #${item.postId}, vui lòng kiểm tra trực tiếp trên TikTok Studio.`
          })
          broadcastToAdmins({ type: 'POST_VERIFICATION_RESOLVED', payload: timeoutEvent })
          continue
        }

        pushLog({
          platform: 'tiktok',
          step: 'review_waiting',
          level: 'info',
          message: `⏳ Theo dõi bài TikTok #${item.postId} (lần ${item.checks}/${item.maxChecks || 12}): ${check?.message || 'TikTok vẫn đang duyệt...'}`
        })
        remaining.push(item)
      } catch (err) {
        if (item.checks < (item.maxChecks || 12)) {
          remaining.push(item)
        }
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

  const [pendingVerifications, resolvedVerifications] = await Promise.all([
    getPendingVerifications(),
    getResolvedVerifications()
  ])

  try {
    port.postMessage({
      type: 'BRIDGE_HELLO',
      version: getExtensionVersion(),
      activeJobs: Array.from(activeJobs.values()),
      pendingVerifications,
      resolvedVerifications,
      recentLogs: recentLogs.slice(0, 18)
    })
  } catch (_) {}

  port.onMessage.addListener(async (msg) => {
    if (!msg) return
    if (msg.type === 'HEARTBEAT') {
      port.postMessage({ type: 'HEARTBEAT_ACK', ts: Date.now(), version: getExtensionVersion() })
      return
    }
    if (msg.type === 'ACK_RESOLVED_VERIFICATION' && msg.postId) {
      const current = await getResolvedVerifications()
      await saveResolvedVerifications(current.filter((r) => r.postId !== msg.postId))
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
        port.postMessage({
          type: 'ADMIN_COMMAND_RESULT',
          requestId: msg.requestId,
          ok: false,
          data: null,
          error: err.message || String(err)
        })
      }
    }
  })

  port.onDisconnect.addListener(() => {
    adminPorts.delete(port)
  })
})

// =========================================================================
// QUẢN LÝ TAB THÔNG MINH (TÁCH BIỆT TAB ĐĂNG BÀI & 2 TAB CÀO VIRAL/NHÓM)
// =========================================================================

async function waitForTabComplete(tabId, timeoutMs = 18000) {
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

async function navigateTabAndWait(tabId, url, settleMs = 2200) {
  await chrome.tabs.update(tabId, { url })
  await waitForTabComplete(tabId, 22000)
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
    const receiverMissing =
      /receiving end does not exist|could not establish connection|no content script response|message port closed/i.test(
        err.message || ''
      )
    if (receiverMissing && scriptFiles && chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: Array.isArray(scriptFiles) ? scriptFiles : [scriptFiles]
      })
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

// Tìm hoặc mở Tab đăng bài Facebook (bất kỳ nick nào đang đăng nhập)
async function findOrCreateFacebookPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => {
    if (isScraperTabId(tab.id)) return false
    try {
      const url = new URL(tab.url || '')
      return /(^|\.)facebook\.com$/i.test(url.hostname) && !/\/(groups\/discover|watch|search)/i.test(url.pathname)
    } catch (_) {
      return false
    }
  })
  if (existing) return existing

  const created = await chrome.tabs.create({ url: FB_POST_HOME_URL, active: false })
  await waitForTabComplete(created.id, 22000)
  await new Promise((r) => setTimeout(r, 2400))
  return created
}

// Tìm hoặc mở Tab đăng bài TikTok Studio (bất kỳ nick nào đang đăng nhập)
async function findOrCreateTikTokPostTab() {
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((tab) => {
    if (isScraperTabId(tab.id)) return false
    try {
      const url = new URL(tab.url || '')
      return /(^|\.)tiktok\.com$/i.test(url.hostname) && /\/(tiktokstudio|creator-center|upload)/i.test(url.pathname)
    } catch (_) {
      return false
    }
  })
  if (existing) return existing

  const created = await chrome.tabs.create({ url: TIKTOK_UPLOAD_URL, active: false })
  await waitForTabComplete(created.id, 22000)
  await new Promise((r) => setTimeout(r, 2500))
  return created
}

// Mở hoặc tái sử dụng Tab chuyên biệt để cào (không đụng tab đang đăng bài!)
async function openOrReuseScraperTab(key, url, settleMs = 2500) {
  const existingId = scraperTabIds[key]
  if (existingId) {
    try {
      const tab = await chrome.tabs.get(existingId)
      if (tab?.id) {
        return await navigateTabAndWait(tab.id, url, settleMs)
      }
    } catch (_) {
      scraperTabIds[key] = null
    }
  }
  const created = await chrome.tabs.create({ url, active: false })
  scraperTabIds[key] = created.id
  await waitForTabComplete(created.id, 24000)
  await new Promise((r) => setTimeout(r, settleMs))
  return await chrome.tabs.get(created.id)
}

// =========================================================================
// XỬ LÝ ẢNH & PAYLOAD
// =========================================================================

function resolveProductImageUrl(rawValue, senderTabUrl) {
  const value = String(rawValue || '').trim()
  if (!value) throw new Error('PRODUCT_IMAGE_REQUIRED')
  if (value.startsWith('data:image/')) return value
  if (value.startsWith('/')) {
    const base = senderTabUrl ? new URL(senderTabUrl).origin : ADMIN_DEFAULT_ORIGIN
    return `${base}${value}`
  }
  let parsed
  try { parsed = new URL(value) } catch (_) { throw new Error('PRODUCT_IMAGE_URL_INVALID') }
  const isAllowedLocal = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  if (!isAllowedLocal && parsed.protocol !== 'https:') throw new Error('PRODUCT_IMAGE_URL_NOT_ALLOWED')
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
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
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
    privacy,
    imageDataUrl: await loadProductImageDataUrl(rawImage, senderTabUrl)
  }
}

function isConfirmedPostResponse(response, platform, requestedPrivacy) {
  if (response?.ok !== true || response.platform !== platform) return false
  if (response.privacy && response.privacy !== requestedPrivacy) return false
  if (response.pendingReview === true && platform === 'tiktok') return true
  if (typeof response.postUrl !== 'string' || !response.postUrl) return false
  return true
}

// =========================================================================
// ĐĂNG BÀI FACEBOOK & TIKTOK
// =========================================================================

async function executeFacebookPost(postData, senderTabUrl) {
  if (activeJobs.has('facebook')) return { ok: false, error: 'FACEBOOK_JOB_ALREADY_RUNNING' }
  activeJobs.set('facebook', { platform: 'facebook', startedAt: new Date().toISOString(), step: 'init' })
  ensureKeepAlive()

  try {
    const config = await getVisionConfig()
    pushLog({ platform: 'facebook', step: 'prepare', level: 'info', message: `Chuẩn bị ảnh & nội dung Facebook (tốc độ: ${config.pacingMode})...` })
    const preparedPost = await preparePostPayload(postData, senderTabUrl)

    let fbTab = await findOrCreateFacebookPostTab()
    const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    chrome.tabs.sendMessage(fbTab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})

    let response = await sendTabMessageWithRetry(fbTab.id, { type: 'FB_EXECUTE_POST', payload: preparedPost }, scripts)
    if (response?.needsNavigation && response.targetUrl) {
      pushLog({ platform: 'facebook', step: 'navigate', level: 'warn', message: 'Điều hướng tab Facebook về trang cá nhân đang đăng nhập (/me)...' })
      fbTab = await navigateTabAndWait(fbTab.id, response.targetUrl, 2600)
      response = await sendTabMessageWithRetry(fbTab.id, { type: 'FB_EXECUTE_POST', payload: preparedPost }, scripts)
    }

    if (!isConfirmedPostResponse(response, 'facebook', preparedPost.privacy)) {
      const errMsg = response?.error || 'FACEBOOK_POST_NOT_VERIFIED'
      pushLog({ platform: 'facebook', step: 'failed', level: 'error', message: `Đăng Facebook thất bại: ${errMsg}` })
      return { ok: false, error: errMsg, visionTrace: response?.visionTrace || [] }
    }

    pushLog({ platform: 'facebook', step: 'done', level: 'success', message: `✅ Đã đăng bài Facebook thành công (${response.privacy})!` })
    return response
  } catch (err) {
    pushLog({ platform: 'facebook', step: 'error', level: 'error', message: `Lỗi Facebook: ${err.message}` })
    return { ok: false, error: `Lỗi thao tác tab Facebook: ${err.message}` }
  } finally {
    activeJobs.delete('facebook')
    ensureKeepAlive()
  }
}

async function executeTikTokPost(postData, senderTabUrl) {
  if (activeJobs.has('tiktok')) return { ok: false, error: 'TIKTOK_JOB_ALREADY_RUNNING' }
  activeJobs.set('tiktok', { platform: 'tiktok', startedAt: new Date().toISOString(), step: 'init' })
  ensureKeepAlive()

  try {
    const config = await getVisionConfig()
    pushLog({ platform: 'tiktok', step: 'prepare', level: 'info', message: `Chuẩn bị ảnh & nội dung TikTok (tốc độ: ${config.pacingMode})...` })
    const preparedPost = await preparePostPayload(postData, senderTabUrl)

    let ttTab = await findOrCreateTikTokPostTab()
    if (!ttTab.url || !/\/(tiktokstudio\/upload|creator-center\/upload|upload)/i.test(ttTab.url)) {
      ttTab = await navigateTabAndWait(ttTab.id, TIKTOK_UPLOAD_URL, 2600)
    }

    const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    chrome.tabs.sendMessage(ttTab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})

    let response = await sendTabMessageWithRetry(ttTab.id, { type: 'TIKTOK_EXECUTE_POST', payload: preparedPost }, scripts)
    if (response?.needsNavigation && response.targetUrl) {
      ttTab = await navigateTabAndWait(ttTab.id, response.targetUrl, 2800)
      response = await sendTabMessageWithRetry(ttTab.id, { type: 'TIKTOK_EXECUTE_POST', payload: preparedPost }, scripts)
    }

    if (!isConfirmedPostResponse(response, 'tiktok', preparedPost.privacy)) {
      const errMsg = response?.error || 'TIKTOK_POST_NOT_VERIFIED'
      pushLog({ platform: 'tiktok', step: 'failed', level: 'error', message: `Đăng TikTok thất bại: ${errMsg}` })
      return { ok: false, error: errMsg, visionTrace: response?.visionTrace || [] }
    }

    // Nếu TikTok đang duyệt bài (3–5 phút), lưu vào hàng đợi 24/7 để tự động theo dõi & lấy link thật!
    if (response.pendingReview && preparedPost.postId) {
      await enqueuePendingVerification({
        postId: preparedPost.postId,
        platform: 'tiktok',
        privacy: preparedPost.privacy,
        titleProbe: response.titleProbe || preparedPost.title.slice(0, 36),
        account: response.account || ''
      })
    } else if (response.postUrl) {
      pushLog({ platform: 'tiktok', step: 'done', level: 'success', message: `✅ Đã đăng TikTok thành công: ${response.postUrl}` })
    }

    return response
  } catch (err) {
    pushLog({ platform: 'tiktok', step: 'error', level: 'error', message: `Lỗi TikTok: ${err.message}` })
    return { ok: false, error: `Lỗi thao tác tab TikTok: ${err.message}` }
  } finally {
    activeJobs.delete('tiktok')
    ensureKeepAlive()
  }
}

// =========================================================================
// CÀO VIRAL SONG SONG 2 TAB CHUYÊN BIỆT: 10 BÀI FB (>=5K) + 10 BÀI TIKTOK (>=50K)
// =========================================================================

async function scrapeFacebookViralDedicated(targetCount = 10, minLikes = 5000) {
  const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
  const config = await getVisionConfig()
  const sources = [
    'https://www.facebook.com/',
    'https://www.facebook.com/watch/',
    'https://www.facebook.com/groups/feed/'
  ]

  const allPosts = []
  const seenUrls = []

  for (const sourceUrl of sources) {
    if (allPosts.length >= targetCount) break
    try {
      pushLog({ platform: 'facebook', step: 'scrape_tab', level: 'info', message: `📘 Mở Tab cào FB (${sourceUrl}) tìm bài >= ${(minLikes / 1000)}K tương tác...` })
      const tab = await openOrReuseScraperTab('fbViral', sourceUrl, 2800)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'FB_SCRAPE_VIRAL',
          options: { targetCount: targetCount - allPosts.length, minLikes, maxScrolls: 12, excludeUrls: seenUrls }
        },
        scripts
      )
      if (res?.ok && Array.isArray(res.posts)) {
        for (const p of res.posts) {
          if (allPosts.length >= targetCount) break
          if (!seenUrls.includes(p.postUrl)) {
            seenUrls.push(p.postUrl)
            allPosts.push(p)
          }
        }
      }
      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') {
        return { ok: false, error: res.error, posts: allPosts }
      }
    } catch (err) {
      pushLog({ platform: 'facebook', step: 'scrape_warn', level: 'warn', message: `Cảnh báo nguồn cào FB: ${err.message}` })
    }
  }

  return { ok: true, posts: allPosts }
}

async function scrapeTikTokViralDedicated(targetCount = 10, minLikes = 50000) {
  const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const config = await getVisionConfig()
  const sources = [
    'https://www.tiktok.com/explore',
    'https://www.tiktok.com/foryou'
  ]

  const allPosts = []
  const seenUrls = []

  for (const sourceUrl of sources) {
    if (allPosts.length >= targetCount) break
    try {
      pushLog({ platform: 'tiktok', step: 'scrape_tab', level: 'info', message: `🎵 Mở Tab cào TikTok (${sourceUrl}) tìm bài >= ${(minLikes / 1000)}K tim...` })
      const tab = await openOrReuseScraperTab('ttViral', sourceUrl, 3000)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})
      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'TIKTOK_SCRAPE_VIRAL',
          options: { targetCount: targetCount - allPosts.length, minLikes, maxScrolls: 14, excludeUrls: seenUrls }
        },
        scripts
      )
      if (res?.ok && Array.isArray(res.posts)) {
        for (const p of res.posts) {
          if (allPosts.length >= targetCount) break
          if (!seenUrls.includes(p.postUrl)) {
            seenUrls.push(p.postUrl)
            allPosts.push(p)
          }
        }
      }
    } catch (err) {
      pushLog({ platform: 'tiktok', step: 'scrape_warn', level: 'warn', message: `Cảnh báo nguồn cào TikTok: ${err.message}` })
    }
  }

  return { ok: true, posts: allPosts }
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
    const fbMinLikes = Number(options.fbMinLikes) || 5000
    const ttMinLikes = Number(options.tiktokMinLikes) || 50000

    pushLog({
      platform: 'system',
      step: 'scrape_both',
      level: 'info',
      message: `🔥 Mở 2 Tab chuyên biệt song song: cào ${fbTarget} bài FB (>=5K) + ${ttTarget} bài TikTok (>=50K)...`
    })

    const [fbRes, ttRes] = await Promise.all([
      scrapeFacebookViralDedicated(fbTarget, fbMinLikes),
      scrapeTikTokViralDedicated(ttTarget, ttMinLikes)
    ])

    const facebookPosts = fbRes?.posts || []
    const tiktokPosts = ttRes?.posts || []
    const combined = [...facebookPosts, ...tiktokPosts]

    pushLog({
      platform: 'system',
      step: 'scrape_done',
      level: combined.length > 0 ? 'success' : 'warn',
      message: `✅ Hoàn tất cào Viral 2 Tab: Facebook ${facebookPosts.length}/${fbTarget} bài • TikTok ${tiktokPosts.length}/${ttTarget} bài.`
    })

    return {
      ok: true,
      facebookPosts,
      tiktokPosts,
      posts: combined,
      errors: {
        facebook: fbRes?.ok ? null : fbRes?.error || null,
        tiktok: ttRes?.ok ? null : ttRes?.error || null
      }
    }
  } finally {
    activeJobs.delete('scrape_viral')
    ensureKeepAlive()
  }
}

// =========================================================================
// TỰ ĐỘNG LẤY 5 LINK HỘI NHÓM FACEBOOK THẬT
// =========================================================================

async function scrapeFacebookGroupsJob(options = {}) {
  if (activeJobs.has('scrape_groups')) {
    return { ok: false, error: 'GROUP_SCRAPE_ALREADY_RUNNING', groups: [] }
  }
  activeJobs.set('scrape_groups', { platform: 'facebook', startedAt: new Date().toISOString(), step: 'scraping_groups' })
  ensureKeepAlive()

  try {
    const targetCount = Number(options.count) || 5
    const keyword = String(options.keyword || '').trim()
    const excludeUrls = Array.isArray(options.excludeUrls) ? options.excludeUrls : []
    const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    const config = await getVisionConfig()

    const candidateUrls = keyword
      ? [`https://www.facebook.com/search/groups/?q=${encodeURIComponent(keyword)}`, 'https://www.facebook.com/groups/discover/']
      : ['https://www.facebook.com/groups/discover/', 'https://www.facebook.com/search/groups/?q=mua%20s%E1%BA%AFm%20review']

    const collected = []
    const seen = [...excludeUrls]

    for (const url of candidateUrls) {
      if (collected.length >= targetCount) break
      pushLog({ platform: 'facebook', step: 'scrape_groups', level: 'info', message: `👥 Mở tab Facebook tìm ${targetCount} hội nhóm thật...` })
      const tab = await openOrReuseScraperTab('fbGroups', url, 2800)
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_CONFIG', config }).catch(() => {})

      const res = await sendTabMessageWithRetry(
        tab.id,
        {
          type: 'FB_SCRAPE_GROUPS',
          options: { targetCount: targetCount - collected.length, excludeUrls: seen, category: keyword || 'Cộng đồng Facebook' }
        },
        scripts
      )

      if (res?.error === 'FACEBOOK_LOGIN_REQUIRED') {
        return { ok: false, error: res.error, groups: collected }
      }
      if (res?.ok && Array.isArray(res.groups)) {
        for (const g of res.groups) {
          if (collected.length >= targetCount) break
          if (!seen.includes(g.groupUrl)) {
            seen.push(g.groupUrl)
            collected.push(g)
          }
        }
      }
    }

    pushLog({
      platform: 'facebook',
      step: 'scrape_groups_done',
      level: collected.length > 0 ? 'success' : 'warn',
      message: `✅ Đã lấy tự động ${collected.length}/${targetCount} hội nhóm Facebook thật!`
    })
    return { ok: true, groups: collected }
  } catch (err) {
    return { ok: false, error: err.message, groups: [] }
  } finally {
    activeJobs.delete('scrape_groups')
    ensureKeepAlive()
  }
}

// =========================================================================
// VISION AI CLIENT
// =========================================================================

async function captureTabScreenshotSafely(tabId, allowFocusSwitch = false) {
  if (!tabId) return null
  const tab = await chrome.tabs.get(tabId)
  if (!tab) return null
  if (tab.active) {
    try { return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 68 }) } catch (_) { return null }
  }
  if (!allowFocusSwitch) return null
  const activeTabs = await chrome.tabs.query({ windowId: tab.windowId, active: true })
  const previousTabId = activeTabs[0]?.id
  try {
    await chrome.tabs.update(tabId, { active: true })
    await new Promise((r) => setTimeout(r, 260))
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 68 })
  } catch (_) {
    return null
  } finally {
    if (previousTabId && previousTabId !== tabId) {
      try { await chrome.tabs.update(previousTabId, { active: true }) } catch (_) {}
    }
  }
}

function extractJsonObject(rawText) {
  const text = String(rawText || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch (_) { return null }
}

async function analyzeWithVisionAI({ tabId, goal, platform, step, somMap }) {
  const config = await getVisionConfig()
  if (config.aiMode === 'off') return { ok: false, error: 'VISION_AI_DISABLED' }

  const screenshotDataUrl = config.aiMode === 'screenshot'
    ? await captureTabScreenshotSafely(tabId, true)
    : await captureTabScreenshotSafely(tabId, false)

  const compactItems = (somMap?.items || []).slice(0, 65).map((item) => ({
    id: item.id, role: item.role, label: item.label, disabled: item.disabled,
    editable: item.editable, color: item.primaryColor, rect: item.rect
  }))

  const prompt = [
    `You are OmniVision operating ${platform} (step: ${step}).`,
    `Goal: ${goal}`,
    `Page URL: ${somMap?.url || ''}`,
    `Headings/Alerts: ${JSON.stringify(somMap?.visibleHeadings || [])}`,
    `Interactive Elements: ${JSON.stringify(compactItems)}`,
    'Return ONLY JSON: {"screenState":"snake_case","obstacle":null,"targetMarkId":number|null,"confidence":0.9,"reason":"Vietnamese brief"}'
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)

  try {
    let rawContent = ''
    if (config.provider === 'ollama') {
      const userMessage = { role: 'user', content: prompt }
      if (screenshotDataUrl) userMessage.images = [screenshotDataUrl.replace(/^data:image\/[^;]+;base64,/, '')]
      const res = await fetch(config.endpoint || 'http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ model: config.model || 'qwen2.5vl:7b', messages: [userMessage], format: 'json', stream: false, options: { temperature: 0.1 } })
      })
      if (!res.ok) throw new Error(`OLLAMA_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.message?.content || data?.response || ''
    } else if (config.provider === 'gemini') {
      if (!config.apiKey) throw new Error('GEMINI_API_KEY_MISSING')
      const parts = [{ text: prompt }]
      if (screenshotDataUrl) {
        parts.push({ inline_data: { mime_type: 'image/jpeg', data: screenshotDataUrl.replace(/^data:image\/[^;]+;base64,/, '') } })
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } })
      })
      if (!res.ok) throw new Error(`GEMINI_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else {
      const headers = { 'Content-Type': 'application/json' }
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
      const content = [{ type: 'text', text: prompt }]
      if (screenshotDataUrl) content.push({ type: 'image_url', image_url: { url: screenshotDataUrl } })
      const res = await fetch(config.endpoint || 'https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({ model: config.model || 'gpt-4o-mini', temperature: 0.1, messages: [{ role: 'user', content }] })
      })
      if (!res.ok) throw new Error(`OPENAI_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.choices?.[0]?.message?.content || ''
    }

    const parsed = extractJsonObject(rawContent)
    if (!parsed) return { ok: false, error: 'VISION_AI_INVALID_JSON' }
    return {
      ok: true,
      targetMarkId: Number.isInteger(parsed.targetMarkId) ? parsed.targetMarkId : null,
      screenState: parsed.screenState || 'unknown',
      reason: parsed.reason || ''
    }
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'VISION_AI_TIMEOUT' : err.message }
  } finally {
    clearTimeout(timeout)
  }
}

async function testVisionAIConnection() {
  const config = await getVisionConfig()
  if (config.aiMode === 'off') {
    return { ok: true, mode: 'off', message: 'OmniVision Hình học sẵn sàng. Vision AI đang tắt.' }
  }
  const result = await analyzeWithVisionAI({
    tabId: null,
    goal: 'Return markId 1 for Đăng button.',
    platform: 'test',
    step: 'connectivity_test',
    somMap: {
      url: 'https://test.local',
      visibleHeadings: ['Test'],
      items: [{ id: 1, role: 'button', label: 'Đăng', disabled: false, editable: false, primaryColor: 'red', rect: { x: 100, y: 500, w: 120, h: 40 } }]
    }
  })
  return result.ok
    ? { ok: true, message: `Kết nối Vision AI (${config.provider}/${config.model}) thành công!` }
    : { ok: false, error: result.error, message: `Không kết nối được Vision AI: ${result.error}. Hệ thống vẫn chạy bằng OmniVision Hình học.` }
}

async function inspectPlatformTab(platform) {
  const isFb = platform === 'facebook'
  const tab = isFb ? await findOrCreateFacebookPostTab() : await findOrCreateTikTokPostTab()
  const scripts = isFb
    ? ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const res = await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_INSPECT_VISION' : 'TIKTOK_INSPECT_VISION' }, scripts)
  return { ok: true, platform, tabId: tab.id, url: tab.url, inspection: res }
}

// =========================================================================
// ROUTER LỆNH TRUNG TÂM
// =========================================================================

async function dispatchCommand(message, sender = {}) {
  const type = message?.type
  switch (type) {
    case 'PING': {
      const [vision, pending] = await Promise.all([getVisionConfig(), getPendingVerifications()])
      return {
        ok: true,
        installed: true,
        version: getExtensionVersion(),
        visionEnabled: true,
        pacingMode: vision.pacingMode,
        pendingVerificationsCount: pending.length,
        capabilities: ['multi_account_auto', 'tiktok_3_5m_review_tracker', 'dual_tab_viral_scraper', 'fb_group_scraper', 'page_health_vision', 'human_pacing']
      }
    }

    case 'CHECK_STATUS': {
      const [allTabs, vision, pending] = await Promise.all([
        chrome.tabs.query({}),
        getVisionConfig(),
        getPendingVerifications()
      ])
      const hasAdmin = allTabs.some((t) => t.url && /^http:\/\/(localhost|127\.0\.0\.1):5174/i.test(t.url))
      const hasFacebook = allTabs.some((t) => t.url && /(^|\.)facebook\.com/i.test(t.url))
      const hasTikTok = allTabs.some((t) => t.url && /(^|\.)tiktok\.com/i.test(t.url))

      return {
        ok: true,
        version: getExtensionVersion(),
        tabs: { admin: hasAdmin, facebook: hasFacebook, tiktok: hasTikTok },
        vision,
        activeJobs: Array.from(activeJobs.values()),
        pendingVerifications: pending
      }
    }

    case 'AUTO_POST': {
      const platform = String(message.platform || 'facebook').toLowerCase()
      const senderUrl = sender?.tab?.url || ADMIN_DEFAULT_ORIGIN
      if (platform === 'facebook') return await executeFacebookPost(message.post, senderUrl)
      if (platform === 'tiktok') return await executeTikTokPost(message.post, senderUrl)
      return { ok: false, error: 'UNSUPPORTED_PLATFORM' }
    }

    case 'FETCH_REAL_VIRAL': {
      const platform = String(message.platform || 'both').toLowerCase()
      if (platform === 'both') return await scrapeBothViralPlatforms(message)
      if (platform === 'facebook') return await scrapeFacebookViralDedicated(Number(message.fbCount) || 10, Number(message.fbMinLikes) || 5000)
      return await scrapeTikTokViralDedicated(Number(message.tiktokCount) || 10, Number(message.tiktokMinLikes) || 50000)
    }

    case 'SCRAPE_FB_GROUPS':
      return await scrapeFacebookGroupsJob(message)

    case 'CHECK_PENDING_NOW': {
      await processPendingVerifications()
      return { ok: true, pending: await getPendingVerifications() }
    }

    case 'VISION_AI_ANALYZE':
      return await analyzeWithVisionAI({
        tabId: sender?.tab?.id || null,
        goal: message.goal,
        platform: message.platform,
        step: message.step,
        somMap: message.somMap
      })

    case 'JOB_STEP_PROGRESS': {
      const job = activeJobs.get(message.platform)
      if (job) job.step = message.step
      pushLog({
        platform: message.platform || 'system',
        step: message.step || 'step',
        level: message.level || 'info',
        message: message.message || '',
        extra: message.extra || {}
      })
      return { ok: true }
    }

    case 'GET_VISION_CONFIG':
      return { ok: true, config: await getVisionConfig() }

    case 'SAVE_VISION_CONFIG':
      return { ok: true, config: await saveVisionConfig(message.config || {}) }

    case 'TEST_VISION_AI':
      return await testVisionAIConnection()

    case 'INSPECT_TAB':
      return await inspectPlatformTab(String(message.platform || 'tiktok').toLowerCase())

    case 'GET_LIVE_LOGS':
      return { ok: true, logs: recentLogs.slice(0, 30), activeJobs: Array.from(activeJobs.values()), pendingVerifications: await getPendingVerifications() }

    case 'CANCEL_JOB': {
      activeJobs.clear()
      ensureKeepAlive()
      pushLog({ platform: 'system', step: 'cancelled', level: 'warn', message: 'Đã mở khóa hàng đợi tác vụ.' })
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
