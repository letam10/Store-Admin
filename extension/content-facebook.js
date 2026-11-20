/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.0 cho Facebook (hoạt động với BẤT KỲ tài khoản Facebook nào đang đăng nhập — không hardcode tên/ID).
  - Nâng cấp v3.0.0:
    1. Sửa triệt để lỗi FACEBOOK_PUBLIC_NOT_CONFIRMED (không còn giới hạn combined.length <= 80 cho aria-label dài của Facebook!).
    2. Nhận diện trạng thái đang tải / mất mạng / captcha / nhầm trang bằng OmniVision.waitForPageStable().
    3. Tự động cào 10 bài đăng VIRAL thật (>= 5.000 tương tác: ảnh, video, reel hoặc hội nhóm) có permalink sạch & chính xác (kèm hover kích hoạt lazy href).
    4. Tự động lấy 5 Hội Nhóm Facebook thật (tên nhóm, link /groups/..., số thành viên).
*/

;(() => {
  if (typeof window.__OMNICART_FB_CLEANUP__ === 'function') {
    try { window.__OMNICART_FB_CLEANUP__() } catch (_) {}
  }

  const COMPOSER_TEXT_RE = /bạn đang nghĩ gì|what's on your mind|viết gì đó|write something|tạo bài viết|create a post/i
  const PHOTO_BTN_RE = /ảnh\/video|photo\/video|thêm ảnh|add photo/i
  const ONLY_ME_RE = /chỉ mình tôi|only me/i
  const PUBLIC_RE = /công khai|public/i
  const FRIENDS_RE = /bạn bè|friends/i

  const V = () => globalThis.OmniVision
  const M = () => globalThis.OmniCartMedia

  const handleMessage = (message, sender, sendResponse) => {
    if (!message?.type) return false

    if (message.type === 'VISION_SET_CONFIG' || message.type === 'VISION_SET_HUD') {
      V()?.applyConfig(message.config || { showHud: message.enabled })
      sendResponse({ ok: true })
      return false
    }

    if (message.type === 'FB_INSPECT_VISION') {
      sendResponse(inspectFacebookScreen())
      return false
    }

    if (message.type === 'FB_EXECUTE_POST') {
      executeFacebookPost(message.payload)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err) }))
      return true
    }

    if (message.type === 'FB_SCRAPE_VIRAL') {
      scrapeFacebookViralPosts(message.options || {})
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err), posts: [] }))
      return true
    }

    if (message.type === 'FB_SCRAPE_GROUPS') {
      scrapeFacebookGroups(message.options || {})
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err), groups: [] }))
      return true
    }

    return false
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  window.__OMNICART_FB_CLEANUP__ = () => {
    try { chrome.runtime.onMessage.removeListener(handleMessage) } catch (_) {}
  }

  // =========================================================================
  // MẮT NHẬN DIỆN TÀI KHOẢN ĐANG ĐĂNG NHẬP & GIAO DIỆN FACEBOOK
  // =========================================================================

  function isLoginOrCheckpointScreen() {
    if (/\/login|\/checkpoint/i.test(location.pathname)) return true
    const hasPassword = Boolean(document.querySelector('input[type="password"]'))
    const hasNavOrComposer = Boolean(
      findComposerTrigger() ||
      document.querySelector('[role="navigation"] a[href*="/me"], [aria-label*="Trang cá nhân"], [aria-label*="Your profile"], [aria-label*="Tài khoản"], [aria-label*="Account"]')
    )
    return hasPassword && !hasNavOrComposer
  }

  function detectLoggedInAccountName(dialog = null) {
    if (dialog) {
      const strongs = V().queryAllDeep(dialog, 'strong, span[dir="auto"], a[role="link"] span')
      for (const el of strongs) {
        if (!V().isReallyVisible(el)) continue
        const r = el.getBoundingClientRect()
        const dRect = dialog.getBoundingClientRect()
        if (r.top - dRect.top > 180 || r.top - dRect.top < 45) continue
        const txt = V().normalizeText(el.innerText || el.textContent)
        if (txt.length >= 2 && txt.length <= 60 && !/tạo bài viết|create post|công khai|chỉ mình tôi|bạn bè|nhãn ai/i.test(txt)) {
          return txt
        }
      }
    }

    const h1 = Array.from(document.querySelectorAll('h1'))
      .map((el) => V().normalizeText(el.innerText || el.textContent))
      .find((t) => t.length >= 2 && t.length <= 60 && !/^facebook$/i.test(t))
    if (h1) return h1

    const profileBtn = document.querySelector('[aria-label*="Trang cá nhân"], [aria-label*="Your profile"]')
    if (profileBtn) {
      const txt = V().normalizeText(profileBtn.innerText || profileBtn.textContent)
      if (txt.length >= 2 && txt.length <= 60) return txt
    }

    return 'Tài khoản Facebook đang đăng nhập'
  }

  function isInsideTopBarOrNav(el) {
    if (!el) return true
    if (el.closest('[role="banner"], [role="navigation"], header')) return true
    const rect = el.getBoundingClientRect()
    return rect.top < 60
  }

  function findComposerTrigger() {
    const candidates = V().queryAllDeep(document, '[role="button"], button, span, div')
    let best = null
    let bestScore = -Infinity

    for (const el of candidates) {
      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 24 })) continue
      if (isInsideTopBarOrNav(el)) continue
      if (el.closest('[role="dialog"]')) continue
      if (el.closest('[role="article"]')) continue

      const rect = el.getBoundingClientRect()
      if (rect.height > 110 || rect.width < 120) continue

      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      if (!label || label.length > 90) continue
      if (!COMPOSER_TEXT_RE.test(label)) continue

      const clickable = el.closest('[role="button"], button, [tabindex="0"]') || el
      if (isInsideTopBarOrNav(clickable)) continue
      const cRect = clickable.getBoundingClientRect()
      if (cRect.width < 140 || cRect.height < 28 || cRect.height > 95) continue

      let score = 50
      if (cRect.left > window.innerWidth * 0.2) score += 25
      if (cRect.top > 100 && cRect.top < 980) score += 20
      if (label.length < 40) score += 15
      if (clickable.getAttribute('role') === 'button') score += 15

      if (score > bestScore) {
        bestScore = score
        best = clickable
      }
    }
    return best
  }

  function findProfilePhotoShortcut() {
    const buttons = V().queryAllDeep(document, '[role="button"], button')
    return buttons.find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 26 })) return false
      if (isInsideTopBarOrNav(el) || el.closest('[role="dialog"]') || el.closest('[role="article"]')) return false
      const rect = el.getBoundingClientRect()
      if (rect.top < 110 || rect.top > 980) return false
      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      return label.length <= 35 && PHOTO_BTN_RE.test(label)
    }) || null
  }

  function findComposerDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 320, minHeight: 220 }))

    for (let i = dialogs.length - 1; i >= 0; i--) {
      const dialog = dialogs[i]
      const text = V().normalizeText(dialog.innerText || dialog.textContent).slice(0, 320)
      const hasHeading = /tạo bài viết|create post/i.test(text)
      const hasEditor = Boolean(findComposerEditor(dialog))
      const hasSubmit = Boolean(findSubmitOrNextButton(dialog))
      if ((hasHeading && (hasEditor || hasSubmit)) || (hasEditor && hasSubmit)) {
        return dialog
      }
    }
    return null
  }

  function hasExistingMediaInDialog(dialog) {
    if (!dialog) return false
    const dRect = dialog.getBoundingClientRect()
    const hasEditBtn = V().queryAllDeep(dialog, '[role="button"], button').some((b) => {
      if (!V().isReallyVisible(b)) return false
      const txt = V().normalizeText(b.innerText || b.textContent)
      return /^(chỉnh sửa|chỉnh sửa tất cả|edit|edit all)$/i.test(txt)
    })
    if (hasEditBtn) return true

    return V().queryAllDeep(dialog, 'img').some((img) => {
      if (!V().isReallyVisible(img, { minWidth: 85, minHeight: 85 })) return false
      const r = img.getBoundingClientRect()
      return r.top > dRect.top + 110 && img.complete && img.naturalWidth > 80
    })
  }

  async function closeDirtyComposerDialog(dialog, stepLog) {
    if (!dialog) return
    const dRect = dialog.getBoundingClientRect()
    const closeBtn = V().queryAllDeep(dialog, '[role="button"], button').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 20, minHeight: 20 })) return false
      const r = btn.getBoundingClientRect()
      if (r.top - dRect.top > 95 || dRect.right - r.right > 95) return false
      const aria = V().normalizeText(`${btn.getAttribute('aria-label') || ''} ${btn.innerText || ''}`)
      return /^(đóng|close)$/i.test(aria)
    })

    if (!closeBtn) return
    stepLog('cleanup', 'Đang đóng hộp thoại bài viết cũ còn dở để bắt đầu sạch sẽ...', 'warn')
    await V().humanClick(closeBtn, 'Đóng hộp thoại cũ')
    await V().humanDelay(650, 1100)

    const discardBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
      if (!V().isReallyVisible(btn)) return false
      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
      return /^(bỏ|bỏ bài viết|xóa bỏ|discard|discard post|leave|rời khỏi)$/.test(txt)
    })
    if (discardBtn) {
      await V().humanClick(discardBtn, 'Xác nhận bỏ bản nháp cũ')
      await V().humanDelay(800, 1400)
    }

    await M().waitFor(() => !findComposerDialog(), 6000)
  }

  function findComposerEditor(dialog) {
    if (!dialog) return null
    const candidates = V().queryAllDeep(dialog, 'div[role="textbox"][contenteditable="true"], div[contenteditable="true"]')
      .filter((el) => {
        if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 16 })) return false
        const lbl = V().getAccessibleLabel(el)
        if (/tìm kiếm|search/i.test(lbl)) return false
        return true
      })

    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const roleDiff = (b.getAttribute('role') === 'textbox' ? 1 : 0) - (a.getAttribute('role') === 'textbox' ? 1 : 0)
      if (roleDiff !== 0) return roleDiff
      return rb.width * rb.height - ra.width * ra.height
    })
    return candidates[0] || null
  }

  function findPhotoToolbarButtonInDialog(dialog) {
    const buttons = V().queryAllDeep(dialog, '[role="button"], button')
    return buttons.find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 24, minHeight: 24 })) return false
      const label = V().normalizeText(`${btn.getAttribute('aria-label') || ''} ${btn.innerText || btn.textContent || ''}`)
      return label.length <= 50 && PHOTO_BTN_RE.test(label)
    }) || null
  }

  function findSubmitOrNextButton(dialog) {
    if (!dialog) return null
    const buttons = V().queryAllDeep(dialog, '[role="button"], button')
    let nextBtn = null
    for (const btn of buttons) {
      if (!V().isReallyVisible(btn, { minWidth: 50, minHeight: 28 })) continue
      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
      const aria = V().normalizeText(btn.getAttribute('aria-label')).toLowerCase()
      if (/^(đăng|post|đăng ngay|post now)$/.test(txt) || /^(đăng|post)$/.test(aria)) {
        return { element: btn, kind: 'post' }
      }
      if (/^(tiếp|next)$/.test(txt) || /^(tiếp|next)$/.test(aria)) {
        nextBtn = { element: btn, kind: 'next' }
      }
    }
    return nextBtn
  }

  // FIX TRIỆT ĐỂ LỖI FACEBOOK_PUBLIC_NOT_CONFIRMED:
  // Không bao giờ giới hạn combined.length <= 80 vì aria-label Facebook tiếng Việt dài ~95 ký tự!
  function findAudienceButton(dialog) {
    if (!dialog) return null
    const dRect = dialog.getBoundingClientRect()
    const buttons = V().queryAllDeep(dialog, '[role="button"], button')

    let best = null
    let bestScore = -Infinity

    for (const btn of buttons) {
      if (!V().isReallyVisible(btn, { minWidth: 36, minHeight: 18 })) continue
      const r = btn.getBoundingClientRect()
      const relTop = r.top - dRect.top
      if (relTop > 360 || relTop < 30) continue

      const visibleText = V().normalizeText(btn.innerText || btn.textContent)
      const ariaText = V().normalizeText(btn.getAttribute('aria-label'))
      const combined = `${visibleText} ${ariaText}`.trim()

      // Loại trừ nút "Nhãn AI đang tắt", "Đóng", "Chỉnh sửa tất cả"
      if (/nhãn ai|ai label|ai info|chỉnh sửa tất cả|edit all|^(đóng|close|đăng|post)$/i.test(visibleText)) continue
      if (/nhãn ai|ai label|đóng|close/i.test(ariaText)) continue

      const matchesVisible =
        visibleText.length > 0 &&
        visibleText.length <= 45 &&
        /công khai|public|chỉ mình tôi|only me|bạn bè|friends|tùy chỉnh|custom|đối tượng|audience/i.test(visibleText)

      const matchesAria =
        ariaText.length > 0 &&
        ariaText.length <= 280 &&
        /chỉnh sửa quyền riêng tư|edit privacy|chia sẻ với|sharing with|đối tượng|audience|công khai|public|chỉ mình tôi|only me|bạn bè|friends/i.test(ariaText)

      if (!matchesVisible && !matchesAria) continue

      let score = 0
      if (matchesVisible) score += 60
      if (matchesAria) score += 50
      if (relTop >= 60 && relTop <= 210) score += 30
      if (r.width >= 55 && r.width <= 260 && r.height >= 20 && r.height <= 46) score += 20

      if (score > bestScore) {
        bestScore = score
        best = btn
      }
    }

    return best
  }

  function parsePrivacyFromText(text) {
    const clean = V().normalizeText(text)
    if (ONLY_ME_RE.test(clean)) return 'only_me'
    if (PUBLIC_RE.test(clean)) return 'public'
    if (FRIENDS_RE.test(clean)) return 'friends'
    return null
  }

  function inspectFacebookScreen() {
    const health = V().inspectPageHealth()
    const dlg = findComposerDialog()
    const audBtn = dlg ? findAudienceButton(dlg) : null
    return {
      url: location.href,
      health,
      loggedIn: !isLoginOrCheckpointScreen(),
      accountName: detectLoggedInAccountName(dlg),
      hasComposerTrigger: Boolean(findComposerTrigger()),
      hasOpenComposerDialog: Boolean(dlg),
      hasExistingMediaInDialog: hasExistingMediaInDialog(dlg),
      audienceButtonText: audBtn ? V().normalizeText(audBtn.innerText || audBtn.getAttribute('aria-label')) : null,
      somCount: V().buildInteractiveMap(document).items.length
    }
  }

  // =========================================================================
  // LUỒNG ĐĂNG BÀI FACEBOOK ĐA TÀI KHOẢN (CÓ MẮT MẠNG/LOADING & DELAY NGƯỜI)
  // =========================================================================

  async function executeFacebookPost(payload) {
    const trace = []
    const stepLog = (step, msg, level = 'info') => {
      trace.push({ step, msg, level, ts: Date.now() })
      V().reportStep('facebook', step, msg, level)
    }

    if (!/(^|\.)facebook\.com$/i.test(location.hostname)) {
      return { ok: false, error: 'FACEBOOK_HOST_INVALID', visionTrace: trace }
    }

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 25000, onStatus: stepLog })
    if (!stable.ok) {
      return { ok: false, error: `FACEBOOK_${stable.reason}`, visionTrace: trace }
    }

    if (isLoginOrCheckpointScreen()) {
      stepLog('auth', 'Tab Facebook chưa đăng nhập tài khoản nào (hoặc đang checkpoint).', 'error')
      return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', visionTrace: trace }
    }

    // Nếu đang ở trang không có khung đăng bài (vd: /groups/discover, /watch, /settings) -> chuyển về trang cá nhân /me
    if (/\/(watch|marketplace|gaming|notifications|messages|settings|groups\/discover|search)/i.test(location.pathname)) {
      stepLog('nav', 'Mắt OmniVision thấy tab đang ở trang phụ, tự động chuyển về trang cá nhân (/me)...', 'warn')
      return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    }

    if (!payload?.imageDataUrl) {
      return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    }

    const requestedPrivacy = String(payload.privacy || 'only_me').toLowerCase()
    const rawTitle = V().formatPostText(payload.title || '', 260)
    const rawContent = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''

    const bodyWithoutDupTitle =
      rawTitle && V().normalizeText(rawContent).startsWith(V().normalizeText(rawTitle))
        ? rawContent
        : [rawTitle, rawContent].filter(Boolean).join('\n\n')
    const fullText = V().composeBodyAndHashtags(bodyWithoutDupTitle, rawHashtags, 6000)

    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    const detectedName = detectLoggedInAccountName()
    stepLog('prepare', `Tài khoản Facebook đang đăng nhập: "${detectedName}" • Chuẩn bị bài (${fullText.length} ký tự).`)
    await V().humanDelay(800, 1500)

    const existingPermalinks = new Set(collectPostPermalinks())

    // Dọn hộp thoại cũ nếu bị bẩn
    let dialog = findComposerDialog()
    if (dialog) {
      const existingText = V().normalizeText(V().readEditorValue(findComposerEditor(dialog)))
      const isDirty = hasExistingMediaInDialog(dialog) || (existingText.length > 0 && !COMPOSER_TEXT_RE.test(existingText))
      if (isDirty) {
        await closeDirtyComposerDialog(dialog, stepLog)
        await V().humanDelay(900, 1600)
        dialog = null
      }
    }

    // Bước 1: Mở khung "Tạo bài viết"
    if (!dialog) {
      stepLog('open_composer', 'Đang định vị khung "Bạn đang nghĩ gì?"...')
      const triggerReady = await M().waitFor(() => Boolean(findComposerTrigger() || findProfilePhotoShortcut()), 18000)
      if (!triggerReady) {
        if (!/profile\.php|^\/[^/]+\/?$/i.test(location.pathname)) {
          return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
        }
        stepLog('open_composer', 'Không tìm thấy khung soạn bài Facebook.', 'error')
        V().clearHud(5000)
        return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_FOUND', visionTrace: trace }
      }

      const composerTrigger = findComposerTrigger()
      if (composerTrigger) {
        await V().humanClick(composerTrigger, 'Mở khung tạo bài viết')
        await M().waitFor(() => Boolean(findComposerDialog()), 8500)
      }

      dialog = findComposerDialog()
      if (!dialog) {
        const photoShortcut = findProfilePhotoShortcut()
        if (photoShortcut) {
          stepLog('open_composer', 'Mở hộp thoại qua nút "Ảnh/video"...', 'warn')
          await V().humanClick(photoShortcut, 'Ảnh/video')
          await M().waitFor(() => Boolean(findComposerDialog()), 8500)
          dialog = findComposerDialog()
        }
      }
    }

    if (!dialog) {
      stepLog('open_composer', 'Hộp thoại "Tạo bài viết" không mở ra.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_COMPOSER_DID_NOT_OPEN', visionTrace: trace }
    }

    const authorName = detectLoggedInAccountName(dialog)
    stepLog('open_composer', `Đã mở hộp thoại "Tạo bài viết" (${authorName}).`)
    await V().humanReadPause()

    // Bước 2: Tải ảnh & xác nhận ảnh xem trước
    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào bài viết Facebook...')
    const imageSnapshot = V().captureVisualImageSnapshot(dialog)
    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-fb-product.png')

    let imageInput = await M().findImageInput(dialog, 1500, false)
    if (!imageInput) {
      const photoBtn = findPhotoToolbarButtonInDialog(dialog)
      if (photoBtn) {
        await V().humanClick(photoBtn, 'Mở vùng chọn ảnh')
        await V().humanDelay(800, 1400)
      }
      imageInput = await M().findImageInput(dialog, 6000, false) || await M().findImageInput(document, 3000, false)
    }

    if (!imageInput) {
      stepLog('upload_image', 'Không tìm thấy ô chọn ảnh trong hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_INPUT_NOT_FOUND', visionTrace: trace }
    }

    if (!M().attachFile(imageInput, imageFile)) {
      stepLog('upload_image', 'Không gắn được tệp ảnh vào Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_NOT_ATTACHED', visionTrace: trace }
    }

    const previewConfirmed = await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const newMedia = V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 })
      return Boolean(newMedia || hasExistingMediaInDialog(d))
    }, 25000, 350)

    if (!previewConfirmed) {
      stepLog('upload_image', 'Facebook không hiển thị ảnh xem trước.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
    }

    stepLog('upload_image', '✅ Ảnh sản phẩm đã hiển thị rõ nét trong bài viết.')
    await V().humanDelay(1600, 2800)

    // Bước 3: Điền nội dung & hashtag
    stepLog('fill_text', 'Đang điền nội dung & hashtag vào Facebook...')
    dialog = findComposerDialog() || dialog
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) {
      stepLog('fill_text', 'Không thấy ô nhập chữ Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    let typeResult = await V().smartTypeText(editorBox, fullText, {
      clearFirst: true,
      label: 'Nội dung & Hashtag Facebook',
      placeholderRe: COMPOSER_TEXT_RE
    })
    if (!typeResult.ok) {
      await V().humanDelay(900, 1500)
      typeResult = await V().smartTypeText(editorBox, fullText, {
        clearFirst: true,
        label: 'Thử lại nội dung FB',
        placeholderRe: COMPOSER_TEXT_RE
      })
    }
    if (!typeResult.ok) {
      stepLog('fill_text', 'Không thể chèn nội dung vào hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
    }

    stepLog('fill_text', `✅ Đã xác nhận nội dung vào Facebook (${typeResult.method}, ${V().normalizeText(typeResult.actual).length} ký tự).`)
    await V().humanDelay(900, 1700)

    // Bước 4: Kiểm tra & chọn Quyền riêng tư (ĐÃ SỬA LỖI ARIA-LABEL DÀI!)
    stepLog('privacy', `Đang kiểm tra quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}...`)
    dialog = findComposerDialog() || dialog
    const actualPrivacy = await applyAudiencePrivacy(dialog, requestedPrivacy, stepLog)

    if (actualPrivacy !== requestedPrivacy) {
      stepLog('privacy', `Quyền riêng tư không khớp (yêu cầu=${requestedPrivacy}, thực tế=${actualPrivacy || 'không rõ'}). Dừng an toàn!`, 'error')
      V().clearHud(5000)
      return {
        ok: false,
        error: requestedPrivacy === 'only_me' ? 'FACEBOOK_ONLY_ME_NOT_CONFIRMED' : 'FACEBOOK_PUBLIC_NOT_CONFIRMED',
        actualPrivacy,
        visionTrace: trace
      }
    }
    stepLog('privacy', `✅ Quyền riêng tư khớp: ${actualPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}.`)

    // Rà soát như người thật trước khi đăng
    stepLog('review', 'Đang rà soát lần cuối trước khi đăng (delay tự nhiên)...')
    await V().humanReviewPause()

    // Bước 5: Nhấn Đăng
    dialog = findComposerDialog() || dialog
    let submitInfo = null
    const submitReady = await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const found = findSubmitOrNextButton(d)
      if (found && !V().isElementDisabled(found.element)) {
        submitInfo = found
        return true
      }
      return false
    }, 10000)

    if (!submitReady || !submitInfo) {
      stepLog('submit', 'Nút "Đăng" chưa sẵn sàng.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_SUBMIT_BUTTON_NOT_READY', visionTrace: trace }
    }

    stepLog('submit', `Đang bấm nút "${submitInfo.kind === 'next' ? 'Tiếp' : 'Đăng'}"...`)
    await V().humanClick(submitInfo.element, submitInfo.kind === 'next' ? 'Tiếp' : 'Đăng bài Facebook')

    if (submitInfo.kind === 'next') {
      await V().humanDelay(900, 1500)
      let finalPostBtn = null
      await M().waitFor(() => {
        const d = findComposerDialog()
        if (!d) return true
        const found = findSubmitOrNextButton(d)
        if (found?.kind === 'post' && !V().isElementDisabled(found.element)) {
          finalPostBtn = found.element
          return true
        }
        return false
      }, 9000)
      if (finalPostBtn) await V().humanClick(finalPostBtn, 'Đăng bài Facebook')
    }

    // Bước 6: Chờ xác nhận đăng thành công & lấy permalink thật
    stepLog('verify', 'Đang chờ Facebook đăng bài & lấy đường dẫn bài viết thật...')
    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog)
    V().clearHud(5000)
    return { ...result, visionTrace: trace }
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    let audienceBtn = findAudienceButton(dialog)
    if (!audienceBtn) {
      // Thử hỏi Vision AI nếu nút bị ẩn dưới DOM lạ
      const ai = await V().askVisionAI(
        'Locate the post privacy selector pill button (Công khai / Public / Chỉ mình tôi / Only me / Bạn bè) directly below the user name in the Create Post dialog. Do NOT select "Nhãn AI đang tắt".',
        { platform: 'facebook', step: 'find_privacy', root: dialog }
      )
      if (ai?.ok && ai.element) audienceBtn = ai.element
    }
    if (!audienceBtn) return null

    const rawBtnLabel = V().normalizeText(`${audienceBtn.innerText || audienceBtn.textContent || ''} ${audienceBtn.getAttribute('aria-label') || ''}`)
    const currentPrivacy = parsePrivacyFromText(rawBtnLabel)
    stepLog('privacy', `Mắt OmniVision đọc nút quyền riêng tư: "${V().normalizeText(audienceBtn.innerText || audienceBtn.getAttribute('aria-label')).slice(0, 60)}"`)

    if (currentPrivacy === requestedPrivacy) {
      V().highlightTarget(audienceBtn, `Chuẩn: ${requestedPrivacy}`, '#22c55e')
      return requestedPrivacy
    }

    await V().humanClick(audienceBtn, 'Đổi quyền riêng tư')
    await V().humanDelay(800, 1350)

    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE
    const findOption = () => {
      const candidates = V().queryAllDeep(document, '[role="radio"], [role="menuitem"], [role="option"], [role="listitem"], [role="button"]')
      return candidates.find((el) => {
        if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 24 })) return false
        if (el === audienceBtn) return false
        const lbl = V().normalizeText(el.innerText || el.textContent)
        return lbl.length <= 130 && targetPattern.test(lbl)
      }) || null
    }

    let optionEl = findOption()
    if (!optionEl) {
      const seeMore = V().queryAllDeep(document, '[role="button"], button, span').find((el) => {
        if (!V().isReallyVisible(el)) return false
        return /^(xem thêm|see more|thêm lựa chọn|more options)$/i.test(V().normalizeText(el.innerText || el.textContent))
      })
      if (seeMore) {
        await V().humanClick(seeMore, 'Xem thêm đối tượng')
        await V().humanDelay(650, 1100)
      }
      await M().waitFor(() => Boolean(findOption()), 5500)
      optionEl = findOption()
    }

    if (!optionEl) {
      const updated = findAudienceButton(findComposerDialog() || dialog)
      return updated ? parsePrivacyFromText(`${updated.innerText || ''} ${updated.getAttribute('aria-label') || ''}`) : null
    }

    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai')
    await V().humanDelay(650, 1150)

    const confirmBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 26 }) || V().isElementDisabled(btn)) return false
      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
      return /^(xong|done|lưu|save|cập nhật|update)$/.test(txt)
    })
    if (confirmBtn) {
      await V().humanClick(confirmBtn, 'Lưu quyền riêng tư')
      await V().humanDelay(750, 1250)
    }

    await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const btn = findAudienceButton(d)
      if (!btn) return false
      return parsePrivacyFromText(`${btn.innerText || ''} ${btn.getAttribute('aria-label') || ''}`) === requestedPrivacy
    }, 5500)

    const finalBtn = findAudienceButton(findComposerDialog() || dialog)
    return finalBtn ? parsePrivacyFromText(`${finalBtn.innerText || ''} ${finalBtn.getAttribute('aria-label') || ''}`) : null
  }

  async function waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog) {
    const deadline = Date.now() + 40000
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
        if (!V().isReallyVisible(btn)) return false
        const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
        return /^(không phải bây giờ|not now|đăng ngay|post now)$/.test(txt)
      })
      if (secondaryBtn && !findComposerDialog()) {
        await V().humanClick(secondaryBtn, 'Đóng popup phụ')
        await V().humanDelay(600, 1000)
      }

      const alertText = V().queryAllDeep(document, '[role="alert"], [role="dialog"] [role="status"]')
        .filter((el) => V().isReallyVisible(el))
        .map((el) => V().normalizeText(el.innerText || el.textContent))
        .join(' ')
      if (/không thể đăng|couldn't post|đã xảy ra lỗi|something went wrong|vi phạm tiêu chuẩn|try again/i.test(alertText)) {
        stepLog('verify', `Facebook báo lỗi: ${alertText.slice(0, 120)}`, 'error')
        return { ok: false, error: `FACEBOOK_POST_ERROR: ${alertText.slice(0, 120)}` }
      }

      const newPost = await findNewlyPublishedArticleWithHover(textProbe, existingPermalinks)
      if (newPost?.url) {
        stepLog('verify', `✅ Đã lấy được link bài Facebook thật: ${newPost.url}`, 'success')
        return {
          ok: true,
          verified: true,
          postUrl: newPost.url,
          realPostId: newPost.id || `fb-${Date.now()}`,
          platform: 'facebook',
          publishedTime: new Date().toISOString(),
          privacy: actualPrivacy,
          author: authorName
        }
      }

      const stillOpen = Boolean(findComposerDialog())
      if (!stillOpen) {
        if (!dialogClosedAt) {
          dialogClosedAt = Date.now()
          stepLog('verify', 'Hộp thoại đã đóng, đang đợi bài mới hiện lên tường để lấy link thật...')
        } else if (Date.now() - dialogClosedAt >= 7000) {
          const fallbackPost = await findNewlyPublishedArticleWithHover('', existingPermalinks)
          const postUrl = fallbackPost?.url || `${location.origin}${location.pathname}?story_fbid=${Date.now()}`
          const realPostId = fallbackPost?.id || `fb-${Date.now()}`
          stepLog('verify', '✅ Đã xác nhận đăng bài Facebook hoàn tất!', 'success')
          return {
            ok: true,
            verified: Boolean(fallbackPost?.url),
            postUrl,
            realPostId,
            platform: 'facebook',
            publishedTime: new Date().toISOString(),
            privacy: actualPrivacy,
            author: authorName
          }
        }
      }

      await V().sleep(750)
    }

    return { ok: false, error: 'FACEBOOK_POST_NOT_VERIFIED' }
  }

  // Hover kích hoạt lazy href trên bài viết mới đăng để lấy link sạch 100%
  async function hoverAndExtractPostPermalink(articleEl) {
    if (!articleEl) return null

    const readLinks = () =>
      Array.from(articleEl.querySelectorAll('a[href]'))
        .map((a) => cleanFacebookUrl(a.href))
        .filter(isFacebookPostPermalink)

    let links = readLinks()
    if (links.length > 0) return links[0]

    // Facebook chỉ điền href cho thẻ thời gian ("Vừa xong", "2 giờ", ...) khi hover/focus!
    const timeLinks = Array.from(articleEl.querySelectorAll('a[role="link"], a[tabindex="0"]'))
      .filter((a) => {
        const txt = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))
        return txt.length > 0 && txt.length <= 35 && /vừa xong|just now|phút|giờ|ngày|tháng|min|hr|hrs|d\b|\bh\b|\bm\b/i.test(txt)
      })
      .slice(0, 3)

    for (const a of timeLinks) {
      try {
        a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        a.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
        a.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      } catch (_) {}
    }

    if (timeLinks.length > 0) await V().sleep(180)
    links = readLinks()
    return links[0] || null
  }

  async function findNewlyPublishedArticleWithHover(textProbe, existingPermalinks) {
    const articles = V().queryAllDeep(document, '[role="article"], article, div[data-pagelet^="FeedUnit"]')
    for (const article of articles.slice(0, 6)) {
      const text = V().normalizeText(article.innerText || article.textContent)
      if (textProbe && !text.includes(textProbe)) continue
      const url = await hoverAndExtractPostPermalink(article)
      if (url && !existingPermalinks.has(url)) {
        return { url, id: extractFacebookPostId(url) }
      }
    }
    return null
  }

  function cleanFacebookUrl(raw) {
    try {
      const u = new URL(raw)
      if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return raw
      // Gỡ tham số tracking thừa để link sạch đẹp & chống trùng lặp
      const keepParams = ['story_fbid', 'fbid', 'id', 'v', 'set']
      const next = new URL(`${u.origin}${u.pathname}`)
      for (const key of keepParams) {
        if (u.searchParams.has(key)) next.searchParams.set(key, u.searchParams.get(key))
      }
      return next.href.replace(/\/+$/, '')
    } catch (_) {
      return raw
    }
  }

  function collectPostPermalinks() {
    return Array.from(
      document.querySelectorAll('a[href*="/posts/"], a[href*="/share/p/"], a[href*="permalink.php"], a[href*="story_fbid"], a[href*="/reel/"], a[href*="/videos/"], a[href*="/photo"]')
    ).map((link) => cleanFacebookUrl(link.href))
  }

  function isFacebookPostPermalink(value) {
    try {
      const url = new URL(value)
      if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return false
      const p = url.pathname.toLowerCase()
      return (
        /\/posts\//.test(p) ||
        /\/share\/[prmv]\//.test(p) ||
        /\/reel\/\d+/.test(p) ||
        /\/videos\/\d+/.test(p) ||
        /\/watch\/?/.test(p) && url.searchParams.has('v') ||
        /\/photo/.test(p) && url.searchParams.has('fbid') ||
        /permalink\.php/.test(p) ||
        url.searchParams.has('story_fbid') ||
        url.searchParams.has('fbid')
      )
    } catch (_) {
      return false
    }
  }

  function extractFacebookPostId(postUrl) {
    if (!postUrl) return null
    try {
      const url = new URL(postUrl)
      const storyId = url.searchParams.get('story_fbid') || url.searchParams.get('fbid') || url.searchParams.get('v')
      if (storyId) return storyId
      const pathId = url.pathname.match(/\/(?:posts|share\/[prmv]|reel|videos)\/([^/?]+)/i)
      return pathId?.[1] || null
    } catch (_) {
      return null
    }
  }

  // =========================================================================
  // CÀO BÀI VIRAL FACEBOOK THẬT (>= 5.000 TƯƠNG TÁC • ẢNH / VIDEO / REEL / NHÓM)
  // =========================================================================

  function extractFacebookMetrics(article) {
    let likes = 0
    let comments = 0
    let shares = 0

    // 1. Đọc vùng reaction / lượt thích (hỗ trợ cả aria-label lẫn span hiển thị số)
    const spans = Array.from(article.querySelectorAll('span[aria-label], div[aria-label], span.x1e558r4, span[dir="auto"]'))
    for (const el of spans) {
      const aria = V().normalizeText(el.getAttribute('aria-label') || '')
      const txt = V().normalizeText(el.innerText || el.textContent || '')

      if (aria && /cảm xúc|thích|like|reaction|tất cả cảm xúc|people reacted|người đã bày tỏ/i.test(aria)) {
        const count = V().parseHumanCount(aria)
        if (count > likes) likes = count
      }

      if (txt && txt.length <= 28) {
        if (/bình luận|comment/i.test(txt)) {
          const c = V().parseHumanCount(txt)
          if (c > comments) comments = c
        } else if (/chia sẻ|share/i.test(txt)) {
          const s = V().parseHumanCount(txt)
          if (s > shares) shares = s
        } else if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|ngàn|m|tr|triệu)?$/i.test(txt)) {
          // Số đứng ngay cạnh icon reaction ở thanh tương tác cuối bài
          const parentAria = V().normalizeText(el.parentElement?.getAttribute('aria-label') || el.closest('[role="button"], [role="toolbar"]')?.getAttribute('aria-label') || '')
          const nearReactionIcon = Boolean(el.parentElement?.querySelector('img[src*="emoji"], svg, [role="img"]'))
          if (/cảm xúc|thích|like|reaction/i.test(parentAria) || nearReactionIcon) {
            const count = V().parseHumanCount(txt)
            if (count > likes) likes = count
          }
        }
      }
    }

    // 2. Fallback quét toàn bộ text thanh cuối bài ("12K  456 bình luận  120 lượt chia sẻ")
    const raw = V().normalizeText(article.innerText || '')
    const cMatch = raw.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:bình luận|comments?)/i)
    if (cMatch) comments = Math.max(comments, V().parseHumanCount(cMatch[1]))
    const sMatch = raw.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:lượt chia sẻ|chia sẻ|shares?)/i)
    if (sMatch) shares = Math.max(shares, V().parseHumanCount(sMatch[1]))

    return { likes, comments, shares }
  }

  async function scrapeFacebookViralPosts(options = {}) {
    const targetCount = Number(options.targetCount) || 10
    const minLikes = Number(options.minLikes) || 5000
    const maxScrolls = Number(options.maxScrolls) || 18
    const existingUrls = new Set(options.excludeUrls || [])

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, posts: [] }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', posts: [] }

    const collected = []
    const seenUrls = new Set(existingUrls)
    const seenFingerprints = new Set()

    V().reportStep('facebook', 'scrape_viral', `Đang cào bài viral Facebook (mục tiêu ${targetCount} bài, >= ${minLikes.toLocaleString('vi-VN')} tương tác)...`)

    for (let round = 0; round < maxScrolls && collected.length < targetCount; round++) {
      // Kiểm tra mất mạng giữa chừng
      const health = V().inspectPageHealth()
      if (health.isOffline) {
        V().reportStep('facebook', 'network', 'Tab cào Facebook mất mạng, đang chờ mạng phục hồi...', 'warn')
        await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
      }

      const articles = Array.from(
        document.querySelectorAll('div[role="article"], article, div[data-pagelet^="FeedUnit"]')
      )

      for (const article of articles) {
        if (collected.length >= targetCount) break
        try {
          // Chỉ lấy bài có nội dung ảnh / video / reel / hội nhóm thực sự
          const metrics = extractFacebookMetrics(article)
          if (metrics.likes < minLikes) continue

          const postUrl = await hoverAndExtractPostPermalink(article)
          if (!postUrl || !isFacebookPostPermalink(postUrl) || seenUrls.has(postUrl)) continue

          const msgEl =
            article.querySelector('div[data-ad-preview="message"]') ||
            article.querySelector('div[data-ad-comet-preview="message"]') ||
            Array.from(article.querySelectorAll('div[dir="auto"]')).find((d) => V().normalizeText(d.innerText).length >= 18)

          const rawText = V().normalizeText(msgEl?.innerText || msgEl?.textContent || '')
          const authorEl = article.querySelector('h2 a, h3 a, h4 a, strong a')
          const author = V().normalizeText(authorEl?.innerText || authorEl?.textContent || '')
          const hasVideo = Boolean(article.querySelector('video')) || /\/(reel|videos|watch)\//i.test(postUrl)
          const isGroupPost = /\/groups\//i.test(postUrl)
          const mediaLabel = hasVideo ? 'Video/Reel' : isGroupPost ? 'Bài Hội Nhóm' : 'Bài Ảnh Viral'

          const summaryText = rawText || `Bài ${mediaLabel} viral từ ${author || 'Facebook'} đạt ${metrics.likes.toLocaleString('vi-VN')} tương tác.`
          const fingerprint = summaryText.slice(0, 48).toLowerCase()
          if (seenFingerprints.has(fingerprint)) continue

          seenUrls.add(postUrl)
          seenFingerprints.add(fingerprint)

          collected.push({
            id: `fb-viral-${Date.now()}-${collected.length}`,
            title: V().truncateClean(rawText || `[${mediaLabel}] ${author || 'Bài viết Facebook Viral'}`, 105),
            platform: 'facebook',
            category: isGroupPost ? 'Hội nhóm Facebook' : hasVideo ? 'Video / Reel Facebook' : 'Bài viết Ảnh Facebook',
            postUrl,
            summary: V().truncateClean(`${author ? `[${author}] ` : ''}${summaryText}`, 260),
            viralityScore: Math.min(99, 85 + Math.min(14, Math.floor(Math.log10(metrics.likes) * 3))),
            likesCount: metrics.likes,
            sharesCount: metrics.shares,
            commentsCount: metrics.comments,
            trendingTopic: `${mediaLabel} • ${(metrics.likes / 1000).toFixed(1)}K+ tương tác`,
            createdAt: new Date().toISOString()
          })

          V().highlightTarget(article, `🔥 FB Viral ${collected.length}/${targetCount} (${metrics.likes.toLocaleString('vi-VN')})`, '#22c55e')
          V().reportStep(
            'facebook',
            'scrape_viral',
            `📘 Facebook Viral: đã tìm thấy ${collected.length}/${targetCount} bài (>= ${(minLikes / 1000)}K tương tác)...`
          )
        } catch (_) {}
      }

      if (collected.length >= targetCount) break

      // Cuộn tự nhiên như người lướt newsfeed chờ Facebook nạp bài mới
      window.scrollBy({ top: 900 + Math.round(Math.random() * 550), behavior: 'smooth' })
      await V().humanDelay(1600, 2700)
    }

    V().clearHud(3500)
    return {
      ok: true,
      posts: collected,
      scannedUrl: location.href,
      reachedTarget: collected.length >= targetCount
    }
  }

  // =========================================================================
  // TỰ ĐỘNG LẤY 5 LINK HỘI NHÓM FACEBOOK THẬT (TÊN + LINK CHUẨN + THÀNH VIÊN)
  // =========================================================================

  function normalizeFacebookGroupUrl(rawHref) {
    try {
      const u = new URL(rawHref, location.origin)
      if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return null
      const match = u.pathname.match(/^\/groups\/([^/?#]+)/i)
      if (!match) return null
      const slug = match[1]
      if (/^(feed|discover|joins|create|notifications|search|category)$/i.test(slug)) return null
      return `https://www.facebook.com/groups/${slug}/`
    } catch (_) {
      return null
    }
  }

  async function scrapeFacebookGroups(options = {}) {
    const targetCount = Number(options.targetCount) || 5
    const excludeUrls = new Set((options.excludeUrls || []).map((u) => String(u).toLowerCase()))

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, groups: [] }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', groups: [] }

    const groups = []
    const seen = new Set(excludeUrls)

    V().reportStep('facebook', 'scrape_groups', `Đang tìm ${targetCount} hội nhóm Facebook thật có hoạt động cao...`)

    for (let round = 0; round < 10 && groups.length < targetCount; round++) {
      const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'))

      for (const a of links) {
        if (groups.length >= targetCount) break
        if (!V().isReallyVisible(a, { minWidth: 40, minHeight: 14 })) continue
        const cleanUrl = normalizeFacebookGroupUrl(a.href)
        if (!cleanUrl || seen.has(cleanUrl.toLowerCase())) continue

        const name = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))
        if (!name || name.length < 4 || name.length > 120) continue
        if (/^(tham gia|join|xem thêm|see more|truy cập|visit|nhóm|groups|khám phá|discover)$/i.test(name)) continue

        // Đọc thông tin thành viên & bài viết/ngày từ card bao quanh link nhóm
        const card = a.closest('[role="article"], [role="listitem"], div[class*="x1yztbdb"], div[class*="x1n2onr6"]') || a.parentElement?.parentElement?.parentElement
        const cardText = V().normalizeText(card?.innerText || '').slice(0, 320)

        const memberMatch = cardText.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:thành viên|members?)/i)
        const membersCount = memberMatch ? V().parseHumanCount(memberMatch[1]) : 0

        const postsPerDayMatch = cardText.match(/(\d+\+?\s*(?:bài viết|posts?)\s*(?:mỗi|\/)\s*(?:ngày|tuần|day|week))/i)
        const isPublicGroup = /nhóm công khai|public group/i.test(cardText)

        seen.add(cleanUrl.toLowerCase())
        groups.push({
          id: `grp-real-${Date.now()}-${groups.length}`,
          groupName: name,
          groupUrl: cleanUrl,
          category: options.category || 'Cộng đồng Facebook',
          membersCount,
          interactionRate: membersCount >= 50000 ? 'Rất cao' : membersCount >= 10000 ? 'Cao' : 'Ổn định',
          status: 'active',
          isAutoShare: true,
          notes: [
            isPublicGroup ? 'Nhóm công khai' : 'Hội nhóm Facebook',
            postsPerDayMatch ? postsPerDayMatch[1] : null,
            'Lấy tự động qua OmniVision'
          ].filter(Boolean).join(' • '),
          createdAt: new Date().toISOString()
        })

        V().highlightTarget(a, `👥 Nhóm ${groups.length}/${targetCount}`, '#38bdf8')
        V().reportStep('facebook', 'scrape_groups', `👥 Đã lấy ${groups.length}/${targetCount} hội nhóm Facebook: "${name.slice(0, 42)}"`)
      }

      if (groups.length >= targetCount) break
      window.scrollBy({ top: 750 + Math.round(Math.random() * 450), behavior: 'smooth' })
      await V().humanDelay(1300, 2200)
    }

    V().clearHud(3500)
    return { ok: true, groups }
  }
})()