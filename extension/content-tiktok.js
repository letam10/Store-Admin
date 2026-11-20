/*

  FILE NOTE

  - Mục đích: Content Script OmniVision v3.1 cho TikTok (Đa tài khoản — không hardcode @username).

  - Nâng cấp v3.1.0:

    1. Khi đang ở Trang chủ TikTok Studio (/tiktokstudio) hoặc Bài đăng (/tiktokstudio/content): tự bấm nút đỏ "+ Tải lên" -> "Ảnh" trực tiếp (SPA) không cần mở trang mới!

    2. Kiểm tra duyệt bài ngay trên Trang chủ / Bài đăng TikTok Studio (Ảnh 8 - không phụ thuộc thẻ <tr>!): phát hiện ngay khi bài đã chuyển sang "Mọi người" / "Chỉ mình tôi" -> lấy link thật qua menu "•••" hoặc /profile -> báo cáo Đăng thành công ngay lập tức!

    3. Cào 10 bài Viral TikTok (>= 50K tim) với bộ đếm trượt 5 phút + đọc caption thật từ img[alt] + bấm xoay vòng các danh mục trên Explore để lần 2, lần 3 KHÔNG BAO GIỜ TRÙNG!

*/



;(() => {

  if (typeof window.__OMNICART_TT_CLEANUP__ === 'function') {

    try { window.__OMNICART_TT_CLEANUP__() } catch (_) {}

  }



  const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'

  const PUBLIC_RE = /mọi người|công khai|everyone|public/i

  const ONLY_ME_RE = /chỉ mình tôi|chỉ bạn|chỉ mình\s*\.{0,3}|only you|only me|private/i

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

  // NHẬN DIỆN TÀI KHOẢN & ĐIỀU HƯỚNG SPA TRONG TIKTOK STUDIO

  // =========================================================================



  function isUploadPath() {

    return /^\/(tiktokstudio\/upload|creator-center\/upload|upload)\/?$/i.test(location.pathname)

  }



  function isTikTokStudioPage() {

    return /^\/(tiktokstudio|creator-center)/i.test(location.pathname)

  }



  function detectCurrentTikTokHandle() {

    const pathMatch = location.pathname.match(/^\/(@[A-Za-z0-9._-]+)/)

    if (pathMatch) return pathMatch[1]



    const profileLinks = Array.from(document.querySelectorAll('a[href*="/@"]'))

      .map((a) => {

        const m = String(a.getAttribute('href') || a.href || '').match(/\/(@[A-Za-z0-9._-]+)/)

        return m ? m[1] : null

      })

      .filter(Boolean)

    if (profileLinks.length > 0) return profileLinks[0]



    const previewAuthor = V().queryAllDeep(document, '[class*="author"], [class*="Author"], [aria-label*="@"]')

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

    const loginBtn = V().queryAllDeep(document, 'button, a').find((el) =>

      V().isReallyVisible(el) && /^(đăng nhập|log in|login)$/i.test(V().normalizeText(el.innerText || el.textContent))

    )

    return Boolean(loginBtn && !isAccountLoggedIn())

  }



  // Bấm nút đỏ "+ Tải lên" góc trên bên trái TikTok Studio (Ảnh 8) -> chọn "Ảnh" (SPA không tải lại trang!)

  async function clickStudioSidebarUploadPhoto(stepLog) {

    const uploadBtn = V().queryAllDeep(document, 'button, [role="button"], a').find((el) => {

      if (!V().isReallyVisible(el, { minWidth: 70, minHeight: 28 })) return false

      const r = el.getBoundingClientRect()

      if (r.left > 240 || r.top > 180) return false

      return /^(\+?\s*tải lên|\+?\s*upload)$/i.test(V().normalizeText(el.innerText || el.textContent))

    })

    if (!uploadBtn) return false



    stepLog('nav', 'Đang ở TikTok Studio, tự bấm nút "+ Tải lên" để chọn đăng Ảnh (không mở trang mới)...')

    await V().humanClick(uploadBtn, '+ Tải lên')

    await V().humanDelay(550, 950)



    // Nếu xổ dropdown "Video / Ảnh" -> bấm ngay "Ảnh"

    const photoOption = V().queryAllDeep(document, '[role="menuitem"], [role="option"], button, a, div, span').find((el) => {

      if (!V().isReallyVisible(el, { minWidth: 30, minHeight: 18 })) return false

      const r = el.getBoundingClientRect()

      if (r.left > 260 || r.top < 80 || r.top > 320) return false

      return /^(ảnh|photo|photos)$/i.test(V().normalizeText(el.innerText || el.textContent))

    })

    if (photoOption) {

      await V().humanClick(photoOption, 'Chọn mục Ảnh')

    }



    await M().waitFor(() => isUploadPath() || detectScreenState() === 'upload_photo_tab' || detectScreenState() === 'upload_video_tab', 10000)

    await V().humanDelay(800, 1400)

    return isUploadPath()

  }



  // Bấm nút "Trang chủ" hoặc "Bài đăng" ở cột trái TikTok Studio (Ảnh 8) để làm mới danh sách duyệt

  async function clickStudioSidebarTab(targetRe) {

    const navBtn = V().queryAllDeep(document, 'a, button, [role="button"], div, span').find((el) => {

      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 20 })) return false

      const r = el.getBoundingClientRect()

      if (r.left > 220 || r.top < 110 || r.top > 340) return false

      return targetRe.test(V().normalizeText(el.innerText || el.textContent))

    })

    if (!navBtn) return false

    await V().humanClick(navBtn, V().normalizeText(navBtn.innerText))

    await V().humanDelay(1200, 2000)

    return true

  }



  function detectScreenState() {

    if (isLoginRequired()) return 'login_required'

    if (!isUploadPath()) return isTikTokStudioPage() ? 'studio_home_or_posts' : 'other_tiktok_page'



    const hasTitleOrDesc = Boolean(findTitleInput() || findDescriptionPlaceholder() || findDescriptionEditorPassive())

    const hasSettingsOrCounter = Boolean(

      readDescriptionCounter() !== null ||

      V().findLabelElement(/^(cài đặt|settings|chi tiết|details)$/i, { minLeft: 180, maxLength: 30 }) ||

      V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 80 })

    )

    if (hasTitleOrDesc && hasSettingsOrCounter) return 'detail_editor_form'

    if (V().findLabelElement(/chọn ảnh để tải lên|select photos? to upload|tải lên tối đa 35 ảnh/i, { minLeft: 160 })) return 'upload_photo_tab'

    if (V().findLabelElement(/chọn video để tải lên|select video to upload/i, { minLeft: 160 })) return 'upload_video_tab'

    return 'loading_or_unknown'

  }



  function findPhotoTabButton() {

    let best = null, bestScore = -Infinity

    for (const el of V().queryAllDeep(document, '[role="tab"], button, [role="button"], div, span, a')) {

      if (!V().isReallyVisible(el, { minWidth: 24, minHeight: 20 })) continue

      const r = el.getBoundingClientRect()

      if (r.top < 70 || r.top > 450 || r.height > 70 || r.width > 180) continue

      if (!/^(ảnh|photo|photos|image|images)$/i.test(V().normalizeText(el.innerText || el.textContent))) continue

      let score = 50 + (r.left > 180 ? 30 : 0) + ((el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') ? 20 : 0)

      if (score > bestScore) { bestScore = score; best = el }

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

    for (const el of V().queryAllDeep(document, 'input[type="text"], input:not([type]), textarea, [contenteditable="true"]')) {

      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 14 })) continue

      const r = el.getBoundingClientRect()

      if (r.left < 180 || r.top < 70 || r.height > 85) continue

      const ph = V().normalizeText(`${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-placeholder') || ''}`)

      if (/vị trí|location|search|tìm kiếm/i.test(ph)) continue

      if (/tiêu đề|title/i.test(ph)) return el

      if (/thêm tiêu đề|add.*title|\b\d+\s*\/\s*90\b/i.test(V().normalizeText(el.parentElement?.innerText || '').slice(0, 140))) return el

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



    let best = null, bestScore = -Infinity

    for (const el of V().queryAllDeep(document, '.public-DraftEditor-content[contenteditable="true"], [data-lexical-editor="true"], div[contenteditable="true"], div[contenteditable="plaintext-only"], [role="textbox"], textarea')) {

      if (el === titleEl || titleEl?.contains(el) || el.contains(titleEl)) continue

      if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 10 })) continue

      const r = el.getBoundingClientRect()

      if (r.left < 160 || r.top < 70) continue

      const selfMeta = V().normalizeText(`${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.className || ''}`)

      if (/vị trí|location|search|tìm kiếm/i.test(selfMeta)) continue

      const nearText = V().normalizeText(el.parentElement?.parentElement?.innerText || '').slice(0, 350)

      if (/tìm kiếm vị trí|search location/i.test(nearText) && !/hashtag|4000|mô tả dài/i.test(nearText)) continue



      let score = 0

      if (/public-drafteditor-content|drafteditor|lexical|caption|description/i.test(selfMeta)) score += 50

      if (DESC_PLACEHOLDER_RE.test(nearText) || /\b\d+\s*\/\s*4000\b/.test(nearText) || /#\s*hashtag/i.test(nearText)) score += 55

      if (el.isContentEditable) score += 25

      if (titleRect && r.top >= titleRect.bottom - 8 && r.top <= titleRect.bottom + 240) score += 45

      if (footerRect && r.bottom <= footerRect.bottom + 15 && r.top >= footerRect.top - 340) score += 45



      if (score > bestScore && score >= 25) { bestScore = score; best = el }

    }

    return best

  }



  async function findAndFocusDescriptionEditor(stepLog) {

    const titleEl = findTitleInput()

    let editor = findDescriptionEditorPassive()

    if (editor) return editor



    const placeholderEl = findDescriptionPlaceholder()

    if (placeholderEl) {

      stepLog('fill_desc', 'Đang bấm trực tiếp vào vùng "Mô tả dài..." để kích hoạt khung nhập...')

      await V().humanClick(placeholderEl, 'Kích hoạt ô Mô tả (0/4000)')

      await V().humanDelay(350, 650)

      const active = V().getDeepActiveElement()

      if (active && active !== titleEl && !titleEl?.contains(active) && (active.isContentEditable || active.tagName === 'TEXTAREA' || active.getAttribute('role') === 'textbox')) {

        return active

      }

      editor = findDescriptionEditorPassive()

      if (editor) return editor

      let box = placeholderEl.parentElement

      for (let i = 0; i < 4 && box; i++) {

        const inner = box.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"], textarea, [role="textbox"]')

        if (inner && inner !== titleEl) return inner

        box = box.parentElement

      }

    }



    const footerEl = findDescriptionFooterAnchor()

    if (footerEl) {

      const fRect = footerEl.getBoundingClientRect()

      const hit = document.elementFromPoint(Math.round(fRect.left + 60), Math.round(Math.max(100, fRect.top - 48)))

      if (hit && hit !== titleEl && !titleEl?.contains(hit)) {

        await V().humanClick(hit, 'Vùng Mô tả')

        await V().humanDelay(320, 600)

        const active = V().getDeepActiveElement()

        if (active && active !== titleEl && (active.isContentEditable || active.tagName === 'TEXTAREA')) return active

      }

    }

    return null

  }



  function readDescriptionCounter() {

    const label = V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 })

    const m = label ? V().normalizeText(label.innerText || label.textContent).match(/^(\d+)\s*\/\s*4000$/) : null

    return m ? Number(m[1]) : null

  }



  function readTitleCounter() {

    const label = V().findLabelElement(/^\d+\s*\/\s*90$/i, { minLeft: 180, maxLength: 16 })

    const m = label ? V().normalizeText(label.innerText || label.textContent).match(/^(\d+)\s*\/\s*90$/) : null

    return m ? Number(m[1]) : null

  }



  function findPrivacyControl() {

    const label = V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 90 })

    if (label) {

      const nearby = V().findControlNearLabel(label, 'button, [role="combobox"], [role="button"], select, div[class*="select"], div[class*="Select"]', { direction: 'below', maxVertical: 110, maxHorizontal: 260 })

      if (nearby) return nearby

    }

    return V().queryAllDeep(document, 'select, button, [role="combobox"], [role="button"], div[class*="select"], div[class*="Select"]').find((el) => {

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

    for (const sel of ['button[data-e2e="post_video_button"]', 'button[data-e2e="post-button"]', 'button[data-e2e="post-btn"]']) {

      const el = V().queryAllDeep(document, sel).find((node) => V().isReallyVisible(node, { minWidth: 60, minHeight: 28 }))

      if (el) return el

    }

    let best = null, bestScore = -Infinity

    for (const btn of V().queryAllDeep(document, 'button, [role="button"]')) {

      if (!V().isReallyVisible(btn, { minWidth: 64, minHeight: 28 })) continue

      const r = btn.getBoundingClientRect()

      if (r.left < 180 || r.top < 120) continue

      if (!/^(đăng|post|đăng ngay|post now|xuất bản|publish)$/i.test(V().normalizeText(btn.innerText || btn.textContent))) continue

      const color = V().getElementColorInfo(btn)

      const score = 50 + (btn.tagName === 'BUTTON' ? 20 : 0) + (color.isRedPink ? 40 : 0) + (r.width >= 90 ? 15 : 0) + (!V().isElementDisabled(btn) ? 10 : 0)

      if (score > bestScore) { bestScore = score; best = btn }

    }

    return best

  }



  function findDiscardButton() {

    return V().queryAllDeep(document, 'button, [role="button"]').find((btn) =>

      V().isReallyVisible(btn, { minWidth: 50, minHeight: 24 }) && btn.getBoundingClientRect().left > 180 && /^(hủy bỏ|hủy|discard|xóa bỏ)$/i.test(V().normalizeText(btn.innerText || btn.textContent))

    ) || null

  }



  function inspectTikTokScreen() {

    return {

      url: location.href,

      health: V().inspectPageHealth(),

      screenState: detectScreenState(),

      loggedIn: isAccountLoggedIn(),

      accountHandle: detectCurrentTikTokHandle() || 'Tài khoản TikTok đang đăng nhập',

      titleCounter: readTitleCounter(),

      descriptionCounter: readDescriptionCounter(),

      privacyControlText: V().normalizeText(findPrivacyControl()?.innerText || findPrivacyControl()?.value || ''),

      publishButtonEnabled: Boolean(findPublishButton() && !V().isElementDisabled(findPublishButton()))

    }

  }



  // =========================================================================

  // LUỒNG ĐĂNG BÀI ẢNH TIKTOK STUDIO (TỰ BẤM "+ TẢI LÊN -> ẢNH" TỪ TRANG CHỦ STUDIO!)

  // =========================================================================



  async function executeTikTokPost(payload) {

    const trace = []

    const stepLog = (step, msg, level = 'info') => {

      trace.push({ step, msg, level, ts: Date.now() })

      V().reportStep('tiktok', step, msg, level)

    }



    if (!/(^|\.)tiktok\.com$/i.test(location.hostname)) return { ok: false, error: 'TIKTOK_HOST_INVALID', visionTrace: trace }

    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 25000, onStatus: stepLog })

    if (!stable.ok) return { ok: false, error: `TIKTOK_${stable.reason}`, visionTrace: trace }



    const readyAuth = await M().waitFor(() => isAccountLoggedIn() || isLoginRequired(), 15000)

    if (!readyAuth || isLoginRequired()) return { ok: false, error: 'TIKTOK_LOGIN_REQUIRED', visionTrace: trace }



    // Nếu đang ở Trang chủ TikTok Studio (/tiktokstudio) hoặc Bài đăng (/tiktokstudio/content):

    // BẤM TRỰC TIẾP NÚT ĐỎ "+ Tải lên" -> "Ảnh" như người thật, KHÔNG cần mở trang mới!

    if (!isUploadPath()) {

      if (isTikTokStudioPage()) {

        const switched = await clickStudioSidebarUploadPhoto(stepLog)

        if (!switched) return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }

      } else {

        return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }

      }

    }



    const requestedPrivacy = String(payload?.privacy || 'only_me').toLowerCase()

    if (!['only_me', 'public'].includes(requestedPrivacy)) return { ok: false, error: 'INVALID_PRIVACY', visionTrace: trace }

    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }



    const rawTitle = V().normalizeText(payload.title || '')

    const rawBody = payload.content || payload.description || payload.caption || payload.body || ''

    const rawHashtags = payload.hashtags || payload.tags || ''



    const shortTitle = V().truncateClean(rawTitle || V().formatPostText(rawBody, 200).split('\n')[0] || 'Ưu đãi nổi bật từ OmniCart', 85)

    let fullDescription = V().composeBodyAndHashtags(rawBody || rawTitle, rawHashtags, 3850)

    if (!fullDescription) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    if (/#[\p{L}\p{N}_]+$/u.test(fullDescription)) fullDescription += ' '



    const accountHandle = detectCurrentTikTokHandle() || ''

    stepLog('prepare', `TikTok Studio • Tiêu đề ${shortTitle.length}c | Mô tả + Hashtag ${fullDescription.trim().length}c.`)

    await V().humanDelay(700, 1300)



    await M().waitFor(() => detectScreenState() !== 'loading_or_unknown', 12000)

    let state = detectScreenState()



    if (state === 'detail_editor_form') {

      stepLog('reset_draft', 'Đang hủy bản nháp cũ còn mở...', 'warn')

      await V().scrollContainerToBottom(findDescriptionFooterAnchor() || findTitleInput())

      const discardBtn = findDiscardButton()

      if (discardBtn) {

        await V().humanClick(discardBtn, 'Hủy bản nháp cũ')

        await V().humanDelay(750, 1250)

        const confirmDiscard = V().queryAllDeep(document, '[role="dialog"] button, [class*="modal"] button').find((b) =>

          V().isReallyVisible(b) && /^(hủy bỏ|hủy|discard|xác nhận|confirm)$/i.test(V().normalizeText(b.innerText || b.textContent))

        )

        if (confirmDiscard) {

          await V().humanClick(confirmDiscard, 'Xác nhận hủy')

          await M().waitFor(() => detectScreenState() !== 'detail_editor_form', 8000)

        }

        await V().humanDelay(800, 1400)

      }

      state = detectScreenState()

    }



    if (state === 'upload_video_tab' || state === 'loading_or_unknown') {

      const photoTab = findPhotoTabButton()

      if (photoTab) {

        stepLog('switch_tab', 'Đang chuyển sang tab "Ảnh"...')

        await V().humanClick(photoTab, 'Tab Ảnh')

        await M().waitFor(() => detectScreenState() === 'upload_photo_tab' || Boolean(M().findImageInput(document, 200, false)), 8000)

        await V().humanDelay(650, 1200)

      }

    }



    // Nạp ảnh

    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào TikTok Studio...')

    const imageSnapshot = V().captureVisualImageSnapshot(document)

    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-tiktok-product.png')

    const imageInput = await M().findImageInput(document, 6000, false)

    let attached = imageInput ? M().attachFile(imageInput, imageFile) : false

    if (!attached) {

      const dropzone = findPhotoDropzoneElement()

      if (dropzone) attached = M().attachViaDrop(dropzone, imageFile)

    }

    if (!attached) return { ok: false, error: 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE', visionTrace: trace }



    stepLog('wait_detail', 'Đang chờ TikTok xử lý ảnh & mở biểu mẫu "Chi tiết"...')

    const detailFormReady = await M().waitFor(() => {

      if (!findTitleInput() && !findDescriptionPlaceholder() && !findDescriptionEditorPassive()) return false

      return Boolean(

        V().findNewlyRenderedMedia(imageSnapshot, { root: document, minTop: 110, minWidth: 55, minHeight: 55 }) ||

        V().findLabelElement(/ảnh bìa|đã tải lên \d+ ảnh|uploaded \d+ photo|cover/i, { minLeft: 180, maxLength: 80 })

      )

    }, 30000, 350)



    if (!detailFormReady) return { ok: false, error: 'TIKTOK_DETAIL_FORM_NOT_LOADED', visionTrace: trace }

    await V().humanDelay(1700, 2900)

    const confirmedHandle = detectCurrentTikTokHandle() || accountHandle



    // Điền Tiêu đề (0/90)

    const titleInput = findTitleInput()

    if (titleInput) {

      stepLog('fill_title', `Đang gõ Tiêu đề (${shortTitle.length}/90)...`)

      await V().smartTypeText(titleInput, shortTitle, { clearFirst: true, humanBurst: true, label: 'Tiêu đề TikTok (0/90)' })

      await V().humanDelay(800, 1450)

    }



    // Điền Mô tả + Hashtag (0/4000)

    stepLog('fill_desc', 'Đang định vị & điền Mô tả + Hashtag (0/4000)...')

    const descEditor = await findAndFocusDescriptionEditor(stepLog)

    if (!descEditor) return { ok: false, error: 'TIKTOK_DESCRIPTION_EDITOR_NOT_FOUND', visionTrace: trace }



    const descVerifyFn = (el, actual) => {

      const counter = readDescriptionCounter()

      if (counter !== null && counter >= Math.min(15, fullDescription.trim().length)) return true

      const clean = V().normalizeText(actual)

      return clean.length >= Math.min(18, fullDescription.trim().length) && !DESC_PLACEHOLDER_RE.test(clean)

    }



    let descRes = await V().smartTypeText(descEditor, fullDescription, {

      clearFirst: true, label: 'Mô tả & Hashtag (0/4000)', dismissPopover: true, placeholderRe: DESC_PLACEHOLDER_RE, verifyFn: descVerifyFn

    })

    await V().humanDelay(650, 1150)

    let counterAfter = readDescriptionCounter()



    if (!descRes.ok && (counterAfter === null || counterAfter === 0)) {

      const reFocused = await findAndFocusDescriptionEditor(stepLog)

      if (reFocused) {

        descRes = await V().smartTypeText(reFocused, fullDescription, {

          clearFirst: true, label: 'Thử lại Mô tả', dismissPopover: true, placeholderRe: DESC_PLACEHOLDER_RE, verifyFn: descVerifyFn

        })

        await V().humanDelay(700, 1200)

        counterAfter = readDescriptionCounter()

      }

    }

    if ((counterAfter !== null && counterAfter === 0) || (!descRes.ok && counterAfter === null)) {

      return { ok: false, error: 'TIKTOK_DESCRIPTION_NOT_INSERTED', visionTrace: trace }

    }

    V().dispatchEscape(descEditor)

    stepLog('fill_desc', `✅ Mô tả + Hashtag đã xác nhận (${counterAfter !== null ? `${counterAfter}/4000` : descRes.method})!`)



    // Chọn quyền riêng tư

    await V().humanDelay(800, 1500)

    const privacyResult = await setAndVerifyTikTokPrivacy(requestedPrivacy, stepLog)

    if (!privacyResult.ok) return { ok: false, error: 'TIKTOK_PRIVACY_NOT_CONFIRMED', actualPrivacy: privacyResult.actual, visionTrace: trace }



    // Rà soát & bấm Đăng

    await V().scrollContainerToBottom(findPrivacyControl() || descEditor)

    await V().humanReviewPause()



    let publishBtn = null

    await M().waitFor(() => {

      const btn = findPublishButton()

      if (btn && !V().isElementDisabled(btn)) { publishBtn = btn; return true }

      return false

    }, 12000)

    if (!publishBtn) return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY', visionTrace: trace }



    await V().humanClick(publishBtn, 'Đăng bài TikTok')

    stepLog('publish', 'Đã bấm Đăng, đang theo dõi TikTok tiếp nhận bài...')



    const confirm = await waitForTikTokSubmitResult(38000, shortTitle, confirmedHandle, stepLog)

    V().clearHud(4500)

    if (!confirm.ok) return { ok: false, error: confirm.error || 'TIKTOK_POST_NOT_VERIFIED', visionTrace: trace }



    if (confirm.pendingReview) {

      return {

        ok: true, pendingReview: true, status: 'pending_review', platform: 'tiktok',

        account: confirmedHandle, privacy: privacyResult.actual,

        titleProbe: shortTitle.slice(0, 40), submittedAt: new Date().toISOString(),

        message: confirm.message, visionTrace: trace

      }

    }



    return {

      ok: true, verified: true, postUrl: confirm.postUrl, realPostId: confirm.postId || `tiktok-${Date.now()}`,

      platform: 'tiktok', account: confirmedHandle, privacy: privacyResult.actual,

      publishedTime: new Date().toISOString(), message: 'Đã đăng TikTok thành công!', visionTrace: trace

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

      if (parsePrivacyValue(control.options[control.selectedIndex]?.textContent || '') === requestedPrivacy) return { ok: true, actual: requestedPrivacy }

      const matchOpt = Array.from(control.options).find((o) => targetPattern.test(V().normalizeText(o.textContent)))

      if (!matchOpt) return { ok: false, actual: null }

      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set

      if (setter) setter.call(control, matchOpt.value); else control.value = matchOpt.value

      control.dispatchEvent(new Event('change', { bubbles: true }))

      return { ok: control.value === matchOpt.value, actual: requestedPrivacy }

    }



    const curLbl = V().getAccessibleLabel(control)

    if (parsePrivacyValue(curLbl) === requestedPrivacy) return { ok: true, actual: requestedPrivacy }

    await V().humanClick(control, 'Mở quyền riêng tư')

    await V().humanDelay(650, 1150)



    const findOpt = () => V().queryAllDeep(document, '[role="option"], [role="menuitem"], [role="radio"], li, div[class*="option"], button').find((el) =>

      el !== control && !el.contains(control) && V().isReallyVisible(el, { minWidth: 50, minHeight: 20 }) &&

      V().normalizeText(el.innerText || el.textContent).length <= 60 && targetPattern.test(V().normalizeText(el.innerText || el.textContent))

    ) || null



    if (!await M().waitFor(() => Boolean(findOpt()), 5000)) { V().dispatchEscape(); return { ok: false, actual: parsePrivacyValue(curLbl) } }

    await V().humanClick(findOpt(), requestedPrivacy)

    await V().humanDelay(650, 1100)

    const ok = await M().waitFor(() => {

      const updated = findPrivacyControl()

      return Boolean(updated && parsePrivacyValue(V().getAccessibleLabel(updated)) === requestedPrivacy)

    }, 5000)

    return { ok, actual: ok ? requestedPrivacy : parsePrivacyValue(V().getAccessibleLabel(findPrivacyControl())) }

  }



  function cleanTikTokPostUrl(raw) {

    try {

      const u = new URL(raw, location.origin)

      const m = u.pathname.match(/^\/(@[A-Za-z0-9._-]+)\/(video|photo)\/(\d+)/i)

      return m ? `https://www.tiktok.com/${m[1]}/${m[2].toLowerCase()}/${m[3]}` : null

    } catch (_) { return null }

  }



  function isRealTikTokPostUrl(url) {

    return Boolean(url && /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._-]+\/(?:video|photo)\/\d+$/i.test(url))

  }



  function extractRealTikTokPostLinks(root = document) {

    return V().queryAllDeep(root, 'a[href*="/video/"], a[href*="/photo/"]')

      .map((a) => cleanTikTokPostUrl(a.href))

      .filter(isRealTikTokPostUrl)

  }



  async function waitForTikTokSubmitResult(timeoutMs, titleProbe, accountHandle, stepLog) {

    const startUrl = location.href

    const deadline = Date.now() + timeoutMs

    let handledConfirmModal = false

    let accepted = false



    while (Date.now() < deadline) {

      const currentUrl = location.href

      if (currentUrl !== startUrl && !/\/upload\/?(\?|$)/i.test(currentUrl)) {

        accepted = true

        const directLink = cleanTikTokPostUrl(currentUrl)

        if (directLink) return { ok: true, postUrl: directLink, postId: extractTikTokPostId(directLink) }

        return { ok: true, pendingReview: true, message: 'TikTok đã nhận bài & đang duyệt (~2–5 phút). Extension đang tự theo dõi lấy link thật!' }

      }



      for (const modal of V().queryAllDeep(document, '[role="dialog"], [class*="modal"], [class*="Modal"]').filter((m) => V().isReallyVisible(m, { minWidth: 200, minHeight: 90 }))) {

        const txt = V().normalizeText(modal.innerText || modal.textContent)

        if (!handledConfirmModal && /tiếp tục đăng|continue to post|kiểm tra bản quyền|copyright/i.test(txt)) {

          const confirmBtn = V().queryAllDeep(modal, 'button, [role="button"]').find((b) =>

            V().isReallyVisible(b) && !V().isElementDisabled(b) && /^(đăng ngay|đăng|tiếp tục|post now|post|continue)$/i.test(V().normalizeText(b.innerText || b.textContent))

          )

          if (confirmBtn) { handledConfirmModal = true; await V().humanClick(confirmBtn, 'Tiếp tục đăng'); await V().humanDelay(800, 1300) }

        }

        if (/đã được tải lên|has been uploaded|đã đăng|đang xem xét|under review|quản lý bài đăng|manage your posts/i.test(txt)) {

          accepted = true

          const manageBtn = V().queryAllDeep(modal, 'button, a, [role="button"]').find((b) =>

            V().isReallyVisible(b) && /quản lý bài đăng|manage your posts|trang chủ/i.test(V().normalizeText(b.innerText || b.textContent))

          )

          if (manageBtn) await V().humanClick(manageBtn, 'Mở quản lý bài đăng')

          return { ok: true, pendingReview: true, message: 'TikTok đã nhận bài & đang duyệt (~2–5 phút). Extension sẽ tự động cập nhật link thật!' }

        }

      }



      const toasts = V().queryAllDeep(document, '[role="status"], [role="alert"], [class*="toast"], [class*="Toast"]')

        .filter((el) => V().isReallyVisible(el)).map((el) => V().normalizeText(el.innerText || el.textContent)).join(' | ')

      if (/không thể đăng|thất bại|failed|captcha|xác minh/i.test(toasts)) return { ok: false, error: `TIKTOK_PUBLISH_ERROR: ${toasts.slice(0, 120)}` }

      if (/đã đăng|posted|đã tải lên|thành công|đang xem xét/i.test(toasts)) {

        accepted = true

        return { ok: true, pendingReview: true, message: 'TikTok đã tiếp nhận, đang tự theo dõi duyệt bài...' }

      }

      await V().sleep(700)

    }



    return accepted

      ? { ok: true, pendingReview: true, message: 'TikTok đã nhận bài và đang xử lý duyệt...' }

      : { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }

  }



  // =========================================================================

  // KIỂM TRA DUYỆT BÀI TRÊN TRANG CHỦ / BÀI ĐĂNG TIKTOK STUDIO (ẢNH 8) & LẤY LINK THẬT!

  // =========================================================================



  function findApprovedRowOnStudio(titleProbe) {

    const probeKey = V().stripToMatchKey(titleProbe).slice(0, 22)

    const probeWords = probeKey.split(' ').filter((w) => w.length >= 2).slice(0, 4)



    // Tìm theo mọi hàng có nút quyền riêng tư ("Mọi người", "Chỉ mình...", "Everyone", "Only you") trên màn hình Studio (Ảnh 8!)

    const privacyPills = V().queryAllDeep(document, 'button, [role="button"], [role="combobox"], div, span').filter((el) => {

      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 16 })) return false

      const r = el.getBoundingClientRect()

      if (r.left < 200 || r.top < 110 || r.height > 48 || r.width > 200) return false

      const t = V().normalizeText(el.innerText || el.textContent)

      return t.length <= 28 && /^(mọi người|công khai|bạn bè|chỉ mình.*|chỉ bạn|everyone|public|friends|only you|only me|private)$/i.test(t)

    })



    const candidateRows = []

    const visited = new Set()



    for (const pill of privacyPills) {

      let row = pill.parentElement

      for (let d = 0; d < 7 && row && row !== document.body; d++) {

        const r = row.getBoundingClientRect()

        if (r.width >= 560 && r.height >= 52 && r.height <= 200) {

          if (!visited.has(row)) {

            visited.add(row)

            candidateRows.push({ row, top: r.top })

          }

          break

        }

        row = row.parentElement

      }

    }



    candidateRows.sort((a, b) => a.top - b.top)



    // Khớp theo tiêu đề bài vừa đăng trước

    if (probeWords.length >= 2) {

      for (const item of candidateRows) {

        const rowKey = V().stripToMatchKey(item.row.innerText || item.row.textContent)

        const hitCount = probeWords.filter((w) => rowKey.includes(w)).length

        if (hitCount >= Math.min(2, probeWords.length)) return item.row

      }

    }



    // Nếu trên Trang chủ TikTok Studio chưa thấy bằng privacy pill -> tìm trực tiếp theo văn bản tiêu đề bài đăng!

    if (probeWords.length >= 2) {

      for (const el of V().queryAllDeep(document, 'div, span, a, p')) {

        if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 14 })) continue

        const r = el.getBoundingClientRect()

        if (r.left < 180 || r.top < 110 || r.height > 90) continue

        const txtKey = V().stripToMatchKey(el.innerText || el.textContent)

        if (txtKey.length > 220) continue

        if (probeWords.filter((w) => txtKey.includes(w)).length >= Math.min(2, probeWords.length)) {

          let row = el.parentElement

          for (let d = 0; d < 7 && row && row !== document.body; d++) {

            const rr = row.getBoundingClientRect()

            if (rr.width >= 480 && rr.height >= 52 && rr.height <= 220) return row

            row = row.parentElement

          }

        }

      }

    }



    return candidateRows[0]?.row || null

  }



  async function tryExtractLinkFromStudioRow(row) {

    if (!row) return null



    // 1. Có sẵn <a> link thật trong hàng

    const directLinks = extractRealTikTokPostLinks(row)

    if (directLinks.length > 0) return directLinks[0]



    // 2. Bấm nút "•••" ở bên phải cùng của hàng (Ảnh 8) để đọc link "Xem trên TikTok" / "View on TikTok"

    const rRect = row.getBoundingClientRect()

    const actionBtns = Array.from(row.querySelectorAll('button, [role="button"]'))

      .filter((b) => V().isReallyVisible(b, { minWidth: 18, minHeight: 18 }))

      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)



    const moreBtn = actionBtns[0]

    if (moreBtn && moreBtn.getBoundingClientRect().left > rRect.left + rRect.width * 0.65) {

      await V().humanClick(moreBtn, 'Mở menu bài đăng (•••)')

      await V().humanDelay(450, 800)



      // Kiểm tra link "Xem trên TikTok" / "View on TikTok" trong menu vừa mở

      const menuLinks = extractRealTikTokPostLinks(document)

      if (menuLinks.length > 0) {

        V().dispatchEscape()

        return menuLinks[0]

      }



      const viewLink = V().queryAllDeep(document, 'a[href], [role="menuitem"] a[href]').find((a) =>

        V().isReallyVisible(a) && /xem trên tiktok|view on tiktok|mở trên tiktok/i.test(V().normalizeText(a.innerText || a.textContent))

      )

      if (viewLink && cleanTikTokPostUrl(viewLink.href)) {

        V().dispatchEscape()

        return cleanTikTokPostUrl(viewLink.href)

      }

      V().dispatchEscape()

      await V().sleep(200)

    }



    // 3. Thử tách Item ID 19 chữ số từ mọi thuộc tính href/src trong hàng

    const htmlChunk = row.innerHTML || ''

    const idMatch = htmlChunk.match(/(?:item_id=|video_id=|post\/|edit\/|video\/|photo\/)(\d{17,21})/i)

    const handle = detectCurrentTikTokHandle()

    if (idMatch && handle) {

      return `https://www.tiktok.com/${handle}/photo/${idMatch[1]}`

    }

    return null

  }



  async function checkTikTokApprovedPostLink(options = {}) {

    const titleProbe = options.titleProbe || ''

    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 15000 })

    if (!stable.ok) return { ok: false, status: 'pending_review', reason: stable.reason }



    await V().humanDelay(900, 1500)

    const detectedHandle = detectCurrentTikTokHandle() || options.accountHandle || null



    // Nếu đang ở trang Profile cá nhân /@username (sau khi redirect từ tiktok.com/profile) -> lấy ngay link bài mới nhất khớp tiêu đề!

    if (/^\/@[A-Za-z0-9._-]+/i.test(location.pathname)) {

      const probeWords = V().stripToMatchKey(titleProbe).split(' ').filter((w) => w.length >= 2).slice(0, 4)

      const cards = Array.from(document.querySelectorAll('[data-e2e="user-post-item"], [class*="DivItemContainer"]'))

      for (const card of cards.slice(0, 8)) {

        const cardLink = extractRealTikTokPostLinks(card)[0]

        if (!cardLink) continue

        const cardKey = V().stripToMatchKey(`${card.innerText || ''} ${card.querySelector('img')?.getAttribute('alt') || ''} ${card.querySelector('a[title]')?.getAttribute('title') || ''}`)

        if (!probeWords.length || probeWords.filter((w) => cardKey.includes(w)).length >= Math.min(2, probeWords.length)) {

          return { ok: true, status: 'published', postUrl: cardLink, postId: extractTikTokPostId(cardLink), accountHandle: detectedHandle }

        }

      }

      // Fallback: lấy bài mới đăng nhất trên cùng của trang cá nhân

      const newestLink = extractRealTikTokPostLinks(document)[0]

      if (newestLink) {

        return { ok: true, status: 'published', postUrl: newestLink, postId: extractTikTokPostId(newestLink), accountHandle: detectedHandle }

      }

      return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'Bài chưa hiện trên trang cá nhân, chờ thêm 30s...' }

    }



    // Nếu đang ở Trang chủ TikTok Studio (/tiktokstudio) hoặc Bài đăng (/tiktokstudio/content) -> kiểm tra trực tiếp!

    if (options.refreshViaSidebar && isTikTokStudioPage()) {

      await clickStudioSidebarTab(/^(trang chủ|home)$/i)

      await clickStudioSidebarTab(/^(bài đăng|posts)$/i)

    }



    const row = findApprovedRowOnStudio(titleProbe)

    if (!row) {

      return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'Chưa thấy bài xuất hiện trong danh sách TikTok Studio...' }

    }



    const rowText = V().normalizeText(row.innerText || row.textContent)

    if (/đang xem xét|under review|đang xử lý|processing|đang kiểm tra/i.test(rowText)) {

      return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'TikTok vẫn đang duyệt bài (Under review)...' }

    }

    if (/bị xóa|removed|vi phạm|violation|không được duyệt/i.test(rowText)) {

      return { ok: false, status: 'rejected', error: 'TIKTOK_POST_REJECTED_IN_REVIEW' }

    }



    // Bài đã duyệt (hiển thị Mọi người / Chỉ mình tôi như Ảnh 8!) -> lấy link thật ngay!

    const exactUrl = await tryExtractLinkFromStudioRow(row)

    if (exactUrl && isRealTikTokPostUrl(exactUrl)) {

      return { ok: true, status: 'published', postUrl: exactUrl, postId: extractTikTokPostId(exactUrl), accountHandle: detectedHandle }

    }



    // Đã duyệt xong trên Studio nhưng cần mở tiktok.com/profile (link chung cho mọi nick) để lấy URL chuẩn /@handle/photo|video/id!

    return {

      ok: true,

      status: 'approved_need_profile_link',

      accountHandle: detectedHandle,

      message: 'Bài TikTok đã duyệt thành công! Đang lấy link bài thật từ trang cá nhân...'

    }

  }



  function extractTikTokPostId(postUrl) {

    if (!postUrl) return null

    const match = String(postUrl).match(/\/(?:video|photo)\/([0-9]+)/i)

    return match?.[1] || null

  }



  // =========================================================================

  // CÀO 10 BÀI VIRAL TIKTOK (>= 50.000 TIM) — BỘ ĐẾM TRƯỢT 5 PHÚT + CHỐNG TRÙNG + CAPTION THẬT!

  // =========================================================================



  function extractTikTokCardMetrics(card) {

    let likes = 0, comments = 0, shares = 0

    for (const sel of ['[data-e2e="like-count"]', '[data-e2e="video-like-count"]', 'strong[data-e2e="like-count"]', '[class*="StrongCount"]', '[class*="LikeCount"]']) {

      const el = card.querySelector(sel)

      if (el) likes = Math.max(likes, V().parseHumanCount(el.innerText || el.textContent))

    }

    const cEl = card.querySelector('[data-e2e="comment-count"]')

    if (cEl) comments = V().parseHumanCount(cEl.innerText || cEl.textContent)

    const sEl = card.querySelector('[data-e2e="share-count"]')

    if (sEl) shares = V().parseHumanCount(sEl.innerText || sEl.textContent)



    if (likes === 0) {

      for (const el of card.querySelectorAll('strong, span')) {

        const t = V().normalizeText(el.innerText || el.textContent)

        if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|m|tr|triệu)$/i.test(t)) {

          likes = Math.max(likes, V().parseHumanCount(t))

        }

      }

    }

    return { likes, comments, shares }

  }



  // Bấm xoay vòng các danh mục trên TikTok Explore (Ảnh 5) để lần 2, lần 3 luôn có bài mới không bị trùng!

  async function clickExploreCategoryPill(categoryIndex) {

    if (categoryIndex <= 0 || !location.pathname.includes('/explore')) return false

    const pills = Array.from(document.querySelectorAll('button, [role="tab"], [role="button"]')).filter((el) => {

      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 24 })) return false

      const r = el.getBoundingClientRect()

      if (r.top > 95 || r.left < 180 || r.height > 54) return false

      const t = V().normalizeText(el.innerText || el.textContent)

      return t.length >= 2 && t.length <= 32 && !/tìm kiếm|đăng nhập|tải lên/i.test(t)

    })

    if (pills.length <= 1) return false

    const targetPill = pills[categoryIndex % pills.length]

    if (!targetPill) return false

    V().reportStep('tiktok', 'scrape_cat', `🎵 Chuyển danh mục Khám phá: "${V().normalizeText(targetPill.innerText)}" để tìm bài mới không trùng...`)

    await V().humanClick(targetPill, `Danh mục ${V().normalizeText(targetPill.innerText)}`)

    await V().humanDelay(1600, 2600)

    return true

  }



  async function scrapeTikTokViralPosts(options = {}) {

    const targetCount = Number(options.targetCount) || 10

    const minLikes = Number(options.minLikes) || 50000

    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 26

    const idleTimeoutMs = Number(options.idleTimeoutMs) || 5 * 60 * 1000

    let lastFoundAt = Number(options.lastFoundAt) || Date.now()

    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0

    const startCategoryIndex = Number(options.categoryIndex) || 0



    const seenUrls = new Set((options.excludeUrls || []).map((u) => String(u).trim().toLowerCase()))



    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 20000 })

    if (!stable.ok) return { ok: false, error: `TIKTOK_${stable.reason}`, posts: [], lastFoundAt }



    if (startCategoryIndex > 0) {

      await clickExploreCategoryPill(startCategoryIndex)

    }



    const collected = []

    let stagnantRounds = 0

    let catSwitchCount = 0



    for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {

      if (Date.now() - lastFoundAt >= idleTimeoutMs) {

        return { ok: true, posts: collected, timedOut: true, lastFoundAt }

      }



      const health = V().inspectPageHealth()

      if (health.isOffline) {

        V().reportStep('tiktok', 'network', 'Tab cào TikTok mất mạng, đang chờ phục hồi...', 'warn')

        await V().waitForPageStable('tiktok', { maxWaitMs: 25000 })

      }

      if (health.isCaptchaOrCheckpoint) break



      const foundBeforeRound = collected.length

      const cards = Array.from(

        document.querySelectorAll('div[data-e2e="explore-item"], div[data-e2e="recommend-list-item-container"], article[data-e2e="recommend-list-item-container"], div[class*="DivItemContainer"], article[data-e2e]')

      )



      for (const card of cards) {

        if (collected.length >= targetCount) break

        if (Date.now() - lastFoundAt >= idleTimeoutMs) break

        try {

          const linkEl = card.querySelector('a[href*="/video/"], a[href*="/photo/"]')

          const postUrl = linkEl ? cleanTikTokPostUrl(linkEl.href) : null

          if (!postUrl || !isRealTikTokPostUrl(postUrl)) continue

          const urlKey = postUrl.toLowerCase()

          if (seenUrls.has(urlKey)) continue



          const metrics = extractTikTokCardMetrics(card)

          if (metrics.likes < minLikes) continue



          // Đọc tiêu đề thật từ img[alt] hoặc video-desc (khắc phục việc chỉ hiện tên tác giả!)

          const imgAlt = V().normalizeText(card.querySelector('img[alt]')?.getAttribute('alt') || '')

          const descEl = card.querySelector('[data-e2e="explore-card-desc"], [data-e2e="video-desc"], a[title], h1')

          const descTxt = V().normalizeText(descEl?.getAttribute?.('title') || descEl?.innerText || descEl?.textContent || '')



          const authorMatch = postUrl.match(/tiktok\.com\/(@[A-Za-z0-9._-]+)\//i)

          const authorEl = card.querySelector('[data-e2e="explore-card-user-unique-id"], [data-e2e="video-author-uniqueid"], p[data-e2e="explore-card-user-unique-id"]')

          const author = V().normalizeText(authorEl?.textContent || '') || (authorMatch ? authorMatch[1] : '@creator')



          const bestCaption = (imgAlt.length > descTxt.length && !/avatar/i.test(imgAlt)) ? imgAlt : (descTxt || `Video TikTok Viral của ${author}`)

          const isPhoto = postUrl.includes('/photo/')



          seenUrls.add(urlKey)

          // RESET BỘ ĐẾM TRƯỢT 5 PHÚT MỖI KHI CÀO ĐƯỢC 1 BÀI MỚI!

          lastFoundAt = Date.now()

          collected.push({

            id: `tt-viral-${Date.now()}-${collected.length}`,

            title: V().truncateClean(bestCaption, 105),

            platform: 'tiktok',

            category: isPhoto ? 'Ảnh Viral TikTok' : 'Video Viral TikTok',

            postUrl,

            summary: V().truncateClean(`[${author}] ${bestCaption} • Đạt ${metrics.likes.toLocaleString('vi-VN')} tim`, 260),

            viralityScore: Math.min(99, 88 + Math.min(11, Math.floor(Math.log10(metrics.likes) * 2))),

            likesCount: metrics.likes,

            sharesCount: metrics.shares,

            commentsCount: metrics.comments,

            trendingTopic: `${(metrics.likes / 1000).toFixed(0)}K+ tim TikTok`,

            createdAt: new Date().toISOString()

          })



          const currentTotal = totalAlreadyFound + collected.length

          V().highlightTarget(card, `🔥 TikTok Viral ${currentTotal}/10 (${metrics.likes.toLocaleString('vi-VN')} ♥)`, '#fe2c55')

          V().reportStep(

            'tiktok',

            'scrape_viral',

            `🎵 TikTok Viral: ${currentTotal}/10 bài (${metrics.likes.toLocaleString('vi-VN')} tim) — đã reset bộ đếm 5 phút!`

          )

        } catch (_) {}

      }



      if (collected.length >= targetCount) break



      if (collected.length === foundBeforeRound) {

        stagnantRounds++

        // Nếu cuộn 3 nhịp trên cùng danh mục mà toàn bài cũ/trùng -> bấm chuyển sang danh mục Explore mới!

        if (stagnantRounds >= 3 && location.pathname.includes('/explore') && catSwitchCount < 6) {

          catSwitchCount++

          stagnantRounds = 0

          await clickExploreCategoryPill(startCategoryIndex + catSwitchCount)

          continue

        }

      } else {

        stagnantRounds = 0

      }



      window.scrollBy({ top: 900 + Math.round(Math.random() * 550), behavior: 'smooth' })

      await V().humanDelay(1600, 2600)

    }



    V().clearHud(3000)

    return { ok: true, posts: collected, timedOut: false, lastFoundAt }

  }

})()
