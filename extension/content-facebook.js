/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.3.0 cho Facebook Desktop 2026 (Chạy ngầm tab + Checkpoint phục hồi bước + tách cào Viral Trang chủ vs Thước phim).
  - Liên kết trực tiếp: vision-engine.js, background.js, content-admin-bridge.js
  - Vùng ảnh hưởng khi sửa: Luồng tự động đăng bài Facebook và cào bài viết/thước phim viral từ Facebook.
*/

;(() => {
  if (typeof window.__OMNICART_FB_CLEANUP__ === 'function') {
    try { window.__OMNICART_FB_CLEANUP__() } catch (_) {}
  }

  const COMPOSER_TEXT_RE = /bạn đang nghĩ gì|what's on your mind|viết gì đó|write something|tạo bài viết|create a post/i
  const EXCLUDE_NOTE_RE = /chia sẻ suy nghĩ|share a thought|ghi chú|note/i
  const PHOTO_BTN_RE = /ảnh\/video|photo\/video|thêm ảnh|add photo/i
  const ONLY_ME_RE = /chỉ mình tôi|only me/i
  const PUBLIC_RE = /công khai|public/i
  const FRIENDS_RE = /bạn bè|friends/i
  const AUDIENCE_EXACT_RE = /^(công khai|public|chỉ mình tôi|only me|bạn bè|friends|bạn thân|bạn bè ngoại trừ.*|chỉ hiển thị với.*|không hiển thị với.*|tùy chỉnh|custom)$/i

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
      executeFacebookPost(message.payload, message.checkpoint || {})
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
    if (message.type === 'FB_WATCH_ITEM') {
      watchFacebookItem(message.options || {}).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }))
      return true
    }
    if (message.type === 'FB_SCRAPE_COMMENTS') {
      scrapeFacebookPostComments(message.options || {}).then(sendResponse).catch((e) => sendResponse({ ok: false, comments: [] }))
      return true
    }
    if (message.type === 'FB_SCRAPE_CHANNEL') {
      scrapeFacebookChannelInfo(message.options || {}).then(sendResponse).catch((e) => sendResponse({ ok: false }))
      return true
    }
    return false
  }

  chrome.runtime.onMessage.addListener(handleMessage)
  window.__OMNICART_FB_CLEANUP__ = () => {
    try { chrome.runtime.onMessage.removeListener(handleMessage) } catch (_) {}
  }

  function isLoginOrCheckpointScreen() {
    if (/\/login|\/checkpoint/i.test(location.pathname)) return true
    const hasPassword = Boolean(document.querySelector('input[type="password"]'))
    const hasBanner = Boolean(document.querySelector('[role="banner"] [aria-label*="Trang cá nhân"], [role="banner"] [aria-label*="Tài khoản"], [role="banner"] [aria-label*="Your profile"], [role="banner"] [aria-label*="Account"]'))
    return hasPassword && !hasBanner && !findComposerTrigger()
  }

  function isNonProfilePage() {
    const p = location.pathname.replace(/\/+$/, '') || '/'
    if (p === '/' || p === '/home.php') return true
    return /^\/(reel|reels|watch|groups|marketplace|gaming|friends|memories|saved|events|notifications|messages|settings|search|bookmarks)/i.test(p)
  }

  function findHomeSidebarProfileAvatarLink() {
    for (const a of document.querySelectorAll('a[href]')) {
      if (!V().isReallyVisible(a, { minWidth: 80, minHeight: 28 })) continue
      if (a.closest('[role="banner"], header')) continue
      const r = a.getBoundingClientRect()
      if (r.left > 300 || r.top < 50 || r.top > 190) continue
      const href = a.href || ''
      if (!/facebook\.com\/(profile\.php\?id=\d+|me\b|[A-Za-z0-9._-]+\/?(\?|$))/i.test(href)) continue
      if (/\/(friends|watch|marketplace|groups|gaming|bookmarks|saved|memories|events|ads|meta\.ai)/i.test(href)) continue
      if (a.querySelector('svg image, img') && V().normalizeText(a.innerText).length >= 2) return a
    }
    return null
  }

  async function navigateToProfileViaTopRightAvatar(stepLog) {
    const leftLink = findHomeSidebarProfileAvatarLink()
    if (leftLink) {
      stepLog('nav', 'Đang mở Trang cá nhân...')
      await V().humanClick(leftLink)
      if (await M().waitFor(() => !isNonProfilePage(), 8000)) { await V().humanDelay(1000, 1600); return true }
    }

    const bannerBtns = Array.from(document.querySelectorAll('[role="banner"] [role="button"], [role="banner"] button'))
      .filter((b) => V().isReallyVisible(b, { minWidth: 28, minHeight: 28 }))
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)

    const avatarBtn = bannerBtns.find((b) => /trang cá nhân|tài khoản|your profile|account/i.test(V().normalizeText(b.getAttribute('aria-label')))) || bannerBtns[0]
    if (!avatarBtn) return false

    stepLog('nav', 'Đang bấm Avatar góc trên phải để về Trang cá nhân...')
    await V().humanClick(avatarBtn, { skipScroll: true })
    await V().humanDelay(650, 1050)

    const profileMenuLink = Array.from(document.querySelectorAll('[role="dialog"] a[href], [role="menu"] a[href], a[href*="/me"]'))
      .find((a) => {
        if (!V().isReallyVisible(a, { minWidth: 90, minHeight: 28 })) return false
        const r = a.getBoundingClientRect()
        return r.left >= window.innerWidth * 0.5 && r.top >= 45 && r.top <= 260 && /facebook\.com\/(me\/?|profile\.php\?id=\d+)/i.test(a.href || '')
      })

    if (profileMenuLink) {
      await V().humanClick(profileMenuLink, { skipScroll: true })
      if (await M().waitFor(() => !isNonProfilePage(), 9000)) { await V().humanDelay(1100, 1800); return true }
    } else {
      V().dispatchEscape()
    }
    return false
  }

  function detectLoggedInAccountName(dialog = null) {
    if (dialog) {
      const dRect = dialog.getBoundingClientRect()
      for (const el of V().queryAllDeep(dialog, 'strong, span[dir="auto"], a[role="link"] span')) {
        if (!V().isReallyVisible(el)) continue
        const r = el.getBoundingClientRect()
        if (r.top - dRect.top > 180 || r.top - dRect.top < 35) continue
        const txt = V().normalizeText(el.innerText || el.textContent)
        if (txt.length >= 2 && txt.length <= 60 && !/tạo bài viết|create post|công khai|chỉ mình tôi|bạn bè|nhãn ai/i.test(txt)) return txt
      }
    }
    return Array.from(document.querySelectorAll('h1'))
      .map((el) => V().normalizeText(el.innerText || el.textContent))
      .find((t) => t.length >= 2 && t.length <= 60 && !/^facebook$/i.test(t)) || 'Tài khoản Facebook'
  }

  function isInsideFixedTopBanner(el) {
    return Boolean(!el || el.closest('[role="banner"], [role="navigation"], header'))
  }

  // Tìm chính xác thanh "Bạn đang nghĩ gì?" (bỏ qua bóng ghi chú "Chia sẻ suy nghĩ..." trên avatar!)
  function findComposerTrigger() {
    const scope = document.querySelector('[role="main"]') || document.body
    let best = null, bestScore = -Infinity

    for (const el of V().queryAllDeep(scope, 'span, div[role="button"], button')) {
      if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 16 })) continue
      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) continue

      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      if (!label || label.length > 90 || EXCLUDE_NOTE_RE.test(label) || !COMPOSER_TEXT_RE.test(label)) continue

      // Ưu tiên node lá hoặc nút trực tiếp
      const clickable = el.closest('[role="button"], button, [tabindex="0"]') || el
      if (isInsideFixedTopBanner(clickable)) continue
      const cRect = clickable.getBoundingClientRect()
      if (cRect.width < 120 || cRect.height < 24 || cRect.height > 105) continue

      const score = 60 +
        (clickable.getAttribute('role') === 'button' ? 30 : 0) +
        (cRect.width >= 240 ? 25 : 0) +
        (cRect.left > window.innerWidth * 0.25 ? 20 : 0) +
        (label.length < 36 ? 20 : 0)
      if (score > bestScore) { bestScore = score; best = clickable }
    }
    return best
  }

  function findProfilePhotoShortcut() {
    const scope = document.querySelector('[role="main"]') || document.body
    return V().queryAllDeep(scope, '[role="button"], button').find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 60, minHeight: 24 })) return false
      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) return false
      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      return label.length <= 35 && PHOTO_BTN_RE.test(label)
    }) || null
  }

  function findAudienceSubDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 280, minHeight: 200 }))
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const headText = V().normalizeText(dialogs[i].innerText || dialogs[i].textContent).slice(0, 320)
      if (/đối tượng của bài viết|ai có thể xem bài viết|post audience|who can see your post/i.test(headText)) {
        return dialogs[i]
      }
    }
    return null
  }

  function findComposerDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 320, minHeight: 220 }))
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const dialog = dialogs[i]
      const text = V().normalizeText(dialog.innerText || dialog.textContent).slice(0, 320)
      if (/đối tượng của bài viết|post audience/i.test(text) && !findComposerEditor(dialog)) continue
      if (/tạo bài viết|create post/i.test(text) || (findComposerEditor(dialog) && findSubmitOrNextButton(dialog))) {
        return dialog
      }
    }
    return null
  }

  function hasExistingMediaInDialog(dialog) {
    if (!dialog) return false
    const dRect = dialog.getBoundingClientRect()
    if (V().queryAllDeep(dialog, '[role="button"], button').some((b) =>
      V().isReallyVisible(b) && /^(chỉnh sửa|chỉnh sửa tất cả|edit|edit all|thêm ảnh\/video|add photos\/videos)$/i.test(V().normalizeText(b.innerText || b.textContent))
    )) return true
    return V().queryAllDeep(dialog, 'img').some((img) =>
      V().isReallyVisible(img, { minWidth: 85, minHeight: 85 }) && img.getBoundingClientRect().top > dRect.top + 100 && img.complete && img.naturalWidth > 80
    )
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

  function findAudienceButton(dialog) {
    const scope = dialog || document.body
    const dRect = dialog ? dialog.getBoundingClientRect() : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }

    // Ưu tiên 1: Nút có aria-label quyền riêng tư ngay phần đầu hộp thoại Tạo bài viết
    for (const btn of V().queryAllDeep(scope, '[role="button"], button, [tabindex="0"]')) {
      if (btn.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(btn, { minWidth: 28, minHeight: 16, checkAriaHidden: false })) continue
      const r = btn.getBoundingClientRect()
      if (dialog && (r.top < dRect.top + 30 || r.top > dRect.top + 280)) continue
      const aria = V().normalizeText(btn.getAttribute('aria-label'))
      const vis = V().normalizeText(btn.innerText || btn.textContent)
      if (/nhãn ai|ai label|^(đóng|close|đăng|post|chỉnh sửa ảnh)/i.test(`${vis} ${aria}`)) continue
      if (/chỉnh sửa quyền riêng tư|edit privacy|chia sẻ với|sharing with|đối tượng|audience/i.test(aria)) return btn
    }

    // Ưu tiên 2: Nhãn văn bản chính xác Công khai / Bạn bè / Chỉ mình tôi
    for (const el of V().queryAllDeep(scope, 'span, div, button')) {
      if (el.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(el, { minWidth: 18, minHeight: 10, checkAriaHidden: false })) continue
      const txt = V().normalizeText(el.innerText || el.textContent)
      if (!txt || txt.length > 42 || !AUDIENCE_EXACT_RE.test(txt) || /nhãn ai|ai label/i.test(txt)) continue
      const r = el.getBoundingClientRect()
      if (dialog && (r.top < dRect.top + 30 || r.top > dRect.top + 300)) continue
      return el.closest('[role="button"], button, [tabindex="0"]') || el
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

  function findScrollableBoxInside(container) {
    if (!container) return null
    let best = null, bestDiff = 0
    for (const el of [container, ...Array.from(container.querySelectorAll('div'))]) {
      const diff = (el.scrollHeight || 0) - (el.clientHeight || 0)
      if (diff > 20 && el.clientHeight > 100 && /(auto|scroll|overlay)/.test(window.getComputedStyle(el).overflowY || '') && diff > bestDiff) {
        bestDiff = diff
        best = el
      }
    }
    return best
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    const targetLabel = requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE
    const oppositePattern = requestedPrivacy === 'only_me' ? PUBLIC_RE : ONLY_ME_RE

    for (let attempt = 1; attempt <= 3; attempt++) {
      const curDialog = findComposerDialog() || dialog
      const audienceBtn = findAudienceButton(curDialog)
      if (!audienceBtn) { await V().sleep(550); continue }

      if (parsePrivacyFromText(`${audienceBtn.innerText || ''} ${audienceBtn.getAttribute('aria-label') || ''}`) === requestedPrivacy) {
        return requestedPrivacy
      }

      stepLog('privacy', `Đang chọn đối tượng "${targetLabel}" (lần ${attempt}/3)...`)
      await V().humanClick(audienceBtn, { skipScroll: true })
      await M().waitFor(() => Boolean(findAudienceSubDialog()), 6500)
      await V().humanDelay(450, 800)

      const subDialog = findAudienceSubDialog()
      if (!subDialog) continue

      // Nếu có nút "Xem thêm" thì bấm mở rộng danh sách đối tượng trước
      const seeMoreBtn = V().queryAllDeep(subDialog, '[role="button"], button, span').find((el) =>
        V().isReallyVisible(el, { minWidth: 30, minHeight: 16 }) && /^(xem thêm|see more)$/i.test(V().normalizeText(el.innerText || el.textContent))
      )
      if (seeMoreBtn) {
        await V().humanClick(seeMoreBtn.closest('[role="button"], button') || seeMoreBtn, { skipScroll: true })
        await V().humanDelay(450, 750)
      }

      const scroller = findScrollableBoxInside(subDialog)

      // Tìm đúng hàng radio riêng lẻ (KHÔNG chọn thẻ cha chứa cả Công khai lẫn Chỉ mình tôi!)
      const findOptionRow = () => {
        const candidates = []
        for (const el of V().queryAllDeep(subDialog, '[role="radio"], [role="listitem"], [role="menuitem"], [role="button"]')) {
          if (el === audienceBtn) continue
          const txt = V().normalizeText(el.innerText || el.textContent)
          if (!txt || txt.length > 140 || !targetPattern.test(txt)) continue
          if (oppositePattern.test(txt)) continue // loại bỏ container chứa nhiều option!
          candidates.push(el)
        }
        if (candidates.length > 0) {
          // Ưu tiên [role="radio"] hoặc phần tử cụ thể nhất (text ngắn nhất)
          candidates.sort((a, b) => {
            const rDiff = (b.getAttribute('role') === 'radio' ? 1 : 0) - (a.getAttribute('role') === 'radio' ? 1 : 0)
            if (rDiff !== 0) return rDiff
            return V().normalizeText(a.innerText).length - V().normalizeText(b.innerText).length
          })
          return candidates[0]
        }
        for (const sp of subDialog.querySelectorAll('span')) {
          const txt = V().normalizeText(sp.innerText || sp.textContent)
          if (requestedPrivacy === 'only_me' ? /^(chỉ mình tôi|only me)$/i.test(txt) : /^(công khai|public)$/i.test(txt)) {
            return sp.closest('[role="radio"], [role="button"], [tabindex="0"]') || sp
          }
        }
        return null
      }

      if (scroller) scroller.scrollTop = 0
      let optionEl = findOptionRow()

      for (let step = 0; step < 8 && (!optionEl || !V().isReallyVisible(optionEl, { minWidth: 30, minHeight: 16 })); step++) {
        if (!scroller) break
        scroller.scrollTop += 220
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
        await V().sleep(260)
        optionEl = findOptionRow()
      }

      if (optionEl) {
        if (scroller) {
          const sRect = scroller.getBoundingClientRect()
          const oRect = optionEl.getBoundingClientRect()
          if (oRect.bottom > sRect.bottom - 10 || oRect.top < sRect.top + 10) {
            scroller.scrollTop += (oRect.top - sRect.top) - 80
            await V().sleep(200)
          }
        }
        await V().humanClick(optionEl, { skipScroll: true })
        await V().humanDelay(450, 800)

        const innerRadio = optionEl.querySelector?.('[role="radio"], input[type="radio"]') || optionEl
        if (innerRadio?.getAttribute?.('aria-checked') === 'false' || innerRadio?.checked === false) {
          await V().humanClick(innerRadio, { skipScroll: true })
          await V().humanDelay(400, 700)
        }

        // Bấm nút Xong / Lưu (ưu tiên nút có màu xanh ở cuối hộp thoại)
        const confirmBtn = V().queryAllDeep(subDialog, '[role="button"], button').find((btn) =>
          V().isReallyVisible(btn, { minWidth: 48, minHeight: 28 }) && !V().isElementDisabled(btn) &&
          /^(xong|done|lưu|save|cập nhật|update)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
        )
        if (confirmBtn) {
          await V().humanClick(confirmBtn, { skipScroll: true })
          await V().humanDelay(650, 1100)
        }
      } else {
        V().dispatchEscape()
        await V().humanDelay(450, 750)
      }

      const confirmed = await M().waitFor(() => {
        if (findAudienceSubDialog()) return false
        const btn = findAudienceButton(findComposerDialog() || dialog)
        return Boolean(btn && parsePrivacyFromText(`${btn.innerText || ''} ${btn.getAttribute('aria-label') || ''}`) === requestedPrivacy)
      }, 6500)

      if (confirmed) return requestedPrivacy
    }

    const finalBtn = findAudienceButton(findComposerDialog() || dialog)
    return finalBtn ? parsePrivacyFromText(`${finalBtn.innerText || ''} ${finalBtn.getAttribute('aria-label') || ''}`) : null
  }

  function inspectFacebookScreen() {
    const dlg = findComposerDialog()
    const audBtn = dlg ? findAudienceButton(dlg) : null
    return {
      url: location.href,
      health: V().inspectPageHealth(),
      loggedIn: !isLoginOrCheckpointScreen(),
      isNonProfilePage: isNonProfilePage(),
      scrollY: Math.round(window.scrollY),
      accountName: detectLoggedInAccountName(dlg),
      hasComposerTrigger: Boolean(findComposerTrigger()),
      hasOpenComposerDialog: Boolean(dlg),
      audienceButtonText: audBtn ? V().normalizeText(audBtn.innerText || audBtn.getAttribute('aria-label')) : null
    }
  }

  async function executeFacebookPost(payload, checkpoint = {}) {
    const trace = []
    const stepLog = (step, msg, level = 'info', extra = {}) => {
      trace.push({ step, msg, level, ts: Date.now() })
      V().reportStep('facebook', step, msg, level, extra)
    }

    if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return { ok: false, error: 'FACEBOOK_HOST_INVALID', visionTrace: trace }
    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 25000, onStatus: stepLog })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, visionTrace: trace }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', visionTrace: trace }

    const requestedPrivacy = String(payload.privacy || 'only_me').toLowerCase()
    const rawTitle = V().formatPostText(payload.title || '', 260)
    const rawContent = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''
    const bodyWithoutDupTitle = rawTitle && V().normalizeText(rawContent).startsWith(V().normalizeText(rawTitle))
      ? rawContent : [rawTitle, rawContent].filter(Boolean).join('\n\n')
    const fullText = V().composeBodyAndHashtags(bodyWithoutDupTitle, rawHashtags, 6000)

    // Đảm bảo đang ở Trang cá nhân
    if (isNonProfilePage()) {
      const moved = await navigateToProfileViaTopRightAvatar(stepLog)
      if (!moved && isNonProfilePage()) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    }

    // CHECKPOINT: Nếu trước đó ĐÃ BẤM ĐĂNG rồi mới tải lại/văng trang -> chỉ kiểm chứng, KHÔNG đăng trùng!
    if (checkpoint.verifyOnly) {
      stepLog('verify', 'Phục hồi từ Checkpoint sau bước Đăng — đang xác nhận bài mới...')
      const prevSet = new Set(checkpoint.existingPermalinks || [])
      const authorName = detectLoggedInAccountName(null)
      const verified = await waitForFacebookPublishConfirmation(fullText, prevSet, requestedPrivacy, authorName, stepLog)
      V().clearHud(4000)
      return { ...verified, visionTrace: trace }
    }

    if (window.scrollY > 80) await V().smoothScrollToTop()
    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    await V().humanDelay(450, 900)
    const existingPermalinksList = collectPostPermalinks()
    const existingPermalinks = new Set(existingPermalinksList)
    stepLog('navigated', 'Đã ở Trang cá nhân, chuẩn bị mở khung tạo bài...', 'info', { checkpointStep: 'navigated', existingPermalinks: existingPermalinksList.slice(0, 25) })

    // Bước 1: CHỈ bấm khung "Bạn đang nghĩ gì?" để mở trực tiếp hộp thoại "Tạo bài viết" (KHÔNG bấm Ảnh/video ngoài trang cá nhân!)
    let dialog = findComposerDialog()
    if (!dialog) {
      const learnedTriggerRule = await V().getLearnedRule('facebook:composer_trigger')
      for (let openTry = 1; openTry <= 3 && !dialog; openTry++) {
        let trigger = (openTry === 1 && learnedTriggerRule) ? V().findByLearnedRule(learnedTriggerRule) : null
        let usedLearned = Boolean(trigger)
        if (!trigger) trigger = findComposerTrigger()

        if (!trigger && openTry === 2) {
          window.scrollTo({ top: 480, behavior: 'auto' })
          await V().sleep(400)
          trigger = findComposerTrigger()
        }

        if (trigger) {
          stepLog('open_composer', `Đang bấm vào khung "Bạn đang nghĩ gì?" (lần ${openTry}/3)...`)
          await V().humanClick(trigger)
          const opened = await M().waitFor(() => Boolean(findComposerDialog()), 7000)
          if (opened) {
            dialog = findComposerDialog()
            break
          }
          if (usedLearned) await V().invalidateLearnedRule('facebook:composer_trigger')
        }

        // Lần 3 vẫn không mở được -> Gọi AI Local qwen3.5:4b nhìn màn hình phán đoán & tự học!
        if (openTry === 3 && !dialog) {
          const aiRes = await V().askSelfHealingAI({
            platform: 'facebook',
            stepKey: 'facebook:composer_trigger',
            goal: 'Tìm và bấm vào ô "Bạn đang nghĩ gì?" để mở hộp thoại "Tạo bài viết" trên Facebook (tuyệt đối KHÔNG bấm nút Ảnh/video).',
            errorReason: 'Không tìm thấy hoặc không mở được hộp thoại Tạo bài viết khi bấm "Bạn đang nghĩ gì?"'
          })
          if (aiRes.ok && aiRes.action === 'navigate_target') {
            return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
          }
          if (aiRes.ok && aiRes.action === 'dismiss_popup') {
            if (aiRes.element) await V().humanClick(aiRes.element, { skipScroll: true })
            else V().dispatchEscape()
            await V().sleep(600)
            const retryTrig = findComposerTrigger()
            if (retryTrig) {
              await V().humanClick(retryTrig)
              if (await M().waitFor(() => Boolean(findComposerDialog()), 7000)) dialog = findComposerDialog()
            }
          } else if (aiRes.ok && aiRes.element) {
            await V().humanClick(aiRes.element, { skipScroll: aiRes.clickMode === 'skip_scroll' })
            if (await M().waitFor(() => Boolean(findComposerDialog()), 8000)) {
              dialog = findComposerDialog()
              // Thành công thật -> Ghi nhớ kiến thức vĩnh viễn cho lần sau!
              await V().saveLearnedRule('facebook:composer_trigger', aiRes.element, aiRes.learnedRule || {})
            }
          }
        }
      }
    }

    if (!dialog) {
      if (isNonProfilePage()) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
      return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_OPENED', visionTrace: trace }
    }

    const authorName = detectLoggedInAccountName(dialog)
    stepLog('open_composer', 'Đã mở hộp thoại "Tạo bài viết".', 'info', { checkpointStep: 'composer_opened' })
    await V().humanReadPause()

    // Bước 2: Đổi quyền riêng tư (nếu DOM đổi -> tự nhờ AI Local học & lưu lại!)
    let actualPrivacy = await applyAudiencePrivacy(findComposerDialog() || dialog, requestedPrivacy, stepLog)
    if (actualPrivacy !== requestedPrivacy) {
      const targetName = requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
      const aiPriv = await V().askSelfHealingAI({
        platform: 'facebook',
        stepKey: `facebook:privacy_${requestedPrivacy}`,
        goal: `Mở nút chọn đối tượng bài viết (hiện đang là Công khai hoặc Bạn bè dưới tên người dùng) và chọn "${targetName}" rồi xác nhận Xong/Lưu.`,
        root: findComposerDialog() || document,
        errorReason: `Chưa xác nhận được quyền riêng tư "${targetName}"`
      })
      if (aiPriv.ok && aiPriv.element) {
        await V().humanClick(aiPriv.element, { skipScroll: true })
        await V().sleep(700)
        actualPrivacy = await applyAudiencePrivacy(findComposerDialog() || dialog, requestedPrivacy, stepLog)
        if (actualPrivacy === requestedPrivacy) {
          await V().saveLearnedRule(`facebook:privacy_${requestedPrivacy}`, aiPriv.element, aiPriv.learnedRule || {})
        }
      }
    }
    if (actualPrivacy !== requestedPrivacy) {
      return { ok: false, error: requestedPrivacy === 'only_me' ? 'FACEBOOK_ONLY_ME_NOT_CONFIRMED' : 'FACEBOOK_PUBLIC_NOT_CONFIRMED', actualPrivacy, visionTrace: trace }
    }
    stepLog('privacy', `Đã xác nhận đối tượng: ${actualPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}.`, 'info', { checkpointStep: 'privacy_set' })
    await V().humanDelay(400, 750)

    // Bước 3: Nạp ảnh NGAY TRONG HỘP THOẠI "Tạo bài viết" (Ưu tiên Input ẩn -> Paste/Drop ảnh trực tiếp -> KHÔNG mở OS File Picker!)
    dialog = findComposerDialog() || dialog
    if (!hasExistingMediaInDialog(dialog)) {
      stepLog('upload_image', 'Đang nạp ảnh vào khung "Tạo bài viết"...')
      const imageSnapshot = V().captureVisualImageSnapshot(dialog)
      const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-fb-product.png')
      let previewOk = false

      // Cách 1: Gắn thẳng vào input[type="file"] đã có sẵn trong hộp thoại (không cần bấm nút nào!)
      const existingInput = await M().findImageInput(dialog, 1200, false)
      if (existingInput && M().attachFile(existingInput, imageFile)) {
        previewOk = await M().waitFor(() => {
          const d = findComposerDialog() || dialog
          return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
        }, 12000, 300)
      }

      // Cách 2: Dán (Paste) & Kéo thả (Drop) thẳng File ảnh vào khung "Tạo bài viết" (không cần bấm nút Ảnh/video!)
      if (!previewOk) {
        const dropTarget = findComposerEditor(dialog) || dialog
        try {
          const dt = new DataTransfer()
          dt.items.add(imageFile)
          dropTarget.focus?.({ preventScroll: true })
          dropTarget.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true, clipboardData: dt }))
        } catch (_) {}
        M().attachViaDrop(dropTarget, imageFile)
        previewOk = await M().waitFor(() => {
          const d = findComposerDialog() || dialog
          return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
        }, 12000, 300)
      }

      // Cách 3 (dự phòng cuối): Tìm input trong toàn trang sau khi bấm icon ảnh bên trong thanh "Thêm vào bài viết của bạn"
      if (!previewOk) {
        const photoIcon = findPhotoToolbarButtonInDialog(dialog)
        if (photoIcon) { await V().humanClick(photoIcon, { skipScroll: true }); await V().sleep(600) }
        const lateInput = await M().findImageInput(dialog, 4000, false) || await M().findImageInput(document, 2000, false)
        if (lateInput && M().attachFile(lateInput, imageFile)) {
          previewOk = await M().waitFor(() => {
            const d = findComposerDialog() || dialog
            return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
          }, 16000, 350)
        }
      }

      if (!previewOk) return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
      stepLog('upload_image', 'Đã nạp ảnh vào bài viết.', 'info', { checkpointStep: 'image_uploaded' })
      await V().humanDelay(1000, 1700)
    }
    
    // Bước 4: Điền chữ & hashtag (bỏ qua nếu nội dung đã khớp)
    dialog = findComposerDialog()
    if (!dialog) {
      if (isNonProfilePage()) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
      return { ok: false, error: 'FACEBOOK_COMPOSER_CLOSED_UNEXPECTEDLY', visionTrace: trace }
    }
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }

    if (!V().isTextMatched(V().readEditorValue(editorBox), fullText, COMPOSER_TEXT_RE)) {
      stepLog('fill_text', 'Đang điền nội dung & hashtag...')
      let typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
      if (!typeResult.ok) {
        await V().humanDelay(700, 1100)
        typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
      }
      if (!typeResult.ok) return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
    }
    stepLog('fill_text', 'Đã điền xong nội dung.', 'info', { checkpointStep: 'text_filled' })
    await V().humanReviewPause()

    // Bước 5: Bấm Đăng
    dialog = findComposerDialog()
    if (!dialog) return { ok: false, error: 'FACEBOOK_COMPOSER_CLOSED_BEFORE_SUBMIT', visionTrace: trace }
    let submitInfo = null
    await M().waitFor(() => {
      const found = findSubmitOrNextButton(findComposerDialog() || dialog)
      if (found && !V().isElementDisabled(found.element)) { submitInfo = found; return true }
      return false
    }, 10000)
    if (!submitInfo) return { ok: false, error: 'FACEBOOK_SUBMIT_BUTTON_NOT_READY', visionTrace: trace }

    stepLog('submit', 'Đang bấm Đăng bài...', 'info', { checkpointStep: 'submitted' })
    await V().humanClick(submitInfo.element, { skipScroll: true })
    if (submitInfo.kind === 'next') {
      await V().humanDelay(750, 1250)
      let finalPostBtn = null
      await M().waitFor(() => {
        const d = findComposerDialog()
        if (!d) return true
        const found = findSubmitOrNextButton(d)
        if (found?.kind === 'post' && !V().isElementDisabled(found.element)) { finalPostBtn = found.element; return true }
        return false
      }, 9000)
      if (finalPostBtn) await V().humanClick(finalPostBtn, { skipScroll: true })
    }

    stepLog('verify', 'Đang xác nhận bài viết mới...')
    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog)
    V().clearHud(4500)
    return { ...result, visionTrace: trace }
  }

  async function waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog) {
    const deadline = Date.now() + 45000
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) =>
        V().isReallyVisible(btn) && /^(không phải bây giờ|not now|đăng ngay|post now)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
      )
      if (secondaryBtn && !findComposerDialog()) { await V().humanClick(secondaryBtn, { skipScroll: true }); await V().humanDelay(550, 900) }

      const alertText = V().queryAllDeep(document, '[role="alert"], [role="dialog"] [role="status"]')
        .filter((el) => V().isReallyVisible(el)).map((el) => V().normalizeText(el.innerText || el.textContent)).join(' ')
      if (/không thể đăng|couldn't post|đã xảy ra lỗi|something went wrong|vi phạm tiêu chuẩn|try again/i.test(alertText)) {
        return { ok: false, error: `FACEBOOK_POST_ERROR: ${alertText.slice(0, 120)}` }
      }

      const newPost = await findNewlyPublishedArticleWithHover(textProbe, existingPermalinks)
      if (newPost?.url) {
        stepLog('verify', 'Đã đăng bài Facebook thành công!', 'success')
        return {
          ok: true, verified: true, postUrl: newPost.url, realPostId: newPost.id || `fb-${Date.now()}`,
          platform: 'facebook', publishedTime: new Date().toISOString(), privacy: actualPrivacy, author: authorName
        }
      }

      if (!findComposerDialog()) {
        if (!dialogClosedAt) dialogClosedAt = Date.now()
        else if (Date.now() - dialogClosedAt >= 7500) {
          const fallbackPost = await findNewlyPublishedArticleWithHover('', existingPermalinks)
          const postUrl = fallbackPost?.url || `${location.origin}${location.pathname}?story_fbid=${Date.now()}`
          return {
            ok: true, verified: Boolean(fallbackPost?.url), postUrl, realPostId: fallbackPost?.id || `fb-${Date.now()}`,
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
    const readLinks = () => Array.from(articleEl.querySelectorAll('a[href]')).map((a) => cleanFacebookUrl(a.href)).filter(isFacebookPostPermalink)
    let links = readLinks()
    if (links.length > 0) return links[0]

    const timeLinks = Array.from(articleEl.querySelectorAll('a[role="link"], a[tabindex="0"], a[href="#"], a[href*="?__cft__"]'))
      .filter((a) => {
        const txt = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))
        return txt.length > 0 && txt.length <= 45 &&
          /vừa xong|hôm qua|phút|giờ|ngày|tháng|yesterday|just now|min|hr|hrs|\d{1,2}:\d{2}|\b\d+[hdwm]\b/i.test(txt)
      }).slice(0, 4)

    for (const a of timeLinks) {
      try {
        a.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))
        a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
        a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        a.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      } catch (_) {}
    }
    if (timeLinks.length > 0) await V().sleep(280)
    return readLinks()[0] || null
  }

  async function findNewlyPublishedArticleWithHover(textProbe, existingPermalinks) {
    for (const article of V().queryAllDeep(document, '[role="article"], article, div[data-pagelet^="FeedUnit"]').slice(0, 6)) {
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
      const reelMatch = u.pathname.match(/\/reel\/(\d+)/i)
      if (reelMatch) return `https://www.facebook.com/reel/${reelMatch[1]}`
      const next = new URL(`${u.origin}${u.pathname}`)
      for (const key of ['story_fbid', 'fbid', 'id', 'v', 'set', 'multi_permalinks']) {
        if (u.searchParams.has(key)) next.searchParams.set(key, u.searchParams.get(key))
      }
      return next.href.replace(/\/+$/, '')
    } catch (_) { return raw }
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
        /\/posts\//.test(p) || /\/permalink\//.test(p) || /\/permalink\.php/.test(p) ||
        /\/share\/[prmv]\//.test(p) || /\/reel\/\d+/.test(p) || /\/videos\/\d+/.test(p) ||
        (/\/watch\/?/.test(p) && url.searchParams.has('v')) ||
        (/\/photo/.test(p) && url.searchParams.has('fbid')) ||
        url.searchParams.has('story_fbid') || url.searchParams.has('fbid') || url.searchParams.has('multi_permalinks')
      )
    } catch (_) { return false }
  }

  function extractFacebookPostId(postUrl) {
    if (!postUrl) return null
    try {
      const url = new URL(postUrl)
      const qId = url.searchParams.get('story_fbid') || url.searchParams.get('fbid') || url.searchParams.get('v') || url.searchParams.get('multi_permalinks')
      if (qId) return qId
      return url.pathname.match(/\/(?:posts|permalink|share\/[prmv]|reel|videos)\/([^/?]+)/i)?.[1] || null
    } catch (_) { return null }
  }

  // =========================================================================
  // CÀO BÀI VIRAL FACEBOOK: TÁCH RÕ TRANG CHỦ (FEED) VÀ THƯỚC PHIM (REELS)
  // =========================================================================

  // Đọc chuẩn thanh dưới bài viết Facebook 2026: [👍 13,5K] [💬 57] [↗ 198]
  async function extractFeedPostMetrics2026(article) {
    let likes = 0, comments = 0, shares = 0

    // 1. Đọc từ aria-label chuẩn (Thích: 13,5K / 13.500 người...)
    for (const el of article.querySelectorAll('[aria-label^="Thích:"], [aria-label^="Like:"], [aria-label*="cảm xúc"], [aria-label*="reaction"]')) {
      const aria = V().normalizeText(el.getAttribute('aria-label') || '')
      if (/lượt xem|views?/i.test(aria)) continue
      likes = Math.max(likes, V().parseHumanCount(aria), V().parseHumanCount(el.innerText || el.textContent))
    }

    // 2. Đọc trực tiếp thanh hành động dưới bài (Ảnh 1 & 2: 3 số đứng ngang hàng ở nửa dưới article!)
    const aRect = article.getBoundingClientRect()
    const bottomNumbers = []
    for (const el of article.querySelectorAll('[role="button"], button, span')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.top < aRect.top + aRect.height * 0.55) continue
      const aria = V().normalizeText(el.getAttribute('aria-label') || '')
      const txt = V().normalizeText(el.innerText || el.textContent || '')

      if (/^(thích|like|bỏ thích|unlike|bày tỏ cảm xúc|react)$/i.test(aria) || /tất cả cảm xúc|người đã thích|thích:|like:|reactions?/i.test(aria)) {
        const near = V().normalizeText(`${aria} ${txt} ${el.nextElementSibling?.innerText || ''} ${el.parentElement?.innerText?.slice(0, 28) || ''}`)
        if (!/lượt xem|views?/i.test(near)) likes = Math.max(likes, V().parseHumanCount(near))
        continue
      }
      if (/bình luận|viết bình luận|leave a comment|comment/i.test(aria)) {
        const near = V().normalizeText(`${txt} ${el.nextElementSibling?.innerText || ''} ${aria}`)
        comments = Math.max(comments, V().parseHumanCount(near))
        continue
      }
      if (/chia sẻ|share|gửi/i.test(aria)) {
        const near = V().normalizeText(`${txt} ${el.nextElementSibling?.innerText || ''} ${aria}`)
        shares = Math.max(shares, V().parseHumanCount(near))
        continue
      }
      if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|m|tr|triệu)?$/i.test(txt) && !el.children.length) {
        const val = V().parseHumanCount(txt)
        if (val > 0 && r.left < aRect.left + aRect.width * 0.72) {
          bottomNumbers.push({ val, x: r.left })
        }
      }
    }

    // Nếu nút không gắn aria-label số -> 3 số trái-sang-phải ở thanh dưới chính là [Like, Comment, Share]!
    if (bottomNumbers.length > 0) {
      bottomNumbers.sort((a, b) => a.x - b.x)
      const uniqueByX = []
      for (const n of bottomNumbers) {
        if (!uniqueByX.length || Math.abs(n.x - uniqueByX[uniqueByX.length - 1].x) > 18) uniqueByX.push(n)
      }
      if (likes === 0 && uniqueByX[0]) likes = uniqueByX[0].val
      if (comments === 0 && uniqueByX[1]) comments = uniqueByX[1].val
      if (shares === 0 && uniqueByX[2]) shares = uniqueByX[2].val
    }

    return { likes, comments, shares }
  }

  function extractArticleMediaAndAuthor(article) {
    const authorLink = article.querySelector('h2 a[href], h3 a[href], h4 a[href], strong a[href]')
    const authorName = V().normalizeText(authorLink?.innerText || '')
    const authorUrl = authorLink?.href ? cleanFacebookUrl(authorLink.href) : ''
    let thumbnailUrl = ''
    const videoEl = article.querySelector('video[poster]')
    if (videoEl?.getAttribute('poster')) thumbnailUrl = videoEl.getAttribute('poster')
    if (!thumbnailUrl) {
      const imgs = Array.from(article.querySelectorAll('img[src]'))
        .filter((img) => img.naturalWidth >= 100 && img.naturalHeight >= 100 && !/emoji|static\.xx/i.test(img.src))
        .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))
      thumbnailUrl = imgs[0]?.src || article.querySelector('svg image')?.getAttribute('xlink:href') || ''
    }
    return { authorName, authorUrl, thumbnailUrl }
  }

  function extractActiveReelPost2026() {
    if (!/\/reel\/\d+/i.test(location.pathname)) return null
    const postUrl = cleanFacebookUrl(location.href)
    let likes = 0, comments = 0, shares = 0

    // Chỉ lấy nút nằm đúng trong khung hình hiện tại (loại bỏ Reel liền kề bị cache ở ngoài màn hình!)
    const buttons = Array.from(document.querySelectorAll('[role="button"], button')).filter((b) => {
      if (!V().isReallyVisible(b, { minWidth: 20, minHeight: 20 })) return false
      const r = b.getBoundingClientRect()
      return r.top > 90 && r.bottom < window.innerHeight - 10 && r.left > window.innerWidth * 0.45 && r.right <= window.innerWidth
    })

    for (const btn of buttons) {
      const aria = V().normalizeText(btn.getAttribute('aria-label') || '')
      const nearText = V().normalizeText(`${btn.innerText || ''} ${btn.nextElementSibling?.innerText || ''} ${btn.parentElement?.innerText || ''}`)
      if (/^(thích|like|bỏ thích|unlike)$/i.test(aria) || /thích|like/i.test(aria)) {
        if (nearText.length <= 32) likes = Math.max(likes, V().parseHumanCount(nearText))
      } else if (/bình luận|comment/i.test(aria)) {
        if (nearText.length <= 32) comments = Math.max(comments, V().parseHumanCount(nearText))
      } else if (/chia sẻ|share/i.test(aria)) {
        if (nearText.length <= 32) shares = Math.max(shares, V().parseHumanCount(nearText))
      }
    }

    const bottomTexts = Array.from(document.querySelectorAll('span, a, div[dir="auto"]'))
      .filter((el) => {
        if (!V().isReallyVisible(el)) return false
        const r = el.getBoundingClientRect()
        return r.top > window.innerHeight * 0.65 && r.bottom <= window.innerHeight && r.left > 160 && r.right < window.innerWidth * 0.84
      })
      .map((el) => V().normalizeText(el.innerText || el.textContent))
      .filter((t) => t.length >= 6 && t.length <= 260 && !/^(theo dõi|đang theo dõi|follow|following|âm thanh gốc|xem thêm|see more)$/i.test(t))

    const bestCaption = bottomTexts.sort((a, b) => b.length - a.length)[0] || ''
    if (likes === 0) {
      const rightNumbers = Array.from(document.querySelectorAll('span, div'))
        .filter((el) => {
          if (!V().isReallyVisible(el)) return false
          const r = el.getBoundingClientRect()
          return r.left > window.innerWidth * 0.88 && /^\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?$/i.test(V().normalizeText(el.innerText || ''))
        })
        .map((el) => ({ val: V().parseHumanCount(el.innerText), top: el.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top)
      if (rightNumbers[0]) likes = rightNumbers[0].val
      if (rightNumbers[1]) comments = rightNumbers[1].val
      if (rightNumbers[2]) shares = rightNumbers[2].val
    }
    const videoPoster = document.querySelector('video[poster]')?.getAttribute('poster') || document.querySelector('div[role="main"] img')?.src || ''
    return { postUrl, likes, comments, shares, caption: bestCaption || `Thước phim Facebook #${extractFacebookPostId(postUrl) || Date.now()}`, thumbnailUrl: videoPoster }
  }

  async function advanceToNextFacebookReel(prevUrl) {
    const nextBtn = Array.from(document.querySelectorAll('[role="button"], button')).find((b) =>
      V().isReallyVisible(b, { minWidth: 28, minHeight: 28 }) && b.getBoundingClientRect().left >= window.innerWidth * 0.82 &&
      /tiếp theo|next|sau|xuống|down|thẻ tiếp theo/i.test(V().normalizeText(b.getAttribute('aria-label') || ''))
    )
    if (nextBtn) await V().humanClick(nextBtn, { skipScroll: true })
    else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }))
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true }))
    }
    // Đợi URL thực sự chuyển sang thước phim kế tiếp để KHÔNG BAO GIỜ cào trùng!
    await M().waitFor(() => cleanFacebookUrl(location.href) !== prevUrl, 5000, 250)
    await V().humanDelay(900, 1500)
  }

  async function scrapeFacebookViralPosts(options = {}) {
    const targetCount = Number(options.targetCount) || 10
    const minLikes = Number(options.minLikes) || 5000
    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 20
    const idleTimeoutMs = Number(options.idleTimeoutMs) || 4 * 60 * 1000
    let lastFoundAt = Number(options.lastFoundAt) || Date.now()
    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0
    const topicLabel = options.topicLabel || ''
    const sourceKind = options.sourceKind || (/\/(reel|watch|search\/videos)/i.test(location.pathname) ? 'reels' : 'feed')
    const sourceTag = sourceKind === 'reels' ? 'Thước phim (Reels)' : 'Trang chủ'

    const seenUrls = new Set((options.excludeUrls || []).map((u) => cleanFacebookUrl(u).toLowerCase()))
    const seenFingerprints = new Set()

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, posts: [], lastFoundAt }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', posts: [], lastFoundAt }

    const collected = []

    // Chế độ Reels trực tiếp (/reel/...)
    if (/\/reel\b/i.test(location.pathname)) {
      let stuckCount = 0
      for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {
        if (Date.now() - lastFoundAt >= idleTimeoutMs) return { ok: true, posts: collected, timedOut: true, lastFoundAt }
        const curUrl = cleanFacebookUrl(location.href)
        const reel = extractActiveReelPost2026()
        if (reel && reel.likes >= minLikes) {
          const urlKey = reel.postUrl.toLowerCase()
          const fp = `${V().stripToMatchKey(reel.caption).slice(0, 42)}|${reel.likes}`
          if (!seenUrls.has(urlKey) && !seenFingerprints.has(fp)) {
            seenUrls.add(urlKey)
            seenFingerprints.add(fp)
            lastFoundAt = Date.now()
            collected.push({
              id: `fb-reel-${Date.now()}-${collected.length}`,
              title: V().truncateClean(reel.caption, 105),
              platform: 'facebook',
              category: topicLabel || 'Thước phim (Reels)',
              postUrl: reel.postUrl,
              summary: V().truncateClean(`${reel.caption} • ${reel.likes.toLocaleString('vi-VN')} cảm xúc`, 250),
              viralityScore: Math.min(99, 86 + Math.min(13, Math.floor(Math.log10(reel.likes) * 3))),
              likesCount: reel.likes, sharesCount: reel.shares, commentsCount: reel.comments,
              trendingTopic: `Thước phim (Reels) • ${(reel.likes / 1000).toFixed(1)}K+ cảm xúc`,
              thumbnailUrl: reel.thumbnailUrl || '',
              createdAt: new Date().toISOString()
            })
            V().reportStep('facebook', 'scrape_viral', `FB Thước phim: ${totalAlreadyFound + collected.length} bài (${reel.likes.toLocaleString('vi-VN')})`)
          }
        }
        if (collected.length >= targetCount) break
        await advanceToNextFacebookReel(curUrl)
        if (cleanFacebookUrl(location.href) === curUrl) {
          stuckCount++
          if (stuckCount >= 2) break
        } else {
          stuckCount = 0
        }
      }
      V().clearHud(2500)
      return { ok: true, posts: collected, timedOut: false, lastFoundAt }
    }

    // Chế độ Trang chủ / Tìm kiếm Bài viết / Tìm kiếm Video-Reels
    let stagnantScrolls = 0, lastScrollHeight = 0
    for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {
      if (Date.now() - lastFoundAt >= idleTimeoutMs) return { ok: true, posts: collected, timedOut: true, lastFoundAt }
      if (V().inspectPageHealth().isOffline) await V().waitForPageStable('facebook', { maxWaitMs: 25000 })

      for (const article of document.querySelectorAll('div[role="article"], article, div[data-pagelet^="FeedUnit"]')) {
        if (collected.length >= targetCount || Date.now() - lastFoundAt >= idleTimeoutMs) break
        try {
          const metrics = await extractFeedPostMetrics2026(article)
          if (metrics.likes < minLikes) continue
          const postUrl = await hoverAndExtractPostPermalink(article)
          if (!postUrl || !isFacebookPostPermalink(postUrl)) continue
          const urlKey = cleanFacebookUrl(postUrl).toLowerCase()
          if (seenUrls.has(urlKey)) continue

          const msgEl = article.querySelector('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]') ||
            Array.from(article.querySelectorAll('div[dir="auto"]')).find((d) => V().normalizeText(d.innerText).length >= 12)
          const rawText = V().normalizeText(msgEl?.innerText || msgEl?.textContent || '')
          const author = V().normalizeText(article.querySelector('h2 a, h3 a, h4 a, strong a')?.innerText || '')
          const isVideoOrReel = Boolean(article.querySelector('video')) || /\/(reel|videos|watch)\//i.test(postUrl)
          const actualKindTag = isVideoOrReel ? 'Thước phim (Reels)' : 'Trang chủ'
          const mediaAndAuthor = extractArticleMediaAndAuthor(article)
          const actualAuthorName = mediaAndAuthor.authorName || author
          const actualAuthorUrl = mediaAndAuthor.authorUrl
          const actualThumbnailUrl = mediaAndAuthor.thumbnailUrl

          const summaryText = rawText || `[${actualKindTag}] ${author || 'Bài Viral Facebook'} đạt ${metrics.likes.toLocaleString('vi-VN')} cảm xúc.`
          const fp = `${V().stripToMatchKey(summaryText).slice(0, 44)}|${metrics.likes}`
          if (seenFingerprints.has(fp)) continue

          seenUrls.add(urlKey)
          seenFingerprints.add(fp)
          lastFoundAt = Date.now()
          collected.push({
            id: `fb-${sourceKind}-${Date.now()}-${collected.length}`,
            title: V().truncateClean(rawText || `[${actualKindTag}] ${actualAuthorName || 'Bài Viral Facebook'}`, 105),
            platform: 'facebook',
            category: topicLabel || actualKindTag,
            postUrl,
            summary: V().truncateClean(`${actualAuthorName ? `[${actualAuthorName}] ` : ''}${summaryText}`, 250),
            viralityScore: Math.min(99, 85 + Math.min(14, Math.floor(Math.log10(metrics.likes) * 3))),
            likesCount: metrics.likes, sharesCount: metrics.shares, commentsCount: metrics.comments,
            trendingTopic: `${actualKindTag} • ${(metrics.likes / 1000).toFixed(1)}K+ cảm xúc`,
            thumbnailUrl: actualThumbnailUrl || '',
            authorName: actualAuthorName || '',
            authorUrl: actualAuthorUrl || '',
            createdAt: new Date().toISOString()
          })
          V().reportStep('facebook', 'scrape_viral', `FB ${sourceTag}: ${totalAlreadyFound + collected.length} bài (${metrics.likes.toLocaleString('vi-VN')})`)
        } catch (_) {}
      }

      if (collected.length >= targetCount) break
      const curH = document.documentElement.scrollHeight
      if (curH === lastScrollHeight) stagnantScrolls++
      else { stagnantScrolls = 0; lastScrollHeight = curH }
      if (stagnantScrolls >= 4) break

      await V().scrollPageDownForFeed(1150 + Math.round(Math.random() * 450))
      await V().humanDelay(1300, 2100)
    }

    V().clearHud(2500)
    return { ok: true, posts: collected, timedOut: false, lastFoundAt }
  }

  function normalizeFacebookGroupUrl(rawHref) {
    try {
      const u = new URL(rawHref, location.origin)
      if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return null
      const match = u.pathname.match(/^\/groups\/([^/?#]+)/i)
      if (!match || /^(feed|discover|joins|create|notifications|search|category)$/i.test(match[1])) return null
      return `https://www.facebook.com/groups/${match[1]}/`
    } catch (_) { return null }
  }

  async function scrapeFacebookGroups(options = {}) {
    const targetCount = Number(options.targetCount) || 5
    const seenUrls = new Set((options.excludeUrls || []).map((u) => String(u).trim().replace(/\/+$/, '').toLowerCase()))
    const seenNames = new Set((options.excludeNames || []).map((n) => V().stripToMatchKey(n)))

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, groups: [] }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', groups: [] }

    const groups = []
    const mainRoot = document.querySelector('[role="main"]') || document.body

    for (let round = 0; round < 12 && groups.length < targetCount; round++) {
      for (const a of mainRoot.querySelectorAll('a[href*="/groups/"]')) {
        if (groups.length >= targetCount) break
        if (a.closest('[role="navigation"], [role="banner"]')) continue
        if (!V().isReallyVisible(a, { minWidth: 40, minHeight: 14 }) || a.getBoundingClientRect().left < 240) continue

        const cleanUrl = normalizeFacebookGroupUrl(a.href)
        if (!cleanUrl) continue
        const urlKey = cleanUrl.replace(/\/+$/, '').toLowerCase()
        if (seenUrls.has(urlKey)) continue

        const name = V().normalizeText(a.innerText || a.textContent || a.getAttribute('aria-label'))
        if (!name || name.length < 4 || name.length > 120 || /^(tham gia|join|xem thêm|see more|truy cập|visit|nhóm|groups|khám phá|discover|tất cả)$/i.test(name)) continue
        const nameKey = V().stripToMatchKey(name)
        if (!nameKey || seenNames.has(nameKey)) continue

        let card = a.parentElement, cardText = ''
        for (let depth = 0; depth < 7 && card && card !== mainRoot; depth++) {
          const txt = V().normalizeText(card.innerText || '')
          if (/thành viên|members?/i.test(txt) && txt.length <= 500) { cardText = txt; break }
          card = card.parentElement
        }
        const memberMatch = cardText.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|ngàn|m|tr|triệu)?)\s*(?:thành viên|members?)/i)
        const membersCount = memberMatch ? V().parseHumanCount(memberMatch[1]) : 0
        if (membersCount <= 0) continue

        seenUrls.add(urlKey)
        seenNames.add(nameKey)
        groups.push({
          id: `grp-real-${Date.now()}-${groups.length}`,
          groupName: name, groupUrl: cleanUrl, category: options.category || 'Cộng đồng Facebook',
          membersCount, interactionRate: membersCount >= 50000 ? 'Rất cao' : membersCount >= 10000 ? 'Cao' : 'Ổn định',
          status: 'active', isAutoShare: true, notes: `${membersCount.toLocaleString('vi-VN')} thành viên`,
          createdAt: new Date().toISOString()
        })
        V().reportStep('facebook', 'scrape_groups', `Hội nhóm: ${groups.length}/${targetCount} (${membersCount.toLocaleString('vi-VN')} tv)`)
      }

      if (groups.length >= targetCount) break
      await V().scrollPageDownForFeed(950 + Math.round(Math.random() * 400))
      await V().humanDelay(1200, 2000)
    }

    V().clearHud(2500)
    return { ok: true, groups }
  }
  async function watchFacebookItem(options = {}) {
    const dwellMs = Math.max(3000, (Number(options.dwellSeconds) || 8) * 1000)
    await V().sleep(dwellMs)
    if (/\/reel\//i.test(location.pathname)) {
      await advanceToNextFacebookReel(cleanFacebookUrl(location.href))
    } else {
      await V().scrollPageDownForFeed(900)
    }
    return { ok: true }
  }

  async function scrapeFacebookPostComments(options = {}) {
    const maxComments = Number(options.maxComments) || 40
    const comments = []
    const seen = new Set()
    const postTitle = V().truncateClean(document.querySelector('h1, div[data-ad-preview="message"]')?.innerText || document.title, 120)

    for (let round = 0; round < 10 && comments.length < maxComments; round++) {
      for (const node of document.querySelectorAll('[role="article"][aria-label*="Bình luận"], [role="article"][aria-label*="Comment"], ul li div[dir="auto"]')) {
        if (comments.length >= maxComments) break
        const card = node.closest('[role="article"]') || node.parentElement
        if (!card) continue
        const textEl = card.querySelector('div[dir="auto"][style], span[dir="auto"]') || node
        const text = V().normalizeText(textEl.innerText || textEl.textContent)
        if (!text || text.length < 2 || text.length > 400 || seen.has(text)) continue
        seen.add(text)
        const author = V().normalizeText(card.querySelector('a[role="link"] span, strong')?.innerText || 'Người dùng FB')
        const likeMatch = V().normalizeText(card.innerText || '').match(/\b(\d+(?:[.,]\d+)?\s*(?:k|m|tr)?)\b/i)
        const likes = likeMatch ? V().parseHumanCount(likeMatch[1]) : 0
        comments.push({ author, text, likes })
      }
      const moreBtn = Array.from(document.querySelectorAll('[role="button"], span')).find((b) =>
        V().isReallyVisible(b) && /xem thêm bình luận|view more comments/i.test(V().normalizeText(b.innerText))
      )
      if (moreBtn) await V().humanClick(moreBtn)
      else await V().scrollPageDownForFeed(700)
      await V().sleep(1200)
    }
    return { ok: true, postTitle, comments }
  }

  async function scrapeFacebookChannelInfo(options = {}) {
    const channelName = V().normalizeText(document.querySelector('h1')?.innerText || document.title)
    const bio = V().normalizeText(document.body?.innerText || '').slice(0, 600)
    const followersMatch = bio.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:người theo dõi|followers?)/i)
    const followersCount = followersMatch ? V().parseHumanCount(followersMatch[1]) : 0
    const sampleTitles = Array.from(document.querySelectorAll('div[role="article"] div[dir="auto"]'))
      .map((el) => V().normalizeText(el.innerText))
      .filter((t) => t.length >= 12 && t.length <= 160)
      .slice(0, 10)
    const avatarUrl = document.querySelector('svg image')?.getAttribute('xlink:href') || ''
    return {
      ok: true,
      channel: {
        platform: 'facebook',
        channelUrl: options.channelUrl || location.href,
        channelName,
        handle: location.pathname.replace(/^\/+|\/+$/g, ''),
        bio: bio.slice(0, 260),
        avatarUrl,
        followersCount,
        totalLikesCount: 0,
        sampleTitles
      }
    }
  }

})()
