/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.0 cho TikTok (hoạt động với BẤT KỲ tài khoản TikTok nào đang đăng nhập — không hardcode @username).
  - Nâng cấp v3.0.0:
    1. Điền trọn vẹn Tiêu đề (0/90) + Mô tả chi tiết & #Hashtag (0/4000) bằng Click-to-Discover 4 lớp.
    2. Hỗ trợ quy trình duyệt bài 3–5 phút của TikTok: nếu sau khi bấm Đăng mà TikTok đang duyệt/xử lý -> trả về pendingReview: true để Background dùng chrome.alarms theo dõi tiếp 3–5 phút!
    3. Thêm lệnh TIKTOK_CHECK_POST_STATUS để kiểm tra trang TikTok Studio Content (/tiktokstudio/content) & Profile của tài khoản đang đăng nhập nhằm lấy chính xác đường dẫn bài thật /@<handle>/(photo|video)/<id>.
    4. Cào 10 bài VIRAL TikTok thật (>= 50.000 tim) có đường dẫn chính xác 100%.
*/

;(() => {
  if (typeof window.__OMNICART_TT_CLEANUP__ === 'function') {
    try { window.__OMNICART_TT_CLEANUP__() } catch (_) {}
  }

  const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'
  const PUBLIC_RE = /mọi người|công khai|everyone|public/i
  const ONLY_ME_RE = /chỉ mình tôi|chỉ bạn|only you|only me|private/i
  const PRIVACY_LABEL_RE = /người có thể nhìn thấy|ai có thể xem|who can (watch|view|see)|quyền riêng tư|privacy/i
  const DESC_PLACEHOLDER_RE = /mô tả dài có thể giúp|mô tả dài|longer descriptions can help|share more about your|describe your|thêm mô tả/i

  const V = () => globalThis.OmniVision
  const M = () => globalThis.OmniCartMedia

  const handleMessage = (message, sender, sendResponse) => {
    if (!message?.type) return false

    if (message.type === 'VISION_SET_CONFIG' || message.type === 'VISION_SET_HUD') {
      V()?.applyConfig(message.config || { showHud: message.enabled })
      sendResponse({ ok: true })
      return false
    }

    if (message.type === 'TIKTOK_INSPECT_VISION') {
      sendResponse(inspectTikTokScreen())
      return false
    }

    if (message.type === 'TIKTOK_EXECUTE_POST') {
      executeTikTokPost(message.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
      return true
    }

    if (message.type === 'TIKTOK_CHECK_POST_STATUS') {
      checkTikTokApprovedPostLink(message.options || {})
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
      return true
    }

    if (message.type === 'TIKTOK_SCRAPE_VIRAL') {
      scrapeTikTokViralPosts(message.options || {})
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err), posts: [] }))
      return true
    }

    return false
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  window.__OMNICART_TT_CLEANUP__ = () => {
    try { chrome.runtime.onMessage.removeListener(handleMessage) } catch (_) {}
  }

  // =========================================================================
  // TỰ NHẬN DIỆN BẤT KỲ TÀI KHOẢN TIKTOK NÀO ĐANG ĐĂNG NHẬP
  // =========================================================================

  function isUploadPath() {
    return /^\/(tiktokstudio\/upload|creator-center\/upload|upload)\/?$/i.test(location.pathname)
  }

  function detectCurrentTikTokHandle() {
    // 1. Từ URL hiện tại nếu đang ở trang profile /@username
    const pathMatch = location.pathname.match(/^\/(@[A-Za-z0-9._-]+)/)
    if (pathMatch) return pathMatch[1]

    // 2. Từ link hồ sơ trên thanh điều hướng / avatar / bài viết trên Studio Content
    const profileLinks = Array.from(document.querySelectorAll('a[href*="/@"]'))
      .map((a) => {
        const m = String(a.getAttribute('href') || a.href || '').match(/\/(@[A-Za-z0-9._-]+)/)
        return m ? m[1] : null
      })
      .filter(Boolean)
    if (profileLinks.length > 0) return profileLinks[0]

    // 3. Từ khung xem trước điện thoại trên TikTok Studio (hiển thị tên/handle ngay góc trái dưới màn hình preview)
    const previewAuthor = V().queryAllDeep(document, '[class*="author"], [class*="Author"], [data-e2e="profile-icon"], [aria-label*="@"]')
      .map((el) => V().normalizeText(el.innerText || el.getAttribute('aria-label') || ''))
      .find((t) => /^@?[A-Za-z0-9._-]{2,30}$/.test(t) && !/tiktok|studio/i.test(t))
    if (previewAuthor) return previewAuthor.startsWith('@') ? previewAuthor : `@${previewAuthor}`

    return null
  }

  function isAccountLoggedIn() {
    const topRightAvatars = V().queryAllDeep(document, 'img, [data-e2e="nav-avatar"], [data-e2e="profile-icon"]')
      .filter((el) => {
        if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 20 })) return false
        const r = el.getBoundingClientRect()
        return r.top < 90 && r.left > window.innerWidth * 0.65
      })
    if (topRightAvatars.length > 0) return true

    const bodyText = V().normalizeText(document.body?.innerText || '').slice(0, 1200)
    return /tiktok studio/i.test(bodyText) && /bài đăng|posts|tải lên|upload/i.test(bodyText)
  }

  function isLoginRequired() {
    if (/\/login/i.test(location.pathname)) return true
    const loginBtn = V().queryAllDeep(document, 'button, a').find((el) => {
      if (!V().isReallyVisible(el)) return false
      return /^(đăng nhập|log in|login)$/i.test(V().normalizeText(el.innerText || el.textContent))
    })
    return Boolean(loginBtn && !isAccountLoggedIn())
  }

  function detectScreenState() {
    if (isLoginRequired()) return 'login_required'
    if (!isUploadPath()) return 'other_tiktok_page'

    const hasTitleOrDesc = Boolean(findTitleInput() || findDescriptionPlaceholder() || findDescriptionEditorPassive())
    const hasSettingsOrCounter = Boolean(
      readDescriptionCounter() !== null ||
      V().findLabelElement(/^(cài đặt|settings|chi tiết|details)$/i, { minLeft: 180, maxLength: 30 }) ||
      V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 80 })
    )
    if (hasTitleOrDesc && hasSettingsOrCounter) return 'detail_editor_form'

    if (V().findLabelElement(/chọn ảnh để tải lên|select photos? to upload|tải lên tối đa 35 ảnh/i, { minLeft: 160 })) {
      return 'upload_photo_tab'
    }
    if (V().findLabelElement(/chọn video để tải lên|select video to upload/i, { minLeft: 160 })) {
      return 'upload_video_tab'
    }
    return 'loading_or_unknown'
  }

  function findPhotoTabButton() {
    const candidates = V().queryAllDeep(document, '[role="tab"], button, [role="button"], div, span, a')
    let best = null
    let bestScore = -Infinity

    for (const el of candidates) {
      if (!V().isReallyVisible(el, { minWidth: 24, minHeight: 20 })) continue
      const r = el.getBoundingClientRect()
      if (r.top < 70 || r.top > 450 || r.height > 70 || r.width > 180) continue
      const txt = V().normalizeText(el.innerText || el.textContent)
      if (!/^(ảnh|photo|photos|image|images)$/i.test(txt)) continue

      let score = 50
      if (r.left > 180) score += 30
      if (el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') score += 20
      if (score > bestScore) {
        bestScore = score
        best = el
      }
    }
    return best
  }

  function findPhotoDropzoneElement() {
    const label = V().findLabelElement(/chọn ảnh để tải lên|select photos? to upload|kéo và thả ảnh/i, { minLeft: 160 })
    if (!label) return null
    let cur = label
    for (let i = 0; i < 4 && cur?.parentElement; i++) {
      const r = cur.parentElement.getBoundingClientRect()
      if (r.width > 350 && r.height > 150) return cur.parentElement
      cur = cur.parentElement
    }
    return label
  }

  function findTitleInput() {
    const inputs = V().queryAllDeep(document, 'input[type="text"], input:not([type]), textarea, [contenteditable="true"]')
    for (const el of inputs) {
      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 14 })) continue
      const r = el.getBoundingClientRect()
      if (r.left < 180 || r.top < 70 || r.height > 85) continue

      const ph = V().normalizeText(
        `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-placeholder') || ''}`
      )
      if (/vị trí|location|search|tìm kiếm/i.test(ph)) continue
      if (/tiêu đề|title/i.test(ph)) return el

      const parentText = V().normalizeText(el.parentElement?.innerText || '').slice(0, 140)
      if (/thêm tiêu đề|add.*title|\b\d+\s*\/\s*90\b/i.test(parentText)) return el
    }
    return null
  }

  function findDescriptionPlaceholder() {
    return V().findLabelElement(DESC_PLACEHOLDER_RE, { minLeft: 180, minTop: 80, maxLength: 160 })
  }

  function findDescriptionFooterAnchor() {
    return (
      V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 }) ||
      V().findLabelElement(/^#\s*hashtag$/i, { minLeft: 180, maxLength: 24 }) ||
      V().findLabelElement(/@\s*nhắc đến|@\s*mentions?/i, { minLeft: 180, maxLength: 24 })
    )
  }

  function findDescriptionEditorPassive() {
    const titleEl = findTitleInput()
    const footerEl = findDescriptionFooterAnchor()
    const footerRect = footerEl ? footerEl.getBoundingClientRect() : null
    const titleRect = titleEl ? titleEl.getBoundingClientRect() : null

    const candidates = V().queryAllDeep(
      document,
      '.public-DraftEditor-content[contenteditable="true"], [data-lexical-editor="true"], div[contenteditable="true"], div[contenteditable="plaintext-only"], [role="textbox"], textarea'
    )

    let best = null
    let bestScore = -Infinity

    for (const el of candidates) {
      if (el === titleEl || titleEl?.contains(el) || el.contains(titleEl)) continue
      if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 10 })) continue

      const r = el.getBoundingClientRect()
      if (r.left < 160 || r.top < 70) continue

      const selfMeta = V().normalizeText(
        `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.className || ''}`
      )
      if (/vị trí|location|search|tìm kiếm/i.test(selfMeta)) continue

      const nearText = V().normalizeText(el.parentElement?.parentElement?.innerText || '').slice(0, 350)
      if (/tìm kiếm vị trí|search location/i.test(nearText) && !/hashtag|4000|mô tả dài/i.test(nearText)) continue

      let score = 0
      if (/public-drafteditor-content|drafteditor|lexical|caption|description/i.test(selfMeta)) score += 50
      if (DESC_PLACEHOLDER_RE.test(nearText) || /\b\d+\s*\/\s*4000\b/.test(nearText) || /#\s*hashtag/i.test(nearText)) score += 55
      if (el.isContentEditable) score += 25
      if (el.getAttribute('role') === 'textbox' || el.tagName === 'TEXTAREA') score += 15

      if (titleRect && r.top >= titleRect.bottom - 8 && r.top <= titleRect.bottom + 240) score += 45
      if (footerRect && r.bottom <= footerRect.bottom + 15 && r.top >= footerRect.top - 340) score += 45

      if (score > bestScore && score >= 25) {
        bestScore = score
        best = el
      }
    }
    return best
  }

  async function findAndFocusDescriptionEditor(stepLog) {
    const titleEl = findTitleInput()
    let editor = findDescriptionEditorPassive()
    if (editor) return editor

    const placeholderEl = findDescriptionPlaceholder()
    if (placeholderEl) {
      stepLog('fill_desc', 'Đang bấm trực tiếp vào vùng "Mô tả dài..." để kích hoạt khung soạn thảo...')
      await V().humanClick(placeholderEl, 'Kích hoạt ô Mô tả (0/4000)')
      await V().humanDelay(350, 650)

      const active = V().getDeepActiveElement()
      if (
        active &&
        active !== titleEl &&
        !titleEl?.contains(active) &&
        (active.isContentEditable || active.tagName === 'TEXTAREA' || active.getAttribute('role') === 'textbox')
      ) {
        return active
      }

      editor = findDescriptionEditorPassive()
      if (editor) return editor

      let box = placeholderEl.parentElement
      for (let i = 0; i < 4 && box; i++) {
        const innerEditable = box.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"], textarea, [role="textbox"]')
        if (innerEditable && innerEditable !== titleEl) return innerEditable
        box = box.parentElement
      }
    }

    const footerEl = findDescriptionFooterAnchor()
    if (footerEl) {
      const fRect = footerEl.getBoundingClientRect()
      const hit = document.elementFromPoint(Math.round(fRect.left + 60), Math.round(Math.max(100, fRect.top - 48)))
      if (hit && hit !== titleEl && !titleEl?.contains(hit)) {
        await V().humanClick(hit, 'Vùng nhập Mô tả')
        await V().humanDelay(320, 600)
        const active = V().getDeepActiveElement()
        if (active && active !== titleEl && (active.isContentEditable || active.tagName === 'TEXTAREA')) {
          return active
        }
      }
    }

    const ai = await V().askVisionAI(
      'Click the main Description / Caption editor box ("Mô tả dài có thể giúp tăng lượt xem...", 0/4000 counter, above # Hashtag) — NOT the short 0/90 title box.',
      { platform: 'tiktok', step: 'find_description_editor' }
    )
    if (ai?.ok && ai.element && ai.element !== titleEl) {
      await V().humanClick(ai.element, 'Vision AI -> Ô Mô tả')
      await V().humanDelay(350, 650)
      const active = V().getDeepActiveElement()
      if (active && active !== titleEl && (active.isContentEditable || active.tagName === 'TEXTAREA')) return active
      return ai.element
    }
    return null
  }

  function readDescriptionCounter() {
    const label = V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 })
    if (!label) return null
    const m = V().normalizeText(label.innerText || label.textContent).match(/^(\d+)\s*\/\s*4000$/)
    return m ? Number(m[1]) : null
  }

  function readTitleCounter() {
    const label = V().findLabelElement(/^\d+\s*\/\s*90$/i, { minLeft: 180, maxLength: 16 })
    if (!label) return null
    const m = V().normalizeText(label.innerText || label.textContent).match(/^(\d+)\s*\/\s*90$/)
    return m ? Number(m[1]) : null
  }

  function findPrivacyControl() {
    const label = V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 90 })
    if (label) {
      const nearby = V().findControlNearLabel(
        label,
        'button, [role="combobox"], [role="button"], select, div[class*="select"], div[class*="Select"]',
        { direction: 'below', maxVertical: 110, maxHorizontal: 260 }
      )
      if (nearby) return nearby
    }

    return V().queryAllDeep(
      document,
      'select, button, [role="combobox"], [role="button"], div[class*="select"], div[class*="Select"]'
    ).find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 24 })) return false
      const r = el.getBoundingClientRect()
      if (r.left < 180 || r.top < 150) return false
      const txt = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      return txt.length <= 45 && /^(mọi người|công khai|bạn bè|chỉ mình tôi|chỉ bạn|everyone|friends|only you|only me|private)$/i.test(txt)
    }) || null
  }

  function parsePrivacyValue(text) {
    const clean = V().normalizeText(text)
    if (ONLY_ME_RE.test(clean)) return 'only_me'
    if (PUBLIC_RE.test(clean)) return 'public'
    if (/bạn bè|friends/i.test(clean)) return 'friends'
    return null
  }

  function findPublishButton() {
    const directSelectors = [
      'button[data-e2e="post_video_button"]',
      'button[data-e2e="post-button"]',
      'button[data-e2e="post-btn"]',
      '[data-e2e="post_video_button"]'
    ]
    for (const sel of directSelectors) {
      const el = V().queryAllDeep(document, sel).find((node) => V().isReallyVisible(node, { minWidth: 60, minHeight: 28 }))
      if (el) return el
    }

    const buttons = V().queryAllDeep(document, 'button, [role="button"]')
    let best = null
    let bestScore = -Infinity

    for (const btn of buttons) {
      if (!V().isReallyVisible(btn, { minWidth: 64, minHeight: 28 })) continue
      const r = btn.getBoundingClientRect()
      if (r.left < 180 || r.top < 120) continue
      const txt = V().normalizeText(btn.innerText || btn.textContent)
      if (!/^(đăng|post|đăng ngay|post now|xuất bản|publish)$/i.test(txt)) continue

      const color = V().getElementColorInfo(btn)
      let score = 50
      if (btn.tagName === 'BUTTON') score += 20
      if (color.isRedPink) score += 40
      if (r.width >= 90) score += 15
      if (!V().isElementDisabled(btn)) score += 10
      if (score > bestScore) {
        bestScore = score
        best = btn
      }
    }
    return best
  }

  function findDiscardButton() {
    return V().queryAllDeep(document, 'button, [role="button"]').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 50, minHeight: 24 })) return false
      const r = btn.getBoundingClientRect()
      if (r.left < 180) return false
      return /^(hủy bỏ|hủy|discard|xóa bỏ)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
    }) || null
  }

  function inspectTikTokScreen() {
    return {
      url: location.href,
      health: V().inspectPageHealth(),
      screenState: detectScreenState(),
      loggedIn: isAccountLoggedIn(),
      accountHandle: detectCurrentTikTokHandle() || 'Tài khoản TikTok đang đăng nhập',
      hasPhotoTab: Boolean(findPhotoTabButton()),
      hasTitleInput: Boolean(findTitleInput()),
      titleCounter: readTitleCounter(),
      hasDescriptionEditor: Boolean(findDescriptionEditorPassive() || findDescriptionPlaceholder()),
      descriptionCounter: readDescriptionCounter(),
      privacyControlText: V().normalizeText(findPrivacyControl()?.innerText || findPrivacyControl()?.value || ''),
      hasPublishButton: Boolean(findPublishButton()),
      publishButtonEnabled: Boolean(findPublishButton() && !V().isElementDisabled(findPublishButton())),
      somCount: V().buildInteractiveMap(document).items.length
    }
  }

  // =========================================================================
  // LUỒNG ĐĂNG BÀI ẢNH TIKTOK STUDIO + HỖ TRỢ DUYỆT 3–5 PHÚT
  // =========================================================================

  async function executeTikTokPost(payload) {
    const trace = []
    const stepLog = (step, msg, level = 'info') => {
      trace.push({ step, msg, level, ts: Date.now() })
      V().reportStep('tiktok', step, msg, level)
    }

    if (!/(^|\.)tiktok\.com$/i.test(location.hostname)) {
      return { ok: false, error: 'TIKTOK_HOST_INVALID', visionTrace: trace }
    }

    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 25000, onStatus: stepLog })
    if (!stable.ok) {
      return { ok: false, error: `TIKTOK_${stable.reason}`, visionTrace: trace }
    }

    if (!isUploadPath()) {
      stepLog('nav', 'Chưa ở trang TikTok Studio Upload, yêu cầu background điều hướng...', 'warn')
      return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
    }

    const requestedPrivacy = String(payload?.privacy || 'only_me').toLowerCase()
    if (!['only_me', 'public'].includes(requestedPrivacy)) {
      return { ok: false, error: 'INVALID_PRIVACY', visionTrace: trace }
    }
    if (!payload?.imageDataUrl) {
      return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    }

    const rawTitle = V().normalizeText(payload.title || '')
    const rawBody = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''

    const shortTitle = V().truncateClean(
      rawTitle || V().formatPostText(rawBody, 200).split('\n')[0] || 'Ưu đãi nổi bật từ OmniCart',
      85
    )

    let fullDescription = V().composeBodyAndHashtags(rawBody || rawTitle, rawHashtags, 3850)
    if (!fullDescription) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }
    if (/#[\p{L}\p{N}_]+$/u.test(fullDescription)) fullDescription += ' '

    const accountHandle = detectCurrentTikTokHandle() || 'Tài khoản TikTok đang đăng nhập'
    stepLog('prepare', `Tài khoản TikTok: ${accountHandle} • Tiêu đề ${shortTitle.length}c | Mô tả + Hashtag ${fullDescription.trim().length}c.`)

    // 1. Kiểm tra đăng nhập
    const readyAuth = await M().waitFor(() => isAccountLoggedIn() || isLoginRequired(), 15000)
    if (!readyAuth || isLoginRequired()) {
      stepLog('auth', 'Tab TikTok chưa đăng nhập tài khoản nào!', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_LOGIN_REQUIRED', visionTrace: trace }
    }
    await V().humanDelay(750, 1400)

    // 2. Quan sát màn hình & dọn nháp cũ nếu có
    await M().waitFor(() => detectScreenState() !== 'loading_or_unknown', 12000)
    let state = detectScreenState()
    stepLog('screen', `OmniVision nhận diện TikTok Studio: ${state}`)

    if (state === 'detail_editor_form') {
      stepLog('reset_draft', 'Phát hiện bản nháp cũ còn mở, đang hủy để tạo bài mới sạch...', 'warn')
      await V().scrollContainerToBottom(findDescriptionFooterAnchor() || findTitleInput())
      const discardBtn = findDiscardButton()
      if (discardBtn) {
        await V().humanClick(discardBtn, 'Hủy bản nháp cũ')
        await V().humanDelay(750, 1250)
        const confirmDiscard = V().queryAllDeep(document, '[role="dialog"] button, [class*="modal"] button, [class*="Modal"] button').find((b) => {
          if (!V().isReallyVisible(b)) return false
          return /^(hủy bỏ|hủy|discard|xác nhận|confirm)$/i.test(V().normalizeText(b.innerText || b.textContent))
        })
        if (confirmDiscard) {
          await V().humanClick(confirmDiscard, 'Xác nhận hủy')
          await M().waitFor(() => detectScreenState() !== 'detail_editor_form', 8000)
        }
        await V().humanDelay(900, 1500)
      } else {
        return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      }
      state = detectScreenState()
    }

    if (state === 'upload_video_tab' || state === 'loading_or_unknown') {
      const photoTab = findPhotoTabButton()
      if (photoTab) {
        stepLog('switch_tab', 'Đang chuyển sang tab "Ảnh" (Photo Mode)...')
        await V().humanClick(photoTab, 'Chuyển tab Ảnh')
        await M().waitFor(
          () => detectScreenState() === 'upload_photo_tab' || Boolean(M().findImageInput(document, 200, false)),
          8000
        )
        await V().humanDelay(650, 1200)
      }
    }

    // 3. Nạp ảnh & chờ chuyển sang form Chi tiết
    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào TikTok Studio...')
    const imageSnapshot = V().captureVisualImageSnapshot(document)
    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-tiktok-product.png')

    const imageInput = await M().findImageInput(document, 6000, false)
    let attached = imageInput ? M().attachFile(imageInput, imageFile) : false
    if (!attached) {
      const dropzone = findPhotoDropzoneElement()
      if (dropzone) attached = M().attachViaDrop(dropzone, imageFile)
    }
    if (!attached) {
      stepLog('upload_image', 'Không tìm thấy ô tải ảnh trên TikTok Studio.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE', visionTrace: trace }
    }

    stepLog('wait_detail', 'Đang chờ TikTok xử lý ảnh & mở biểu mẫu "Chi tiết"...')
    const detailFormReady = await M().waitFor(() => {
      const hasForm = Boolean(findTitleInput() || findDescriptionPlaceholder() || findDescriptionEditorPassive())
      if (!hasForm) return false
      const hasNewThumb = Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: document, minTop: 110, minWidth: 55, minHeight: 55 }))
      const hasCoverLabel = Boolean(V().findLabelElement(/ảnh bìa|đã tải lên \d+ ảnh|uploaded \d+ photo|cover/i, { minLeft: 180, maxLength: 80 }))
      return hasNewThumb || hasCoverLabel
    }, 30000, 350)

    if (!detailFormReady) {
      stepLog('wait_detail', 'TikTok không chuyển sang màn hình "Chi tiết" sau khi tải ảnh.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_DETAIL_FORM_NOT_LOADED', visionTrace: trace }
    }

    await V().humanDelay(1800, 3000)
    const confirmedHandle = detectCurrentTikTokHandle() || accountHandle
    stepLog('wait_detail', `✅ Đã xác nhận ảnh bìa & biểu mẫu sẵn sàng (${confirmedHandle}).`)

    // 4A. Điền Tiêu đề (0/90)
    const titleInput = findTitleInput()
    if (titleInput) {
      stepLog('fill_title', `Đang gõ Tiêu đề (${shortTitle.length}/90 ký tự)...`)
      const titleRes = await V().smartTypeText(titleInput, shortTitle, {
        clearFirst: true,
        humanBurst: true,
        label: 'Tiêu đề TikTok (0/90)'
      })
      const tCounter = readTitleCounter()
      stepLog('fill_title', `✅ Tiêu đề: ${tCounter !== null ? `${tCounter}/90` : titleRes.method}.`)
      await V().humanDelay(850, 1550)
    }

    // 4B. Điền Mô tả chi tiết & #Hashtag (0/4000)
    stepLog('fill_desc', 'Đang định vị ô Mô tả & Hashtag (0/4000)...')
    const descEditor = await findAndFocusDescriptionEditor(stepLog)
    if (!descEditor) {
      stepLog('fill_desc', 'Không tìm thấy ô Mô tả (0/4000) — dừng an toàn!', 'error')
      V().clearHud(5500)
      return { ok: false, error: 'TIKTOK_DESCRIPTION_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    const descVerifyFn = (el, actual) => {
      const counter = readDescriptionCounter()
      if (counter !== null && counter >= Math.min(15, fullDescription.trim().length)) return true
      const clean = V().normalizeText(actual)
      return clean.length >= Math.min(18, fullDescription.trim().length) && !DESC_PLACEHOLDER_RE.test(clean)
    }

    let descRes = await V().smartTypeText(descEditor, fullDescription, {
      clearFirst: true,
      label: 'Mô tả & Hashtag TikTok (0/4000)',
      dismissPopover: true,
      placeholderRe: DESC_PLACEHOLDER_RE,
      verifyFn: descVerifyFn
    })

    await V().humanDelay(700, 1200)
    let counterAfter = readDescriptionCounter()

    if (!descRes.ok && (counterAfter === null || counterAfter === 0)) {
      const reFocused = await findAndFocusDescriptionEditor(stepLog)
      if (reFocused) {
        descRes = await V().smartTypeText(reFocused, fullDescription, {
          clearFirst: true,
          label: 'Thử lại Mô tả & Hashtag',
          dismissPopover: true,
          placeholderRe: DESC_PLACEHOLDER_RE,
          verifyFn: descVerifyFn
        })
        await V().humanDelay(750, 1250)
        counterAfter = readDescriptionCounter()
      }
    }

    if ((counterAfter !== null && counterAfter === 0) || (!descRes.ok && counterAfter === null)) {
      stepLog('fill_desc', '❌ Ô Mô tả vẫn đang 0/4000! Dừng an toàn để không đăng bài thiếu nội dung.', 'error')
      V().clearHud(6000)
      return { ok: false, error: 'TIKTOK_DESCRIPTION_NOT_INSERTED', visionTrace: trace }
    }

    V().dispatchEscape(descEditor)
    await V().humanDelay(500, 900)
    stepLog('fill_desc', `✅ Đã xác nhận Mô tả + Hashtag (${counterAfter !== null ? `${counterAfter}/4000` : descRes.method})!`)

    // 5. Quyền riêng tư
    await V().humanDelay(850, 1550)
    stepLog('privacy', `Đang kiểm tra quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}...`)
    const privacyResult = await setAndVerifyTikTokPrivacy(requestedPrivacy, stepLog)
    if (!privacyResult.ok) {
      stepLog('privacy', `Quyền riêng tư TikTok chưa khớp (${privacyResult.actual || 'không rõ'}).`, 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PRIVACY_NOT_CONFIRMED', actualPrivacy: privacyResult.actual, visionTrace: trace }
    }
    stepLog('privacy', `✅ Quyền riêng tư chuẩn: ${privacyResult.actual === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}.`)

    // 6. Cuộn xuống, rà soát và bấm Đăng
    stepLog('publish', 'Đang cuộn mượt xuống nút "Đăng" & rà soát lần cuối...')
    await V().scrollContainerToBottom(findPrivacyControl() || descEditor)
    await V().humanReviewPause()

    let publishBtn = null
    const publishReady = await M().waitFor(() => {
      const btn = findPublishButton()
      if (btn && !V().isElementDisabled(btn)) {
        publishBtn = btn
        return true
      }
      return false
    }, 12000)

    if (!publishReady || !publishBtn) {
      stepLog('publish', 'Nút "Đăng" trên TikTok Studio chưa sẵn sàng.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY', visionTrace: trace }
    }

    await V().humanClick(publishBtn, 'Đăng bài TikTok')
    stepLog('publish', 'Đã bấm nút "Đăng", đang chờ TikTok tiếp nhận bài (chú ý TikTok có thể duyệt 3–5 phút)...')

    // 7. Chờ 38 giây đầu: nếu lấy được link thật ngay -> xong luôn; nếu TikTok chuyển sang chờ duyệt -> bàn giao cho Background Tracker 24/7!
    const confirm = await waitForTikTokSubmitResult(38000, shortTitle, confirmedHandle, stepLog)
    V().clearHud(5000)

    if (!confirm.ok) {
      return { ok: false, error: confirm.error || 'TIKTOK_POST_NOT_VERIFIED', visionTrace: trace }
    }

    if (confirm.pendingReview) {
      return {
        ok: true,
        pendingReview: true,
        status: 'pending_review',
        platform: 'tiktok',
        account: confirmedHandle,
        privacy: privacyResult.actual,
        titleProbe: shortTitle.slice(0, 36),
        submittedAt: new Date().toISOString(),
        message: confirm.message || 'TikTok đã nhận bài & đang duyệt (3–5 phút). Extension đang tự động theo dõi ngầm để lấy link thật!',
        visionTrace: trace
      }
    }

    return {
      ok: true,
      verified: true,
      postUrl: confirm.postUrl,
      realPostId: confirm.postId || `tiktok-${Date.now()}`,
      platform: 'tiktok',
      account: confirmedHandle,
      privacy: privacyResult.actual,
      publishedTime: new Date().toISOString(),
      message: confirm.message || 'Đã đăng bài TikTok thành công!',
      visionTrace: trace
    }
  }

  async function setAndVerifyTikTokPrivacy(requestedPrivacy, stepLog) {
    const label = V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 90 })
    if (label) await V().scrollIntoViewSafely(label, 'center')

    const control = findPrivacyControl()
    if (!control) return { ok: false, actual: null }
    await V().scrollIntoViewSafely(control, 'center')
    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE

    if (control.tagName === 'SELECT') {
      const currentText = control.options[control.selectedIndex]?.textContent || ''
      if (parsePrivacyValue(currentText) === requestedPrivacy) return { ok: true, actual: requestedPrivacy }
      const matchOpt = Array.from(control.options).find((o) => targetPattern.test(V().normalizeText(o.textContent)))
      if (!matchOpt) return { ok: false, actual: parsePrivacyValue(currentText) }
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      if (setter) setter.call(control, matchOpt.value)
      else control.value = matchOpt.value
      control.dispatchEvent(new Event('input', { bubbles: true }))
      control.dispatchEvent(new Event('change', { bubbles: true }))
      await V().humanDelay(450, 800)
      return { ok: control.value === matchOpt.value, actual: requestedPrivacy }
    }

    const currentLabel = V().getAccessibleLabel(control)
    const currentValue = parsePrivacyValue(currentLabel)
    if (currentValue === requestedPrivacy) {
      V().highlightTarget(control, `Chuẩn: ${currentLabel}`, '#22c55e')
      return { ok: true, actual: requestedPrivacy }
    }

    stepLog('privacy', `Đổi quyền riêng tư từ "${currentLabel}" -> "${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}"...`)
    await V().humanClick(control, 'Mở danh sách quyền riêng tư')
    await V().humanDelay(650, 1150)

    const findMatchingOption = () => {
      const opts = V().queryAllDeep(document, '[role="option"], [role="menuitem"], [role="radio"], li, div[class*="option"], div[class*="Option"], button')
      return opts.find((el) => {
        if (el === control || el.contains(control)) return false
        if (!V().isReallyVisible(el, { minWidth: 50, minHeight: 20 })) return false
        const txt = V().normalizeText(el.innerText || el.textContent)
        return txt.length <= 60 && targetPattern.test(txt)
      }) || null
    }

    const optReady = await M().waitFor(() => Boolean(findMatchingOption()), 5000)
    const optionEl = optReady ? findMatchingOption() : null
    if (!optionEl) {
      V().dispatchEscape()
      return { ok: false, actual: currentValue }
    }

    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người')
    await V().humanDelay(650, 1100)

    const confirmed = await M().waitFor(() => {
      const updated = findPrivacyControl()
      return Boolean(updated && parsePrivacyValue(V().getAccessibleLabel(updated)) === requestedPrivacy)
    }, 5000)

    const finalCtrl = findPrivacyControl()
    const finalVal = finalCtrl ? parsePrivacyValue(V().getAccessibleLabel(finalCtrl)) : null
    return { ok: confirmed && finalVal === requestedPrivacy, actual: finalVal }
  }

  function extractRealTikTokPostLinks(root = document) {
    return V().queryAllDeep(root, 'a[href*="/video/"], a[href*="/photo/"]')
      .map((a) => cleanTikTokPostUrl(a.href))
      .filter(isRealTikTokPostUrl)
  }

  function cleanTikTokPostUrl(raw) {
    try {
      const u = new URL(raw, location.origin)
      const m = u.pathname.match(/^\/(@[A-Za-z0-9._-]+)\/(video|photo)\/(\d+)/i)
      if (!m) return null
      return `https://www.tiktok.com/${m[1]}/${m[2].toLowerCase()}/${m[3]}`
    } catch (_) {
      return null
    }
  }

  function isRealTikTokPostUrl(url) {
    return Boolean(url && /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._-]+\/(?:video|photo)\/\d+$/i.test(url))
  }

  async function waitForTikTokSubmitResult(timeoutMs, titleProbe, accountHandle, stepLog) {
    const startUrl = location.href
    const deadline = Date.now() + timeoutMs
    let handledConfirmModal = false
    let acceptedByTikTok = false

    while (Date.now() < deadline) {
      const currentUrl = location.href

      // 1. Kiểm tra nếu đã chuyển trang sang danh sách bài đăng (/content, /manage-posts)
      if (currentUrl !== startUrl && !/\/upload\/?(\?|$)/i.test(currentUrl)) {
        acceptedByTikTok = true
        const directLink = cleanTikTokPostUrl(currentUrl)
        if (directLink) {
          stepLog('verify', `✅ Đã có link bài TikTok thật ngay: ${directLink}`, 'success')
          return { ok: true, postUrl: directLink, postId: extractTikTokPostId(directLink) }
        }

        // Chờ danh sách bài trên /tiktokstudio/content nạp xong rồi thử lấy link bài vừa đăng
        await V().humanDelay(1800, 2800)
        const statusCheck = await checkTikTokApprovedPostLink({ titleProbe, accountHandle })
        if (statusCheck.status === 'published' && statusCheck.postUrl) {
          stepLog('verify', `✅ Bài đã duyệt & lấy được link thật: ${statusCheck.postUrl}`, 'success')
          return { ok: true, postUrl: statusCheck.postUrl, postId: statusCheck.postId }
        }

        stepLog('verify', '⏳ TikTok đã tiếp nhận bài & chuyển sang chờ duyệt (3–5 phút). Bật theo dõi ngầm 24/7!', 'info')
        return {
          ok: true,
          pendingReview: true,
          message: 'TikTok đang duyệt bài (3–5 phút). Extension sẽ tự động cập nhật link thật ngay khi duyệt xong.'
        }
      }

      // 2. Xử lý modal xác nhận phụ ("Tiếp tục đăng?", "Đã tải lên", "Quản lý bài đăng")
      const modals = V().queryAllDeep(document, '[role="dialog"], [class*="modal"], [class*="Modal"]')
        .filter((m) => V().isReallyVisible(m, { minWidth: 200, minHeight: 90 }))

      for (const modal of modals) {
        const modalText = V().normalizeText(modal.innerText || modal.textContent)
        if (!handledConfirmModal && /tiếp tục đăng|continue to post|đang kiểm tra bản quyền|copyright check|post now/i.test(modalText)) {
          const confirmBtn = V().queryAllDeep(modal, 'button, [role="button"]').find((b) => {
            if (!V().isReallyVisible(b) || V().isElementDisabled(b)) return false
            return /^(đăng ngay|đăng|tiếp tục|post now|post|continue)$/i.test(V().normalizeText(b.innerText || b.textContent))
          })
          if (confirmBtn) {
            handledConfirmModal = true
            stepLog('verify', 'Tự động xác nhận popup "Tiếp tục đăng"...')
            await V().humanDelay(550, 1000)
            await V().humanClick(confirmBtn, 'Xác nhận đăng ngay')
            await V().humanDelay(800, 1300)
          }
        }

        if (/đã được tải lên|has been uploaded|đã đăng|đang xem xét|under review|quản lý bài đăng|manage your posts|tải lên bài đăng khác/i.test(modalText)) {
          acceptedByTikTok = true
          // Bấm nút "Quản lý bài đăng" nếu có để chuyển sang trang theo dõi
          const manageBtn = V().queryAllDeep(modal, 'button, a, [role="button"]').find((b) =>
            V().isReallyVisible(b) && /quản lý bài đăng|manage your posts|xem hồ sơ|view profile/i.test(V().normalizeText(b.innerText || b.textContent))
          )
          if (manageBtn) {
            await V().humanClick(manageBtn, 'Mở quản lý bài đăng')
            await V().humanDelay(1500, 2300)
          }
          stepLog('verify', '⏳ TikTok xác nhận đã tải bài lên và đang duyệt (3–5 phút). Bật theo dõi ngầm!', 'info')
          return {
            ok: true,
            pendingReview: true,
            message: 'Bài đã tải lên TikTok & đang chờ duyệt (3–5 phút). Extension đang tự theo dõi để lấy link thật.'
          }
        }
      }

      // 3. Kiểm tra toast lỗi / thành công
      const toastJoined = V().queryAllDeep(
        document,
        '[role="status"], [role="alert"], [class*="toast"], [class*="Toast"], [class*="notification"]'
      )
        .filter((el) => V().isReallyVisible(el))
        .map((el) => V().normalizeText(el.innerText || el.textContent))
        .filter(Boolean)
        .join(' | ')

      if (/không thể đăng|thất bại|failed|error|captcha|verify to continue|xác minh/i.test(toastJoined)) {
        stepLog('verify', `TikTok báo lỗi: ${toastJoined.slice(0, 140)}`, 'error')
        return { ok: false, error: `TIKTOK_PUBLISH_ERROR: ${toastJoined.slice(0, 140)}` }
      }

      if (/đã đăng|posted|đã tải lên|thành công|successfully|đang xem xét|under review/i.test(toastJoined)) {
        acceptedByTikTok = true
        return {
          ok: true,
          pendingReview: true,
          message: `TikTok đã tiếp nhận (${toastJoined.slice(0, 80)}). Đang tự động theo dõi duyệt bài 3–5 phút...`
        }
      }

      await V().sleep(700)
    }

    if (acceptedByTikTok) {
      return {
        ok: true,
        pendingReview: true,
        message: 'TikTok đã nhận bài và đang xử lý duyệt (3–5 phút).'
      }
    }

    return { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }
  }

  // =========================================================================
  // KIỂM TRA TRẠNG THÁI DUYỆT BÀI TIKTOK (CHẠY NGẦM 3–5 PHÚT QUA CHROME.ALARMS)
  // =========================================================================

  async function checkTikTokApprovedPostLink(options = {}) {
    const titleProbe = V().normalizeText(options.titleProbe || '').toLowerCase().slice(0, 26)
    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 15000 })
    if (!stable.ok) return { ok: false, status: 'pending_review', reason: stable.reason }

    await V().humanDelay(800, 1400)
    const detectedHandle = detectCurrentTikTokHandle() || options.accountHandle || null

    // 1. Nếu đang ở TikTok Studio -> Bài đăng (/tiktokstudio/content hoặc /manage-posts)
    const rows = V().queryAllDeep(document, 'tr, [role="row"], [class*="post-item"], [class*="PostItem"], [class*="video-item"], [data-e2e*="post-item"]')
      .filter((el) => V().isReallyVisible(el, { minWidth: 200, minHeight: 40 }))

    for (const row of rows.slice(0, 8)) {
      const rowText = V().normalizeText(row.innerText || row.textContent)
      const rowLower = rowText.toLowerCase()
      const matchesTitle = !titleProbe || rowLower.includes(titleProbe) || rowLower.includes(titleProbe.slice(0, 14))
      if (!matchesTitle) continue

      // Kiểm tra nếu bài vẫn đang được TikTok duyệt ("Đang xem xét" / "Under review" / "Đang xử lý")
      if (/đang xem xét|under review|đang xử lý|processing|đang tải lên|uploading/i.test(rowText)) {
        return {
          ok: true,
          status: 'pending_review',
          accountHandle: detectedHandle,
          message: 'TikTok vẫn đang duyệt bài (Under review)...'
        }
      }

      if (/bị xóa|removed|vi phạm|violation|không được duyệt/i.test(rowText)) {
        return {
          ok: false,
          status: 'rejected',
          error: 'TIKTOK_POST_REJECTED_IN_REVIEW'
        }
      }

      // Tìm link thật ngay trong dòng bài đăng
      const linksInRow = extractRealTikTokPostLinks(row)
      if (linksInRow.length > 0) {
        return {
          ok: true,
          status: 'published',
          postUrl: linksInRow[0],
          postId: extractTikTokPostId(linksInRow[0]),
          accountHandle: detectedHandle
        }
      }

      // Nếu bài đã "Đã đăng / Công khai / Chỉ mình tôi" trên Studio Content nhưng dòng không có <a> trực tiếp -> báo cần kiểm tra trang hồ sơ /@handle!
      if (/công khai|mọi người|chỉ mình tôi|chỉ bạn|public|everyone|only you|private|đã đăng/i.test(rowText)) {
        return {
          ok: true,
          status: 'approved_need_profile_link',
          accountHandle: detectedHandle,
          message: 'TikTok đã duyệt bài! Đang mở trang cá nhân để lấy link bài chính xác...'
        }
      }
    }

    // 2. Nếu đang ở trang Profile /@handle của tài khoản đang đăng nhập
    if (/^\/@[A-Za-z0-9._-]+/i.test(location.pathname)) {
      const profileLinks = extractRealTikTokPostLinks(document)
      if (profileLinks.length > 0) {
        // Tìm bài khớp tiêu đề trước; nếu không rõ lấy bài mới nhất trên cùng
        const cards = Array.from(document.querySelectorAll('[data-e2e="user-post-item"], [class*="DivItemContainer"]'))
        for (const card of cards.slice(0, 6)) {
          const cardText = V().normalizeText(card.innerText || card.textContent || card.querySelector('a[title]')?.getAttribute('title') || '').toLowerCase()
          const cardLink = extractRealTikTokPostLinks(card)[0]
          if (cardLink && (!titleProbe || cardText.includes(titleProbe.slice(0, 12)))) {
            return {
              ok: true,
              status: 'published',
              postUrl: cardLink,
              postId: extractTikTokPostId(cardLink),
              accountHandle: detectedHandle
            }
          }
        }
        return {
          ok: true,
          status: 'published',
          postUrl: profileLinks[0],
          postId: extractTikTokPostId(profileLinks[0]),
          accountHandle: detectedHandle
        }
      }
    }

    return {
      ok: true,
      status: 'pending_review',
      accountHandle: detectedHandle,
      message: 'Đang chờ TikTok hoàn tất duyệt bài...'
    }
  }

  function extractTikTokPostId(postUrl) {
    if (!postUrl) return null
    const match = String(postUrl).match(/\/(?:video|photo)\/([0-9]+)/i)
    return match?.[1] || null
  }

  // =========================================================================
  // CÀO 10 BÀI VIRAL TIKTOK THẬT (>= 50.000 TIM • ĐƯỜNG DẪN CHÍNH XÁC 100%)
  // =========================================================================

  function extractTikTokCardMetrics(card) {
    let likes = 0
    let comments = 0
    let shares = 0

    // 1. Selector trực tiếp của TikTok Explore & For You
    const likeSelectors = [
      '[data-e2e="like-count"]',
      '[data-e2e="video-like-count"]',
      'strong[data-e2e="like-count"]',
      'strong[data-e2e="browse-like-count"]',
      '[class*="StrongCount"]',
      '[class*="LikeCount"]',
      '[class*="like-count"]'
    ]
    for (const sel of likeSelectors) {
      const el = card.querySelector(sel)
      if (el) {
        const val = V().parseHumanCount(el.innerText || el.textContent)
        if (val > likes) likes = val
      }
    }

    const commentEl = card.querySelector('[data-e2e="comment-count"], [data-e2e="browse-comment-count"]')
    if (commentEl) comments = V().parseHumanCount(commentEl.innerText || commentEl.textContent)

    const shareEl = card.querySelector('[data-e2e="share-count"], [data-e2e="browse-share-count"]')
    if (shareEl) shares = V().parseHumanCount(shareEl.innerText || shareEl.textContent)

    // 2. Fallback: Quét số tim hiển thị trên thẻ grid Explore (thường nằm cạnh icon trái tim SVG cuối card)
    if (likes === 0) {
      const smallNums = Array.from(card.querySelectorAll('strong, span'))
        .map((el) => V().normalizeText(el.innerText || el.textContent))
        .filter((t) => /^\d+(?:[.,]\d+)?\s*(k|n|nghìn|m|tr|triệu)$/i.test(t))
      for (const numStr of smallNums) {
        const val = V().parseHumanCount(numStr)
        if (val > likes) likes = val
      }
    }

    return { likes, comments, shares }
  }

  async function scrapeTikTokViralPosts(options = {}) {
    const targetCount = Number(options.targetCount) || 10
    const minLikes = Number(options.minLikes) || 50000
    const maxScrolls = Number(options.maxScrolls) || 20
    const existingUrls = new Set(options.excludeUrls || [])

    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `TIKTOK_${stable.reason}`, posts: [] }

    const collected = []
    const seenUrls = new Set(existingUrls)

    V().reportStep('tiktok', 'scrape_viral', `Đang cào bài viral TikTok (mục tiêu ${targetCount} bài, >= ${(minLikes / 1000).toLocaleString('vi-VN')}K tim)...`)

    for (let round = 0; round < maxScrolls && collected.length < targetCount; round++) {
      const health = V().inspectPageHealth()
      if (health.isOffline) {
        V().reportStep('tiktok', 'network', 'Tab cào TikTok mất mạng, đang chờ phục hồi...', 'warn')
        await V().waitForPageStable('tiktok', { maxWaitMs: 20000 })
      }
      if (health.isCaptchaOrCheckpoint) {
        V().reportStep('tiktok', 'captcha', 'TikTok yêu cầu xác minh Captcha trên tab cào — trả về các bài đã thu được.', 'warn')
        break
      }

      const cards = Array.from(
        document.querySelectorAll(
          'div[data-e2e="explore-item"], div[data-e2e="recommend-list-item-container"], article[data-e2e="recommend-list-item-container"], div[class*="DivItemContainer"], article[data-e2e]'
        )
      )

      for (const card of cards) {
        if (collected.length >= targetCount) break
        try {
          const linkEl = card.querySelector('a[href*="/video/"], a[href*="/photo/"]')
          const postUrl = linkEl ? cleanTikTokPostUrl(linkEl.href) : null
          if (!postUrl || !isRealTikTokPostUrl(postUrl) || seenUrls.has(postUrl)) continue

          const metrics = extractTikTokCardMetrics(card)
          if (metrics.likes < minLikes) continue

          const titleEl = card.querySelector('[data-e2e="explore-card-desc"], [data-e2e="video-desc"], a[title], h1, span[class*="SpanText"]')
          const rawTitle = V().normalizeText(
            titleEl?.getAttribute?.('title') || titleEl?.innerText || titleEl?.textContent || ''
          )

          const authorMatch = postUrl.match(/tiktok\.com\/(@[A-Za-z0-9._-]+)\//i)
          const authorEl = card.querySelector('[data-e2e="explore-card-user-unique-id"], [data-e2e="video-author-uniqueid"], p[data-e2e="explore-card-user-unique-id"]')
          const author = V().normalizeText(authorEl?.textContent || '') || (authorMatch ? authorMatch[1] : '@creator')
          const isPhoto = postUrl.includes('/photo/')

          seenUrls.add(postUrl)
          collected.push({
            id: `tt-viral-${Date.now()}-${collected.length}`,
            title: V().truncateClean(rawTitle || `Video TikTok Viral từ ${author}`, 105),
            platform: 'tiktok',
            category: isPhoto ? 'Ảnh Viral TikTok' : 'Video Viral TikTok',
            postUrl,
            summary: V().truncateClean(
              `[${author}] ${rawTitle || 'Nội dung thịnh hành'} • Đạt ${metrics.likes.toLocaleString('vi-VN')} tim`,
              260
            ),
            viralityScore: Math.min(99, 88 + Math.min(11, Math.floor(Math.log10(metrics.likes) * 2))),
            likesCount: metrics.likes,
            sharesCount: metrics.shares,
            commentsCount: metrics.comments,
            trendingTopic: `${(metrics.likes / 1000).toFixed(0)}K+ tim TikTok`,
            createdAt: new Date().toISOString()
          })

          V().highlightTarget(card, `🔥 TikTok Viral ${collected.length}/${targetCount} (${metrics.likes.toLocaleString('vi-VN')} ♥)`, '#fe2c55')
          V().reportStep(
            'tiktok',
            'scrape_viral',
            `🎵 TikTok Viral: đã tìm thấy ${collected.length}/${targetCount} bài (>= ${(minLikes / 1000)}K tim)...`
          )
        } catch (_) {}
      }

      if (collected.length >= targetCount) break

      window.scrollBy({ top: 900 + Math.round(Math.random() * 550), behavior: 'smooth' })
      await V().humanDelay(1600, 2600)
    }

    V().clearHud(3500)
    return {
      ok: true,
      posts: collected,
      scannedUrl: location.href,
      reachedTarget: collected.length >= targetCount
    }
  }
})()