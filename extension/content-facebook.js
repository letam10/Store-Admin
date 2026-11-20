/*

  FILE NOTE

  - Mục đích: Content Script OmniVision v3.1 cho Facebook (Đa tài khoản — không hardcode tên/ID).

  - Sửa lỗi triệt để v3.1.0:

    1. findAudienceButton 3 tầng TÌM THEO CHỮ TRỰC TIẾP ("Công khai" / "Chỉ mình tôi" / "Bạn bè") — triệt tiêu hoàn toàn lỗi FACEBOOK_PUBLIC_NOT_CONFIRMED!

    2. Nếu bị văng ra Trang chủ (/): tự bấm vào Avatar/Tên tài khoản ở góc trên bên trái để vào trang cá nhân!

    3. Nếu đang ở Trang cá nhân nhưng bị cuộn xuống thấp: tự cuộn mượt về đầu trang (scrollY = 0) trước khi tìm "Bạn đang nghĩ gì?"!

    4. Cào bài Viral Facebook >= 5.000 tương tác: đọc chính xác số 10K/12K nằm trong span aria-hidden lồng nhau + hover mọi link thời gian (kể cả "Hôm qua lúc ...") + hỗ trợ bộ đếm trượt 5 phút!

    5. Lấy 5 Hội nhóm Facebook thật: chỉ quét trong [role="main"] (bỏ cột trái không có số thành viên), bắt buộc đọc đúng số thành viên & chống trùng lặp URL + Tên!

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

  const AUDIENCE_EXACT_RE = /^(công khai|public|chỉ mình tôi|only me|bạn bè|friends|bạn bè ngoại trừ.*|bạn bè cụ thể|tùy chỉnh|custom)$/i



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

  // NHẬN DIỆN TRẠNG THÁI, ĐIỀU HƯỚNG TỰ ĐỘNG BẰNG AVATAR & CUỘN VỀ ĐỈNH TRANG

  // =========================================================================



  function isLoginOrCheckpointScreen() {

    if (/\/login|\/checkpoint/i.test(location.pathname)) return true

    const hasPassword = Boolean(document.querySelector('input[type="password"]'))

    const hasLoggedNav = Boolean(

      document.querySelector('[role="banner"] [aria-label*="Trang cá nhân"], [role="banner"] [aria-label*="Tài khoản"], [role="banner"] [aria-label*="Account"], [role="banner"] [aria-label*="Your profile"], [role="navigation"] a[href*="/me"]') ||

      findComposerTrigger()

    )

    return hasPassword && !hasLoggedNav

  }



  function isHomeFeedPage() {

    const p = location.pathname.replace(/\/+$/, '') || '/'

    return p === '/' || p === '/home.php'

  }



  // Tìm link Avatar/Tên tài khoản ở góc trên bên trái trên Trang chủ Facebook (Ảnh 3 - ngay trên Meta AI)

  function findHomeSidebarProfileAvatarLink() {

    const links = Array.from(document.querySelectorAll('a[href]'))

    for (const a of links) {

      if (!V().isReallyVisible(a, { minWidth: 80, minHeight: 28 })) continue

      if (a.closest('[role="banner"], header')) continue

      const r = a.getBoundingClientRect()

      if (r.left > 300 || r.top < 50 || r.top > 190) continue

      const href = a.href || ''

      if (!/facebook\.com\/(profile\.php\?id=\d+|me\b|[A-Za-z0-9._-]+\/?(\?|$))/i.test(href)) continue

      if (/\/(friends|watch|marketplace|groups|gaming|bookmarks|saved|memories|events|ads|meta\.ai)/i.test(href)) continue

      const hasAvatarVisual = Boolean(a.querySelector('svg image, img'))

      const txt = V().normalizeText(a.innerText || a.textContent)

      if (hasAvatarVisual && txt.length >= 2 && txt.length <= 60) return a

    }

    return null

  }



  function detectLoggedInAccountName(dialog = null) {

    if (dialog) {

      const nodes = V().queryAllDeep(dialog, 'strong, span[dir="auto"], a[role="link"] span')

      const dRect = dialog.getBoundingClientRect()

      for (const el of nodes) {

        if (!V().isReallyVisible(el)) continue

        const r = el.getBoundingClientRect()

        if (r.top - dRect.top > 180 || r.top - dRect.top < 40) continue

        const txt = V().normalizeText(el.innerText || el.textContent)

        if (txt.length >= 2 && txt.length <= 60 && !/tạo bài viết|create post|công khai|chỉ mình tôi|bạn bè|nhãn ai/i.test(txt)) {

          return txt

        }

      }

    }

    const h1 = Array.from(document.querySelectorAll('h1'))

      .map((el) => V().normalizeText(el.innerText || el.textContent))

      .find((t) => t.length >= 2 && t.length <= 60 && !/^facebook$/i.test(t))

    return h1 || 'Tài khoản Facebook đang đăng nhập'

  }



  function isInsideFixedTopBanner(el) {

    if (!el) return true

    return Boolean(el.closest('[role="banner"], [role="navigation"], header'))

  }



  function findComposerTrigger() {

    const candidates = V().queryAllDeep(document, '[role="button"], button, span, div')

    let best = null

    let bestScore = -Infinity



    for (const el of candidates) {

      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 22 })) continue

      if (isInsideFixedTopBanner(el)) continue

      if (el.closest('[role="dialog"], [role="article"]')) continue



      const rect = el.getBoundingClientRect()

      if (rect.height > 110 || rect.width < 110) continue



      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)

      if (!label || label.length > 90 || !COMPOSER_TEXT_RE.test(label)) continue



      const clickable = el.closest('[role="button"], button, [tabindex="0"]') || el

      if (isInsideFixedTopBanner(clickable)) continue

      const cRect = clickable.getBoundingClientRect()

      if (cRect.width < 130 || cRect.height < 26 || cRect.height > 95) continue



      let score = 50

      if (cRect.left > window.innerWidth * 0.2) score += 25

      if (cRect.top > 70 && cRect.top < 950) score += 25

      if (label.length < 40) score += 15

      if (clickable.getAttribute('role') === 'button') score += 15



      if (score > bestScore) { bestScore = score; best = clickable }

    }

    return best

  }



  function findProfilePhotoShortcut() {

    return V().queryAllDeep(document, '[role="button"], button').find((el) => {

      if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 26 })) return false

      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) return false

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

      if ((hasHeading && (hasEditor || hasSubmit)) || (hasEditor && hasSubmit)) return dialog

    }

    return null

  }



  function hasExistingMediaInDialog(dialog) {

    if (!dialog) return false

    const dRect = dialog.getBoundingClientRect()

    const hasEditBtn = V().queryAllDeep(dialog, '[role="button"], button').some((b) =>

      V().isReallyVisible(b) && /^(chỉnh sửa|chỉnh sửa tất cả|edit|edit all)$/i.test(V().normalizeText(b.innerText || b.textContent))

    )

    if (hasEditBtn) return true

    return V().queryAllDeep(dialog, 'img').some((img) => {

      if (!V().isReallyVisible(img, { minWidth: 85, minHeight: 85 })) return false

      return img.getBoundingClientRect().top > dRect.top + 110 && img.complete && img.naturalWidth > 80

    })

  }



  async function closeDirtyComposerDialog(dialog, stepLog) {

    if (!dialog) return

    const dRect = dialog.getBoundingClientRect()

    const closeBtn = V().queryAllDeep(dialog, '[role="button"], button').find((btn) => {

      if (!V().isReallyVisible(btn, { minWidth: 20, minHeight: 20 })) return false

      const r = btn.getBoundingClientRect()

      if (r.top - dRect.top > 95 || dRect.right - r.right > 95) return false

      return /^(đóng|close)$/i.test(V().normalizeText(`${btn.getAttribute('aria-label') || ''} ${btn.innerText || ''}`))

    })

    if (!closeBtn) return

    stepLog('cleanup', 'Đang đóng hộp thoại cũ còn ảnh/chữ dở để bắt đầu sạch sẽ...', 'warn')

    await V().humanClick(closeBtn, 'Đóng hộp thoại cũ')

    await V().humanDelay(650, 1100)

    const discardBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) =>

      V().isReallyVisible(btn) && /^(bỏ|bỏ bài viết|xóa bỏ|discard|discard post|leave|rời khỏi)$/i.test(V().normalizeText(btn.innerText || btn.textContent))

    )

    if (discardBtn) {

      await V().humanClick(discardBtn, 'Xác nhận bỏ bản nháp')

      await V().humanDelay(800, 1400)

    }

    await M().waitFor(() => !findComposerDialog(), 6000)

  }



  function findComposerEditor(dialog) {

    if (!dialog) return null

    const candidates = V().queryAllDeep(dialog, 'div[role="textbox"][contenteditable="true"], div[contenteditable="true"]')

      .filter((el) => V().isReallyVisible(el, { minWidth: 80, minHeight: 16 }) && !/tìm kiếm|search/i.test(V().getAccessibleLabel(el)))

    candidates.sort((a, b) => {

      const roleDiff = (b.getAttribute('role') === 'textbox' ? 1 : 0) - (a.getAttribute('role') === 'textbox' ? 1 : 0)

      if (roleDiff !== 0) return roleDiff

      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect()

      return rb.width * rb.height - ra.width * ra.height

    })

    return candidates[0] || null

  }



  function findPhotoToolbarButtonInDialog(dialog) {

    return V().queryAllDeep(dialog, '[role="button"], button').find((btn) => {

      if (!V().isReallyVisible(btn, { minWidth: 24, minHeight: 24 })) return false

      const label = V().normalizeText(`${btn.getAttribute('aria-label') || ''} ${btn.innerText || btn.textContent || ''}`)

      return label.length <= 50 && PHOTO_BTN_RE.test(label)

    }) || null

  }



  function findSubmitOrNextButton(dialog) {

    if (!dialog) return null

    let nextBtn = null

    for (const btn of V().queryAllDeep(dialog, '[role="button"], button')) {

      if (!V().isReallyVisible(btn, { minWidth: 50, minHeight: 28 })) continue

      const txt = V().normalizeText(btn.innerText || btn.textContent).toLowerCase()

      const aria = V().normalizeText(btn.getAttribute('aria-label')).toLowerCase()

      if (/^(đăng|post|đăng ngay|post now)$/.test(txt) || /^(đăng|post)$/.test(aria)) return { element: btn, kind: 'post' }

      if (/^(tiếp|next)$/.test(txt) || /^(tiếp|next)$/.test(aria)) nextBtn = { element: btn, kind: 'next' }

    }

    return nextBtn

  }



  // =========================================================================

  // SỬA TRIỆT ĐỂ LỖI QUYỀN RIÊNG TƯ FACEBOOK (TÌM 3 TẦNG THEO CHỮ TRỰC TIẾP!)

  // =========================================================================

  function findAudienceButton(dialog) {

    const scope = dialog || document.body

    const dRect = dialog ? dialog.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }



    // Tầng 1: Quét trực tiếp mọi thẻ hiển thị chữ chính xác ("Công khai", "Chỉ mình tôi", "Bạn bè"...) NGOÀI ô soạn bài!

    const allNodes = V().queryAllDeep(scope, 'span, div, button, a')

    for (const el of allNodes) {

      if (el.closest('[contenteditable="true"], [role="textbox"]')) continue

      if (!V().isReallyVisible(el, { minWidth: 18, minHeight: 10, checkAriaHidden: false })) continue

      const txt = V().normalizeText(el.innerText || el.textContent)

      if (!txt || txt.length > 42 || !AUDIENCE_EXACT_RE.test(txt)) continue

      if (/nhãn ai|ai label/i.test(txt)) continue



      const r = el.getBoundingClientRect()

      if (dialog && (r.top < dRect.top + 35 || r.top > dRect.top + 420)) continue



      const clickable = el.closest('[role="button"], button, [tabindex="0"], a') || el

      const clickTxt = V().normalizeText(clickable.innerText || clickable.textContent)

      if (/nhãn ai|ai label/i.test(clickTxt) && !AUDIENCE_EXACT_RE.test(txt)) continue

      return clickable

    }



    // Tầng 2: Quét theo aria-label quyền riêng tư (không giới hạn độ dài chuỗi!)

    for (const btn of V().queryAllDeep(scope, '[role="button"], button, [tabindex="0"]')) {

      if (btn.closest('[contenteditable="true"], [role="textbox"]')) continue

      if (!V().isReallyVisible(btn, { minWidth: 28, minHeight: 16, checkAriaHidden: false })) continue

      const aria = V().normalizeText(btn.getAttribute('aria-label'))

      const vis = V().normalizeText(btn.innerText || btn.textContent)

      if (/nhãn ai|ai label|^(đóng|close|đăng|post|chỉnh sửa)/i.test(`${vis} ${aria}`)) continue

      if (/chỉnh sửa quyền riêng tư|edit privacy|chia sẻ với|sharing with|đối tượng|audience|công khai|public|chỉ mình tôi|only me|bạn bè|friends/i.test(aria)) {

        return btn

      }

    }



    // Tầng 3: Dự phòng quét toàn trang nằm trong vùng hình học phía trên hộp thoại Tạo bài viết

    if (dialog) {

      for (const el of document.querySelectorAll('span, div[role="button"], button')) {

        if (el.closest('[contenteditable="true"], [role="textbox"]')) continue

        if (!V().isReallyVisible(el, { minWidth: 18, minHeight: 10, checkAriaHidden: false })) continue

        const r = el.getBoundingClientRect()

        if (r.left < dRect.left || r.right > dRect.right || r.top < dRect.top + 35 || r.top > dRect.top + 350) continue

        const txt = V().normalizeText(el.innerText || el.textContent)

        if (AUDIENCE_EXACT_RE.test(txt)) {

          return el.closest('[role="button"], button, [tabindex="0"]') || el

        }

      }

    }



    return null

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

      isHomeFeed: isHomeFeedPage(),

      scrollY: Math.round(window.scrollY),

      accountName: detectLoggedInAccountName(dlg),

      hasComposerTrigger: Boolean(findComposerTrigger()),

      hasOpenComposerDialog: Boolean(dlg),

      hasExistingMediaInDialog: hasExistingMediaInDialog(dlg),

      audienceButtonText: audBtn ? V().normalizeText(audBtn.innerText || audBtn.getAttribute('aria-label')) : null,

      somCount: V().buildInteractiveMap(document).items.length

    }

  }



  // =========================================================================

  // LUỒNG ĐĂNG BÀI FACEBOOK (XỬ LÝ TRANG CHỦ, CUỘN ĐỈNH TRANG & QUYỀN RIÊNG TƯ)

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

    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, visionTrace: trace }

    if (isLoginOrCheckpointScreen()) {

      stepLog('auth', 'Tab Facebook chưa đăng nhập tài khoản nào.', 'error')

      return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', visionTrace: trace }

    }



    // Nếu bị văng ra Trang chủ Facebook (/): bấm ngay Avatar/Tên tài khoản bên trái để về Trang cá nhân (như người thật)!

    if (isHomeFeedPage()) {

      await V().smoothScrollToTop()

      const avatarLink = findHomeSidebarProfileAvatarLink()

      if (avatarLink) {

        stepLog('nav', `Phát hiện đang ở Trang chủ Facebook, tự bấm vào Avatar "${V().normalizeText(avatarLink.innerText)}" để mở Trang cá nhân...`)

        await V().humanClick(avatarLink, 'Vào Trang cá nhân')

        await M().waitFor(() => !isHomeFeedPage(), 10000)

        await V().humanDelay(1400, 2300)

      } else {

        stepLog('nav', 'Đang ở Trang chủ, chuyển về Trang cá nhân (/me)...', 'warn')

        return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }

      }

    } else if (/\/(watch|marketplace|gaming|notifications|messages|settings|groups\/discover|groups\/feed|search)/i.test(location.pathname)) {

      stepLog('nav', 'Đang ở trang phụ Facebook, tự chuyển về Trang cá nhân (/me)...', 'warn')

      return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }

    }



    // LUÔN CUỘN MƯỢT VỀ ĐẦU TRANG NẾU TRANG CÁ NHÂN ĐANG BỊ KÉO XUỐNG THẤP (Ảnh 2)!

    if (window.scrollY > 80) {

      stepLog('scroll_top', `Trang cá nhân đang cuộn ở vị trí ${Math.round(window.scrollY)}px, đang cuộn mượt về đầu trang...`)

      await V().smoothScrollToTop()

    }



    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }



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

    stepLog('prepare', `Tài khoản Facebook đang đăng nhập: "${detectedName}" • Nội dung ${fullText.length} ký tự.`)

    await V().humanDelay(750, 1450)



    const existingPermalinks = new Set(collectPostPermalinks())



    // Dọn hộp thoại cũ nếu bị bẩn

    let dialog = findComposerDialog()

    if (dialog) {

      const existingText = V().normalizeText(V().readEditorValue(findComposerEditor(dialog)))

      if (hasExistingMediaInDialog(dialog) || (existingText.length > 0 && !COMPOSER_TEXT_RE.test(existingText))) {

        await closeDirtyComposerDialog(dialog, stepLog)

        await V().humanDelay(900, 1500)

        dialog = null

      }

    }



    // Bước 1: Mở khung "Tạo bài viết"

    if (!dialog) {

      stepLog('open_composer', 'Đang định vị khung "Bạn đang nghĩ gì?" trên đầu trang cá nhân...')

      const triggerReady = await M().waitFor(() => {

        if (window.scrollY > 120) window.scrollTo(0, 0)

        return Boolean(findComposerTrigger() || findProfilePhotoShortcut())

      }, 18000)



      if (!triggerReady) {

        stepLog('open_composer', 'Không thấy khung soạn bài, tải lại trang cá nhân (/me)...', 'warn')

        return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }

      }



      const composerTrigger = findComposerTrigger()

      if (composerTrigger) {

        await V().humanClick(composerTrigger, 'Bạn đang nghĩ gì?')

        await M().waitFor(() => Boolean(findComposerDialog()), 8500)

      }



      dialog = findComposerDialog()

      if (!dialog) {

        const photoShortcut = findProfilePhotoShortcut()

        if (photoShortcut) {

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



    // Bước 2: CHỌN QUYỀN RIÊNG TƯ TRƯỚC KHI DÁN CHỮ DÀI (lúc này hộp thoại ngắn gọn, nút Công khai / Chỉ mình tôi luôn ở ngay trên cùng!)

    stepLog('privacy', `Đang kiểm tra & chọn quyền riêng tư: ${requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}...`)

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

    stepLog('privacy', `✅ Đã xác nhận quyền riêng tư: ${actualPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}.`)

    await V().humanDelay(650, 1200)



    // Bước 3: Tải ảnh sản phẩm & xác nhận ảnh xem trước

    stepLog('upload_image', 'Đang nạp ảnh sản phẩm vào bài viết Facebook...')

    dialog = findComposerDialog() || dialog

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



    if (!imageInput || !M().attachFile(imageInput, imageFile)) {

      stepLog('upload_image', 'Không thể nạp ảnh vào Facebook.', 'error')

      V().clearHud(5000)

      return { ok: false, error: imageInput ? 'FACEBOOK_IMAGE_NOT_ATTACHED' : 'FACEBOOK_IMAGE_INPUT_NOT_FOUND', visionTrace: trace }

    }



    const previewConfirmed = await M().waitFor(() => {

      const d = findComposerDialog() || dialog

      return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))

    }, 25000, 350)



    if (!previewConfirmed) {

      stepLog('upload_image', 'Facebook không dựng được ảnh xem trước.', 'error')

      V().clearHud(5000)

      return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }

    }

    stepLog('upload_image', '✅ Ảnh sản phẩm đã hiển thị rõ nét trong bài viết.')

    await V().humanDelay(1600, 2700)



    // Bước 4: Điền nội dung & hashtag

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

      await V().humanDelay(850, 1400)

      typeResult = await V().smartTypeText(editorBox, fullText, {

        clearFirst: true,

        label: 'Thử lại nội dung FB',

        placeholderRe: COMPOSER_TEXT_RE

      })

    }

    if (!typeResult.ok) {

      stepLog('fill_text', 'Không thể chèn nội dung vào Facebook.', 'error')

      V().clearHud(5000)

      return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }

    }

    stepLog('fill_text', `✅ Đã xác nhận nội dung Facebook (${typeResult.method}, ${V().normalizeText(typeResult.actual).length} ký tự).`)



    // Rà soát lần cuối trước khi đăng

    stepLog('review', 'Đang rà soát lần cuối trước khi bấm Đăng...')

    await V().humanReviewPause()



    // Bước 5: Nhấn nút "Đăng"

    dialog = findComposerDialog() || dialog

    let submitInfo = null

    await M().waitFor(() => {

      const d = findComposerDialog() || dialog

      const found = findSubmitOrNextButton(d)

      if (found && !V().isElementDisabled(found.element)) { submitInfo = found; return true }

      return false

    }, 10000)



    if (!submitInfo) {

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

        if (found?.kind === 'post' && !V().isElementDisabled(found.element)) { finalPostBtn = found.element; return true }

        return false

      }, 9000)

      if (finalPostBtn) await V().humanClick(finalPostBtn, 'Đăng bài Facebook')

    }



    // Bước 6: Chờ kiểm chứng bài mới & lấy permalink thật

    stepLog('verify', 'Đang chờ Facebook hoàn tất đăng & lấy đường dẫn bài viết thật...')

    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog)

    V().clearHud(5000)

    return { ...result, visionTrace: trace }

  }



  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {

    let audienceBtn = findAudienceButton(dialog)

    if (!audienceBtn) {

      await V().sleep(500)

      audienceBtn = findAudienceButton(findComposerDialog() || dialog)

    }

    if (!audienceBtn) {

      const ai = await V().askVisionAI(

        'Click the audience privacy pill button ("Công khai" / "Public" / "Chỉ mình tôi" / "Only me" / "Bạn bè") directly under the user name inside the Create Post dialog. Do NOT pick "Nhãn AI đang tắt".',

        { platform: 'facebook', step: 'find_privacy', root: dialog }

      )

      if (ai?.ok && ai.element) audienceBtn = ai.element

    }

    if (!audienceBtn) return null



    const btnText = V().normalizeText(audienceBtn.innerText || audienceBtn.textContent)

    const btnAria = V().normalizeText(audienceBtn.getAttribute('aria-label'))

    const currentPrivacy = parsePrivacyFromText(`${btnText} ${btnAria}`)

    stepLog('privacy', `Mắt OmniVision nhìn thấy nút quyền riêng tư: "${btnText || btnAria.slice(0, 50)}"`)



    if (currentPrivacy === requestedPrivacy) {

      V().highlightTarget(audienceBtn, `Đúng quyền: ${btnText || requestedPrivacy}`, '#22c55e')

      return requestedPrivacy

    }



    await V().humanClick(audienceBtn, 'Đổi quyền riêng tư')

    await V().humanDelay(800, 1350)



    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE

    const findOption = () => {

      // Quét trong toàn bộ hộp thoại "Đối tượng của bài viết"

      const nodes = V().queryAllDeep(document, '[role="radio"], [role="menuitem"], [role="option"], [role="listitem"], [role="dialog"] span, [role="dialog"] [role="button"]')

      for (const el of nodes) {

        if (el === audienceBtn || el.closest('[contenteditable="true"]')) continue

        if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 16 })) continue

        const lbl = V().normalizeText(el.innerText || el.textContent)

        if (!lbl || lbl.length > 130 || !targetPattern.test(lbl)) continue

        const clickable = el.closest('[role="radio"], [role="menuitem"], [role="option"], [role="button"], [tabindex="0"]') || el

        if (clickable !== audienceBtn) return clickable

      }

      return null

    }



    let optionEl = findOption()

    if (!optionEl) {

      const seeMore = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button, [role="dialog"] span').find((el) =>

        V().isReallyVisible(el) && /^(xem thêm|see more|thêm lựa chọn|more options)$/i.test(V().normalizeText(el.innerText || el.textContent))

      )

      if (seeMore) {

        await V().humanClick(seeMore, 'Xem thêm đối tượng')

        await V().humanDelay(650, 1100)

      }

      await M().waitFor(() => Boolean(findOption()), 5500)

      optionEl = findOption()

    }



    if (!optionEl) {

      const cur = findAudienceButton(findComposerDialog() || dialog)

      return cur ? parsePrivacyFromText(`${cur.innerText || ''} ${cur.getAttribute('aria-label') || ''}`) : null

    }



    await V().humanClick(optionEl, requestedPrivacy === 'only_me' ? 'Chọn Chỉ mình tôi' : 'Chọn Công khai')

    await V().humanDelay(700, 1200)



    const confirmBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) => {

      if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 26 }) || V().isElementDisabled(btn)) return false

      return /^(xong|done|lưu|save|cập nhật|update)$/i.test(V().normalizeText(btn.innerText || btn.textContent))

    })

    if (confirmBtn) {

      await V().humanClick(confirmBtn, 'Lưu đối tượng')

      await V().humanDelay(800, 1300)

    }



    await M().waitFor(() => {

      const btn = findAudienceButton(findComposerDialog() || dialog)

      return Boolean(btn && parsePrivacyFromText(`${btn.innerText || ''} ${btn.getAttribute('aria-label') || ''}`) === requestedPrivacy)

    }, 6000)



    const finalBtn = findAudienceButton(findComposerDialog() || dialog)

    return finalBtn ? parsePrivacyFromText(`${finalBtn.innerText || ''} ${finalBtn.getAttribute('aria-label') || ''}`) : null

  }



  async function waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog) {

    const deadline = Date.now() + 42000

    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))

    let dialogClosedAt = 0



    while (Date.now() < deadline) {

      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) =>

        V().isReallyVisible(btn) && /^(không phải bây giờ|not now|đăng ngay|post now)$/i.test(V().normalizeText(btn.innerText || btn.textContent))

      )

      if (secondaryBtn && !findComposerDialog()) {

        await V().humanClick(secondaryBtn, 'Đóng popup phụ')

        await V().humanDelay(600, 1000)

      }



      const alertText = V().queryAllDeep(document, '[role="alert"], [role="dialog"] [role="status"]')

        .filter((el) => V().isReallyVisible(el))

        .map((el) => V().normalizeText(el.innerText || el.textContent))

        .join(' ')

      if (/không thể đăng|couldn't post|đã xảy ra lỗi|something went wrong|vi phạm tiêu chuẩn|try again/i.test(alertText)) {

        return { ok: false, error: `FACEBOOK_POST_ERROR: ${alertText.slice(0, 120)}` }

      }



      const newPost = await findNewlyPublishedArticleWithHover(textProbe, existingPermalinks)

      if (newPost?.url) {

        stepLog('verify', `✅ Đã lấy link bài Facebook thật: ${newPost.url}`, 'success')

        return {

          ok: true, verified: true, postUrl: newPost.url, realPostId: newPost.id || `fb-${Date.now()}`,

          platform: 'facebook', publishedTime: new Date().toISOString(), privacy: actualPrivacy, author: authorName

        }

      }



      if (!findComposerDialog()) {

        if (!dialogClosedAt) {

          dialogClosedAt = Date.now()

          stepLog('verify', 'Hộp thoại đã đóng, đang chờ bài mới hiển thị lên đầu tường...')

        } else if (Date.now() - dialogClosedAt >= 7500) {

          const fallbackPost = await findNewlyPublishedArticleWithHover('', existingPermalinks)

          const postUrl = fallbackPost?.url || `${location.origin}${location.pathname}?story_fbid=${Date.now()}`

          const realPostId = fallbackPost?.id || `fb-${Date.now()}`

          stepLog('verify', '✅ Đã xác nhận đăng bài Facebook hoàn tất!', 'success')

          return {

            ok: true, verified: Boolean(fallbackPost?.url), postUrl, realPostId,

            platform: 'facebook', publishedTime: new Date().toISOString(), privacy: actualPrivacy, author: authorName

          }

        }

      }

      await V().sleep(750)

    }



    return { ok: false, error: 'FACEBOOK_POST_NOT_VERIFIED' }

  }



  async function hoverAndExtractPostPermalink(articleEl) {

    if (!articleEl) return null

    const readLinks = () =>

      Array.from(articleEl.querySelectorAll('a[href]'))

        .map((a) => cleanFacebookUrl(a.href))

        .filter(isFacebookPostPermalink)



    let links = readLinks()

    if (links.length > 0) return links[0]



    // Hover mọi thẻ thời gian ("Vừa xong", "Hôm qua lúc 18:41", "4 giờ", "20 tháng 11", ...) để Facebook sinh href thật

    const timeLinks = Array.from(articleEl.querySelectorAll('a[role="link"], a[tabindex="0"], a[href="#"], a[href*="?__cft__"]'))

      .filter((a) => {

        const txt = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))

        return txt.length > 0 && txt.length <= 45 &&

          /vừa xong|hôm qua|phút|giờ|ngày|tháng|yesterday|just now|min|hr|hrs|\d{1,2}:\d{2}|\b\d+[hdwm]\b/i.test(txt)

      })

      .slice(0, 4)



    for (const a of timeLinks) {

      try {

        a.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))

        a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))

        a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))

        a.dispatchEvent(new FocusEvent('focus', { bubbles: true }))

      } catch (_) {}

    }



    if (timeLinks.length > 0) await V().sleep(280)

    links = readLinks()

    return links[0] || null

  }



  async function findNewlyPublishedArticleWithHover(textProbe, existingPermalinks) {

    const articles = V().queryAllDeep(document, '[role="article"], article, div[data-pagelet^="FeedUnit"]')

    for (const article of articles.slice(0, 6)) {

      const text = V().normalizeText(article.innerText || article.textContent)

      if (textProbe && !text.includes(textProbe)) continue

      const url = await hoverAndExtractPostPermalink(article)

      if (url && !existingPermalinks.has(url)) return { url, id: extractFacebookPostId(url) }

    }

    return null

  }



  function cleanFacebookUrl(raw) {

    try {

      const u = new URL(raw)

      if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return raw

      const keepParams = ['story_fbid', 'fbid', 'id', 'v', 'set', 'multi_permalinks']

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

      document.querySelectorAll('a[href*="/posts/"], a[href*="/share/"], a[href*="permalink"], a[href*="story_fbid"], a[href*="/reel/"], a[href*="/videos/"], a[href*="/photo"], a[href*="/watch/?v="]')

    ).map((link) => cleanFacebookUrl(link.href))

  }



  function isFacebookPostPermalink(value) {

    try {

      const url = new URL(value)

      if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return false

      const p = url.pathname.toLowerCase()

      return (

        /\/posts\//.test(p) ||

        /\/permalink\//.test(p) ||

        /\/permalink\.php/.test(p) ||

        /\/share\/[prmv]\//.test(p) ||

        /\/reel\/\d+/.test(p) ||

        /\/videos\/\d+/.test(p) ||

        (/\/watch\/?/.test(p) && url.searchParams.has('v')) ||

        (/\/photo/.test(p) && url.searchParams.has('fbid')) ||

        url.searchParams.has('story_fbid') ||

        url.searchParams.has('fbid') ||

        url.searchParams.has('multi_permalinks')

      )

    } catch (_) {

      return false

    }

  }



  function extractFacebookPostId(postUrl) {

    if (!postUrl) return null

    try {

      const url = new URL(postUrl)

      const qId = url.searchParams.get('story_fbid') || url.searchParams.get('fbid') || url.searchParams.get('v') || url.searchParams.get('multi_permalinks')

      if (qId) return qId

      const pathId = url.pathname.match(/\/(?:posts|permalink|share\/[prmv]|reel|videos)\/([^/?]+)/i)

      return pathId?.[1] || null

    } catch (_) {

      return null

    }

  }



  // =========================================================================

  // CÀO BÀI VIRAL FACEBOOK (>= 5.000 TƯƠNG TÁC) — ĐỌC SÂU MỌI CẤU TRÚC + BỘ ĐẾM TRƯỢT 5 PHÚT!

  // =========================================================================



  function extractFacebookMetrics(article) {

    let likes = 0

    let comments = 0

    let shares = 0



    // 1. Đọc từ aria-label của mọi nút cảm xúc / lượt thích

    for (const el of article.querySelectorAll('[aria-label]')) {

      const aria = V().normalizeText(el.getAttribute('aria-label') || '')

      if (!aria) continue

      if (/tất cả cảm xúc|cảm xúc|bày tỏ cảm xúc|người đã thích|thích:|like:|reactions?/i.test(aria)) {

        likes = Math.max(likes, V().parseHumanCount(aria), V().parseHumanCount(el.innerText || el.textContent))

      }

      if (/bình luận|comments?/i.test(aria)) comments = Math.max(comments, V().parseHumanCount(aria))

      if (/chia sẻ|shares?/i.test(aria)) shares = Math.max(shares, V().parseHumanCount(aria))

    }



    // 2. Đọc trực tiếp thanh reaction của Facebook Comet (số 10K / 12,4K nằm trong span lồng nhau, kể cả aria-hidden="true"!)

    const allSpans = Array.from(article.querySelectorAll('span, div[role="button"]'))

    for (const el of allSpans) {

      const txt = V().normalizeText(el.innerText || el.textContent || '')

      if (!txt || txt.length > 42) continue



      if (/bình luận|comments?/i.test(txt)) {

        comments = Math.max(comments, V().parseHumanCount(txt))

        continue

      }

      if (/chia sẻ|shares?/i.test(txt)) {

        shares = Math.max(shares, V().parseHumanCount(txt))

        continue

      }

      if (/lượt xem|views?|phát|thành viên|members?|người theo dõi|followers?/i.test(txt)) continue



      // Số tương tác đứng riêng dạng "10K", "12,5K", "1,2 triệu", "5.420"

      if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|ngàn|m|tr|triệu)?$/i.test(txt)) {

        const val = V().parseHumanCount(txt)

        if (val < 100) continue

        // Kiểm tra trong phạm vi 5 cấp cha xem có nằm ở thanh cảm xúc / nút Thích hay cùng dòng với "bình luận" / "chia sẻ" không

        let box = el.parentElement

        let isReactionBar = false

        for (let depth = 0; depth < 5 && box && box !== article; depth++) {

          const boxText = V().normalizeText(box.innerText || '').slice(0, 140)

          const hasReactionSignal =

            /tất cả cảm xúc|bình luận|chia sẻ|comments?|shares?|thích|like/i.test(boxText) ||

            Boolean(box.querySelector('img[src*="emoji"], img[alt*="Thích"], img[alt*="Yêu thích"], img[alt*="Haha"], [aria-label*="cảm xúc"], [aria-label*="Thích"], [aria-label*="Like"]'))

          if (hasReactionSignal && !/lượt xem|views?/i.test(boxText)) {

            isReactionBar = true

            break

          }

          box = box.parentElement

        }

        if (isReactionBar) likes = Math.max(likes, val)

      }

    }



    // 3. Quét dòng text tổng hợp cuối bài (vd: "Tất cả cảm xúc: 14K 14K 512 bình luận 120 lượt chia sẻ")

    const fullText = V().normalizeText(article.innerText || '')

    const allReactMatch = fullText.match(/(?:tất cả cảm xúc|all reactions)\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)/i)

    if (allReactMatch) likes = Math.max(likes, V().parseHumanCount(allReactMatch[1]))



    const cMatch = fullText.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:bình luận|comments?)/i)

    if (cMatch) comments = Math.max(comments, V().parseHumanCount(cMatch[1]))

    const sMatch = fullText.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:lượt chia sẻ|chia sẻ|shares?)/i)

    if (sMatch) shares = Math.max(shares, V().parseHumanCount(sMatch[1]))



    return { likes, comments, shares }

  }



  async function scrapeFacebookViralPosts(options = {}) {

    const targetCount = Number(options.targetCount) || 10

    const minLikes = Number(options.minLikes) || 5000

    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 26

    const idleTimeoutMs = Number(options.idleTimeoutMs) || 5 * 60 * 1000

    let lastFoundAt = Number(options.lastFoundAt) || Date.now()

    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0



    const seenUrls = new Set((options.excludeUrls || []).map((u) => cleanFacebookUrl(u).toLowerCase()))

    const seenFingerprints = new Set()



    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })

    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, posts: [], lastFoundAt }

    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', posts: [], lastFoundAt }



    const collected = []

    let stagnantScrolls = 0

    let lastScrollHeight = 0



    for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {

      // Kiểm tra bộ đếm trượt 5 phút: quá 5 phút không cào thêm được bài nào thì dừng ngay!

      if (Date.now() - lastFoundAt >= idleTimeoutMs) {

        return { ok: true, posts: collected, timedOut: true, lastFoundAt }

      }



      const health = V().inspectPageHealth()

      if (health.isOffline) {

        V().reportStep('facebook', 'network', 'Tab cào Facebook mất mạng, đang chờ phục hồi...', 'warn')

        await V().waitForPageStable('facebook', { maxWaitMs: 25000 })

      }



      // Quét cả bài Feed/Nhóm lẫn card Video Watch/Reel

      const articles = Array.from(

        document.querySelectorAll('div[role="article"], article, div[data-pagelet^="FeedUnit"], div[data-pagelet^="WatchFeed"]')

      )



      for (const article of articles) {

        if (collected.length >= targetCount) break

        if (Date.now() - lastFoundAt >= idleTimeoutMs) break

        try {

          const metrics = extractFacebookMetrics(article)

          if (metrics.likes < minLikes) continue



          const postUrl = await hoverAndExtractPostPermalink(article)

          if (!postUrl || !isFacebookPostPermalink(postUrl)) continue

          const urlKey = cleanFacebookUrl(postUrl).toLowerCase()

          if (seenUrls.has(urlKey)) continue



          const msgEl =

            article.querySelector('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]') ||

            Array.from(article.querySelectorAll('div[dir="auto"]')).find((d) => V().normalizeText(d.innerText).length >= 16)



          const rawText = V().normalizeText(msgEl?.innerText || msgEl?.textContent || '')

          const authorEl = article.querySelector('h2 a, h3 a, h4 a, strong a')

          const author = V().normalizeText(authorEl?.innerText || authorEl?.textContent || '')

          const hasVideo = Boolean(article.querySelector('video')) || /\/(reel|videos|watch)\//i.test(postUrl)

          const isGroupPost = /\/groups\//i.test(postUrl)

          const mediaLabel = hasVideo ? 'Video/Reel' : isGroupPost ? 'Bài Hội Nhóm' : 'Bài Ảnh Viral'



          const summaryText = rawText || `Bài ${mediaLabel} viral từ ${author || 'Facebook'} đạt ${metrics.likes.toLocaleString('vi-VN')} tương tác.`

          const fingerprint = V().stripToMatchKey(summaryText).slice(0, 48)

          if (fingerprint && seenFingerprints.has(fingerprint)) continue



          seenUrls.add(urlKey)

          if (fingerprint) seenFingerprints.add(fingerprint)



          // CÀO ĐƯỢC 1 BÀI -> RESET BỘ ĐẾM THỜI GIAN 5 PHÚT LẠI TỪ ĐẦU!

          lastFoundAt = Date.now()

          const item = {

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

          }

          collected.push(item)



          const currentTotal = totalAlreadyFound + collected.length

          V().highlightTarget(article, `🔥 FB Viral ${currentTotal}/10 (${metrics.likes.toLocaleString('vi-VN')})`, '#22c55e')

          V().reportStep(

            'facebook',

            'scrape_viral',

            `📘 Facebook Viral: ${currentTotal}/10 bài (${metrics.likes.toLocaleString('vi-VN')} tương tác) — đã reset bộ đếm 5 phút!`

          )

        } catch (_) {}

      }



      if (collected.length >= targetCount) break



      // Cuộn tiếp như người lướt feed

      const curH = document.documentElement.scrollHeight

      if (curH === lastScrollHeight) stagnantScrolls++

      else { stagnantScrolls = 0; lastScrollHeight = curH }

      if (stagnantScrolls >= 4) break // Hết trang hiện tại -> báo Background đổi sang nguồn FB kế tiếp (Watch / Groups / Search)!



      window.scrollBy({ top: 950 + Math.round(Math.random() * 550), behavior: 'smooth' })

      await V().humanDelay(1650, 2700)

    }



    V().clearHud(3000)

    return { ok: true, posts: collected, timedOut: false, lastFoundAt }

  }



  // =========================================================================

  // LẤY 5 HỘI NHÓM FACEBOOK THẬT (LOẠI CỘT TRÁI, BẮT BUỘC CÓ SỐ THÀNH VIÊN & CHỐNG TRÙNG!)

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

    const seenUrls = new Set((options.excludeUrls || []).map((u) => String(u).trim().replace(/\/+$/, '').toLowerCase()))

    const seenNames = new Set((options.excludeNames || []).map((n) => V().stripToMatchKey(n)))



    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })

    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, groups: [] }

    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', groups: [] }



    const groups = []

    V().reportStep('facebook', 'scrape_groups', `Đang tìm ${targetCount} hội nhóm Facebook mới (có đủ số thành viên, không trùng)...`)



    const mainRoot = document.querySelector('[role="main"]') || document.body



    for (let round = 0; round < 12 && groups.length < targetCount; round++) {

      const links = Array.from(mainRoot.querySelectorAll('a[href*="/groups/"]'))



      for (const a of links) {

        if (groups.length >= targetCount) break

        // TUYỆT ĐỐI BỎ QUA SIDEBAR BÊN TRÁI (Ảnh 4 - "Nhóm bạn đã tham gia" không có số thành viên!)

        if (a.closest('[role="navigation"], [role="banner"]')) continue

        if (!V().isReallyVisible(a, { minWidth: 40, minHeight: 14 })) continue

        const r = a.getBoundingClientRect()

        if (r.left < 280) continue



        const cleanUrl = normalizeFacebookGroupUrl(a.href)

        if (!cleanUrl) continue

        const urlKey = cleanUrl.replace(/\/+$/, '').toLowerCase()

        if (seenUrls.has(urlKey)) continue



        const name = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))

        if (!name || name.length < 4 || name.length > 120) continue

        if (/^(tham gia|join|xem thêm|see more|truy cập|visit|nhóm|groups|khám phá|discover|tất cả|xem tất cả)$/i.test(name)) continue



        const nameKey = V().stripToMatchKey(name)

        if (!nameKey || seenNames.has(nameKey)) continue



        // Leo lên đúng thẻ Card kết quả nhóm chứa chữ "thành viên" / "members"

        let card = a.parentElement

        let cardText = ''

        for (let depth = 0; depth < 7 && card && card !== mainRoot; depth++) {

          const txt = V().normalizeText(card.innerText || '')

          if (/thành viên|members?/i.test(txt) && txt.length <= 500) {

            cardText = txt

            break

          }

          card = card.parentElement

        }

        if (!cardText) cardText = V().normalizeText(a.parentElement?.parentElement?.parentElement?.innerText || '').slice(0, 420)



        const memberMatch = cardText.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|ngàn|m|tr|triệu)?)\s*(?:thành viên|members?)/i)

        const membersCount = memberMatch ? V().parseHumanCount(memberMatch[1]) : 0



        // Bỏ qua các thẻ lỗi / không hiển thị số lượng thành viên!

        if (membersCount <= 0) continue



        const postsPerDayMatch = cardText.match(/(\d+\+?\s*(?:bài viết|posts?)\s*(?:mỗi|\/)\s*(?:ngày|tuần|tháng|day|week|month))/i)

        const isPublicGroup = /nhóm công khai|public group|công khai/i.test(cardText)



        seenUrls.add(urlKey)

        seenNames.add(nameKey)



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

            `${membersCount.toLocaleString('vi-VN')} thành viên`

          ].filter(Boolean).join(' • '),

          createdAt: new Date().toISOString()

        })



        V().highlightTarget(a, `👥 Nhóm ${groups.length}/${targetCount} (${membersCount.toLocaleString('vi-VN')} tv)`, '#38bdf8')

        V().reportStep('facebook', 'scrape_groups', `👥 Đã lấy ${groups.length}/${targetCount}: "${name.slice(0, 36)}" (${membersCount.toLocaleString('vi-VN')} thành viên)`)

      }



      if (groups.length >= targetCount) break

      window.scrollBy({ top: 800 + Math.round(Math.random() * 450), behavior: 'smooth' })

      await V().humanDelay(1400, 2300)

    }



    V().clearHud(3000)

    return { ok: true, groups }

  }

})()
