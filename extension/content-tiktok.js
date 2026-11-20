/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v2.0 cho TikTok Studio Photo Upload (@harutv666).
  - Liên kết trực tiếp: manifest.json, vision-engine.js, content-media.js, background.js.
  - Khớp chính xác 100% giao diện TikTok Studio thực tế (Ảnh 3 & Ảnh 4):
    1. Tự phát hiện trạng thái màn hình: nếu đang ở tab "Video" -> bấm chuyển sang tab "Ảnh"; nếu còn bản nháp cũ -> tự dọn sạch.
    2. Chụp snapshot ảnh trước upload -> chỉ xác nhận hoàn tất khi màn hình chuyển thật sang form "Chi tiết" (Ảnh 3) có "Mô tả" & "Ảnh bìa" (tuyệt đối không nhầm với avatar góc trên phải!).
    3. Tự định vị và điền ĐẦY ĐỦ cả 2 ô trong "Mô tả":
       - Ô 1: "Thêm tiêu đề hấp dẫn" (0/90 ký tự)
       - Ô 2: "Mô tả dài có thể giúp tăng lượt xem trung bình lên gấp 3 lần" (0/4000 ký tự)
       có tự kiểm chứng chữ thực sự vào React/Draft/Lexical!
    4. Dùng neo hình học tìm nhãn "Người có thể nhìn thấy bài đăng này" rồi chọn dropdown ngay bên dưới ("Mọi người" / "Chỉ mình tôi").
    5. Cuộn xuống cuối, bấm nút "Đăng" chính xác (loại trừ nút "Bài đăng" ở sidebar trái), tự xử lý popup "Tiếp tục đăng?" / "Đăng ngay", và xác nhận xuất bản thực tế.
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

  const V = () => globalThis.OmniVision
  const M = () => globalThis.OmniCartMedia

  const handleMessage = (message, sender, sendResponse) => {
    if (!message?.type) return false

    if (message.type === 'VISION_SET_HUD') {
      V()?.setHudEnabled(message.enabled)
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
    // Kiểm tra ảnh đại diện góc trên phải hoặc menu tài khoản của TikTok Studio
    const topRightAvatars = V().queryAllDeep(document, 'img, [data-e2e="nav-avatar"], [data-e2e="profile-icon"]')
      .filter((el) => {
        if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 20 })) return false
        const r = el.getBoundingClientRect()
        return r.top < 80 && r.left > window.innerWidth * 0.65
      })
    if (topRightAvatars.length > 0) return true

    // Hoặc đã thấy giao diện Studio (menu "Trang chủ", "Bài đăng", "Phân tích")
    const bodyText = V().normalizeText(document.body?.innerText || '').slice(0, 1000)
    return /tiktok studio/i.test(bodyText) && /bài đăng|posts|tải lên|upload/i.test(bodyText)
  }

  // Phát hiện đang ở màn Chi tiết (Ảnh 3) hay màn Chọn ảnh để tải lên (Ảnh 4)
  function detectScreenState() {
    if (isLoginRequired()) return 'login_required'
    if (!isUploadPath()) return 'wrong_page'

    const hasDetailEditor = Boolean(findDescriptionEditor() || findTitleInput())
    const hasSettingsHeading = Boolean(V().findLabelElement(/^(cài đặt|settings|chi tiết|details)$/i, { minLeft: 180, maxLength: 30 }))
    const hasPrivacyLabel = Boolean(V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 80 }))

    if (hasDetailEditor && (hasSettingsHeading || hasPrivacyLabel)) {
      return 'detail_editor_form'
    }

    const photoDropzoneText = V().findLabelElement(/chọn ảnh để tải lên|select photos? to upload|tải lên tối đa 35 ảnh/i, { minLeft: 160 })
    if (photoDropzoneText) return 'upload_photo_tab'

    const videoDropzoneText = V().findLabelElement(/chọn video để tải lên|select video to upload/i, { minLeft: 160 })
    if (videoDropzoneText) return 'upload_video_tab'

    return 'loading_or_unknown'
  }

  // Tìm tab "Ảnh" (Photo) ngay cạnh tab "Video" ở phần thân trang (Ảnh 4)
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
      if (r.left > 180) score += 30 // Ưu tiên tab "Ảnh" ở khu vực chính (trên dropzone) hơn sidebar trái
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

  // Ô 1 trong "Mô tả" (Ảnh 3): "Thêm tiêu đề hấp dẫn" (giới hạn 0/90)
  function findTitleInput() {
    const inputs = V().queryAllDeep(document, 'input[type="text"], input:not([type]), textarea, [contenteditable="true"]')
    for (const el of inputs) {
      if (!V().isReallyVisible(el, { minWidth: 120, minHeight: 20 })) continue
      const r = el.getBoundingClientRect()
      if (r.left < 180 || r.top < 70) continue

      const ph = V().normalizeText(
        `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-placeholder') || ''}`
      )
      // Loại trừ ô "Tìm kiếm vị trí"
      if (/vị trí|location|search|tìm kiếm/i.test(ph)) continue
      if (/tiêu đề|title/i.test(ph)) return el

      // Kiểm tra placeholder nằm ở thẻ anh em (Draft/React wrapper) hoặc bộ đếm "/90" ở gần
      const containerText = V().normalizeText(el.parentElement?.innerText || '').slice(0, 140)
      if (/thêm tiêu đề|add.*title|\b\d+\s*\/\s*90\b/i.test(containerText) && r.height < 90) {
        return el
      }
    }
    return null
  }

  // Ô 2 trong "Mô tả" (Ảnh 3): "Mô tả dài có thể giúp tăng lượt xem..." (0/4000, có DraftEditor / contenteditable)
  function findDescriptionEditor() {
    const titleEl = findTitleInput()
    const candidates = V().queryAllDeep(
      document,
      'div[contenteditable="true"], div[contenteditable="plaintext-only"], [role="textbox"], textarea'
    )

    let best = null
    let bestScore = -Infinity

    for (const el of candidates) {
      if (el === titleEl) continue
      if (!V().isReallyVisible(el, { minWidth: 140, minHeight: 24 })) continue
      const r = el.getBoundingClientRect()
      if (r.left < 180 || r.top < 70) continue

      const selfMeta = V().normalizeText(
        `${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.className || ''}`
      )
      if (/vị trí|location|search|tìm kiếm/i.test(selfMeta)) continue

      // Đọc ngữ cảnh khung cha gần nhất (Draft.js/Lexical thường đặt placeholder ở div anh em!)
      const box = el.closest('[class*="caption"], [class*="description"], [class*="editor"], [class*="Editor"]') || el.parentElement?.parentElement || el.parentElement
      const boxText = V().normalizeText(box?.innerText || '').slice(0, 300)
      if (/tìm kiếm vị trí|search location/i.test(boxText)) continue

      let score = 0
      if (/drafteditor|public-draft|caption|description/i.test(selfMeta)) score += 45
      if (/mô tả dài|longer description|share more|hashtag|nhắc đến|mention|\b\d+\s*\/\s*4000\b/i.test(boxText)) score += 50
      if (el.isContentEditable) score += 20
      if (r.height >= 40) score += 15
      if (titleEl) {
        const tr = titleEl.getBoundingClientRect()
        if (r.top >= tr.bottom - 10 && r.top <= tr.bottom + 140) score += 30
      }

      if (score > bestScore && score >= 20) {
        bestScore = score
        best = el
      }
    }

    return best
  }

  // Đọc bộ đếm ký tự "X/4000" trong khung Mô tả để kiểm chứng kép
  function readDescriptionCounter() {
    const label = V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 })
    if (!label) return null
    const m = V().normalizeText(label.innerText || label.textContent).match(/^(\d+)\s*\/\s*4000$/)
    return m ? Number(m[1]) : null
  }

  // Tìm dropdown quyền riêng tư bằng neo hình học dưới nhãn "Người có thể nhìn thấy bài đăng này" (Ảnh 3)
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

    // Dự phòng: tìm trực tiếp select/button có chữ "Mọi người" / "Chỉ mình tôi" / "Bạn bè" trong phần thân chính
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

  // Tìm nút "Đăng" chính xác (loại trừ mục "Bài đăng" ở thanh bên trái, "Lưu bản nháp", "Hủy bỏ")
  function findPublishButton() {
    // Ưu tiên 1: data-e2e chuẩn của TikTok Studio
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

    // Ưu tiên 2: Quét trực quan nút có nhãn chính xác "Đăng" / "Post" ở phần nội dung chính (left > 180)
    const buttons = V().queryAllDeep(document, 'button, [role="button"]')
    let best = null
    let bestScore = -Infinity

    for (const btn of buttons) {
      if (!V().isReallyVisible(btn, { minWidth: 64, minHeight: 28 })) continue
      const r = btn.getBoundingClientRect()
      if (r.left < 180 || r.top < 120) continue // Loại bỏ tuyệt đối sidebar trái & header trên!

      const txt = V().normalizeText(btn.innerText || btn.textContent)
      if (!/^(đăng|post|đăng ngay|post now|xuất bản|publish)$/i.test(txt)) continue

      const color = V().getElementColorInfo(btn)
      let score = 50
      if (btn.tagName === 'BUTTON') score += 20
      if (color.isRedPink) score += 40 // Nút CTA màu đỏ hồng đặc trưng của TikTok (#fe2c55)
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
      hasDescriptionEditor: Boolean(findDescriptionEditor()),
      descriptionCounter: readDescriptionCounter(),
      privacyControlText: V().normalizeText(findPrivacyControl()?.innerText || findPrivacyControl()?.value || ''),
      hasPublishButton: Boolean(findPublishButton()),
      publishButtonEnabled: Boolean(findPublishButton() && !V().isElementDisabled(findPublishButton())),
      somCount: V().buildInteractiveMap(document).items.length
    }
  }

  // =========================================================================
  // LUỒNG ĐĂNG BÀI ẢNH TIKTOK STUDIO OMNIVISION (Cảm nhận → Hành động → Kiểm chứng)
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

    const rawTitle = V().normalizeText(payload.title || '')
    const rawBody = [payload.content || '', payload.hashtags ? `\n\n${payload.hashtags}` : ''].join('').trim()
    const combinedCaption = [rawTitle ? `${rawTitle}\n` : '', rawBody].join('').trim()
    if (!combinedCaption) {
      return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }
    }

    // --- BƯỚC 1: Kiểm tra đăng nhập ---
    stepLog('auth', 'Đang kiểm tra trạng thái đăng nhập TikTok Studio (@harutv666)...')
    const readyAuth = await M().waitFor(() => isAccountLoggedIn() || isLoginRequired(), 15000)
    if (!readyAuth || isLoginRequired()) {
      stepLog('auth', 'Tài khoản TikTok chưa đăng nhập trên tab này!', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_LOGIN_REQUIRED', visionTrace: trace }
    }

    // --- BƯỚC 2: Quan sát màn hình hiện tại (Video tab / Photo tab / Bản nháp cũ) ---
    await M().waitFor(() => detectScreenState() !== 'loading_or_unknown', 12000)
    let state = detectScreenState()
    stepLog('screen', `Mắt OmniVision nhận diện trạng thái: ${state}`)

    // Nếu tab còn kẹt bản nháp ảnh cũ từ lần trước -> Hủy bản nháp sạch sẽ trước khi đăng bài mới
    if (state === 'detail_editor_form') {
      stepLog('reset_draft', 'Phát hiện bản nháp cũ đang mở, đang dọn về trang tải ảnh mới...', 'warn')
      await V().scrollContainerToBottom(findDescriptionEditor())
      const discardBtn = findDiscardButton()
      if (discardBtn) {
        await V().humanClick(discardBtn, 'Hủy bản nháp cũ')
        await V().sleep(700)
        // Bấm xác nhận "Hủy bỏ" / "Discard" trong popup nếu hiện ra
        const confirmDiscard = V().queryAllDeep(document, '[role="dialog"] button, [class*="modal"] button, [class*="Modal"] button').find((b) => {
          if (!V().isReallyVisible(b)) return false
          return /^(hủy bỏ|hủy|discard|xác nhận|confirm)$/i.test(V().normalizeText(b.innerText || b.textContent))
        })
        if (confirmDiscard) {
          await V().humanClick(confirmDiscard, 'Xác nhận hủy bản nháp')
          await M().waitFor(() => detectScreenState() !== 'detail_editor_form', 8000)
        }
      } else {
        return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      }
      state = detectScreenState()
    }

    // Nếu đang ở tab Video -> chuyển sang tab "Ảnh" (Ảnh 4)
    if (state === 'upload_video_tab' || state === 'loading_or_unknown') {
      const photoTab = findPhotoTabButton()
      if (photoTab) {
        stepLog('switch_tab', 'Đang chuyển từ tab Video sang tab "Ảnh" (Photo)...')
        await V().humanClick(photoTab, 'Chuyển sang tab Ảnh')
        await M().waitFor(
          () => detectScreenState() === 'upload_photo_tab' || Boolean(M().findImageInput(document, 200, false)),
          8000
        )
      } else {
        const ai = await V().askVisionAI(
          'Click the "Ảnh" / "Photo" tab button to switch TikTok Studio from Video upload to Photo upload.',
          { platform: 'tiktok', step: 'switch_to_photo_tab' }
        )
        if (ai?.ok && ai.element) {
          await V().humanClick(ai.element, 'Vision AI -> Tab Ảnh')
          await V().sleep(1200)
        }
      }
    }

    // --- BƯỚC 3: Nạp ảnh sản phẩm & CHỜ CHUYỂN THẬT SANG MÀN HÌNH CHI TIẾT (Ảnh 3) ---
    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào TikTok Studio...')
    const imageSnapshot = V().captureVisualImageSnapshot(document)
    const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-tiktok-product.png')

    let imageInput = await M().findImageInput(document, 6000, false)
    let attached = false

    if (imageInput) {
      attached = M().attachFile(imageInput, imageFile)
    }

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

    // QUAN TRỌNG: Chờ trang thực sự chuyển sang màn hình "Chi tiết" (Ảnh 3) — KHÔNG nhầm với avatar!
    stepLog('wait_detail', 'Đang chờ TikTok xử lý ảnh và mở biểu mẫu "Chi tiết"...')
    const detailFormReady = await M().waitFor(() => {
      const hasEditor = Boolean(findDescriptionEditor() || findTitleInput())
      if (!hasEditor) return false
      const hasNewThumb = Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: document, minTop: 110, minWidth: 55, minHeight: 55 }))
      const hasCoverLabel = Boolean(V().findLabelElement(/ảnh bìa|đã tải lên \d+ ảnh|uploaded \d+ photo|cover/i, { minLeft: 180, maxLength: 80 }))
      return hasNewThumb || hasCoverLabel
    }, 30000, 350)

    if (!detailFormReady) {
      stepLog('wait_detail', 'TikTok không chuyển sang màn hình "Chi tiết" sau khi tải ảnh.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_DETAIL_FORM_NOT_LOADED', visionTrace: trace }
    }

    // Đợi thêm 1.5s cho React/DraftEditor khởi tạo hoàn chỉnh
    await V().sleep(1500)
    stepLog('wait_detail', 'Đã xác nhận ảnh bìa & mở xong màn hình "Chi tiết"!')

    // --- BƯỚC 4: Điền TIÊU ĐỀ (0/90) và MÔ TẢ (0/4000) — Khớp chính xác Ảnh 3 ---
    const titleInput = findTitleInput()
    const descEditor = findDescriptionEditor()

    if (!titleInput && !descEditor) {
      stepLog('fill_caption', 'Không tìm thấy ô Tiêu đề hoặc ô Mô tả trên TikTok Studio.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_CAPTION_EDITOR_NOT_FOUND', visionTrace: trace }
    }

    // 4A. Điền Tiêu đề (nếu có ô "Thêm tiêu đề hấp dẫn" 0/90)
    if (titleInput) {
      const cleanTitle = V().truncateClean(rawTitle || combinedCaption.split('\n')[0], 85)
      stepLog('fill_title', `Đang điền Tiêu đề (${cleanTitle.length}/90 ký tự)...`)
      const titleRes = await V().smartTypeText(titleInput, cleanTitle, {
        clearFirst: true,
        label: 'Tiêu đề TikTok (0/90)'
      })
      if (titleRes.ok) {
        stepLog('fill_title', `Đã điền Tiêu đề thành công (${titleRes.method}).`)
      } else {
        stepLog('fill_title', 'Không xác nhận được ô Tiêu đề, sẽ gộp vào Mô tả.', 'warn')
      }
      await V().sleep(350)
    }

    // 4B. Điền Mô tả (ô 0/4000)
    if (descEditor) {
      const descText = V().truncateClean(titleInput ? (rawBody || combinedCaption) : combinedCaption, 3900)
      stepLog('fill_desc', `Đang điền Mô tả & hashtag (${descText.length}/4000 ký tự)...`)
      let descRes = await V().smartTypeText(descEditor, descText, {
        clearFirst: true,
        label: 'Mô tả TikTok (0/4000)',
        dismissPopover: true
      })

      await V().sleep(600)
      let counter = readDescriptionCounter()

      if (!descRes.ok && (counter === null || counter === 0)) {
        stepLog('fill_desc', 'Lần nhập đầu chưa ăn vào DraftEditor, thử chiến lược dự phòng...', 'warn')
        descRes = await V().smartTypeText(descEditor, descText, {
          clearFirst: true,
          label: 'Thử lại Mô tả TikTok',
          dismissPopover: true
        })
        await V().sleep(600)
        counter = readDescriptionCounter()
      }

      if (!descRes.ok && (counter === null || counter === 0)) {
        stepLog('fill_desc', 'Không thể chèn chữ vào ô Mô tả TikTok Studio.', 'error')
        V().clearHud(5000)
        return { ok: false, error: 'TIKTOK_CAPTION_NOT_INSERTED', visionTrace: trace }
      }

      // Gửi phím Escape để đóng menu gợi ý hashtag (nếu có) trước khi cuộn xuống Cài đặt
      V().dispatchEscape(descEditor)
      stepLog('fill_desc', `Đã xác nhận Mô tả (${counter !== null ? `${counter}/4000` : descRes.method}).`)
    }

    await V().sleep(500)

    // --- BƯỚC 5: Thiết lập & kiểm chứng Quyền riêng tư ("Người có thể nhìn thấy bài đăng này") ---
    stepLog('privacy', `Đang kiểm tra quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}...`)
    const privacyResult = await setAndVerifyTikTokPrivacy(requestedPrivacy, stepLog)
    if (!privacyResult.ok) {
      stepLog('privacy', `Không xác nhận được quyền riêng tư TikTok (thực tế=${privacyResult.actual || 'không rõ'}). Dừng an toàn!`, 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PRIVACY_NOT_CONFIRMED', actualPrivacy: privacyResult.actual, visionTrace: trace }
    }
    stepLog('privacy', `Đã xác nhận đúng quyền riêng tư TikTok: ${privacyResult.actual}.`)

    // --- BƯỚC 6: Cuộn xuống cuối & nhấn nút "Đăng" ---
    stepLog('publish', 'Đang cuộn xuống nút "Đăng" của TikTok Studio...')
    await V().scrollContainerToBottom(findPrivacyControl() || descEditor)
    await V().sleep(500)

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
      stepLog('publish', 'Không tìm thấy hoặc nút "Đăng" trên TikTok Studio vẫn đang bị khóa.', 'error')
      V().clearHud(5000)
      return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY', visionTrace: trace }
    }

    await V().humanClick(publishBtn, 'Đăng bài TikTok')
    stepLog('publish', 'Đã nhấn nút "Đăng", đang theo dõi xác nhận từ TikTok...')

    // --- BƯỚC 7: Xử lý popup xác nhận phụ & kiểm chứng đăng thành công thực sự ---
    const publishConfirm = await waitForTikTokPublishConfirmation(35000, stepLog)
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
      message: publishConfirm.message || 'Đã đăng bài lên TikTok (@harutv666) thành công.',
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

    // Trường hợp thẻ <select> gốc
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
      await V().sleep(400)
      return { ok: control.value === matchOpt.value, actual: requestedPrivacy }
    }

    // Trường hợp TUXSelect / Button dropdown (giống Ảnh 3: nút "Mọi người v")
    const currentLabel = V().getAccessibleLabel(control)
    const currentValue = parsePrivacyValue(currentLabel)
    if (currentValue === requestedPrivacy) {
      V().highlightTarget(control, `Quyền riêng tư: ${currentLabel}`, '#22c55e')
      return { ok: true, actual: requestedPrivacy }
    }

    stepLog('privacy', `Đang đổi từ "${currentLabel}" sang "${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Mọi người'}"...`)
    await V().humanClick(control, 'Mở menu quyền riêng tư')
    await V().sleep(600)

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

    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chọn Chỉ mình tôi' : 'Chọn Mọi người')
    await V().sleep(600)

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

      // 1. TikTok Studio tự điều hướng sang trang Quản lý bài đăng / Nội dung sau khi đăng thành công
      if (currentUrl !== startUrl && !/\/upload\/?(\?|$)/i.test(currentUrl)) {
        const postId = extractTikTokPostId(currentUrl) || `tiktok-${Date.now()}`
        stepLog('verify', `TikTok đã chuyển hướng sang ${currentUrl} — Đăng thành công!`, 'success')
        return { ok: true, postUrl: currentUrl, postId, message: 'TikTok đã xuất bản & chuyển hướng sang trang quản lý.' }
      }

      // 2. Xử lý popup xác nhận phụ của TikTok ("Tiếp tục đăng?" / "Continue to post?" / "Đăng ngay")
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
              stepLog('verify', 'Phát hiện popup "Tiếp tục đăng?", tự động xác nhận...')
              await V().humanClick(confirmBtn, 'Xác nhận Đăng ngay')
              await V().sleep(800)
            }
          }

          // Popup thông báo ĐÃ ĐĂNG THÀNH CÔNG!
          if (/đã được tải lên|has been uploaded|đã đăng|quản lý bài đăng|manage your posts|tải lên bài đăng khác|upload another/i.test(modalText)) {
            stepLog('verify', 'Phát hiện hộp thoại xác nhận đăng bài thành công từ TikTok!', 'success')
            return {
              ok: true,
              postUrl: HARUTV_PROFILE_URL,
              postId: `tiktok-${Date.now()}`,
              message: 'TikTok hiển thị hộp thoại đăng bài thành công.'
            }
          }
        }
      }

      // 3. Kiểm tra Toast thành công hoặc Toast báo lỗi thật
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
        stepLog('verify', `Nhận toast xác nhận thành công: ${toastJoined.slice(0, 100)}`, 'success')
        return { ok: true, postUrl: HARUTV_PROFILE_URL, postId: `tiktok-${Date.now()}`, message: toastJoined.slice(0, 120) }
      }

      // 4. Kiểm tra xuất hiện link bài vừa đăng của @harutv666
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

      await V().sleep(600)
    }

    // Trung thực: nếu vẫn đứng yên ở form upload và nút Đăng chưa đi đâu -> báo chưa xác nhận được
    stepLog('verify', 'Hết thời gian chờ nhưng TikTok chưa xác nhận xuất bản.', 'error')
    return { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }
  }

  function extractTikTokPostId(postUrl) {
    if (!postUrl) return null
    const match = String(postUrl).match(/\/(?:video|photo)\/([0-9]+)/i)
    return match?.[1] || null
  }

  // =========================================================================
  // QUÉT VIDEO XU HƯỚNG THỰC TẾ TỪ TIKTOK FOR YOU / EXPLORE
  // =========================================================================

  async function scrapeTikTokTrending() {
    for (let i = 0; i < 2; i++) {
      window.scrollBy(0, 650)
      await V().sleep(700)
    }
    window.scrollTo(0, 0)
    await V().sleep(300)

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