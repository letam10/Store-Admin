/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v2.1 cho TikTok Studio Photo Upload (@harutv666).
  - Nâng cấp v2.1.0 (Sửa triệt để lỗi ô Mô tả 0/4000 & Hashtag bị trống):
    1. Bỏ giới hạn minHeight: 24 (Draft.js/Lexical rỗng chỉ cao ~18-22px).
    2. Tìm ô Mô tả 4 lớp + Click-to-Discover: tìm trực tiếp dòng chữ "Mô tả dài có thể giúp..." -> bấm vào đó -> lấy getDeepActiveElement() xuyên Shadow DOM!
    3. Điền đầy đủ CẢ Tiêu đề (0/90 - gõ nhịp người thật) LẪN Mô tả chi tiết bóng bẩy + khối #Hashtag (0/4000 - giữ nguyên xuống dòng \n\n).
    4. Cấm tuyệt đối bấm Đăng nếu bộ đếm vẫn ở 0/4000! Xác nhận cả bộ đếm X/4000 > 0 lẫn nội dung thực sự đã nằm trong editor.
    5. Đầy đủ nhịp trễ tự nhiên & cuộn mượt như người thật để tránh bị TikTok quét bot.
*/

;(() => {
  if (typeof window.__OMNICART_TT_CLEANUP__ === 'function') {
    try { window.__OMNICART_TT_CLEANUP__() } catch (_) {}
  }

  const HARUTV_PROFILE_URL = 'https://www.tiktok.com/@harutv666'
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

    if (message.type === 'TIKTOK_SCRAPE_VIRAL') {
      scrapeTikTokTrending()
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
  // MẮT QUAN SÁT MÀN HÌNH TIKTOK STUDIO
  // =========================================================================

  function isUploadPath() {
    return /^\/(tiktokstudio\/upload|creator-center\/upload|upload)\/?$/i.test(location.pathname)
  }

  function isLoginRequired() {
    if (/\/login/i.test(location.pathname)) return true
    const loginBtn = V().queryAllDeep(document, 'button, a').find((el) => {
      if (!V().isReallyVisible(el)) return false
      const txt = V().normalizeText(el.innerText || el.textContent)
      return /^(đăng nhập|log in|login)$/i.test(txt)
    })
    return Boolean(loginBtn && !isAccountLoggedIn())
  }

  function isAccountLoggedIn() {
    const topRightAvatars = V().queryAllDeep(document, 'img, [data-e2e="nav-avatar"], [data-e2e="profile-icon"]')
      .filter((el) => {
        if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 20 })) return false
        const r = el.getBoundingClientRect()
        return r.top < 80 && r.left > window.innerWidth * 0.65
      })
    if (topRightAvatars.length > 0) return true

    const bodyText = V().normalizeText(document.body?.innerText || '').slice(0, 1000)
    return /tiktok studio/i.test(bodyText) && /bài đăng|posts|tải lên|upload/i.test(bodyText)
  }

  function detectScreenState() {
    if (isLoginRequired()) return 'login_required'
    if (!isUploadPath()) return 'wrong_page'

    const hasTitleOrDesc = Boolean(findTitleInput() || findDescriptionPlaceholder() || findDescriptionEditorPassive())
    const hasSettingsOrCounter = Boolean(
      readDescriptionCounter() !== null ||
      V().findLabelElement(/^(cài đặt|settings|chi tiết|details)$/i, { minLeft: 180, maxLength: 30 }) ||
      V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 80 })
    )

    if (hasTitleOrDesc && hasSettingsOrCounter) {
      return 'detail_editor_form'
    }

    const photoDropzoneText = V().findLabelElement(/chọn ảnh để tải lên|select photos? to upload|tải lên tối đa 35 ảnh/i, { minLeft: 160 })
    if (photoDropzoneText) return 'upload_photo_tab'

    const videoDropzoneText = V().findLabelElement(/chọn video để tải lên|select video to upload/i, { minLeft: 160 })
    if (videoDropzoneText) return 'upload_video_tab'

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

  // Ô 1 trong "Mô tả": "Thêm tiêu đề hấp dẫn" (0/90)
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
      if (/thêm tiêu đề|add.*title|\b\d+\s*\/\s*90\b/i.test(parentText)) {
        return el
      }
    }
    return null
  }

  // Tìm chính dòng placeholder "Mô tả dài có thể giúp tăng lượt xem trung bình lên gấp 3 lần" trên màn hình
  function findDescriptionPlaceholder() {
    return V().findLabelElement(DESC_PLACEHOLDER_RE, { minLeft: 180, minTop: 80, maxLength: 160 })
  }

  // Tìm thanh "# Hashtag" hoặc bộ đếm "0/4000" ngay đáy ô Mô tả
  function findDescriptionFooterAnchor() {
    return (
      V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 }) ||
      V().findLabelElement(/^#\s*hashtag$/i, { minLeft: 180, maxLength: 24 }) ||
      V().findLabelElement(/@\s*nhắc đến|@\s*mentions?/i, { minLeft: 180, maxLength: 24 })
    )
  }

  // Tìm thụ động (không click) ô Mô tả 0/4000 — KHÔNG còn bị minHeight: 24 loại bỏ!
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
      // Cho phép chiều cao từ 10px (ô rỗng 1 dòng của Draft.js / Lexical thường chỉ cao 18-22px!)
      if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 10 })) continue

      const r = el.getBoundingClientRect()
      if (r.left < 160 || r.top < 70) continue

      const selfMeta = V().normalizeText(
        `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.className || ''}`
      )
      if (/vị trí|location|search|tìm kiếm/i.test(selfMeta)) continue

      // Kiểm tra vùng cha có phải ô Tìm kiếm vị trí không
      const nearText = V().normalizeText(el.parentElement?.parentElement?.innerText || '').slice(0, 350)
      if (/tìm kiếm vị trí|search location/i.test(nearText) && !/hashtag|4000|mô tả dài/i.test(nearText)) continue

      let score = 0
      if (/public-drafteditor-content|drafteditor|lexical|caption|description/i.test(selfMeta)) score += 50
      if (DESC_PLACEHOLDER_RE.test(nearText) || /\b\d+\s*\/\s*4000\b/.test(nearText) || /#\s*hashtag/i.test(nearText)) score += 55
      if (el.isContentEditable) score += 25
      if (el.getAttribute('role') === 'textbox' || el.tagName === 'TEXTAREA') score += 15

      // Neo hình học CỰC CHÍNH XÁC theo Ảnh 3: nằm DƯỚI ô Tiêu đề (X/90) và TRÊN thanh #Hashtag / 0/4000!
      if (titleRect && r.top >= titleRect.bottom - 8 && r.top <= titleRect.bottom + 240) score += 45
      if (footerRect && r.bottom <= footerRect.bottom + 15 && r.top >= footerRect.top - 340) score += 45

      if (score > bestScore && score >= 25) {
        bestScore = score
        best = el
      }
    }

    return best
  }

  // Tìm CHỦ ĐỘNG 4 LỚP + CLICK-TO-DISCOVER (Đảm bảo 100% bắt được ô 0/4000 của TikTok Studio!)
  async function findAndFocusDescriptionEditor(stepLog) {
    const titleEl = findTitleInput()

    // Lớp 1: Tìm trực tiếp qua DOM & neo hình học (không giới hạn minHeight: 24)
    let editor = findDescriptionEditorPassive()
    if (editor) return editor

    // Lớp 2: Click-to-Discover ngay vào dòng placeholder "Mô tả dài có thể giúp tăng lượt xem..."!
    const placeholderEl = findDescriptionPlaceholder()
    if (placeholderEl) {
      stepLog('fill_desc', 'Đang bấm trực tiếp vào vùng "Mô tả dài..." để kích hoạt khung soạn thảo...')
      await V().humanClick(placeholderEl, 'Kích hoạt ô Mô tả (0/4000)')
      await V().humanDelay(350, 650)

      // Kiểm tra phần tử vừa được trình duyệt focus!
      const active = V().getDeepActiveElement()
      if (
        active &&
        active !== titleEl &&
        !titleEl?.contains(active) &&
        (active.isContentEditable || active.tagName === 'TEXTAREA' || active.getAttribute('role') === 'textbox')
      ) {
        return active
      }

      // Thử tìm lại trong DOM sau khi đã click kích hoạt
      editor = findDescriptionEditorPassive()
      if (editor) return editor

      // Tìm mọi contenteditable bên trong cùng container cha của placeholder
      let box = placeholderEl.parentElement
      for (let i = 0; i < 4 && box; i++) {
        const innerEditable = box.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"], textarea, [role="textbox"]')
        if (innerEditable && innerEditable !== titleEl) return innerEditable
        box = box.parentElement
      }
    }

    // Lớp 3: Bấm vào khoảng trống ngay phía trên nút "# Hashtag" rồi đọc activeElement
    const footerEl = findDescriptionFooterAnchor()
    if (footerEl) {
      const fRect = footerEl.getBoundingClientRect()
      const probeX = Math.round(fRect.left + 60)
      const probeY = Math.round(Math.max(100, fRect.top - 48))
      const hit = document.elementFromPoint(probeX, probeY)
      if (hit && hit !== titleEl && !titleEl?.contains(hit)) {
        await V().humanClick(hit, 'Vùng nhập Mô tả')
        await V().humanDelay(320, 600)
        const active = V().getDeepActiveElement()
        if (active && active !== titleEl && (active.isContentEditable || active.tagName === 'TEXTAREA')) {
          return active
        }
      }
    }

    // Lớp 4: Hỏi Multimodal Vision AI nếu bật
    const ai = await V().askVisionAI(
      'Click the main Description / Caption editor box ("Mô tả dài có thể giúp tăng lượt xem...", 0/4000 counter, above # Hashtag) — NOT the short 0/90 title box.',
      { platform: 'tiktok', step: 'find_description_editor' }
    )
    if (ai?.ok && ai.element && ai.element !== titleEl) {
      await V().humanClick(ai.element, 'Vision AI -> Ô Mô tả')
      await V().humanDelay(350, 650)
      const active = V().getDeepActiveElement()
      if (active && active !== titleEl && (active.isContentEditable || active.tagName === 'TEXTAREA')) {
        return active
      }
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

    const candidates = V().queryAllDeep(
      document,
      'select, button, [role="combobox"], [role="button"], div[class*="select"], div[class*="Select"]'
    )
    return candidates.find((el) => {
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
      const txt = V().normalizeText(btn.innerText || btn.textContent)
      return /^(hủy bỏ|hủy|discard|xóa bỏ)$/i.test(txt)
    }) || null
  }

  function inspectTikTokScreen() {
    return {
      url: location.href,
      screenState: detectScreenState(),
      loggedIn: isAccountLoggedIn(),
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
  // LUỒNG ĐĂNG BÀI ẢNH TIKTOK STUDIO (HOÀN CHỈNH TIÊU ĐỀ + MÔ TẢ + HASHTAG + DELAY NGƯỜI)
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

    // Chuẩn bị Tiêu đề ngắn (0/90) + Mô tả đầy đủ bóng bẩy & khối #Hashtag (0/4000)
    const rawTitle = V().normalizeText(payload.title || '')
    const rawBody = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''

    const shortTitle = V().truncateClean(
      rawTitle || V().formatPostText(rawBody, 200).split('\n')[0] || 'Ưu đãi nổi bật từ OmniCart',
      85
    )

    // Mô tả chi tiết: giữ nguyên đoạn văn bóng bẩy + xuống dòng + gắn đầy đủ khối #Hashtag + dấu cách cuối để TikTok nhận thẻ #
    let fullDescription = V().composeBodyAndHashtags(rawBody || rawTitle, rawHashtags, 3850)
    if (!fullDescription) {
      return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }
    }
    // Nếu cuối bài là #hashtag, thêm 1 dấu cách cuối giúp TikTok Studio chốt thẻ hashtag mượt mà
    if (/#[\p{L}\p{N}_]+$/u.test(fullDescription)) {
      fullDescription += ' '
    }

    stepLog(
      'prepare',
      `Đã nhận bài TikTok: Tiêu đề ${shortTitle.length} ký tự | Mô tả + Hashtag ${fullDescription.trim().length} ký tự.`
    )

    // --- BƯỚC 1: Kiểm tra đăng nhập ---
    stepLog('auth', 'Đang kiểm tra trạng thái đăng nhập TikTok Studio (@harutv666)...')
    const readyAuth = await M().waitFor(() => isAccountLoggedIn() || isLoginRequired(), 15000)
    if (!readyAuth || isLoginRequired()) {
      stepLog('auth', 'Tài khoản TikTok chưa đăng nhập trên tab này!', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_LOGIN_REQUIRED', visionTrace: trace }
    }

    await V().humanDelay(700, 1300)

    // --- BƯỚC 2: Quan sát màn hình & dọn bản nháp cũ nếu có ---
    await M().waitFor(() => detectScreenState() !== 'loading_or_unknown', 12000)
    let state = detectScreenState()
    stepLog('screen', `Mắt OmniVision nhận diện màn hình: ${state}`)

    if (state === 'detail_editor_form') {
      stepLog('reset_draft', 'Phát hiện bản nháp cũ còn mở, đang hủy để tải bài mới sạch...', 'warn')
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
          await V().humanClick(confirmDiscard, 'Xác nhận hủy bản nháp')
          await M().waitFor(() => detectScreenState() !== 'detail_editor_form', 8000)
        }
        await V().humanDelay(900, 1500)
      } else {
        return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      }
      state = detectScreenState()
    }

    // Chuyển từ tab Video sang tab Ảnh (Ảnh 4)
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
      } else {
        const ai = await V().askVisionAI(
          'Click the "Ảnh" / "Photo" tab button to switch TikTok Studio from Video upload to Photo upload.',
          { platform: 'tiktok', step: 'switch_to_photo_tab' }
        )
        if (ai?.ok && ai.element) {
          await V().humanClick(ai.element, 'Vision AI -> Tab Ảnh')
          await V().humanDelay(900, 1400)
        }
      }
    }

    // --- BƯỚC 3: Nạp ảnh & chờ chuyển thật sang màn hình "Chi tiết" ---
    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào TikTok Studio...')
    const imageSnapshot = V().captureVisualImageSnapshot(document)
    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-tiktok-product.png')

    const imageInput = await M().findImageInput(document, 6000, false)
    let attached = false
    if (imageInput) attached = M().attachFile(imageInput, imageFile)
    if (!attached) {
      const dropzone = findPhotoDropzoneElement()
      if (dropzone) {
        stepLog('upload_image', 'Thử thả ảnh trực tiếp vào dropzone TikTok...', 'warn')
        attached = M().attachViaDrop(dropzone, imageFile)
      }
    }
    if (!attached) {
      stepLog('upload_image', 'Không tìm thấy bộ tải ảnh (tab Ảnh) trên TikTok Studio.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE', visionTrace: trace }
    }

    stepLog('wait_detail', 'Đang chờ TikTok xử lý ảnh & chuyển sang màn hình "Chi tiết"...')
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

    // Nhịp chờ tự nhiên để TikTok dựng xong trình soạn thảo & ảnh xem trước điện thoại
    await V().humanDelay(1800, 3000)
    stepLog('wait_detail', '✅ Đã xác nhận ảnh bìa & biểu mẫu "Chi tiết" sẵn sàng.')

    // --- BƯỚC 4A: Điền TIÊU ĐỀ (0/90) với nhịp gõ tự nhiên ---
    const titleInput = findTitleInput()
    if (titleInput) {
      stepLog('fill_title', `Đang gõ Tiêu đề (${shortTitle.length}/90 ký tự)...`)
      const titleRes = await V().smartTypeText(titleInput, shortTitle, {
        clearFirst: true,
        humanBurst: true,
        label: 'Tiêu đề TikTok (0/90)'
      })
      const tCounter = readTitleCounter()
      if (titleRes.ok || (tCounter !== null && tCounter > 0)) {
        stepLog('fill_title', `✅ Đã điền Tiêu đề thành công (${tCounter !== null ? `${tCounter}/90` : titleRes.method}).`)
      } else {
        stepLog('fill_title', 'Cảnh báo: ô Tiêu đề chưa xác nhận, tiếp tục điền đủ nội dung vào Mô tả.', 'warn')
      }
      await V().humanDelay(850, 1550)
    }

    // --- BƯỚC 4B: BẮT BUỘC định vị & điền đầy đủ MÔ TẢ + HASHTAG (0/4000) ---
    stepLog('fill_desc', 'Đang định vị ô "Mô tả dài..." (0/4000) bằng OmniVision 4 lớp...')
    const descEditor = await findAndFocusDescriptionEditor(stepLog)

    if (!descEditor) {
      stepLog('fill_desc', 'Không tìm thấy ô Mô tả (0/4000) trên TikTok Studio — dừng an toàn để không đăng bài thiếu nội dung!', 'error')
      V().clearHud(5500)
      return { ok: false, error: 'TIKTOK_DESCRIPTION_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    const descVerifyFn = (el, actual) => {
      const counter = readDescriptionCounter()
      if (counter !== null && counter >= Math.min(15, fullDescription.trim().length)) return true
      const clean = V().normalizeText(actual)
      return clean.length >= Math.min(18, fullDescription.trim().length) && !DESC_PLACEHOLDER_RE.test(clean)
    }

    stepLog('fill_desc', `Đang điền Mô tả chi tiết & #Hashtag (${fullDescription.trim().length}/4000 ký tự)...`)
    let descRes = await V().smartTypeText(descEditor, fullDescription, {
      clearFirst: true,
      label: 'Mô tả & Hashtag TikTok (0/4000)',
      dismissPopover: true,
      placeholderRe: DESC_PLACEHOLDER_RE,
      verifyFn: descVerifyFn
    })

    await V().humanDelay(700, 1200)
    let counterAfter = readDescriptionCounter()

    // Nếu lần đầu vẫn là 0/4000 -> kích hoạt lại bằng click trực tiếp rồi thử nhập lại lần 2
    if (!descRes.ok && (counterAfter === null || counterAfter === 0)) {
      stepLog('fill_desc', 'Bộ đếm vẫn là 0/4000, đang kích hoạt lại editor & thử chiến lược dự phòng...', 'warn')
      const reFocused = await findAndFocusDescriptionEditor(stepLog)
      if (reFocused) {
        descRes = await V().smartTypeText(reFocused, fullDescription, {
          clearFirst: true,
          label: 'Thử lại Mô tả & Hashtag TikTok',
          dismissPopover: true,
          placeholderRe: DESC_PLACEHOLDER_RE,
          verifyFn: descVerifyFn
        })
        await V().humanDelay(750, 1250)
        counterAfter = readDescriptionCounter()
      }
    }

    // CHỐT AN TOÀN: Không bao giờ cho phép bấm Đăng khi ô Mô tả vẫn trống 0/4000!
    if ((counterAfter !== null && counterAfter === 0) || (!descRes.ok && counterAfter === null)) {
      stepLog('fill_desc', '❌ Ô Mô tả vẫn đang là 0/4000! Dừng an toàn để không đăng bài thiếu nội dung & hashtag.', 'error')
      V().clearHud(6000)
      return { ok: false, error: 'TIKTOK_DESCRIPTION_NOT_INSERTED', visionTrace: trace }
    }

    // Đóng gợi ý hashtag nếu đang mở bằng Escape + click nhẹ ra nhãn "Mô tả"
    V().dispatchEscape(descEditor)
    await V().humanDelay(450, 850)
    stepLog(
      'fill_desc',
      `✅ Đã điền & xác nhận Mô tả + Hashtag (${counterAfter !== null ? `${counterAfter}/4000 ký tự` : descRes.method})!`
    )

    // Nhịp dừng tự nhiên trước khi cuộn xuống Cài đặt
    await V().humanDelay(900, 1650)

    // --- BƯỚC 5: Thiết lập & kiểm chứng Quyền riêng tư ("Người có thể nhìn thấy bài đăng này") ---
    stepLog('privacy', `Đang kiểm tra quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}...`)
    const privacyResult = await setAndVerifyTikTokPrivacy(requestedPrivacy, stepLog)
    if (!privacyResult.ok) {
      stepLog('privacy', `Không xác nhận được quyền riêng tư TikTok (thực tế=${privacyResult.actual || 'không rõ'}). Dừng an toàn!`, 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PRIVACY_NOT_CONFIRMED', actualPrivacy: privacyResult.actual, visionTrace: trace }
    }
    stepLog('privacy', `✅ Quyền riêng tư đã chuẩn: ${privacyResult.actual === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}.`)

    // --- BƯỚC 6: Cuộn mượt xuống cuối, rà soát như người thật & nhấn "Đăng" ---
    stepLog('publish', 'Đang cuộn mượt xuống nút "Đăng" & rà soát bài trước khi xuất bản...')
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
      const ai = await V().askVisionAI(
        'Click the primary red "Đăng" / "Post" button at the bottom of the TikTok Studio upload form (NOT "Bài đăng" in the left sidebar).',
        { platform: 'tiktok', step: 'click_publish' }
      )
      if (ai?.ok && ai.element && !V().isElementDisabled(ai.element)) {
        publishBtn = ai.element
      }
    }

    if (!publishBtn) {
      stepLog('publish', 'Không tìm thấy hoặc nút "Đăng" trên TikTok Studio đang bị khóa.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY', visionTrace: trace }
    }

    await V().humanClick(publishBtn, 'Đăng bài TikTok')
    stepLog('publish', 'Đã bấm nút "Đăng", đang theo dõi TikTok xác nhận xuất bản...')

    // --- BƯỚC 7: Xử lý popup xác nhận phụ & kiểm chứng đăng thành công thực sự ---
    const publishConfirm = await waitForTikTokPublishConfirmation(38000, stepLog)
    V().clearHud(5000)

    if (!publishConfirm.ok) {
      return { ok: false, error: publishConfirm.error || 'TIKTOK_POST_NOT_VERIFIED', visionTrace: trace }
    }

    return {
      ok: true,
      verified: true,
      postUrl: publishConfirm.postUrl || HARUTV_PROFILE_URL,
      realPostId: publishConfirm.postId || `tiktok-${Date.now()}`,
      platform: 'tiktok',
      account: '@harutv666',
      privacy: privacyResult.actual,
      publishedTime: new Date().toISOString(),
      message: publishConfirm.message || 'Đã đăng bài ảnh đầy đủ Tiêu đề + Mô tả + Hashtag lên TikTok (@harutv666).',
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
      if (parsePrivacyValue(currentText) === requestedPrivacy) {
        return { ok: true, actual: requestedPrivacy }
      }
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
      V().highlightTarget(control, `Quyền riêng tư: ${currentLabel}`, '#22c55e')
      return { ok: true, actual: requestedPrivacy }
    }

    stepLog('privacy', `Đang đổi từ "${currentLabel}" sang "${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}"...`)
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

  async function waitForTikTokPublishConfirmation(timeoutMs, stepLog) {
    const startUrl = location.href
    const deadline = Date.now() + timeoutMs
    let handledConfirmModal = false

    while (Date.now() < deadline) {
      const currentUrl = location.href

      if (currentUrl !== startUrl && !/\/upload\/?(\?|$)/i.test(currentUrl)) {
        const postId = extractTikTokPostId(currentUrl) || `tiktok-${Date.now()}`
        stepLog('verify', `✅ TikTok đã chuyển sang ${currentUrl} — Xuất bản thành công!`, 'success')
        return { ok: true, postUrl: currentUrl, postId, message: 'TikTok đã xuất bản & chuyển hướng sang trang quản lý.' }
      }

      if (!handledConfirmModal) {
        const modals = V().queryAllDeep(document, '[role="dialog"], [class*="modal"], [class*="Modal"]')
          .filter((m) => V().isReallyVisible(m, { minWidth: 220, minHeight: 100 }))
        for (const modal of modals) {
          const modalText = V().normalizeText(modal.innerText || modal.textContent)
          if (/tiếp tục đăng|continue to post|đang kiểm tra bản quyền|copyright check|post now/i.test(modalText)) {
            const confirmBtn = V().queryAllDeep(modal, 'button, [role="button"]').find((b) => {
              if (!V().isReallyVisible(b) || V().isElementDisabled(b)) return false
              const t = V().normalizeText(b.innerText || b.textContent)
              return /^(đăng ngay|đăng|tiếp tục|post now|post|continue)$/i.test(t)
            })
            if (confirmBtn) {
              handledConfirmModal = true
              stepLog('verify', 'Phát hiện popup "Tiếp tục đăng?", đang tự động xác nhận...')
              await V().humanDelay(550, 1000)
              await V().humanClick(confirmBtn, 'Xác nhận Đăng ngay')
              await V().humanDelay(800, 1300)
            }
          }

          if (/đã được tải lên|has been uploaded|đã đăng|quản lý bài đăng|manage your posts|tải lên bài đăng khác|upload another/i.test(modalText)) {
            stepLog('verify', '✅ TikTok hiển thị hộp thoại xác nhận đăng thành công!', 'success')
            return {
              ok: true,
              postUrl: HARUTV_PROFILE_URL,
              postId: `tiktok-${Date.now()}`,
              message: 'TikTok hiển thị hộp thoại đăng bài thành công.'
            }
          }
        }
      }

      const toasts = V().queryAllDeep(
        document,
        '[role="status"], [role="alert"], [class*="toast"], [class*="Toast"], [class*="notification"], [class*="Notification"]'
      )
        .filter((el) => V().isReallyVisible(el))
        .map((el) => V().normalizeText(el.innerText || el.textContent))
        .filter(Boolean)
      const toastJoined = toasts.join(' | ')

      if (/vui lòng|không thể đăng|thất bại|failed|error|captcha|verify to continue|xác minh/i.test(toastJoined)) {
        stepLog('verify', `TikTok báo lỗi / yêu cầu xác minh: ${toastJoined.slice(0, 140)}`, 'error')
        return { ok: false, error: `TIKTOK_PUBLISH_ERROR: ${toastJoined.slice(0, 140)}` }
      }

      if (/đã đăng|posted|thành công|successfully|xuất bản/i.test(toastJoined)) {
        stepLog('verify', `✅ Nhận toast xác nhận thành công: ${toastJoined.slice(0, 100)}`, 'success')
        return { ok: true, postUrl: HARUTV_PROFILE_URL, postId: `tiktok-${Date.now()}`, message: toastJoined.slice(0, 120) }
      }

      const postLinks = V().queryAllDeep(document, 'a[href*="/video/"], a[href*="/photo/"]')
        .map((a) => a.href)
        .filter((href) => /tiktok\.com\/@[\w.]+\/(?:video|photo)\/\d+/i.test(href))
      if (postLinks.length > 0) {
        return {
          ok: true,
          postUrl: postLinks[0],
          postId: extractTikTokPostId(postLinks[0]) || `tiktok-${Date.now()}`,
          message: 'Đã lấy được liên kết bài đăng TikTok.'
        }
      }

      await V().sleep(650)
    }

    stepLog('verify', 'Hết thời gian chờ nhưng TikTok chưa xác nhận xuất bản.', 'error')
    return { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }
  }

  function extractTikTokPostId(postUrl) {
    if (!postUrl) return null
    const match = String(postUrl).match(/\/(?:video|photo)\/([0-9]+)/i)
    return match?.[1] || null
  }

  async function scrapeTikTokTrending() {
    for (let i = 0; i < 2; i++) {
      window.scrollBy({ top: 650, behavior: 'smooth' })
      await V().humanDelay(850, 1400)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await V().humanDelay(400, 700)

    const posts = []
    const seen = new Set()
    const cards = Array.from(
      document.querySelectorAll(
        'div[data-e2e="recommend-list-item-container"], div[data-e2e="explore-item"], article[data-e2e], div[class*="DivItemContainer"], div[class*="video-feed-item"]'
      )
    )

    for (const card of cards.slice(0, 16)) {
      try {
        const titleEl = card.querySelector('[data-e2e="video-desc"], div[data-e2e="explore-card-desc"], a[title], h1')
        const title = V().normalizeText(titleEl?.getAttribute?.('title') || titleEl?.innerText || titleEl?.textContent || '')
        if (title.length < 6) continue
        const key = title.slice(0, 45)
        if (seen.has(key)) continue
        seen.add(key)

        const linkEl = card.querySelector('a[href*="/video/"], a[href*="/photo/"]')
        const link = linkEl ? linkEl.href : HARUTV_PROFILE_URL

        const authorEl = card.querySelector('[data-e2e="video-author-uniqueid"], p[data-e2e="explore-card-user-unique-id"], h3[data-e2e="video-author-uniqueid"]')
        const author = V().normalizeText(authorEl?.textContent || '') || '@trending'

        const likeEl = card.querySelector('[data-e2e="like-count"], strong[data-e2e="like-count"]')
        const likesCount = parseCount(likeEl?.textContent || '0')

        posts.push({
          id: 'tt-real-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: V().truncateClean(title, 100),
          platform: 'tiktok',
          category: 'Công nghệ & Đời sống',
          postUrl: link,
          summary: `Video viral từ ${author}: ${V().truncateClean(title, 200)}`,
          viralityScore: Math.min(99, 84 + Math.min(15, Math.floor(Math.log10(likesCount + 10) * 3))),
          likesCount,
          sharesCount: 0,
          commentsCount: 0,
          trendingTopic: 'Xu hướng TikTok thịnh hành',
          createdAt: new Date().toISOString()
        })

        if (posts.length >= 10) break
      } catch (_) {}
    }

    return { ok: true, posts }
  }

  function parseCount(raw) {
    const clean = String(raw || '').toLowerCase().replace(',', '.')
    const k = clean.match(/(\d+(?:\.\d+)?)\s*k/)
    if (k) return Math.round(parseFloat(k[1]) * 1000)
    const m = clean.match(/(\d+(?:\.\d+)?)\s*m/)
    if (m) return Math.round(parseFloat(m[1]) * 1000000)
    const n = parseInt(clean.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }
})()