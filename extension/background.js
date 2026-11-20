/*
  FILE NOTE
  - Mục đích: Service Worker nền (Manifest V3) điều phối Store-Admin ↔ Facebook ↔ TikTok, quản lý OmniVision AI (Ollama / Gemini / OpenAI), giữ kết nối Persistent Port và chống ngủ SW giữa chừng.
  - Liên kết trực tiếp: manifest.json, content-admin-bridge.js, vision-engine.js, content-media.js, content-facebook.js, content-tiktok.js, popup.js.
  - Tương thích ngược 100%: PING, CHECK_STATUS, AUTO_POST, FETCH_REAL_VIRAL.
  - Tính năng mới v2.0.0:
    1. Persistent Port ('omnicart-admin-bridge') phát trực tiếp tiến độ từng bước đăng bài về Admin Live Dock.
    2. Tự bơm lại content-admin-bridge.js vào tab localhost:5174 ngay khi reload extension (không cần F5).
    3. Hỗ trợ ảnh sản phẩm từ localhost mọi port, đường dẫn tương đối, https CDN và data:image/*.
    4. Điều hướng tab từ background.js (không bao giờ để content script tự đổi location làm đứt kết nối).
    5. Multimodal Vision AI (Set-of-Mark + Screenshot hoặc Layout-Only ngầm 100%).
*/

const FB_PROFILE_ID = '100037782653708'
const FB_PROFILE_URL = `https://www.facebook.com/profile.php?id=${FB_PROFILE_ID}`
const TIKTOK_PROFILE_URL = 'https://www.tiktok.com/@harutv666'
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'
const ADMIN_DEFAULT_ORIGIN = 'http://localhost:5174'
const MAX_PRODUCT_IMAGE_BYTES = 15 * 1024 * 1024

const DEFAULT_VISION_CONFIG = {
  showHud: true,
  aiMode: 'layout', // 'off' | 'layout' (ngầm 100% không chiếm tab) | 'screenshot' (chụp ảnh màn hình + AI)
  provider: 'ollama', // 'ollama' | 'gemini' | 'openai'
  endpoint: 'http://localhost:11434/api/chat',
  model: 'qwen2.5vl:7b',
  apiKey: ''
}

// Tập port đang mở tới Store-Admin & Popup
const adminPorts = new Set()
// Khóa tác vụ tránh chạy trùng đồng thời trên cùng 1 nền tảng
const activeJobs = new Map()
// Bộ đệm log gần nhất để popup & admin tra cứu
const recentLogs = []
let keepAliveTimer = null

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
  if (recentLogs.length > 80) recentLogs.length = 80
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
      try {
        chrome.runtime.getPlatformInfo(() => {})
      } catch (_) {}
    }, 18000)
  } else if (activeJobs.size === 0 && keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

async function getVisionConfig() {
  const stored = await chrome.storage.local.get('visionConfig')
  return { ...DEFAULT_VISION_CONFIG, ...(stored?.visionConfig || {}) }
}

async function saveVisionConfig(patch) {
  const next = { ...(await getVisionConfig()), ...(patch || {}) }
  await chrome.storage.local.set({ visionConfig: next })

  // Đồng bộ cờ showHud tới các tab Facebook / TikTok đang mở
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.url && (tab.url.includes('facebook.com') || tab.url.includes('tiktok.com'))) {
      chrome.tabs.sendMessage(tab.id, { type: 'VISION_SET_HUD', enabled: next.showHud }).catch(() => {})
    }
  }
  return next
}

// Tự động kết nối lại cầu nối Store-Admin khi cài đặt/reload extension (hết lỗi EXTENSION_CONTEXT_INVALIDATED)
async function reinjectAdminBridges() {
  try {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id && tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content-admin-bridge.js']
          })
        } catch (_) {}
      }
    }
  } catch (_) {}
}

chrome.runtime.onInstalled.addListener(() => {
  reinjectAdminBridges()
})

chrome.runtime.onStartup.addListener(() => {
  reinjectAdminBridges()
})

// Kết nối Persistent Port từ content-admin-bridge.js và popup.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'omnicart-admin-bridge' && port.name !== 'omnicart-popup') return
  adminPorts.add(port)

  port.postMessage({
    type: 'BRIDGE_HELLO',
    version: getExtensionVersion(),
    activeJobs: Array.from(activeJobs.values()),
    recentLogs: recentLogs.slice(0, 15)
  })

  port.onMessage.addListener(async (msg) => {
    if (!msg) return
    if (msg.type === 'HEARTBEAT') {
      port.postMessage({ type: 'HEARTBEAT_ACK', ts: Date.now(), version: getExtensionVersion() })
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

// Helper đợi tab load hoàn tất
async function waitForTabComplete(tabId, timeoutMs = 15000) {
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

// Điều hướng tab an toàn từ background (không giết content script giữa chừng)
async function navigateTabAndWait(tabId, url, settleMs = 1800) {
  await chrome.tabs.update(tabId, { url })
  await waitForTabComplete(tabId, 20000)
  await new Promise((r) => setTimeout(r, settleMs))
  return await chrome.tabs.get(tabId)
}

// Gửi message tới content script kèm tự động bơm đủ bộ script nếu cần
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
      await new Promise((r) => setTimeout(r, 900))
      const retryRes = await chrome.tabs.sendMessage(tabId, message)
      if (retryRes) return retryRes
      throw new Error('NO_CONTENT_SCRIPT_RESPONSE')
    }
    throw err
  }
}

function resolveProductImageUrl(rawValue, senderTabUrl) {
  const value = String(rawValue || '').trim()
  if (!value) throw new Error('PRODUCT_IMAGE_REQUIRED')
  if (value.startsWith('data:image/')) return value

  // Hỗ trợ đường dẫn tương đối (/uploads/...) từ website Store-Admin
  if (value.startsWith('/')) {
    const base = senderTabUrl ? new URL(senderTabUrl).origin : ADMIN_DEFAULT_ORIGIN
    return `${base}${value}`
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch (_) {
    throw new Error('PRODUCT_IMAGE_URL_INVALID')
  }

  const isAllowedLocal =
    parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  const isAllowedHttps = parsed.protocol === 'https:'
  if (!isAllowedLocal && !isAllowedHttps) {
    throw new Error('PRODUCT_IMAGE_URL_NOT_ALLOWED')
  }
  return parsed.href
}

async function loadProductImageDataUrl(imageUrl, senderTabUrl) {
  const resolved = resolveProductImageUrl(imageUrl, senderTabUrl)
  if (resolved.startsWith('data:image/')) {
    if (resolved.length > MAX_PRODUCT_IMAGE_BYTES * 1.45) {
      throw new Error('PRODUCT_IMAGE_SIZE_INVALID')
    }
    return resolved
  }

  const response = await fetch(resolved, { credentials: 'omit' })
  if (!response.ok) throw new Error(`PRODUCT_IMAGE_HTTP_${response.status}`)

  const blob = await response.blob()
  if (!blob.size || blob.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('PRODUCT_IMAGE_SIZE_INVALID')
  }

  let contentType = (response.headers.get('content-type') || blob.type || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!contentType.startsWith('image/')) {
    // Một số server trả application/octet-stream cho file .jpg/.png
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

async function preparePostPayload(postData, senderTabUrl) {
  if (!postData || typeof postData !== 'object') throw new Error('POST_DATA_REQUIRED')
  const rawImage = postData.imageDataUrl || postData.imageUrl
  if (!rawImage) throw new Error('PRODUCT_IMAGE_REQUIRED')

  const privacy = String(postData.privacy || 'only_me').toLowerCase()
  if (!['only_me', 'public'].includes(privacy)) {
    throw new Error('INVALID_PRIVACY')
  }

  return {
    ...postData,
    privacy,
    imageDataUrl: await loadProductImageDataUrl(rawImage, senderTabUrl)
  }
}

async function findOrCreateFacebookProfileTab() {
  const tabs = await chrome.tabs.query({})
  // Ưu tiên tab đã ở đúng profile Hoàng Thái HT
  const exactTab = tabs.find((tab) => {
    try {
      const url = new URL(tab.url || '')
      return /(^|\.)facebook\.com$/i.test(url.hostname) && url.searchParams.get('id') === FB_PROFILE_ID
    } catch (_) {
      return false
    }
  })
  if (exactTab) return exactTab

  // Nếu chưa có, mở mới tab nền tại đúng profile
  const created = await chrome.tabs.create({ url: FB_PROFILE_URL, active: false })
  await waitForTabComplete(created.id, 20000)
  await new Promise((r) => setTimeout(r, 2000))
  return created
}

async function findOrCreateTikTokUploadTab() {
  const tabs = await chrome.tabs.query({})
  const uploadPaths = ['/tiktokstudio/upload', '/creator-center/upload', '/upload']
  const matchingTab = tabs.find((tab) => {
    try {
      const url = new URL(tab.url || '')
      return /(^|\.)tiktok\.com$/i.test(url.hostname) && uploadPaths.some((p) => url.pathname.startsWith(p))
    } catch (_) {
      return false
    }
  })
  if (matchingTab) return matchingTab

  const created = await chrome.tabs.create({ url: TIKTOK_UPLOAD_URL, active: false })
  await waitForTabComplete(created.id, 20000)
  await new Promise((r) => setTimeout(r, 2200))
  return created
}

async function findOrCreateTab(urlMatcher, defaultUrl) {
  const tabs = await chrome.tabs.query({})
  const found = tabs.find((t) => t.url && urlMatcher(t.url))
  if (found) return found
  const created = await chrome.tabs.create({ url: defaultUrl, active: false })
  await waitForTabComplete(created.id, 20000)
  await new Promise((r) => setTimeout(r, 1800))
  return created
}

function isConfirmedPostResponse(response, platform, requestedPrivacy) {
  if (response?.ok !== true || response.platform !== platform) return false
  if (typeof response.postUrl !== 'string' || !response.postUrl) return false
  if (response.privacy && response.privacy !== requestedPrivacy) return false
  return true
}

// =========================================================================
// MULTIMODAL VISION AI CLIENT (Ollama Local / Google Gemini / OpenAI-compat)
// =========================================================================

async function captureTabScreenshotSafely(tabId, allowFocusSwitch = false) {
  const tab = await chrome.tabs.get(tabId)
  if (!tab) return null

  // Nếu tab đã đang active ở cửa sổ hiện tại -> chụp luôn không gây gián đoạn
  if (tab.active) {
    try {
      return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 68 })
    } catch (_) {
      return null
    }
  }

  // Nếu người dùng không cho phép chuyển tab chớp nhoáng -> chỉ dùng bản đồ Layout không gian (ngầm 100%)
  if (!allowFocusSwitch) return null

  const activeTabs = await chrome.tabs.query({ windowId: tab.windowId, active: true })
  const previousTabId = activeTabs[0]?.id
  try {
    await chrome.tabs.update(tabId, { active: true })
    await new Promise((r) => setTimeout(r, 240))
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 68 })
    return dataUrl
  } catch (_) {
    return null
  } finally {
    if (previousTabId && previousTabId !== tabId) {
      try {
        await chrome.tabs.update(previousTabId, { active: true })
      } catch (_) {}
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
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (_) {
    return null
  }
}

async function analyzeWithVisionAI({ tabId, goal, platform, step, somMap }) {
  const config = await getVisionConfig()
  if (config.aiMode === 'off') {
    return { ok: false, error: 'VISION_AI_DISABLED' }
  }

  const screenshotDataUrl =
    config.aiMode === 'screenshot'
      ? await captureTabScreenshotSafely(tabId, true)
      : await captureTabScreenshotSafely(tabId, false)

  const compactItems = (somMap?.items || []).slice(0, 65).map((item) => ({
    id: item.id,
    role: item.role,
    label: item.label,
    disabled: item.disabled,
    editable: item.editable,
    color: item.primaryColor,
    rect: item.rect
  }))

  const prompt = [
    `You are OmniVision, an expert browser visual agent operating ${platform}.`,
    `Current Step: ${step}`,
    `Goal: ${goal}`,
    `Page URL: ${somMap?.url || ''}`,
    `Visible Headings/Alerts: ${JSON.stringify(somMap?.visibleHeadings || [])}`,
    `Interactive Elements (Set-of-Mark IDs): ${JSON.stringify(compactItems)}`,
    screenshotDataUrl
      ? 'A real screenshot with red numbered boxes [1], [2], ... is attached. Match the visual UI with the numbered box ID.'
      : 'Use the spatial coordinates rect{x,y,w,h}, labels, roles and colors to locate the exact target.',
    'Return ONLY valid JSON with this exact schema:',
    '{"screenState":"short_snake_case","obstacle":null|"login"|"captcha"|"error_alert"|"confirm_modal","targetMarkId":number|null,"confidence":0.0_to_1.0,"reason":"brief Vietnamese explanation"}'
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)

  try {
    let rawContent = ''

    if (config.provider === 'ollama') {
      const endpoint = config.endpoint || 'http://localhost:11434/api/chat'
      const userMessage = { role: 'user', content: prompt }
      if (screenshotDataUrl) {
        userMessage.images = [screenshotDataUrl.replace(/^data:image\/[^;]+;base64,/, '')]
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model || 'qwen2.5vl:7b',
          messages: [userMessage],
          format: 'json',
          stream: false,
          options: { temperature: 0.1 }
        })
      })
      if (!res.ok) throw new Error(`OLLAMA_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.message?.content || data?.response || ''
    } else if (config.provider === 'gemini') {
      if (!config.apiKey) throw new Error('GEMINI_API_KEY_MISSING')
      const model = config.model || 'gemini-2.5-flash'
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
      const parts = [{ text: prompt }]
      if (screenshotDataUrl) {
        parts.push({
          inline_data: {
            mime_type: 'image/jpeg',
            data: screenshotDataUrl.replace(/^data:image\/[^;]+;base64,/, '')
          }
        })
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      })
      if (!res.ok) throw new Error(`GEMINI_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else {
      // OpenAI / LM Studio / OpenRouter compatible
      const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions'
      const headers = { 'Content-Type': 'application/json' }
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
      const content = [{ type: 'text', text: prompt }]
      if (screenshotDataUrl) {
        content.push({ type: 'image_url', image_url: { url: screenshotDataUrl } })
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          temperature: 0.1,
          messages: [{ role: 'user', content }]
        })
      })
      if (!res.ok) throw new Error(`OPENAI_HTTP_${res.status}`)
      const data = await res.json()
      rawContent = data?.choices?.[0]?.message?.content || ''
    }

    const parsed = extractJsonObject(rawContent)
    if (!parsed) return { ok: false, error: 'VISION_AI_INVALID_JSON', raw: rawContent.slice(0, 200) }

    pushLog({
      platform,
      step: 'vision-ai',
      level: 'info',
      message: `🧠 Vision AI (${config.provider}): ${parsed.reason || parsed.screenState} [mark=${parsed.targetMarkId ?? 'none'}, conf=${parsed.confidence ?? '?'}]`
    })

    return {
      ok: true,
      usedScreenshot: Boolean(screenshotDataUrl),
      screenState: parsed.screenState || 'unknown',
      obstacle: parsed.obstacle || null,
      targetMarkId: Number.isInteger(parsed.targetMarkId) ? parsed.targetMarkId : null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
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
    return { ok: true, mode: 'off', message: 'OmniVision Hình học (DOM) sẵn sàng. Vision AI đang tắt.' }
  }

  const result = await analyzeWithVisionAI({
    tabId: null,
    goal: 'Test connection: return markId 1 for the Publish button.',
    platform: 'test',
    step: 'connectivity_test',
    somMap: {
      url: 'https://test.local',
      visibleHeadings: ['Test Vision'],
      items: [{ id: 1, role: 'button', label: 'Đăng', disabled: false, editable: false, primaryColor: 'red', rect: { x: 100, y: 500, w: 120, h: 40 } }]
    }
  })

  if (result.ok) {
    return {
      ok: true,
      provider: config.provider,
      model: config.model,
      message: `Kết nối Vision AI (${config.provider}/${config.model}) thành công! Phản hồi: ${result.reason || 'OK'}`
    }
  }
  return {
    ok: false,
    provider: config.provider,
    error: result.error,
    message: `Không kết nối được Vision AI (${config.provider}): ${result.error}. Hệ thống vẫn chạy tốt bằng OmniVision Hình học.`
  }
}

// =========================================================================
// ĐIỀU PHỐI ĐĂNG BÀI FACEBOOK & TIKTOK + QUÉT VIRAL
// =========================================================================

async function executeFacebookPost(postData, senderTabUrl) {
  if (activeJobs.has('facebook')) {
    return { ok: false, error: 'FACEBOOK_JOB_ALREADY_RUNNING' }
  }

  const jobInfo = { platform: 'facebook', startedAt: new Date().toISOString(), step: 'init' }
  activeJobs.set('facebook', jobInfo)
  ensureKeepAlive()

  try {
    pushLog({ platform: 'facebook', step: 'prepare', level: 'info', message: 'Đang chuẩn bị ảnh sản phẩm & nội dung đăng Facebook...' })
    const preparedPost = await preparePostPayload(postData, senderTabUrl)

    pushLog({ platform: 'facebook', step: 'tab', level: 'info', message: 'Đang kiểm tra tab Facebook Hoàng Thái HT...' })
    let fbTab = await findOrCreateFacebookProfileTab()

    // Nếu tab bị chuyển trang khác -> điều hướng sạch từ background
    if (!fbTab.url || !fbTab.url.includes(FB_PROFILE_ID)) {
      fbTab = await navigateTabAndWait(fbTab.id, FB_PROFILE_URL, 2200)
    }

    const scripts = ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    let response = await sendTabMessageWithRetry(fbTab.id, {
      type: 'FB_EXECUTE_POST',
      payload: preparedPost
    }, scripts)

    // Nếu content script yêu cầu điều hướng lại (ví dụ trang đang bị kẹt ở màn khác)
    if (response?.needsNavigation && response.targetUrl) {
      pushLog({ platform: 'facebook', step: 'navigate', level: 'warn', message: 'Chuyển tab về đúng trang cá nhân Hoàng Thái HT...' })
      fbTab = await navigateTabAndWait(fbTab.id, response.targetUrl, 2500)
      response = await sendTabMessageWithRetry(fbTab.id, {
        type: 'FB_EXECUTE_POST',
        payload: preparedPost
      }, scripts)
    }

    if (!isConfirmedPostResponse(response, 'facebook', preparedPost.privacy)) {
      const errMsg = response?.error || (response?.privacy && response.privacy !== preparedPost.privacy
        ? `FACEBOOK_PRIVACY_MISMATCH (yêu cầu=${preparedPost.privacy}, thực tế=${response.privacy})`
        : 'FACEBOOK_POST_NOT_VERIFIED')
      pushLog({ platform: 'facebook', step: 'failed', level: 'error', message: `Đăng Facebook thất bại: ${errMsg}` })
      return { ok: false, error: errMsg, visionTrace: response?.visionTrace || [] }
    }

    pushLog({ platform: 'facebook', step: 'done', level: 'success', message: `✅ Đã đăng Facebook thành công (${response.privacy})!` })
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
  if (activeJobs.has('tiktok')) {
    return { ok: false, error: 'TIKTOK_JOB_ALREADY_RUNNING' }
  }

  const jobInfo = { platform: 'tiktok', startedAt: new Date().toISOString(), step: 'init' }
  activeJobs.set('tiktok', jobInfo)
  ensureKeepAlive()

  try {
    pushLog({ platform: 'tiktok', step: 'prepare', level: 'info', message: 'Đang chuẩn bị ảnh sản phẩm & nội dung đăng TikTok...' })
    const preparedPost = await preparePostPayload(postData, senderTabUrl)

    pushLog({ platform: 'tiktok', step: 'tab', level: 'info', message: 'Đang mở / kiểm tra tab TikTok Studio Upload...' })
    let ttTab = await findOrCreateTikTokUploadTab()

    if (!ttTab.url || !/\/(tiktokstudio\/upload|creator-center\/upload|upload)/i.test(ttTab.url)) {
      ttTab = await navigateTabAndWait(ttTab.id, TIKTOK_UPLOAD_URL, 2400)
    }

    const scripts = ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    let response = await sendTabMessageWithRetry(ttTab.id, {
      type: 'TIKTOK_EXECUTE_POST',
      payload: preparedPost
    }, scripts)

    if (response?.needsNavigation && response.targetUrl) {
      pushLog({ platform: 'tiktok', step: 'navigate', level: 'warn', message: 'Làm mới trang TikTok Studio Upload...' })
      ttTab = await navigateTabAndWait(ttTab.id, response.targetUrl, 2600)
      response = await sendTabMessageWithRetry(ttTab.id, {
        type: 'TIKTOK_EXECUTE_POST',
        payload: preparedPost
      }, scripts)
    }

    if (!isConfirmedPostResponse(response, 'tiktok', preparedPost.privacy)) {
      const errMsg = response?.error || (response?.privacy && response.privacy !== preparedPost.privacy
        ? `TIKTOK_PRIVACY_MISMATCH (yêu cầu=${preparedPost.privacy}, thực tế=${response.privacy})`
        : 'TIKTOK_POST_NOT_VERIFIED')
      pushLog({ platform: 'tiktok', step: 'failed', level: 'error', message: `Đăng TikTok thất bại: ${errMsg}` })
      return { ok: false, error: errMsg, visionTrace: response?.visionTrace || [] }
    }

    pushLog({ platform: 'tiktok', step: 'done', level: 'success', message: `✅ Đã đăng TikTok (@harutv666) thành công (${response.privacy})!` })
    return response
  } catch (err) {
    pushLog({ platform: 'tiktok', step: 'error', level: 'error', message: `Lỗi TikTok: ${err.message}` })
    return { ok: false, error: `Lỗi thao tác tab TikTok: ${err.message}` }
  } finally {
    activeJobs.delete('tiktok')
    ensureKeepAlive()
  }
}

async function scrapeFacebookViral() {
  try {
    pushLog({ platform: 'facebook', step: 'scrape', level: 'info', message: 'Đang quét bài viết viral thực tế từ Facebook...' })
    const fbTab = await findOrCreateTab(
      (url) => /(^|\.)facebook\.com\/($|\?|home)/i.test(url),
      'https://www.facebook.com/'
    )
    await new Promise((r) => setTimeout(r, 1500))
    const response = await sendTabMessageWithRetry(
      fbTab.id,
      { type: 'FB_SCRAPE_VIRAL' },
      ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    )
    pushLog({
      platform: 'facebook',
      step: 'scrape_done',
      level: 'success',
      message: `Quét được ${(response?.posts || []).length} bài viral Facebook.`
    })
    return response || { ok: false, posts: [] }
  } catch (err) {
    return { ok: false, error: err.message, posts: [] }
  }
}

async function scrapeTikTokViral() {
  try {
    pushLog({ platform: 'tiktok', step: 'scrape', level: 'info', message: 'Đang quét xu hướng thực tế từ TikTok For You...' })
    const ttTab = await findOrCreateTab(
      (url) => /(^|\.)tiktok\.com\/(foryou|explore|$)/i.test(url),
      'https://www.tiktok.com/foryou'
    )
    await new Promise((r) => setTimeout(r, 1800))
    const response = await sendTabMessageWithRetry(
      ttTab.id,
      { type: 'TIKTOK_SCRAPE_VIRAL' },
      ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
    )
    pushLog({
      platform: 'tiktok',
      step: 'scrape_done',
      level: 'success',
      message: `Quét được ${(response?.posts || []).length} video xu hướng TikTok.`
    })
    return response || { ok: false, posts: [] }
  } catch (err) {
    return { ok: false, error: err.message, posts: [] }
  }
}

async function inspectPlatformTab(platform) {
  const isFb = platform === 'facebook'
  const tab = isFb ? await findOrCreateFacebookProfileTab() : await findOrCreateTikTokUploadTab()
  const scripts = isFb
    ? ['vision-engine.js', 'content-media.js', 'content-facebook.js']
    : ['vision-engine.js', 'content-media.js', 'content-tiktok.js']
  const res = await sendTabMessageWithRetry(tab.id, { type: isFb ? 'FB_INSPECT_VISION' : 'TIKTOK_INSPECT_VISION' }, scripts)
  return { ok: true, platform, tabId: tab.id, url: tab.url, inspection: res }
}

// =========================================================================
// BỘ ĐỊNH TUYẾN LỆNH CHUNG (Dùng cho cả sendMessage & Persistent Port)
// =========================================================================

async function dispatchCommand(message, sender = {}) {
  const type = message?.type
  switch (type) {
    case 'PING': {
      const vision = await getVisionConfig()
      return {
        ok: true,
        installed: true,
        version: getExtensionVersion(),
        visionEnabled: true,
        visionAiMode: vision.aiMode,
        capabilities: ['spatial_vision', 'som_ai_vision', 'persistent_bridge', 'facebook_v2', 'tiktok_photo_v2']
      }
    }

    case 'CHECK_STATUS': {
      const [allTabs, vision] = await Promise.all([chrome.tabs.query({}), getVisionConfig()])
      const hasAdmin = allTabs.some((t) => t.url && /^http:\/\/(localhost|127\.0\.0\.1):5174/i.test(t.url))
      const hasFacebook = allTabs.some((t) => {
        try {
          const url = new URL(t.url || '')
          return /(^|\.)facebook\.com$/i.test(url.hostname) && url.searchParams.get('id') === FB_PROFILE_ID
        } catch (_) {
          return false
        }
      })
      const hasTikTok = allTabs.some((t) => t.url && t.url.includes('tiktok.com'))

      return {
        ok: true,
        version: getExtensionVersion(),
        tabs: { admin: hasAdmin, facebook: hasFacebook, tiktok: hasTikTok },
        vision,
        activeJobs: Array.from(activeJobs.values()),
        targetProfiles: {
          facebook: { name: 'Hoàng Thái HT', id: FB_PROFILE_ID, url: FB_PROFILE_URL },
          tiktok: { name: 'harutv', username: '@harutv666', url: TIKTOK_PROFILE_URL }
        }
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
      const platform = String(message.platform || 'facebook').toLowerCase()
      return platform === 'facebook' ? await scrapeFacebookViral() : await scrapeTikTokViral()
    }

    case 'VISION_AI_ANALYZE': {
      return await analyzeWithVisionAI({
        tabId: sender?.tab?.id || null,
        goal: message.goal,
        platform: message.platform,
        step: message.step,
        somMap: message.somMap
      })
    }

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

    case 'GET_VISION_CONFIG': {
      return { ok: true, config: await getVisionConfig() }
    }

    case 'SAVE_VISION_CONFIG': {
      const saved = await saveVisionConfig(message.config || {})
      return { ok: true, config: saved }
    }

    case 'TEST_VISION_AI': {
      return await testVisionAIConnection()
    }

    case 'INSPECT_TAB': {
      const platform = String(message.platform || 'tiktok').toLowerCase()
      return await inspectPlatformTab(platform)
    }

    case 'GET_LIVE_LOGS': {
      return { ok: true, logs: recentLogs.slice(0, 30), activeJobs: Array.from(activeJobs.values()) }
    }

    case 'CANCEL_JOB': {
      const platform = String(message.platform || '').toLowerCase()
      if (platform) activeJobs.delete(platform)
      else activeJobs.clear()
      ensureKeepAlive()
      pushLog({ platform: platform || 'system', step: 'cancelled', level: 'warn', message: 'Đã reset khóa tác vụ theo yêu cầu.' })
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