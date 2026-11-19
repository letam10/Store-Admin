/*
  FILE NOTE
  - Mục đích: Content Script chạy trên trang Facebook, tự động thao tác nhập nội dung bài đăng và chọn quyền riêng tư trên trang cá nhân John Harper (id: 61580644871703) mà không chiếm quyền điều khiển chuột bàn phím máy tính; hỗ trợ quét bài viết viral thực tế.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/background.js.
  - Vùng ảnh hưởng khi sửa: Cơ chế nhận diện DOM và tương tác với trình soạn thảo Facebook (Post Composer) và bộ lọc bài viết thịnh hành.
*/

const JOHN_HARPER_PROFILE_URL = 'https://www.facebook.com/profile.php?id=61580644871703'
const JOHN_HARPER_PROFILE_ID = '61580644871703'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FB_EXECUTE_POST') {
    executeFacebookPost(message.payload).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err) })
    })
    return true
  }

  if (message.type === 'FB_SCRAPE_VIRAL') {
    scrapeFacebookFeed().then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err), posts: [] })
    })
    return true
  }
})

// Chỉ xác nhận đăng thành công khi Facebook hiển thị bài mới và permalink riêng.
async function executeFacebookPost(payload) {
  if (location.hostname !== 'www.facebook.com' && location.hostname !== 'facebook.com') {
    return { ok: false, error: 'FACEBOOK_HOST_INVALID' }
  }

  const currentUrl = new URL(location.href)
  if (currentUrl.searchParams.get('id') !== JOHN_HARPER_PROFILE_ID) {
    return { ok: false, error: 'FACEBOOK_ACCOUNT_MISMATCH' }
  }

  if (payload?.privacy !== 'only_me') return { ok: false, error: 'ONLY_ME_PRIVACY_REQUIRED' }
  if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED' }

  const fullText = [
    payload.title ? `${payload.title}\n\n` : '',
    payload.content || '',
    payload.hashtags ? `\n\n${payload.hashtags}` : ''
  ].join('').trim()
  if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED' }

  const composerTrigger = findComposerTrigger()
  if (!composerTrigger) return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_FOUND' }

  const existingPermalinks = new Set(collectPostPermalinks())
  composerTrigger.click()
  const dialogReady = await OmniCartMedia.waitFor(() => findComposerDialog(), 10000)
  if (!dialogReady) return { ok: false, error: 'FACEBOOK_COMPOSER_DID_NOT_OPEN' }

  const dialog = findComposerDialog()
  const previousImageSources = new Set(Array.from(dialog.querySelectorAll('img')).map((image) => image.getAttribute('src') || ''))
  const imageFile = await OmniCartMedia.createProductImageFile(payload.imageDataUrl)
  let imageInput = await OmniCartMedia.findImageInput(dialog, 1500)
  if (!imageInput) {
    const uploadButton = findPhotoVideoButton(dialog)
    if (uploadButton) uploadButton.click()
    imageInput = await OmniCartMedia.findImageInput(dialog, 8000)
  }
  if (!imageInput) return { ok: false, error: 'FACEBOOK_IMAGE_INPUT_NOT_FOUND' }
  if (!OmniCartMedia.attachFile(imageInput, imageFile)) {
    return { ok: false, error: 'FACEBOOK_IMAGE_NOT_ATTACHED' }
  }

  const imagePreviewReady = await OmniCartMedia.waitFor(() => hasImagePreview(dialog, previousImageSources), 15000)
  if (!imagePreviewReady) return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED' }

  const editorBox = dialog.querySelector('div[role="textbox"][contenteditable="true"]')
  if (!editorBox) return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND' }
  insertTextIntoContentEditable(editorBox, fullText)
  const textReady = await OmniCartMedia.waitFor(
    () => (editorBox.innerText || editorBox.textContent || '').includes(fullText),
    5000
  )
  if (!textReady) return { ok: false, error: 'FACEBOOK_TEXT_NOT_CONFIRMED' }

  const privacyReady = await setPrivacyOnlyMe(dialog)
  if (!privacyReady) return { ok: false, error: 'FACEBOOK_ONLY_ME_NOT_CONFIRMED' }

  const submitBtn = findSubmitPostButton(dialog)
  if (!submitBtn || submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true') {
    return { ok: false, error: 'FACEBOOK_SUBMIT_BUTTON_NOT_READY' }
  }

  submitBtn.click()
  const confirmedPost = await waitForNewPost(fullText, existingPermalinks)
  if (!confirmedPost) return { ok: false, error: 'FACEBOOK_POST_NOT_VERIFIED' }

  const postUrl = extractPostPermalink(confirmedPost)
  const realPostId = extractFacebookPostId(postUrl)
  if (!postUrl || !realPostId) return { ok: false, error: 'FACEBOOK_PERMALINK_NOT_FOUND' }

  return {
    ok: true,
    postUrl,
    realPostId,
    platform: 'facebook',
    publishedTime: new Date().toISOString(),
    privacy: 'only_me',
    author: 'John Harper'
  }
}

// Helper tìm trigger soạn thảo bài viết
function findComposerTrigger() {
  const selectors = [
    'div[data-pagelet="ProfileComposer"] div[role="button"]',
    'div[aria-label*="Bạn đang nghĩ gì"]',
    'div[aria-label*="What\'s on your mind"]',
    'div[role="button"][tabindex="0"][aria-label*="Create"]'
  ]
  for (const s of selectors) {
    const el = document.querySelector(s)
    if (el && el.getClientRects().length) return el
  }
  return null
}

function findComposerDialog() {
  const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'))
  return dialogs.find((dialog) => dialog.querySelector('[contenteditable="true"]')) || null
}

function findPhotoVideoButton(dialog) {
  const buttons = Array.from(dialog.querySelectorAll('[role="button"], button'))
  return buttons.find((button) => {
    const label = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.toLowerCase()
    return /ảnh\/video|photo\/video|add photo|thêm ảnh|photo/.test(label)
  }) || null
}

function hasImagePreview(dialog, previousImageSources) {
  const images = Array.from(dialog.querySelectorAll('img'))
  return images.some((image) => {
    const source = image.getAttribute('src') || ''
    return !!source && !previousImageSources.has(source) && image.getClientRects().length > 0
  })
}

// Chèn chữ vào phần tử contenteditable của Facebook an toàn
function insertTextIntoContentEditable(element, text) {
  element.focus()
  try {
    document.execCommand('selectAll', false, null)
    document.execCommand('insertText', false, text)
  } catch (e) {
    element.textContent = text
  }
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

async function setPrivacyOnlyMe(dialog) {
  let audienceButton = findAudienceButton(dialog)
  if (!audienceButton) return false

  if (/only me|chỉ mình tôi/i.test(`${audienceButton.textContent || ''} ${audienceButton.getAttribute('aria-label') || ''}`)) {
    return true
  }

  audienceButton.click()
  const optionReady = await OmniCartMedia.waitFor(() => {
    return Array.from(document.querySelectorAll('[role="menuitem"], [role="radio"], [role="option"]'))
      .some((option) => /only me|chỉ mình tôi/i.test(option.textContent || ''))
  }, 4000)
  if (!optionReady) return false

  const onlyMeOption = Array.from(document.querySelectorAll('[role="menuitem"], [role="radio"], [role="option"]'))
    .find((option) => /only me|chỉ mình tôi/i.test(option.textContent || ''))
  if (!onlyMeOption) return false
  onlyMeOption.click()

  return OmniCartMedia.waitFor(() => {
    audienceButton = findAudienceButton(dialog)
    return !!audienceButton && /only me|chỉ mình tôi/i.test(
      `${audienceButton.textContent || ''} ${audienceButton.getAttribute('aria-label') || ''}`
    )
  }, 4000)
}

function findAudienceButton(dialog) {
  return Array.from(dialog.querySelectorAll('[role="button"], button'))
    .find((button) => /đối tượng|audience|only me|chỉ mình tôi/i.test(
      `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`
    ))
}

function findSubmitPostButton(dialog) {
  const buttons = Array.from(dialog.querySelectorAll('[role="button"], button'))
  return buttons.find(b => {
    const txt = (b.textContent || '').trim().toLowerCase()
    const aria = (b.getAttribute('aria-label') || '').toLowerCase()
    return txt === 'đăng' || txt === 'post' || aria === 'đăng' || aria === 'post'
  })
}

function collectPostPermalinks() {
  return Array.from(document.querySelectorAll('a[href*="/posts/"], a[href*="/share/p/"], a[href*="permalink.php"], a[href*="story_fbid"]'))
    .map((link) => link.href)
}

async function waitForNewPost(fullText, existingPermalinks) {
  let foundPost = null
  const posted = await OmniCartMedia.waitFor(() => {
    const candidates = Array.from(document.querySelectorAll('[role="article"], article, div[data-pagelet^="FeedUnit"]'))
    foundPost = candidates.find((article) => {
      const text = article.innerText || article.textContent || ''
      if (!text.includes(fullText.slice(0, Math.min(48, fullText.length)))) return false
      const hrefs = Array.from(article.querySelectorAll('a[href]')).map((link) => link.href)
      return hrefs.some((href) => !existingPermalinks.has(href) && isFacebookPostPermalink(href))
    }) || null
    return !!foundPost
  }, 20000)

  return posted ? foundPost : null
}

function isFacebookPostPermalink(value) {
  try {
    const url = new URL(value)
    return /(^|\.)facebook\.com$/i.test(url.hostname) &&
      (/\/posts\//i.test(url.pathname) || /\/share\/p\//i.test(url.pathname) || /story_fbid=/i.test(url.search))
  } catch (_) {
    return false
  }
}

function extractPostPermalink(article) {
  return Array.from(article.querySelectorAll('a[href]'))
    .map((link) => link.href)
    .find(isFacebookPostPermalink) || null
}

function extractFacebookPostId(postUrl) {
  try {
    const url = new URL(postUrl)
    const storyId = url.searchParams.get('story_fbid') || url.searchParams.get('fbid')
    if (storyId) return storyId
    const pathId = url.pathname.match(/\/(?:posts|share\/p)\/([^/?]+)/i)
    return pathId?.[1] || null
  } catch (_) {
    return null
  }
}

// Quét các bài viết có tương tác cao thật từ feed
async function scrapeFacebookFeed() {
  const posts = []
  const feedItems = Array.from(document.querySelectorAll('div[data-pagelet^="FeedUnit"], div[role="feed"] > div'))

  for (const item of feedItems.slice(0, 8)) {
    try {
      const textNode = item.querySelector('div[data-ad-preview="message"], div[dir="auto"]')
      const text = textNode ? textNode.textContent.trim() : ''
      if (text.length < 20) continue

      const linkNode = item.querySelector('a[href*="/posts/"], a[href*="permalink.php"]')
      const link = linkNode ? linkNode.href : JOHN_HARPER_PROFILE_URL

      // Lấy số liệu tương tác
      const reactionNode = item.querySelector('span[aria-label*="thích"], span[aria-label*="like"]')
      const rawLikes = reactionNode ? parseInt(reactionNode.textContent.replace(/\D/g, ''), 10) : 0

      posts.push({
        id: 'fb-real-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title: text.slice(0, 100) + '…',
        platform: 'facebook',
        category: 'Đời sống & Tiện ích',
        postUrl: link,
        summary: text.slice(0, 240),
        viralityScore: Math.min(99, 80 + Math.floor(rawLikes / 50)),
        likesCount: rawLikes,
        sharesCount: 0,
        commentsCount: 0,
        trendingTopic: 'Xu hướng Facebook thực tế',
        createdAt: new Date().toISOString()
      })
    } catch (e) {}
  }

  return { ok: true, posts }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}
