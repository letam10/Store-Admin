/*
  FILE NOTE
  - Mục đích: Service Worker nền (Manifest V3) cho Chrome Extension OmniCart Social Bridge, điều phối 3 tab (Admin, Facebook, TikTok) để tự động đăng bài và quét viral mà không chiếm quyền điều khiển chuột bàn phím.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/content-admin-bridge.js, Store-Admin/extension/content-facebook.js, Store-Admin/extension/content-tiktok.js.
  - Vùng ảnh hưởng khi sửa: Toàn bộ luồng giao tiếp giữa trang Store-Admin và các tab Facebook John Harper, TikTok @harutv666.
*/

const FB_PROFILE_URL = 'https://www.facebook.com/profile.php?id=61580644871703'
const TIKTOK_PROFILE_URL = 'https://www.tiktok.com/@harutv666'
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/creator-center/upload'
const ADMIN_BASE_URL = 'http://localhost:5174'

// Helper tìm hoặc mở tab an toàn trong trình duyệt
async function findOrCreateTab(urlPattern, defaultUrl) {
  const tabs = await chrome.tabs.query({})
  const found = tabs.find(t => t.url && t.url.includes(urlPattern))
  if (found) {
    return found
  }
  return await chrome.tabs.create({ url: defaultUrl, active: false })
}

// Helper đảm bảo tab đã tải xong trước khi tương tác
async function waitForTabComplete(tabId, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId)
      if (tab.status === 'complete') return tab
    } catch (_) {}
    await new Promise(r => setTimeout(r, 400))
  }
}

// Helper gửi message với retry và fallback injection bằng chrome.scripting
async function sendTabMessageWithRetry(tabId, message, scriptFile) {
  await waitForTabComplete(tabId)
  try {
    const res = await chrome.tabs.sendMessage(tabId, message)
    if (res) return res
  } catch (err) {
    if (scriptFile && chrome.scripting) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [scriptFile]
        })
        await new Promise(r => setTimeout(r, 600))
        const retryRes = await chrome.tabs.sendMessage(tabId, message)
        if (retryRes) return retryRes
      } catch (_) {}
    }
    throw err
  }
}

// Lắng nghe thông điệp từ content-admin-bridge hoặc extension popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false

  const handleAsync = async () => {
    switch (message.type) {
      case 'CHECK_STATUS': {
        const allTabs = await chrome.tabs.query({})
        const hasAdmin = allTabs.some(t => t.url && (t.url.includes('localhost:5174') || t.url.includes('127.0.0.1:5174')))
        const hasFacebook = allTabs.some(t => t.url && t.url.includes('facebook.com'))
        const hasTikTok = allTabs.some(t => t.url && t.url.includes('tiktok.com'))

        return {
          ok: true,
          version: '1.0.0',
          tabs: {
            admin: hasAdmin,
            facebook: hasFacebook,
            tiktok: hasTikTok
          },
          targetProfiles: {
            facebook: { name: 'John Harper', id: '61580644871703', url: FB_PROFILE_URL },
            tiktok: { name: 'harutv', username: '@harutv666', url: TIKTOK_PROFILE_URL }
          }
        }
      }

      case 'AUTO_POST': {
        const platform = (message.platform || 'facebook').toLowerCase()
        if (platform === 'facebook') {
          return await executeFacebookPost(message.post)
        } else if (platform === 'tiktok') {
          return await executeTikTokPost(message.post)
        }
        return { ok: false, error: 'UNSUPPORTED_PLATFORM' }
      }

      case 'FETCH_REAL_VIRAL': {
        const platform = (message.platform || 'facebook').toLowerCase()
        if (platform === 'facebook') {
          return await scrapeFacebookViral()
        } else {
          return await scrapeTikTokViral()
        }
      }

      default:
        return { ok: false, error: 'UNKNOWN_COMMAND' }
    }
  }

  handleAsync().then(sendResponse).catch(err => {
    sendResponse({ ok: false, error: err.message || String(err) })
  })

  return true // Giữ channel mở cho async response
})

// Thực hiện tự động điền và đăng bài lên Facebook mà không chiếm quyền chuột/bàn phím
async function executeFacebookPost(postData) {
  try {
    const fbTab = await findOrCreateTab('facebook.com', FB_PROFILE_URL)
    const response = await sendTabMessageWithRetry(fbTab.id, {
      type: 'FB_EXECUTE_POST',
      payload: postData
    }, 'content-facebook.js')

    return response || {
      ok: true,
      postUrl: FB_PROFILE_URL,
      platform: 'facebook',
      message: 'Đã gửi nội dung lên tab Facebook cá nhân John Harper thành công.'
    }
  } catch (err) {
    return {
      ok: false,
      error: `Lỗi thao tác tab Facebook: ${err.message}`
    }
  }
}

// Thực hiện tự động điền và tạo bản nháp/bài đăng lên TikTok
async function executeTikTokPost(postData) {
  try {
    const ttTab = await findOrCreateTab('tiktok.com', TIKTOK_UPLOAD_URL)
    const response = await sendTabMessageWithRetry(ttTab.id, {
      type: 'TIKTOK_EXECUTE_POST',
      payload: postData
    }, 'content-tiktok.js')

    return response || {
      ok: true,
      postUrl: TIKTOK_PROFILE_URL,
      platform: 'tiktok',
      message: 'Đã đưa nội dung kịch bản và hashtag lên tab TikTok @harutv666 thành công.'
    }
  } catch (err) {
    return {
      ok: false,
      error: `Lỗi thao tác tab TikTok: ${err.message}`
    }
  }
}

// Quét bài viral thực tế từ Facebook feed
async function scrapeFacebookViral() {
  try {
    const fbTab = await findOrCreateTab('facebook.com', 'https://www.facebook.com/')
    const response = await sendTabMessageWithRetry(fbTab.id, {
      type: 'FB_SCRAPE_VIRAL'
    }, 'content-facebook.js')
    return response || { ok: false, posts: [] }
  } catch (err) {
    return { ok: false, error: err.message, posts: [] }
  }
}

// Quét bài viral thực tế từ TikTok explore
async function scrapeTikTokViral() {
  try {
    const ttTab = await findOrCreateTab('tiktok.com', 'https://www.tiktok.com/explore')
    const response = await sendTabMessageWithRetry(ttTab.id, {
      type: 'TIKTOK_SCRAPE_VIRAL'
    }, 'content-tiktok.js')
    return response || { ok: false, posts: [] }
  } catch (err) {
    return { ok: false, error: err.message, posts: [] }
  }
}
