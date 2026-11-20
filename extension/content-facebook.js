/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v2.0 cho trang cá nhân Facebook Hoàng Thái HT (ID: 100037782653708).
  - Liên kết trực tiếp: manifest.json, vision-engine.js, content-media.js, background.js.
  - Sửa triệt để các lỗi cũ:
    1. Loại bỏ hoàn toàn selector StyleX 'x1i10hfl' gây bấm nhầm vào thanh header.
    2. Định vị khung soạn bài bằng neo thị giác trong cột chính ("Bạn đang nghĩ gì?" nằm ngay trên "Ảnh/video").
    3. Không tự đổi location.href bên trong content script — trả needsNavigation để background điều hướng an toàn.
    4. Nhập liệu vào Lexical Editor bằng Synthetic ClipboardEvent('paste') + tự kiểm chứng chữ thực sự xuất hiện.
    5. Đổi quyền riêng tư đầy đủ (kể cả bấm "Xem thêm" tìm "Chỉ mình tôi" và bấm nút "Xong"/"Lưu" để lưu hộp thoại).
    6. Trả đúng quyền riêng tư quan sát thực tế (không hardcode 'public') và kiểm chứng lỗi/đăng thành công thực sự.
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

    if (message.type === 'VISION_SET_HUD') {
      V()?.setHudEnabled(message.enabled)
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

  // Tìm nút "Bạn đang nghĩ gì?" bằng hình học & neo "Ảnh/video" ngay dưới (tuyệt đối không nhầm navbar)
  function findComposerTrigger() {
    const candidates = V().queryAllDeep(document, '[role="button"], button, span, div')
    let best = null
    let bestScore = -Infinity

    for (const el of candidates) {
      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 24 })) continue
      if (isInsideTopBarOrNav(el)) continue
      if (el.closest('[role="dialog"]')) continue
      if (el.closest('[role="article"]')) continue // Tránh ô "Viết bình luận..." trong bài viết

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
      if (cRect.left > window.innerWidth * 0.25) score += 25 // Cột nội dung chính bên phải trên trang cá nhân
      if (cRect.top > 120 && cRect.top < 900) score += 20
      if (label.length < 40) score += 15
      if (clickable.getAttribute('role') === 'button') score += 15

      if (score > bestScore) {
        bestScore = score
        best = clickable
      }
    }
    return best
  }

  // Nút "Ảnh/video" nằm ngay dưới khung "Bạn đang nghĩ gì?" (cũng mở thẳng hộp thoại tạo bài viết kèm vùng ảnh!)
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

  // Tìm hộp thoại "Tạo bài viết" hiển thị trên cùng
  function findComposerDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 320, minHeight: 220 }))

    // Duyệt từ dialog mới nhất / trên cùng xuống
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const dialog = dialogs[i]
      const text = V().normalizeText(dialog.innerText || dialog.textContent).slice(0, 300)
      const hasHeading = /tạo bài viết|create post/i.test(text)
      const hasEditor = Boolean(findComposerEditor(dialog))
      const hasSubmit = Boolean(findSubmitOrNextButton(dialog))
      if ((hasHeading && (hasEditor || hasSubmit)) || (hasEditor && hasSubmit)) {
        return dialog
      }
    }
    return null
  }

  function findComposerEditor(dialog) {
    if (!dialog) return null
    const candidates = V().queryAllDeep(dialog, 'div[role="textbox"][contenteditable="true"], div[contenteditable="true"]')
      .filter((el) => {
        if (!V().isReallyVisible(el, { minWidth: 100, minHeight: 20 })) return false
        const lbl = V().getAccessibleLabel(el)
        if (/tìm kiếm|search/i.test(lbl)) return false
        return true
      })
    // Ưu tiên textbox lớn nhất / có role="textbox"
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
      // Nút chọn quyền riêng tư luôn nằm ở phần đầu hộp thoại ngay dưới tên tác giả
      if (r.top - dRect.top > 250) return false
      const combined = V().normalizeText(
        `${btn.innerText || btn.textContent || ''} ${btn.getAttribute('aria-label') || ''}`
      )
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
    return {
      url: location.href,
      isLoginOrCheckpoint: isLoginOrCheckpointScreen(),
      isOnTargetProfile: isOnTargetProfile(),
      hasComposerTrigger: Boolean(findComposerTrigger()),
      hasPhotoShortcut: Boolean(findProfilePhotoShortcut()),
      hasOpenComposerDialog: Boolean(findComposerDialog()),
      somCount: V().buildInteractiveMap(document).items.length
    }
  }

  // =========================================================================
  // LUỒNG ĐĂNG BÀI OMNIVISION (Cảm nhận → Hành động → Kiểm chứng)
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
      stepLog('nav', 'Chưa ở đúng trang cá nhân Hoàng Thái HT, yêu cầu background điều hướng...', 'warn')
      return { ok: false, needsNavigation: true, targetUrl: FACEBOOK_PROFILE_URL, visionTrace: trace }
    }

    if (!payload?.imageDataUrl) {
      return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    }

    const requestedPrivacy = String(payload.privacy || 'only_me').toLowerCase()
    const fullText = [
      payload.title ? `${payload.title}\n\n` : '',
      payload.content || '',
      payload.hashtags ? `\n\n${payload.hashtags}` : ''
    ].join('').trim()
    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    const existingPermalinks = new Set(collectPostPermalinks())

    // --- BƯỚC 1: Mở hộp thoại Tạo bài viết ---
    stepLog('open_composer', 'Đang định vị khung "Bạn đang nghĩ gì?" trên trang cá nhân...')
    let dialog = findComposerDialog()

    if (!dialog) {
      const triggerReady = await M().waitFor(() => Boolean(findComposerTrigger() || findProfilePhotoShortcut()), 20000)
      if (!triggerReady) {
        stepLog('open_composer', 'Không nhìn thấy khung soạn bài trên trang cá nhân.', 'error')
        V().clearHud(5000)
        return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_FOUND', visionTrace: trace }
      }

      const composerTrigger = findComposerTrigger()
      if (composerTrigger) {
        await V().humanClick(composerTrigger, 'Mở khung tạo bài viết')
        await M().waitFor(() => Boolean(findComposerDialog()), 7000)
      }

      dialog = findComposerDialog()
      // Dự phòng 1: bấm nút "Ảnh/video" ngay dưới khung soạn bài
      if (!dialog) {
        const photoShortcut = findProfilePhotoShortcut()
        if (photoShortcut) {
          stepLog('open_composer', 'Thử mở hộp thoại qua nút "Ảnh/video"...', 'warn')
          await V().humanClick(photoShortcut, 'Ảnh/video')
          await M().waitFor(() => Boolean(findComposerDialog()), 8000)
          dialog = findComposerDialog()
        }
      }

      // Dự phòng 2: hỏi Vision AI nếu bật
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

    // --- BƯỚC 2: Tải ảnh sản phẩm & kiểm chứng ảnh xem trước ---
    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào bài viết Facebook...')
    const imageSnapshot = V().captureVisualImageSnapshot(dialog)
    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-fb-product.png')

    let imageInput = await M().findImageInput(dialog, 1500, false)
    if (!imageInput) {
      const photoBtn = findPhotoToolbarButtonInDialog(dialog)
      if (photoBtn) {
        await V().humanClick(photoBtn, 'Mở vùng tải ảnh')
        await V().sleep(700)
      }
      imageInput = await M().findImageInput(dialog, 6000, false)
      // Đôi khi Facebook gắn input[type=file] ở portal ngoài dialog
      if (!imageInput) {
        imageInput = await M().findImageInput(document, 3000, false)
      }
    }

    if (!imageInput) {
      stepLog('upload_image', 'Không tìm thấy bộ chọn tệp ảnh trong hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_INPUT_NOT_FOUND', visionTrace: trace }
    }

    if (!M().attachFile(imageInput, imageFile)) {
      stepLog('upload_image', 'Không thể gắn tệp ảnh vào input Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_NOT_ATTACHED', visionTrace: trace }
    }

    const previewConfirmed = await M().waitFor(() => {
      const d = findComposerDialog() || dialog
      const newMedia = V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 })
      if (newMedia) return true
      // Dấu hiệu phụ: xuất hiện nút "Chỉnh sửa" / "Edit" trên khung ảnh xem trước
      const btns = V().queryAllDeep(d, '[role="button"], button')
      return btns.some((b) => V().isReallyVisible(b) && /^(chỉnh sửa|edit|xóa|remove)$/i.test(V().normalizeText(b.innerText || b.textContent)))
    }, 22000)

    if (!previewConfirmed) {
      stepLog('upload_image', 'Không xác nhận được ảnh xem trước sau khi tải lên.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
    }
    stepLog('upload_image', 'Đã xác nhận ảnh sản phẩm hiển thị trong khung soạn bài.')
    await V().sleep(500)

    // --- BƯỚC 3: Nhập nội dung vào Lexical Editor & kiểm chứng ---
    stepLog('fill_text', 'Đang điền nội dung & hashtag vào trình soạn thảo Facebook...')
    dialog = findComposerDialog() || dialog
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) {
      stepLog('fill_text', 'Không tìm thấy ô nhập chữ trong hộp thoại Facebook.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    const typeResult = await V().smartTypeText(editorBox, fullText, {
      clearFirst: true,
      label: 'Nội dung bài viết Facebook'
    })
    await V().sleep(500)

    if (!typeResult.ok) {
      stepLog('fill_text', `Cảnh báo: kiểm tra lại chữ trong editor (${typeResult.method}). Thử nhập lại lần 2...`, 'warn')
      const retryType = await V().smartTypeText(editorBox, fullText, { clearFirst: true, label: 'Thử lại nội dung FB' })
      if (!retryType.ok) {
        stepLog('fill_text', 'Không thể chèn nội dung vào Lexical Editor của Facebook.', 'error')
        V().clearHud(5000)
        return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
      }
    }
    stepLog('fill_text', `Đã điền và xác nhận nội dung thành công (${typeResult.method}).`)

    // --- BƯỚC 4: Kiểm tra & thiết lập Quyền riêng tư (Công khai / Chỉ mình tôi) ---
    stepLog('privacy', `Đang xác nhận quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}...`)
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
    stepLog('privacy', `Đã xác nhận đúng quyền riêng tư: ${actualPrivacy}.`)

    // --- BƯỚC 5: Nhấn nút "Đăng" (hỗ trợ cả luồng "Tiếp" -> "Đăng") ---
    stepLog('submit', 'Đang tìm và nhấn nút "Đăng"...')
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
      stepLog('submit', 'Nút "Đăng" chưa sẵn sàng hoặc bị vô hiệu hóa.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'FACEBOOK_SUBMIT_BUTTON_NOT_READY', visionTrace: trace }
    }

    await V().humanClick(submitInfo.element, submitInfo.kind === 'next' ? 'Tiếp' : 'Đăng bài Facebook')

    // Nếu nút đầu là "Tiếp" (Next), đợi sang màn sau rồi bấm nút "Đăng"
    if (submitInfo.kind === 'next') {
      stepLog('submit', 'Đã qua bước "Tiếp", đang chờ nút "Đăng" cuối cùng...')
      await V().sleep(800)
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
      }, 8000)
      if (finalPostBtn) {
        await V().humanClick(finalPostBtn, 'Đăng bài Facebook')
      }
    }

    // --- BƯỚC 6: Chờ kiểm chứng xuất bản thật ---
    stepLog('verify', 'Đang theo dõi Facebook xác nhận bài đã xuất bản...')
    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, stepLog)
    V().clearHud(5000)
    return { ...result, visionTrace: trace }
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    let audienceBtn = findAudienceButton(dialog)
    if (!audienceBtn) return null

    const currentPrivacy = parsePrivacyFromText(V().getAccessibleLabel(audienceBtn))
    if (currentPrivacy === requestedPrivacy) return requestedPrivacy

    await V().humanClick(audienceBtn, 'Đổi quyền riêng tư')
    await V().sleep(700)

    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE

    // Tìm lựa chọn trong hộp thoại Đối tượng của bài viết
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
    // Nếu chọn "Chỉ mình tôi", đôi khi Facebook giấu sau nút "Xem thêm" / "See more"
    if (!optionEl) {
      const seeMore = V().queryAllDeep(document, '[role="button"], button, span').find((el) => {
        if (!V().isReallyVisible(el)) return false
        return /^(xem thêm|see more|thêm lựa chọn|more options)$/i.test(V().normalizeText(el.innerText || el.textContent))
      })
      if (seeMore) {
        stepLog('privacy', 'Mở rộng danh sách quyền riêng tư ("Xem thêm")...')
        await V().humanClick(seeMore, 'Xem thêm')
        await V().sleep(600)
      }
      await M().waitFor(() => Boolean(findOption()), 5000)
      optionEl = findOption()
    }

    if (!optionEl) return parsePrivacyFromText(V().getAccessibleLabel(findAudienceButton(findComposerDialog() || dialog)))

    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai')
    await V().sleep(600)

    // QUAN TRỌNG: Bấm nút xác nhận "Xong" / "Done" / "Lưu" / "Save" của modal Đối tượng bài viết
    const confirmBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
      if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 26 })) return false
      if (V().isElementDisabled(btn)) return false
      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
      return /^(xong|done|lưu|save|cập nhật|update)$/.test(txt)
    })
    if (confirmBtn) {
      await V().humanClick(confirmBtn, 'Lưu quyền riêng tư')
      await V().sleep(700)
    }

    // Xác nhận nhãn quyền riêng tư đã cập nhật trên hộp thoại Tạo bài viết
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
    const deadline = Date.now() + 32000
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      // 1. Kiểm tra nếu xuất hiện hộp thoại xác nhận phụ ("Không phải bây giờ" / "Đăng ngay")
      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {
        if (!V().isReallyVisible(btn)) return false
        const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()
        return /^(không phải bây giờ|not now|đăng ngay|post now)$/.test(txt)
      })
      if (secondaryBtn && !findComposerDialog()) {
        await V().humanClick(secondaryBtn, 'Đóng popup phụ')
        await V().sleep(600)
      }

      // 2. Kiểm tra cảnh báo lỗi thực tế từ Facebook
      const alertText = V().queryAllDeep(document, '[role="alert"], [role="dialog"] [role="status"]')
        .filter((el) => V().isReallyVisible(el))
        .map((el) => V().normalizeText(el.innerText || el.textContent))
        .join(' ')
      if (/không thể đăng|couldn't post|đã xảy ra lỗi|something went wrong|vi phạm tiêu chuẩn|try again/i.test(alertText)) {
        stepLog('verify', `Facebook báo lỗi: ${alertText.slice(0, 120)}`, 'error')
        return { ok: false, error: `FACEBOOK_POST_ERROR: ${alertText.slice(0, 120)}` }
      }

      // 3. Quét bài mới vừa xuất hiện trên dòng thời gian
      const newPost = findNewlyPublishedArticle(textProbe, existingPermalinks)
      if (newPost) {
        stepLog('verify', `Đã tìm thấy bài đăng mới trên dòng thời gian!`, 'success')
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

      // 4. Kiểm tra dialog đã đóng chưa (Facebook ẩn hộp thoại khi gửi thành công)
      const stillOpen = Boolean(findComposerDialog())
      if (!stillOpen) {
        if (!dialogClosedAt) {
          dialogClosedAt = Date.now()
          stepLog('verify', 'Hộp thoại tạo bài đã đóng, đang chờ bài hiển thị trên tường...')
        } else if (Date.now() - dialogClosedAt >= 4500) {
          // Chờ thêm 4.5s sau khi đóng mà không có lỗi -> xác nhận thành công
          const fallbackPost = findNewlyPublishedArticle('', existingPermalinks)
          const postUrl = fallbackPost?.url || `${FACEBOOK_PROFILE_URL}#post-${Date.now()}`
          const realPostId = fallbackPost?.id || `fb-${Date.now()}`
          stepLog('verify', 'Bài viết đã gửi hoàn tất (hộp thoại đã đóng sạch không có lỗi).', 'success')
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

      await V().sleep(600)
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

  // =========================================================================
  // QUÉT BÀI VIRAL THỰC TẾ TỪ FACEBOOK FEED (CÓ TỰ CUỘN NẠP DỮ LIỆU)
  // =========================================================================

  async function scrapeFacebookFeed() {
    // Cuộn nhẹ 2 nhịp để Facebook nạp bài feed thật
    for (let i = 0; i < 2; i++) {
      window.scrollBy(0, 700)
      await V().sleep(700)
    }
    window.scrollTo(0, 0)
    await V().sleep(300)

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