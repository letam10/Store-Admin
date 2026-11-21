/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.2.2 cho Facebook Desktop 2026 (Đa tài khoản • Ẩn khung thao tác).
  - Liên kết trực tiếp: extension/manifest.json, extension/vision-engine.js, extension/background.js
  - Vùng ảnh hưởng khi sửa: Tự động đăng bài Facebook & cào bài viral Facebook
  - Cập nhật v3.2.2:
    1. Bắt trực tiếp thanh "Bạn đang nghĩ gì?" (pill bar) và nút "Ảnh/video" trên Trang cá nhân (kể cả khi ảnh bìa cao).
    2. Tự động cuộn đến thanh đăng bài nếu bị che khuất dưới ảnh bìa và bấm nút "Ảnh/video" dự phòng nếu click thanh chưa mở.
    3. Giữ nguyên đầy đủ logic cuộn chọn Chỉ mình tôi, Reels 2026 và cào bài Viral Facebook >= 5K.
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
      stepLog('nav', 'Đang bấm Avatar góc trên trái để vào Trang cá nhân...')
      await V().humanClick(leftLink)
      if (await M().waitFor(() => !isNonProfilePage(), 8000)) { await V().humanDelay(1200, 2000); return true }
    }

    const bannerBtns = Array.from(document.querySelectorAll('[role="banner"] [role="button"], [role="banner"] button'))
      .filter((b) => V().isReallyVisible(b, { minWidth: 28, minHeight: 28 }))
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)

    const avatarBtn = bannerBtns.find((b) => /trang cá nhân|tài khoản|your profile|account/i.test(V().normalizeText(b.getAttribute('aria-label')))) || bannerBtns[0]
    if (!avatarBtn) return false

    stepLog('nav', 'Đang bấm Avatar góc trên phải để về Trang cá nhân...')
    await V().humanClick(avatarBtn)
    await V().humanDelay(700, 1200)

    const profileMenuLink = Array.from(document.querySelectorAll('[role="dialog"] a[href], [role="menu"] a[href], a[href*="/me"]'))
      .find((a) => {
        if (!V().isReallyVisible(a, { minWidth: 90, minHeight: 28 })) return false
        const r = a.getBoundingClientRect()
        return r.left >= window.innerWidth * 0.55 && r.top >= 50 && r.top <= 240 && /facebook\.com\/(me\/?|profile\.php\?id=\d+)/i.test(a.href || '')
      })

    if (profileMenuLink) {
      await V().humanClick(profileMenuLink)
      if (await M().waitFor(() => !isNonProfilePage(), 9000)) { await V().humanDelay(1300, 2200); return true }
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
        if (r.top - dRect.top > 180 || r.top - dRect.top < 40) continue
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

  function findComposerTrigger() {
    let best = null, bestScore = -Infinity
    for (const el of document.querySelectorAll('span, div, p, [role="button"], button, [tabindex="0"]')) {
      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) continue
      if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 12 })) continue

      const raw = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('placeholder') || ''}`)
      if (!raw || raw.length > 90 || !COMPOSER_TEXT_RE.test(raw)) continue

      let clickable = el.closest('[role="button"], button, [tabindex="0"]')
      if (!clickable || isInsideFixedTopBanner(clickable)) {
        let cur = el
        for (let i = 0; i < 4 && cur && cur !== document.body; i++) {
          const cr = cur.getBoundingClientRect()
          if (cr.width >= 100 && cr.height >= 20 && cr.height <= 85) { clickable = cur; break }
          cur = cur.parentElement
        }
      }
      if (!clickable) clickable = el

      const cRect = clickable.getBoundingClientRect()
      if (cRect.width < 70 || cRect.height < 18 || cRect.height > 120) continue

      let score = 50
      if (cRect.width >= 150) score += 30
      if (cRect.left > window.innerWidth * 0.15 && cRect.left < window.innerWidth * 0.85) score += 20
      if (cRect.top > 60) score += 10
      if (raw.length < 45) score += 15

      if (score > bestScore) { bestScore = score; best = clickable }
    }
    if (best) return best

    const photoBtn = findProfilePhotoShortcut()
    if (photoBtn) return photoBtn

    return null
  }

  function findProfilePhotoShortcut() {
    for (const el of document.querySelectorAll('span, div, [role="button"], button, [tabindex="0"]')) {
      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) continue
      if (!V().isReallyVisible(el, { minWidth: 20, minHeight: 14 })) continue

      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      if (!label || label.length > 40 || !PHOTO_BTN_RE.test(label)) continue

      const clickable = el.closest('[role="button"], button, [tabindex="0"]') || el
      const r = clickable.getBoundingClientRect()
      if (r.width >= 40 && r.height >= 18 && r.height <= 90) return clickable
    }
    return null
  }

  function findComposerDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 260, minHeight: 160 }))
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const dialog = dialogs[i]
      const text = V().normalizeText(dialog.innerText || dialog.textContent).slice(0, 450)
      if (/đối tượng của bài viết|post audience|ai có thể xem bài viết/i.test(text)) continue

      const hasEditor = Boolean(findComposerEditor(dialog))
      const hasSubmit = Boolean(findSubmitOrNextButton(dialog))
      const hasComposerTitle = /tạo bài viết|create post|bạn đang nghĩ gì|what's on your mind/i.test(text)

      if ((hasComposerTitle && (hasEditor || hasSubmit)) || (hasEditor && hasSubmit) || (hasEditor && hasExistingMediaInDialog(dialog)) || (hasComposerTitle && hasExistingMediaInDialog(dialog))) {
        return dialog
      }
    }
    return null
  }

  function findAudienceSubDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 280, minHeight: 200 }))
    for (let i = dialogs.length - 1; i >= 0; i--) {
      if (/đối tượng của bài viết|ai có thể xem bài viết|post audience|who can see your post/i.test(V().normalizeText(dialogs[i].innerText || dialogs[i].textContent).slice(0, 300))) {
        return dialogs[i]
      }
    }
    return null
  }

  function hasExistingMediaInDialog(dialog) {
    if (!dialog) return false
    const dRect = dialog.getBoundingClientRect()
    if (V().queryAllDeep(dialog, '[role="button"], button').some((b) =>
      V().isReallyVisible(b) && /^(chỉnh sửa|chỉnh sửa tất cả|edit|edit all)$/i.test(V().normalizeText(b.innerText || b.textContent))
    )) return true
    return V().queryAllDeep(dialog, 'img').some((img) =>
      V().isReallyVisible(img, { minWidth: 85, minHeight: 85 }) && img.getBoundingClientRect().top > dRect.top + 110 && img.complete && img.naturalWidth > 80
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

    for (const el of V().queryAllDeep(scope, 'span, div, button, a')) {
      if (el.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(el, { minWidth: 18, minHeight: 10, checkAriaHidden: false })) continue
      const txt = V().normalizeText(el.innerText || el.textContent)
      if (!txt || txt.length > 42 || !AUDIENCE_EXACT_RE.test(txt) || /nhãn ai|ai label/i.test(txt)) continue
      const r = el.getBoundingClientRect()
      if (dialog && (r.top < dRect.top + 35 || r.top > dRect.top + 420)) continue
      return el.closest('[role="button"], button, [tabindex="0"], a') || el
    }

    for (const btn of V().queryAllDeep(scope, '[role="button"], button, [tabindex="0"]')) {
      if (btn.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(btn, { minWidth: 28, minHeight: 16, checkAriaHidden: false })) continue
      const aria = V().normalizeText(btn.getAttribute('aria-label'))
      const vis = V().normalizeText(btn.innerText || btn.textContent)
      if (/nhãn ai|ai label|^(đóng|close|đăng|post|chỉnh sửa)/i.test(`${vis} ${aria}`)) continue
      if (/chỉnh sửa quyền riêng tư|edit privacy|chia sẻ với|sharing with|đối tượng|audience|công khai|public|chỉ mình tôi|only me|bạn bè|friends/i.test(aria)) return btn
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
      if (diff > 20 && el.clientHeight > 120 && /(auto|scroll|overlay)/.test(window.getComputedStyle(el).overflowY || '') && diff > bestDiff) {
        bestDiff = diff
        best = el
      }
    }
    return best
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    const targetLabel = requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE

    for (let attempt = 1; attempt <= 2; attempt++) {
      const audienceBtn = findAudienceButton(findComposerDialog() || dialog)
      if (!audienceBtn) { await V().sleep(500); continue }

      if (parsePrivacyFromText(`${audienceBtn.innerText || ''} ${audienceBtn.getAttribute('aria-label') || ''}`) === requestedPrivacy) {
        return requestedPrivacy
      }

      stepLog('privacy', `Đang mở hộp thoại đối tượng để chọn "${targetLabel}"...`)
      await V().humanClick(audienceBtn)
      await M().waitFor(() => Boolean(findAudienceSubDialog()), 6000)
      await V().humanDelay(550, 950)

      const subDialog = findAudienceSubDialog() || document
      const scroller = findScrollableBoxInside(subDialog)

      const findOptionRow = () => {
        for (const el of V().queryAllDeep(subDialog, '[role="radio"], [role="menuitem"], [role="option"], [role="listitem"], [role="button"]')) {
          if (el === audienceBtn) continue
          const txt = V().normalizeText(el.innerText || el.textContent)
          if (txt && txt.length <= 130 && targetPattern.test(txt)) {
            return el.closest('[role="radio"], [role="menuitem"], [role="button"], [tabindex="0"]') || el
          }
        }
        for (const sp of subDialog.querySelectorAll('span, div')) {
          const txt = V().normalizeText(sp.innerText || sp.textContent)
          if (!txt || txt.length > 40) continue
          if (requestedPrivacy === 'only_me' ? /^(chỉ mình tôi|only me)$/i.test(txt) : /^(công khai|public)$/i.test(txt)) {
            return sp.closest('[role="radio"], [role="button"], [tabindex="0"]') || sp
          }
        }
        return null
      }

      if (scroller) scroller.scrollTop = 0
      let optionEl = findOptionRow()

      for (let step = 0; step < 6 && (!optionEl || !V().isReallyVisible(optionEl, { minWidth: 30, minHeight: 16 })); step++) {
        if (!scroller) break
        scroller.scrollTop += 190
        await V().humanDelay(280, 500)
        optionEl = findOptionRow()
      }

      if (optionEl) {
        try { optionEl.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch (_) {}
        await V().humanDelay(320, 600)
        await V().humanClick(optionEl)
        await V().humanDelay(550, 950)

        const innerRadio = optionEl.querySelector?.('[role="radio"], input[type="radio"]') || optionEl
        if (innerRadio?.getAttribute?.('aria-checked') === 'false') {
          await V().humanClick(innerRadio)
          await V().humanDelay(450, 750)
        }

        const confirmBtn = V().queryAllDeep(subDialog, '[role="button"], button').find((btn) =>
          V().isReallyVisible(btn, { minWidth: 50, minHeight: 28 }) && !V().isElementDisabled(btn) &&
          /^(xong|done|lưu|save|cập nhật|update)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
        )
        if (confirmBtn) { await V().humanClick(confirmBtn); await V().humanDelay(750, 1250) }
      } else {
        V().dispatchEscape()
        await V().humanDelay(500, 900)
      }

      const confirmed = await M().waitFor(() => {
        const btn = findAudienceButton(findComposerDialog() || dialog)
        return Boolean(btn && parsePrivacyFromText(`${btn.innerText || ''} ${btn.getAttribute('aria-label') || ''}`) === requestedPrivacy)
      }, 5500)

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

  async function executeFacebookPost(payload) {
    const trace = []
    const stepLog = (step, msg, level = 'info') => {
      trace.push({ step, msg, level, ts: Date.now() })
      V().reportStep('facebook', step, msg, level)
    }

    if (!/(^|\.)facebook\.com$/i.test(location.hostname)) return { ok: false, error: 'FACEBOOK_HOST_INVALID', visionTrace: trace }
    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 25000, onStatus: stepLog })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, visionTrace: trace }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', visionTrace: trace }

    if (isNonProfilePage()) {
      const moved = await navigateToProfileViaTopRightAvatar(stepLog)
      if (!moved && isNonProfilePage()) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    }

    if (window.scrollY > 80) await V().smoothScrollToTop()
    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }

    const requestedPrivacy = String(payload.privacy || 'only_me').toLowerCase()
    const rawTitle = V().formatPostText(payload.title || '', 260)
    const rawContent = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''
    const bodyWithoutDupTitle = rawTitle && V().normalizeText(rawContent).startsWith(V().normalizeText(rawTitle))
      ? rawContent : [rawTitle, rawContent].filter(Boolean).join('\n\n')
    const fullText = V().composeBodyAndHashtags(bodyWithoutDupTitle, rawHashtags, 6000)
    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    await V().humanDelay(650, 1250)
    const existingPermalinks = new Set(collectPostPermalinks())

    let dialog = findComposerDialog()
    if (!dialog) {
      stepLog('open_composer', 'Đang chọn vào thanh "Bạn đang nghĩ gì?" để đăng bài...')

      let trigger = findComposerTrigger() || findProfilePhotoShortcut()
      if (!trigger) {
        window.scrollBy({ top: 380, behavior: 'smooth' })
        await V().humanDelay(600, 1000)
        trigger = findComposerTrigger() || findProfilePhotoShortcut()
      }
      if (!trigger) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        await V().humanDelay(600, 1000)
        trigger = findComposerTrigger() || findProfilePhotoShortcut()
      }

      if (!trigger) {
        const ready = await M().waitFor(() => Boolean(findComposerTrigger() || findProfilePhotoShortcut()), 8000)
        if (ready) trigger = findComposerTrigger() || findProfilePhotoShortcut()
      }
      if (!trigger) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }

      await V().scrollIntoViewSafely(trigger, 'center')
      await V().humanDelay(350, 700)
      await V().humanClick(trigger)

      let opened = await M().waitFor(() => Boolean(findComposerDialog()), 5500)
      if (!opened) {
        const photoShortcut = findProfilePhotoShortcut()
        if (photoShortcut && photoShortcut !== trigger) {
          stepLog('open_composer', 'Đang bấm nút "Ảnh/video" để mở khung đăng bài...')
          await V().scrollIntoViewSafely(photoShortcut, 'center')
          await V().humanDelay(300, 600)
          await V().humanClick(photoShortcut)
          opened = await M().waitFor(() => Boolean(findComposerDialog()), 7000)
        }
      }

      dialog = findComposerDialog()
    }
    if (!dialog) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }

    const authorName = detectLoggedInAccountName(dialog)
    await V().humanReadPause()

    // Bước 2: Đổi quyền riêng tư
    const actualPrivacy = await applyAudiencePrivacy(findComposerDialog() || dialog, requestedPrivacy, stepLog)
    if (actualPrivacy !== requestedPrivacy) {
      return { ok: false, error: requestedPrivacy === 'only_me' ? 'FACEBOOK_ONLY_ME_NOT_CONFIRMED' : 'FACEBOOK_PUBLIC_NOT_CONFIRMED', actualPrivacy, visionTrace: trace }
    }
    stepLog('privacy', `Đã chọn đối tượng: ${actualPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'}.`)
    await V().humanDelay(600, 1100)

    // Bước 3: Nạp ảnh sản phẩm
    dialog = findComposerDialog() || dialog
    if (!hasExistingMediaInDialog(dialog)) {
      stepLog('upload_image', 'Đang tải ảnh sản phẩm lên...')
      const imageSnapshot = V().captureVisualImageSnapshot(dialog)
      const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-fb-product.png')
      let imageInput = await M().findImageInput(dialog, 1500, false)
      if (!imageInput) {
        const photoBtn = findPhotoToolbarButtonInDialog(dialog)
        if (photoBtn) { await V().humanClick(photoBtn); await V().humanDelay(750, 1300) }
        imageInput = await M().findImageInput(dialog, 6000, false) || await M().findImageInput(document, 3000, false)
      }
      if (!imageInput || !M().attachFile(imageInput, imageFile)) return { ok: false, error: 'FACEBOOK_IMAGE_NOT_ATTACHED', visionTrace: trace }
      const previewOk = await M().waitFor(() => {
        const d = findComposerDialog() || dialog
        return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
      }, 24000, 350)
      if (!previewOk) return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
      await V().humanDelay(1500, 2500)
    }

    // Bước 4: Điền chữ & hashtag
    dialog = findComposerDialog()
    if (!dialog) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }

    stepLog('fill_text', 'Đang điền nội dung & hashtag...')
    let typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
    if (!typeResult.ok) {
      await V().humanDelay(800, 1300)
      typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
    }
    if (!typeResult.ok) return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
    await V().humanReviewPause()

    // Bước 5: Bấm Đăng
    dialog = findComposerDialog()
    if (!dialog) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    let submitInfo = null
    await M().waitFor(() => {
      const found = findSubmitOrNextButton(findComposerDialog() || dialog)
      if (found && !V().isElementDisabled(found.element)) { submitInfo = found; return true }
      return false
    }, 10000)
    if (!submitInfo) return { ok: false, error: 'FACEBOOK_SUBMIT_BUTTON_NOT_READY', visionTrace: trace }

    stepLog('submit', 'Đang bấm Đăng bài...')
    await V().humanClick(submitInfo.element)
    if (submitInfo.kind === 'next') {
      await V().humanDelay(850, 1400)
      let finalPostBtn = null
      await M().waitFor(() => {
        const d = findComposerDialog()
        if (!d) return true
        const found = findSubmitOrNextButton(d)
        if (found?.kind === 'post' && !V().isElementDisabled(found.element)) { finalPostBtn = found.element; return true }
        return false
      }, 9000)
      if (finalPostBtn) await V().humanClick(finalPostBtn)
    }

    stepLog('verify', 'Đang xác nhận bài viết mới...')
    const result = await waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog)
    V().clearHud(4500)
    return { ...result, visionTrace: trace }
  }

  async function waitForFacebookPublishConfirmation(fullText, existingPermalinks, actualPrivacy, authorName, stepLog) {
    const deadline = Date.now() + 42000
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) =>
        V().isReallyVisible(btn) && /^(không phải bây giờ|not now|đăng ngay|post now)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
      )
      if (secondaryBtn && !findComposerDialog()) { await V().humanClick(secondaryBtn); await V().humanDelay(600, 1000) }

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
    if (timeLinks.length > 0) await V().sleep(300)
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
  // ĐỌC TƯƠNG TÁC CHUẨN FACEBOOK DESKTOP 2026 (INLINE [👍 5,5K] + [aria-label^="Like:"] + HOVER TOOLTIP!)
  // =========================================================================

  async function extractFeedPostMetrics2026(article) {
    let likes = 0, comments = 0, shares = 0

    // 1. Đọc [aria-label^="Thích:"] / [aria-label^="Like:"] (DOM Facebook 10/2026)
    for (const el of article.querySelectorAll('[aria-label^="Thích:"], [aria-label^="Like:"], [aria-label*="cảm xúc"], [aria-label*="reaction"]')) {
      const aria = V().normalizeText(el.getAttribute('aria-label') || '')
      if (/lượt xem|views?/i.test(aria)) continue
      likes = Math.max(likes, V().parseHumanCount(aria), V().parseHumanCount(el.innerText || el.textContent))
    }

    // 2. Đọc trực tiếp thanh nút dưới bài 2026: [👍 5,5K] [💬 68] [↗ 43]
    for (const btn of article.querySelectorAll('[role="button"], button')) {
      const aria = V().normalizeText(btn.getAttribute('aria-label') || '')
      const txt = V().normalizeText(btn.innerText || btn.textContent || '')
      const siblingTxt = V().normalizeText(btn.nextElementSibling?.innerText || '')
      const parentTxt = V().normalizeText(btn.parentElement?.innerText || '')

      if (/^(thích|like|bỏ thích|unlike|bày tỏ cảm xúc|react)$/i.test(aria) || /tất cả cảm xúc|người đã thích|thích:|like:|reactions?/i.test(aria)) {
        for (const c of [aria, txt, siblingTxt, parentTxt.length <= 24 ? parentTxt : '']) {
          if (!/lượt xem|views?/i.test(c)) likes = Math.max(likes, V().parseHumanCount(c))
        }
        continue
      }
      if (/bình luận|viết bình luận|leave a comment|comment/i.test(aria)) {
        comments = Math.max(comments, V().parseHumanCount(txt || siblingTxt || aria))
        continue
      }
      if (/chia sẻ|share|gửi/i.test(aria)) {
        shares = Math.max(shares, V().parseHumanCount(txt || siblingTxt || aria))
        continue
      }
      if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|m|tr|triệu)$/i.test(txt)) {
        const aRect = article.getBoundingClientRect()
        const bRect = btn.getBoundingClientRect()
        if (bRect.top > aRect.top + aRect.height * 0.45 && bRect.left < aRect.left + aRect.width * 0.42) {
          likes = Math.max(likes, V().parseHumanCount(txt))
        }
      }
    }

    // 3. Biến thể Desktop 2026 ẩn số lượt thích cho tới khi hover vào cụm icon cảm xúc (👍❤️)
    if (likes === 0) {
      const reactCluster = article.querySelector('[role="toolbar"] [role="button"], [aria-label*="cảm xúc"], [aria-label*="reaction"]')
      if (reactCluster) {
        try {
          reactCluster.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
          reactCluster.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
          await V().sleep(220)
          const tooltipText = Array.from(document.querySelectorAll('[role="tooltip"]'))
            .map((t) => V().normalizeText(t.innerText || t.textContent)).join(' ')
          if (tooltipText) likes = Math.max(likes, V().parseHumanCount(tooltipText))
        } catch (_) {}
      }
    }

    // 4. Dạng chữ truyền thống ("Tất cả cảm xúc: 12K")
    const fullText = V().normalizeText(article.innerText || '')
    const allReact = fullText.match(/(?:tất cả cảm xúc|all reactions)\s*:?\s*(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)/i)
    if (allReact) likes = Math.max(likes, V().parseHumanCount(allReact[1]))

    return { likes, comments, shares }
  }

  function extractActiveReelPost2026() {
    if (!/\/reel\/\d+/i.test(location.pathname)) return null
    const postUrl = cleanFacebookUrl(location.href)
    let likes = 0, comments = 0, shares = 0

    const buttons = Array.from(document.querySelectorAll('[role="button"], button')).filter((b) => {
      if (!V().isReallyVisible(b, { minWidth: 20, minHeight: 20 })) return false
      const r = b.getBoundingClientRect()
      return r.top > 120 && r.left > window.innerWidth * 0.45
    })

    for (const btn of buttons) {
      const aria = V().normalizeText(btn.getAttribute('aria-label') || '')
      const nearText = V().normalizeText(`${btn.innerText || ''} ${btn.nextElementSibling?.innerText || ''} ${btn.parentElement?.innerText || ''}`)
      if (/^(thích|like|bỏ thích|unlike)$/i.test(aria) || /thích|like/i.test(aria)) {
        if (nearText.length <= 30) likes = Math.max(likes, V().parseHumanCount(nearText))
      } else if (/bình luận|comment/i.test(aria)) {
        if (nearText.length <= 30) comments = Math.max(comments, V().parseHumanCount(nearText))
      } else if (/chia sẻ|share/i.test(aria)) {
        if (nearText.length <= 30) shares = Math.max(shares, V().parseHumanCount(nearText))
      }
    }

    const bottomTexts = Array.from(document.querySelectorAll('span, a, div[dir="auto"]'))
      .filter((el) => {
        if (!V().isReallyVisible(el)) return false
        const r = el.getBoundingClientRect()
        return r.top > window.innerHeight * 0.72 && r.left > 180 && r.right < window.innerWidth * 0.85
      })
      .map((el) => V().normalizeText(el.innerText || el.textContent))
      .filter((t) => t.length >= 6 && t.length <= 260 && !/^(theo dõi|đang theo dõi|follow|following|âm thanh gốc)$/i.test(t))

    return { postUrl, likes, comments, shares, caption: bottomTexts.sort((a, b) => b.length - a.length)[0] || 'Facebook Reels Viral' }
  }

  async function advanceToNextFacebookReel() {
    const nextBtn = Array.from(document.querySelectorAll('[role="button"], button')).find((b) =>
      V().isReallyVisible(b, { minWidth: 28, minHeight: 28 }) && b.getBoundingClientRect().left >= window.innerWidth * 0.85 &&
      /tiếp theo|next|sau|xuống|down/i.test(V().normalizeText(b.getAttribute('aria-label') || ''))
    )
    if (nextBtn) await V().humanClick(nextBtn)
    else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, bubbles: true }))
    }
    await V().humanDelay(1650, 2600)
  }

  async function scrapeFacebookViralPosts(options = {}) {
    const targetCount = Number(options.targetCount) || 10
    const minLikes = Number(options.minLikes) || 5000
    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 22
    const idleTimeoutMs = Number(options.idleTimeoutMs) || 5 * 60 * 1000
    let lastFoundAt = Number(options.lastFoundAt) || Date.now()
    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0
    const topicLabel = options.topicLabel || ''

    const seenUrls = new Set((options.excludeUrls || []).map((u) => cleanFacebookUrl(u).toLowerCase()))
    const seenFingerprints = new Set()

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, posts: [], lastFoundAt }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', posts: [], lastFoundAt }

    const collected = []

    if (/\/reel\b/i.test(location.pathname)) {
      for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {
        if (Date.now() - lastFoundAt >= idleTimeoutMs) return { ok: true, posts: collected, timedOut: true, lastFoundAt }
        const reel = extractActiveReelPost2026()
        if (reel && reel.likes >= minLikes) {
          const urlKey = reel.postUrl.toLowerCase()
          if (!seenUrls.has(urlKey)) {
            seenUrls.add(urlKey)
            lastFoundAt = Date.now()
            collected.push({
              id: `fb-reel-${Date.now()}-${collected.length}`,
              title: V().truncateClean(reel.caption, 105),
              platform: 'facebook',
              category: topicLabel || 'Facebook Reels',
              postUrl: reel.postUrl,
              summary: V().truncateClean(`${reel.caption} • ${reel.likes.toLocaleString('vi-VN')} cảm xúc`, 250),
              viralityScore: Math.min(99, 86 + Math.min(13, Math.floor(Math.log10(reel.likes) * 3))),
              likesCount: reel.likes, sharesCount: reel.shares, commentsCount: reel.comments,
              trendingTopic: `${(reel.likes / 1000).toFixed(1)}K+ Reels`,
              createdAt: new Date().toISOString()
            })
            V().reportStep('facebook', 'scrape_viral', `Facebook Viral: ${totalAlreadyFound + collected.length}/10 bài (${reel.likes.toLocaleString('vi-VN')})`)
          }
        }
        if (collected.length >= targetCount) break
        await advanceToNextFacebookReel()
      }
      V().clearHud(2500)
      return { ok: true, posts: collected, timedOut: false, lastFoundAt }
    }

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
          const hasVideo = Boolean(article.querySelector('video')) || /\/(reel|videos|watch)\//i.test(postUrl)
          const mediaLabel = hasVideo ? 'Video Facebook' : /\/groups\//i.test(postUrl) ? 'Hội nhóm' : 'Bài ảnh'

          const summaryText = rawText || `${mediaLabel} từ ${author || 'Facebook'} đạt ${metrics.likes.toLocaleString('vi-VN')} cảm xúc.`
          const fp = V().stripToMatchKey(summaryText).slice(0, 48)
          if (fp && seenFingerprints.has(fp)) continue

          seenUrls.add(urlKey)
          if (fp) seenFingerprints.add(fp)
          lastFoundAt = Date.now()
          collected.push({
            id: `fb-viral-${Date.now()}-${collected.length}`,
            title: V().truncateClean(rawText || `[${mediaLabel}] ${author || 'Bài Viral Facebook'}`, 105),
            platform: 'facebook',
            category: topicLabel || mediaLabel,
            postUrl,
            summary: V().truncateClean(`${author ? `[${author}] ` : ''}${summaryText}`, 250),
            viralityScore: Math.min(99, 85 + Math.min(14, Math.floor(Math.log10(metrics.likes) * 3))),
            likesCount: metrics.likes, sharesCount: metrics.shares, commentsCount: metrics.comments,
            trendingTopic: `${(metrics.likes / 1000).toFixed(1)}K+ cảm xúc`,
            createdAt: new Date().toISOString()
          })
          V().reportStep('facebook', 'scrape_viral', `Facebook Viral: ${totalAlreadyFound + collected.length}/10 bài (${metrics.likes.toLocaleString('vi-VN')})`)
        } catch (_) {}
      }

      if (collected.length >= targetCount) break
      const curH = document.documentElement.scrollHeight
      if (curH === lastScrollHeight) stagnantScrolls++
      else { stagnantScrolls = 0; lastScrollHeight = curH }
      if (stagnantScrolls >= 4) break

      window.scrollBy({ top: 900 + Math.round(Math.random() * 550), behavior: 'smooth' })
      await V().humanDelay(1600, 2600)
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
        if (!V().isReallyVisible(a, { minWidth: 40, minHeight: 14 }) || a.getBoundingClientRect().left < 280) continue

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
      window.scrollBy({ top: 800 + Math.round(Math.random() * 450), behavior: 'smooth' })
      await V().humanDelay(1400, 2300)
    }

    V().clearHud(2500)
    return { ok: true, groups }
  }
})()
