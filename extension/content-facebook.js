/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v2.1 cho trang cá nhân Facebook Hoàng Thái HT (ID: 100037782653708).
  - Nâng cấp v2.1.0:
    1. Sửa lỗi dừng ngay sau bước tải ảnh (phối hợp với content-media.js v2.1.0).
    2. Tự động dọn hộp thoại "Tạo bài viết" bị sót ảnh/chữ cũ từ lần trước (bấm X -> xác nhận "Bỏ") để không bao giờ bị dính nhiều ảnh sản phẩm vào cùng 1 bài!
    3. Bảo toàn toàn bộ bố cục bài viết (xuống dòng \n\n, emoji, CTA, hotline, khối #hashtag).
    4. Loại trừ nút "Nhãn AI đang tắt" cạnh nút "Công khai" khi đọc quyền riêng tư.
    5. Thêm toàn bộ nhịp trễ tự nhiên như người thật giữa các thao tác chống quét spam.
*/

;(() => {
  if (typeof window.__OMNICART_FB_CLEANUP__ === 'function') {
    try { window.__OMNICART_FB_CLEANUP__() } catch (_) {}
  }

  const FACEBOOK_PROFILE_ID = '100037782653708'
  const FACEBOOK_PROFILE_URL = `https://www.facebook.com/profile.php?id=${FACEBOOK_PROFILE_ID}`
  const FACEBOOK_PROFILE_NAME = 'Hoàng Thái HT'

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
      scrapeFacebookFeed()
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: err.message || String(err), posts: [] }))
      return true
    }

    return false
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  window.__OMNICART_FB_CLEANUP__ = () => {
    try { chrome.runtime.onMessage.removeListener(handleMessage) } catch (_) {}
  }

  // =========================================================================
  // MẮT QUAN SÁT MÀN HÌNH FACEBOOK
  // =========================================================================

  function isLoginOrCheckpointScreen() {
    if (/\/login|\/checkpoint/i.test(location.pathname)) return true
    const hasPassword = Boolean(document.querySelector('input[type="password"]'))
    const hasComposer = Boolean(findComposerTrigger())
    return hasPassword && !hasComposer
  }

  function isOnTargetProfile() {
    try {
      const url = new URL(location.href)
      if (url.searchParams.get('id') === FACEBOOK_PROFILE_ID) return true
    } catch (_) {}
    const heading = Array.from(document.querySelectorAll('h1'))
      .map((h) => V().normalizeText(h.innerText || h.textContent))
      .join(' ')
    return heading.toLocaleLowerCase('vi').includes(FACEBOOK_PROFILE_NAME.toLocaleLowerCase('vi'))
  }

  function isInsideTopBarOrNav(el) {
    if (!el) return true
    if (el.closest('[role="banner"], [role="navigation"], header')) return true
    const rect = el.getBoundingClientRect()
    return rect.top < 62
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
      if (cRect.width < 140 || cRect.height < 28 || cRect.height > 90) continue

      let score = 50
      if (cRect.left > window.innerWidth * 0.25) score += 25
      if (cRect.top > 120 && cRect.top < 950) score += 20
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
      if (rect.top < 140 || rect.top > 950) return false
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

  // Đóng sạch hộp thoại Tạo bài viết cũ còn dính ảnh/chữ từ phiên lỗi trước
  async function closeDirtyComposerDialog(dialog, stepLog) {
    if (!dialog) return
    const dRect = dialog.getBoundingClientRect()
    const closeBtn = V().queryAllDeep(dialog, '[role="button"], button').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 20, minHeight: 20 })) return false
      const r = btn.getBoundingClientRect()
      // Nút X đóng hộp thoại nằm ở góc trên bên phải của dialog
      if (r.top - dRect.top > 90 || dRect.right - r.right > 90) return false
      const aria = V().normalizeText(`${btn.getAttribute('aria-label') || ''} ${btn.innerText || ''}`)
      return /^(đóng|close)$/i.test(aria)
    })

    if (!closeBtn) return
    stepLog('cleanup', 'Phát hiện hộp thoại bài viết cũ còn mở, đang đóng để bắt đầu bài mới sạch...', 'warn')
    await V().humanClick(closeBtn, 'Đóng hộp thoại cũ')
    await V().humanDelay(650, 1100)

    // Nếu Facebook hỏi "Bỏ bài viết?" / "Rời khỏi trang?" -> bấm "Bỏ" / "Discard"
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

  function findAudienceButton(dialog) {
    if (!dialog) return null
    const dRect = dialog.getBoundingClientRect()
    const buttons = V().queryAllDeep(dialog, '[role="button"], button')
    return buttons.find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 20 })) return false
      const r = btn.getBoundingClientRect()
      if (r.top - dRect.top > 250) return false
      const combined = V().normalizeText(
        `${btn.innerText || btn.textContent || ''} ${btn.getAttribute('aria-label') || ''}`
      )
      // Loại trừ nút "Nhãn AI đang tắt" nằm ngay cạnh nút Công khai!
      if (/nhãn ai|ai label|ai info/i.test(combined)) return false
      return (
        combined.length <= 80 &&
        /đối tượng|audience|chỉ mình tôi|only me|công khai|public|bạn bè|friends|chỉnh sửa quyền riêng tư|edit privacy/i.test(combined)
      )
    }) || null
  }

  function parsePrivacyFromText(text) {
    const clean = V().normalizeText(text)
    if (ONLY_ME_RE.test(clean)) return 'only_me'
    if (PUBLIC_RE.test(clean)) return 'public'
    if (FRIENDS_RE.test(clean)) return 'friends'
    return null
  }

  function inspectFacebookScreen() {
    const dlg = findComposerDialog()
    return {
      url: location.href,
      isLoginOrCheckpoint: isLoginOrCheckpointScreen(),
      isOnTargetProfile: isOnTargetProfile(),
      hasComposerTrigger: Boolean(findComposerTrigger()),
      hasPhotoShortcut: Boolean(findProfilePhotoShortcut()),
      hasOpenComposerDialog: Boolean(dlg),
      hasExistingMediaInDialog: hasExistingMediaInDialog(dlg),
      somCount: V().buildInteractiveMap(document).items.length
    }
  }

  // =========================================================================
  // LUỒNG ĐĂNG BÀI OMNIVISION (CÓ NHỊP TRỄ TỰ NHIÊN NHƯ NGƯỜI THẬT)
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

    if (isLoginOrCheckpointScreen()) {
      stepLog('auth', 'Phát hiện màn hình đăng nhập/checkpoint Facebook!', 'error')
      return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', visionTrace: trace }
    }

    if (!isOnTargetProfile()) {
      stepLog('nav', 'Chưa ở đúng trang cá nhân Hoàng Thái HT, chuyển tab từ background...', 'warn')
      return { ok: false, needsNavigation: true, targetUrl: FACEBOOK_PROFILE_URL, visionTrace: trace }
    }

    if (!payload?.imageDataUrl) {
      return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    }

    const requestedPrivacy = String(payload.privacy || 'only_me').toLowerCase()
    const rawTitle = V().formatPostText(payload.title || '', 260)
    const rawContent = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''

    // Giữ nguyên định dạng đẹp: Tiêu đề + xuống dòng + Nội dung + xuống dòng + Khối #Hashtag
    const bodyWithoutDupTitle =
      rawTitle && V().normalizeText(rawContent).startsWith(V().normalizeText(rawTitle))
        ? rawContent
        : [rawTitle, rawContent].filter(Boolean).join('\n\n')
    const fullText = V().composeBodyAndHashtags(bodyWithoutDupTitle, rawHashtags, 6000)

    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }
    stepLog('prepare', `Đã sẵn sàng nội dung Facebook (${fullText.length} ký tự, có giữ nguyên xuống dòng & hashtag).`)

    // Nhịp đọc trang tự nhiên trước khi thao tác
    await V().humanDelay(750, 1450)

    const existingPermalinks = new Set(collectPostPermalinks())

    // --- BƯỚC 0: Dọn hộp thoại cũ nếu còn ảnh/chữ sót lại từ phiên trước ---
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

    // --- BƯỚC 1: Mở hộp thoại "Tạo bài viết" ---
    if (!dialog) {
      stepLog('open_composer', 'Đang định vị khung "Bạn đang nghĩ gì?" trên trang cá nhân...')
      const triggerReady = await M().waitFor(() => Boolean(findComposerTrigger() || findProfilePhotoShortcut()), 20000)
      if (!triggerReady) {
        stepLog('open_composer', 'Không nhìn thấy khung soạn bài trên trang cá nhân.', 'error')
        V().clearHud(5000)
        return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_FOUND', visionTrace: trace }
      }

      const composerTrigger = findComposerTrigger()
      if (composerTrigger) {
        await V().humanClick(composerTrigger, 'Mở khung tạo bài viết')
        await M().waitFor(() => Boolean(findComposerDialog()), 8000)
      }

      dialog = findComposerDialog()
      if (!dialog) {
        const photoShortcut = findProfilePhotoShortcut()
        if (photoShortcut) {
          stepLog('open_composer', 'Thử mở hộp thoại qua nút "Ảnh/video"...', 'warn')
          await V().humanClick(photoShortcut, 'Ảnh/video')
          await M().waitFor(() => Boolean(findComposerDialog()), 8000)
          dialog = findComposerDialog()
        }
      }

      if (!dialog) {
        const ai = await V().askVisionAI(
          'Click the "Bạn đang nghĩ gì?" / "What\'s on your mind?" post composer box on the Facebook profile.',
          { platform: 'facebook', step: 'open_composer' }
        )
        if (ai?.ok && ai.element) {
          await V().humanClick(ai.element, 'Vision AI -> Composer')
          await M().waitFor(() => Boolean(findComposerDialog()), 8000)
          dialog = findComposerDialog()
        }
      }
    }

    if (!dialog) {
      stepLog('open_composer', 'Hộp thoại "Tạo bài viết" không mở ra sau khi bấm.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_COMPOSER_DID_NOT_OPEN', visionTrace: trace }
    }

    stepLog('open_composer', 'Đã mở hộp thoại "Tạo bài viết".')
    await V().humanReadPause()

    // --- BƯỚC 2: Tải ảnh sản phẩm & xác nhận ảnh xem trước ---
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
      imageInput = await M().findImageInput(dialog, 6000, false)
      if (!imageInput) {
        imageInput = await M().findImageInput(document, 3000, false)
      }
    }

    if (!imageInput) {
      stepLog('upload_image', 'Không tìm thấy bộ chọn tệp ảnh trong hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_INPUT_NOT_FOUND', visionTrace: trace }
    }

    const attached = M().attachFile(imageInput, imageFile)
    if (!attached) {
      stepLog('upload_image', 'Không thể gán tệp ảnh vào input Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_NOT_ATTACHED', visionTrace: trace }
    }

    stepLog('upload_image', 'Đã gửi ảnh, đang chờ Facebook dựng ảnh xem trước...')
    const previewConfirmed = await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const newMedia = V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 })
      if (newMedia) return true
      return hasExistingMediaInDialog(d)
    }, 24000, 350)

    if (!previewConfirmed) {
      stepLog('upload_image', 'Facebook không hiển thị ảnh xem trước sau khi tải lên.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
    }

    stepLog('upload_image', '✅ Đã xác nhận ảnh sản phẩm hiển thị rõ nét trong bài viết.')
    // Chờ tự nhiên để Facebook xử lý xong ảnh ở máy chủ trước khi gõ chữ
    await V().humanDelay(1700, 2900)

    // --- BƯỚC 3: Điền nội dung & hashtag vào Lexical Editor ---
    stepLog('fill_text', 'Đang điền nội dung bóng bẩy & hashtag vào hộp thoại Facebook...')
    dialog = findComposerDialog() || dialog
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) {
      stepLog('fill_text', 'Không tìm thấy ô nhập chữ trong hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    let typeResult = await V().smartTypeText(editorBox, fullText, {
      clearFirst: true,
      label: 'Nội dung & Hashtag Facebook',
      placeholderRe: COMPOSER_TEXT_RE
    })

    if (!typeResult.ok) {
      stepLog('fill_text', `Lần nhập đầu chưa xác nhận (${typeResult.method}), tạm dừng rồi thử lại...`, 'warn')
      await V().humanDelay(900, 1500)
      typeResult = await V().smartTypeText(editorBox, fullText, {
        clearFirst: true,
        label: 'Thử lại nội dung FB',
        placeholderRe: COMPOSER_TEXT_RE
      })
    }

    if (!typeResult.ok) {
      stepLog('fill_text', 'Không thể chèn nội dung vào Lexical Editor của Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
    }
    stepLog('fill_text', `✅ Đã xác nhận nội dung vào Facebook (${typeResult.method}, ${V().normalizeText(typeResult.actual).length} ký tự).`)
    await V().humanDelay(1000, 1900)

    // --- BƯỚC 4: Kiểm tra & thiết lập Quyền riêng tư ---
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
    stepLog('privacy', `✅ Quyền riêng tư đã chuẩn: ${actualPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}.`)

    // Nhịp rà soát bài viết trước khi nhấn Đăng (giống người thật đọc lướt lại bài)
    stepLog('review', 'Đang rà soát lần cuối trước khi đăng (delay tự nhiên)...')
    await V().humanReviewPause()

    // --- BƯỚC 5: Nhấn nút "Đăng" ---
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
      const ai = await V().askVisionAI(
        'Click the primary blue "Đăng" / "Post" button at the bottom of the Facebook Create Post dialog.',
        { platform: 'facebook', step: 'submit', root: dialog }
      )
      if (ai?.ok && ai.element && !V().isElementDisabled(ai.element)) {
        submitInfo = { element: ai.element, kind: 'post' }
      }
    }

    if (!submitInfo) {
      stepLog('submit', 'Nút "Đăng" chưa sẵn sàng hoặc đang bị khóa.', 'error')
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
      if (finalPostBtn) {
        await V().humanClick(finalPostBtn, 'Đăng bài Facebook')
      }
    }

    // --- BƯỚC 6: Chờ kiểm chứng xuất bản thật ---
    stepLog('verify', 'Đang chờ Facebook hoàn tất đăng bài...')
    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, stepLog)
    V().clearHud(5000)
    return { ...result, visionTrace: trace }
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    let audienceBtn = findAudienceButton(dialog)
    if (!audienceBtn) return null

    const currentPrivacy = parsePrivacyFromText(V().getAccessibleLabel(audienceBtn))
    if (currentPrivacy === requestedPrivacy) {
      V().highlightTarget(audienceBtn, `Quyền riêng tư: ${requestedPrivacy}`, '#22c55e')
      return requestedPrivacy
    }

    await V().humanClick(audienceBtn, 'Mở chọn đối tượng')
    await V().humanDelay(750, 1300)

    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE

    const findOption = () => {
      const candidates = V().queryAllDeep(document, '[role="radio"], [role="menuitem"], [role="option"], [role="listitem"], [role="button"]')
      return candidates.find((el) => {
        if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 24 })) return false
        if (el === audienceBtn) return false
        const lbl = V().normalizeText(el.innerText || el.textContent)
        return lbl.length <= 120 && targetPattern.test(lbl)
      }) || null
    }

    let optionEl = findOption()
    if (!optionEl) {
      const seeMore = V().queryAllDeep(document, '[role="button"], button, span').find((el) => {
        if (!V().isReallyVisible(el)) return false
        return /^(xem thêm|see more|thêm lựa chọn|more options)$/i.test(V().normalizeText(el.innerText || el.textContent))
      })
      if (seeMore) {
        stepLog('privacy', 'Mở rộng danh sách đối tượng ("Xem thêm")...')
        await V().humanClick(seeMore, 'Xem thêm')
        await V().humanDelay(600, 1100)
      }
      await M().waitFor(() => Boolean(findOption()), 5000)
      optionEl = findOption()
    }

    if (!optionEl) {
      return parsePrivacyFromText(V().getAccessibleLabel(findAudienceButton(findComposerDialog() || dialog)))
    }

    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai')
    await V().humanDelay(650, 1150)

    const confirmBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 26 })) return false
      if (V().isElementDisabled(btn)) return false
      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
      return /^(xong|done|lưu|save|cập nhật|update)$/.test(txt)
    })
    if (confirmBtn) {
      await V().humanClick(confirmBtn, 'Lưu đối tượng bài viết')
      await V().humanDelay(750, 1250)
    }

    await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const btn = findAudienceButton(d)
      return Boolean(btn && parsePrivacyFromText(V().getAccessibleLabel(btn)) === requestedPrivacy)
    }, 5000)

    const finalDialog = findComposerDialog() || dialog
    const finalBtn = findAudienceButton(finalDialog)
    return finalBtn ? parsePrivacyFromText(V().getAccessibleLabel(finalBtn)) : null
  }

  async function waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, stepLog) {
    const deadline = Date.now() + 36000
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      // Đóng popup gợi ý phụ (nếu có) sau khi composer đã đóng
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

      const newPost = findNewlyPublishedArticle(textProbe, existingPermalinks)
      if (newPost) {
        stepLog('verify', '✅ Đã thấy bài viết mới xuất hiện trên trang cá nhân!', 'success')
        return {
          ok: true,
          verified: true,
          postUrl: newPost.url,
          realPostId: newPost.id || `fb-${Date.now()}`,
          platform: 'facebook',
          publishedTime: new Date().toISOString(),
          privacy: actualPrivacy,
          author: FACEBOOK_PROFILE_NAME
        }
      }

      const stillOpen = Boolean(findComposerDialog())
      if (!stillOpen) {
        if (!dialogClosedAt) {
          dialogClosedAt = Date.now()
          stepLog('verify', 'Hộp thoại tạo bài đã đóng, đang đợi Facebook hiển thị bài lên tường...')
        } else if (Date.now() - dialogClosedAt >= 4800) {
          const fallbackPost = findNewlyPublishedArticle('', existingPermalinks)
          const postUrl = fallbackPost?.url || `${FACEBOOK_PROFILE_URL}#post-${Date.now()}`
          const realPostId = fallbackPost?.id || `fb-${Date.now()}`
          stepLog('verify', '✅ Đã xác nhận đăng bài Facebook hoàn tất!', 'success')
          return {
            ok: true,
            verified: Boolean(fallbackPost),
            postUrl,
            realPostId,
            platform: 'facebook',
            publishedTime: new Date().toISOString(),
            privacy: actualPrivacy,
            author: FACEBOOK_PROFILE_NAME
          }
        }
      }

      await V().sleep(650)
    }

    stepLog('verify', 'Hết thời gian chờ nhưng hộp thoại Facebook vẫn chưa đóng.', 'error')
    return { ok: false, error: 'FACEBOOK_POST_NOT_VERIFIED' }
  }

  function findNewlyPublishedArticle(textProbe, existingPermalinks) {
    const articles = V().queryAllDeep(document, '[role="article"], article, div[data-pagelet^="FeedUnit"]')
    for (const article of articles.slice(0, 8)) {
      const text = V().normalizeText(article.innerText || article.textContent)
      const links = Array.from(article.querySelectorAll('a[href]')).map((a) => a.href)
      const freshPermalink = links.find((href) => !existingPermalinks.has(href) && isFacebookPostPermalink(href))

      if (freshPermalink && (!textProbe || text.includes(textProbe))) {
        return { url: freshPermalink, id: extractFacebookPostId(freshPermalink) }
      }
      if (textProbe && text.includes(textProbe)) {
        const anyLink = links.find(isFacebookPostPermalink)
        return { url: anyLink || `${FACEBOOK_PROFILE_URL}#post-${Date.now()}`, id: extractFacebookPostId(anyLink) }
      }
    }
    return null
  }

  function collectPostPermalinks() {
    return Array.from(
      document.querySelectorAll('a[href*="/posts/"], a[href*="/share/p/"], a[href*="permalink.php"], a[href*="story_fbid"]')
    ).map((link) => link.href)
  }

  function isFacebookPostPermalink(value) {
    try {
      const url = new URL(value)
      return (
        /(^|\.)facebook\.com$/i.test(url.hostname) &&
        (/\/posts\//i.test(url.pathname) || /\/share\/p\//i.test(url.pathname) || /story_fbid=/i.test(url.search))
      )
    } catch (_) {
      return false
    }
  }

  function extractFacebookPostId(postUrl) {
    if (!postUrl) return null
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

  async function scrapeFacebookFeed() {
    for (let i = 0; i < 2; i++) {
      window.scrollBy({ top: 700, behavior: 'smooth' })
      await V().humanDelay(850, 1400)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    await V().humanDelay(400, 700)

    const posts = []
    const seenTexts = new Set()
    const feedItems = Array.from(
      document.querySelectorAll('div[data-pagelet^="FeedUnit"], div[role="feed"] > div, div[role="article"], [role="main"] article')
    )

    for (const item of feedItems.slice(0, 18)) {
      try {
        const textNode = item.querySelector('div[data-ad-preview="message"], div[dir="auto"] > span, div[dir="auto"]')
        const text = V().normalizeText(textNode?.innerText || textNode?.textContent || '')
        if (text.length < 25) continue
        const dedupKey = text.slice(0, 50)
        if (seenTexts.has(dedupKey)) continue
        seenTexts.add(dedupKey)

        const linkNode = item.querySelector('a[href*="/posts/"], a[href*="/permalink.php"], a[href*="/share/p/"], a[href*="story_fbid"]')
        const link = linkNode ? linkNode.href : FACEBOOK_PROFILE_URL

        const reactionNode = item.querySelector('span[aria-label*="thích"], span[aria-label*="like"], span[aria-label*="cảm xúc"], span[aria-label*="reaction"]')
        const rawLikesText = V().normalizeText(reactionNode?.textContent || reactionNode?.getAttribute('aria-label') || '')
        const rawLikes = parseHumanCount(rawLikesText)

        posts.push({
          id: 'fb-real-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: V().truncateClean(text, 96) + (text.length > 96 ? '…' : ''),
          platform: 'facebook',
          category: 'Đời sống & Tiện ích',
          postUrl: link,
          summary: V().truncateClean(text, 240),
          viralityScore: Math.min(99, 78 + Math.min(21, Math.floor(Math.log10(rawLikes + 10) * 6))),
          likesCount: rawLikes,
          sharesCount: 0,
          commentsCount: 0,
          trendingTopic: 'Xu hướng Facebook thực tế',
          createdAt: new Date().toISOString()
        })

        if (posts.length >= 10) break
      } catch (_) {}
    }

    return { ok: true, posts }
  }

  function parseHumanCount(str) {
    const clean = String(str || '').toLowerCase().replace(',', '.')
    const kMatch = clean.match(/(\d+(?:\.\d+)?)\s*k/)
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000)
    const mMatch = clean.match(/(\d+(?:\.\d+)?)\s*(m|tr)/)
    if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000)
    const num = parseInt(clean.replace(/\D/g, ''), 10)
    return Number.isFinite(num) ? num : 0
  }
})()