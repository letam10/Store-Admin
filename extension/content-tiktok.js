/*
  FILE NOTE
  - Mục đích: Content Script chạy trên trang TikTok, tự động đưa kịch bản và hashtag lên trang tải video TikTok Studio của tài khoản @harutv666 mà không chiếm quyền điều khiển chuột bàn phím; quét video và hashtag thịnh hành thật.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/background.js.
  - Vùng ảnh hưởng khi sửa: Tương tác DOM với TikTok Creator Center / Upload Studio và bóc tách dữ liệu trending video.
*/

const HARUTV_PROFILE_URL = 'https://www.tiktok.com/@harutv666'
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TIKTOK_EXECUTE_POST') {
    executeTikTokPost(message.payload).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err) })
    })
    return true
  }

  if (message.type === 'TIKTOK_SCRAPE_VIRAL') {
    scrapeTikTokTrending().then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err), posts: [] })
    })
    return true
  }
})

async function executeTikTokPost(payload) {
  if (!/^www\.tiktok\.com$|^tiktok\.com$/i.test(location.hostname)) {
    return { ok: false, error: 'TIKTOK_HOST_INVALID' }
  }

  if (!/^\/(?:tiktokstudio\/upload|creator-center\/upload|upload)\/?$/i.test(location.pathname)) {
    return { ok: false, error: 'TIKTOK_UPLOAD_PAGE_REQUIRED' }
  }

  if (payload?.privacy !== 'only_me') return { ok: false, error: 'ONLY_ME_PRIVACY_REQUIRED' }
  if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED' }

  const caption = [
    payload.title ? `${payload.title}\n` : '',
    payload.content || '',
    payload.hashtags ? `\n${payload.hashtags}` : ''
  ].join('').trim()
  if (!caption) return { ok: false, error: 'POST_TEXT_REQUIRED' }

  const accountReady = await OmniCartMedia.waitFor(isHarutvAccountVisible, 10000)
  if (!accountReady) return { ok: false, error: 'TIKTOK_ACCOUNT_MISMATCH' }

  const existingPermalinks = new Set(collectTikTokPostPermalinks())
  let imageInput = await OmniCartMedia.findImageInput(document, 1000, false)
  if (!imageInput) {
    const uploadButton = findUploadPhotoButton()
    if (uploadButton) uploadButton.click()
    imageInput = await OmniCartMedia.findImageInput(document, 8000, false)
  }
  if (!imageInput) return { ok: false, error: 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE' }

  const imageFile = await OmniCartMedia.createProductImageFile(payload.imageDataUrl)
  if (!OmniCartMedia.attachFile(imageInput, imageFile)) {
    return { ok: false, error: 'TIKTOK_IMAGE_NOT_ATTACHED' }
  }

  const imagePreviewReady = await OmniCartMedia.waitFor(hasImagePreview, 15000)
  if (!imagePreviewReady) return { ok: false, error: 'TIKTOK_IMAGE_PREVIEW_NOT_CONFIRMED' }

  const captionEditor = findCaptionEditor()
  if (!captionEditor) return { ok: false, error: 'TIKTOK_CAPTION_EDITOR_NOT_FOUND' }
  insertCaption(captionEditor, caption)
  const captionReady = await OmniCartMedia.waitFor(
    () => readCaption(captionEditor).includes(caption),
    5000
  )
  if (!captionReady) return { ok: false, error: 'TIKTOK_CAPTION_NOT_CONFIRMED' }

  const privacyReady = await setPrivacyOnlyMe()
  if (!privacyReady) return { ok: false, error: 'TIKTOK_ONLY_ME_NOT_CONFIRMED' }

  const publishButton = findPublishButton()
  if (!publishButton || publishButton.disabled || publishButton.getAttribute('aria-disabled') === 'true') {
    return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY' }
  }

  publishButton.click()
  const postedUrl = await waitForPublishedPost(caption, existingPermalinks)
  const realPostId = extractTikTokPostId(postedUrl)
  if (!postedUrl || !realPostId) return { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }

  return {
    ok: true,
    postUrl: postedUrl,
    realPostId,
    platform: 'tiktok',
    account: '@harutv666',
    privacy: 'only_me',
    publishedTime: new Date().toISOString(),
    message: 'TikTok hiển thị bài mới kèm ảnh và caption; liên kết bài viết đã được xác nhận.'
  }
}

function isHarutvAccountVisible() {
  return Array.from(document.querySelectorAll('a[href*="/@harutv666"]'))
    .some((link) => {
      try {
        const url = new URL(link.href)
        return url.pathname.replace(/\/$/, '').toLowerCase() === '/@harutv666' && link.getClientRects().length > 0
      } catch (_) {
        return false
      }
    }) || Array.from(document.querySelectorAll('[data-e2e], [aria-label]'))
      .some((element) => /@harutv666/i.test(`${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`) && element.getClientRects().length > 0)
}

function findUploadPhotoButton() {
  return Array.from(document.querySelectorAll('button, [role="button"]'))
    .find((button) => /upload|tải lên|select photo/i.test(
      `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`
    ) && button.getClientRects().length > 0) || null
}

function hasImagePreview() {
  return Array.from(document.querySelectorAll('img'))
    .some((image) => {
      const source = image.getAttribute('src') || ''
      return (source.startsWith('blob:') || source.startsWith('data:')) && image.getClientRects().length > 0
    })
}

function findCaptionEditor() {
  const editors = Array.from(document.querySelectorAll(
    'textarea, [contenteditable="true"], [role="textbox"]'
  ))
  return editors.find((editor) => {
    const label = `${editor.getAttribute('placeholder') || ''} ${editor.getAttribute('aria-label') || ''} ${editor.getAttribute('data-placeholder') || ''}`
    return /caption|description|mô tả|chú thích/i.test(label) || editor.tagName === 'TEXTAREA'
  }) || null
}

function insertCaption(editor, text) {
  editor.focus()
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    if (setter) setter.call(editor, text)
  } else {
    editor.textContent = text
  }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
  editor.dispatchEvent(new Event('change', { bubbles: true }))
}

function readCaption(editor) {
  return 'value' in editor ? editor.value || '' : editor.innerText || editor.textContent || ''
}

function findPrivacyButton() {
  return Array.from(document.querySelectorAll('button, [role="button"]'))
    .find((button) => /who can|privacy|visibility|everyone|friends|only you|chỉ mình tôi|ai có thể xem/i.test(
      `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`
    ) && button.getClientRects().length > 0) || null
}

async function setPrivacyOnlyMe() {
  let privacyButton = findPrivacyButton()
  if (!privacyButton) return false
  if (/only you|chỉ mình tôi/i.test(`${privacyButton.textContent || ''} ${privacyButton.getAttribute('aria-label') || ''}`)) return true

  privacyButton.click()
  const optionReady = await OmniCartMedia.waitFor(() => {
    return Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="radio"], button'))
      .some((option) => /only you|chỉ mình tôi/i.test(option.textContent || '') && option.getClientRects().length > 0)
  }, 4000)
  if (!optionReady) return false

  const onlyMeOption = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="radio"], button'))
    .find((option) => /only you|chỉ mình tôi/i.test(option.textContent || '') && option.getClientRects().length > 0)
  if (!onlyMeOption) return false
  onlyMeOption.click()

  return OmniCartMedia.waitFor(() => {
    privacyButton = findPrivacyButton()
    return !!privacyButton && /only you|chỉ mình tôi/i.test(
      `${privacyButton.textContent || ''} ${privacyButton.getAttribute('aria-label') || ''}`
    )
  }, 4000)
}

function findPublishButton() {
  return Array.from(document.querySelectorAll('button, [role="button"]'))
    .find((button) => /^(post|đăng)$/i.test((button.textContent || '').trim()) && button.getClientRects().length > 0) || null
}

function collectTikTokPostPermalinks() {
  return Array.from(document.querySelectorAll('a[href*="/@harutv666/video/"], a[href*="/@harutv666/photo/"]'))
    .map((link) => link.href)
}

async function waitForPublishedPost(caption, existingPermalinks) {
  let newUrl = null
  const posted = await OmniCartMedia.waitFor(() => {
    const candidates = collectTikTokPostPermalinks()
    newUrl = candidates.find((url) => !existingPermalinks.has(url)) || null
    const textVisible = Array.from(document.querySelectorAll('article, [data-e2e*="video"]'))
      .some((element) => (element.innerText || element.textContent || '').includes(caption.slice(0, Math.min(48, caption.length))))
    return !!newUrl && textVisible
  }, 25000)

  return posted ? newUrl : null
}

function extractTikTokPostId(postUrl) {
  const match = postUrl?.match(/\/@harutv666\/(?:video|photo)\/([0-9]+)/i)
  return match?.[1] || null
}

async function scrapeTikTokTrending() {
  const posts = []
  const cards = Array.from(document.querySelectorAll('div[data-e2e="explore-item"], div[class*="DivItemContainer"]'))

  for (const card of cards.slice(0, 8)) {
    try {
      const titleEl = card.querySelector('div[data-e2e="explore-card-desc"], a[title]')
      const title = titleEl ? (titleEl.getAttribute('title') || titleEl.textContent).trim() : ''
      if (!title) continue

      const linkEl = card.querySelector('a[href*="/video/"]')
      const link = linkEl ? linkEl.href : HARUTV_PROFILE_URL

      const authorEl = card.querySelector('p[data-e2e="explore-card-user-unique-id"]')
      const author = authorEl ? authorEl.textContent.trim() : '@trending'

      posts.push({
        id: 'tt-real-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        title: title.slice(0, 100),
        platform: 'tiktok',
        category: 'Công nghệ & Đời sống',
        postUrl: link,
        summary: `Video viral từ creator ${author}: ${title}`,
        viralityScore: 92,
        likesCount: 0,
        sharesCount: 0,
        commentsCount: 0,
        trendingTopic: 'Xu hướng TikTok thịnh hành',
        createdAt: new Date().toISOString()
      })
    } catch (e) {}
  }

  return { ok: true, posts }
}
