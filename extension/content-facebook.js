/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.5.2 cho Facebook Desktop 2026.
  - Nâng cấp:
    1. Đánh thức giấc ngủ ngay khi người dùng bấm dừng ABORT_SCRAPE bằng abortAllWaits().
    2. Chờ mạng chậm 120s khi đăng bài Facebook, kiểm tra đang tải lên để không báo lỗi sớm.
    3. Trích xuất chỉ số tương tác chính xác tuyệt đối (lọc m/h/bỏ unit b/clamp 200M/chặn comment bất thường).
    4. Gửi LIVE_VIRAL_POST tức thì về bảng Admin và cuộn giữa bài chờ ảnh nét khi cào bài viral.
  - Liên kết trực tiếp: extension/vision-engine.js, extension/content-media.js, extension/background.js
  - Vùng ảnh hưởng khi sửa: Toàn bộ tương tác tự động với Facebook desktop (đăng bài cá nhân/nhóm, cào bài viral/reels, xem video, cào nhóm, lướt feed).
*/

;(() => {
  if (typeof window.__OMNICART_FB_CLEANUP__ === 'function') {
    try { window.__OMNICART_FB_CLEANUP__() } catch (_) {}
  }

  const COMPOSER_TEXT_RE = /bạn đang nghĩ gì|what's on your mind|viết gì đó|write something|tạo bài viết|create a post|bạn viết gì đi/i
  const EXCLUDE_NOTE_RE = /chia sẻ suy nghĩ|share a thought|ghi chú|note/i
  const PHOTO_BTN_RE = /ảnh\/video|photo\/video|thêm ảnh|add photo/i
  const ONLY_ME_RE = /chỉ mình tôi|only me/i
  const PUBLIC_RE = /công khai|public/i
  const FRIENDS_RE = /bạn bè|friends/i
  const AUDIENCE_EXACT_RE = /^(công khai|public|chỉ mình tôi|only me|bạn bè|friends|bạn thân|bạn bè ngoại trừ.*|chỉ hiển thị với.*|không hiển thị với.*|tùy chỉnh|custom)$/i

  const V = () => globalThis.OmniVision
  const M = () => globalThis.OmniCartMedia

  let scrapeAborted = false

  const handleMessage = (message, sender, sendResponse) => {
    if (!message?.type) return false
    if (message.type === 'VISION_SET_CONFIG' || message.type === 'VISION_SET_HUD') {
      V()?.applyConfig(message.config || { showHud: message.enabled })
      sendResponse({ ok: true })
      return false
    }
    if (message.type === 'FB_INSPECT_VISION') { sendResponse(inspectFacebookScreen()); return false }
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
    if (message.type === 'ABORT_SCRAPE') {
      scrapeAborted = true
      V()?.abortAllWaits?.()
      sendResponse({ ok: true })
      return false
    }
    if (message.type === 'FB_SURF_STEP') {
      surfOneFacebookStep(message.options || {}).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message, posts: [] }))
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

  function isGroupPostPage() {
    return /^\/groups\/[^/?#]+/i.test(location.pathname) && !/^\/groups\/(feed|discover|joins)/i.test(location.pathname)
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
      if (await M().waitFor(() => !isNonProfilePage(), 9000)) { await V().humanDelay(1000, 1700); return true }
    }

    const bannerBtns = Array.from(document.querySelectorAll('[role="banner"] [role="button"], [role="banner"] button'))
      .filter((b) => V().isReallyVisible(b, { minWidth: 28, minHeight: 28 }))
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)

    const avatarBtn = bannerBtns.find((b) => /trang cá nhân|tài khoản|your profile|account/i.test(V().normalizeText(b.getAttribute('aria-label')))) || bannerBtns[0]
    if (!avatarBtn) return false

    stepLog('nav', 'Đang bấm Avatar góc trên phải để về Trang cá nhân...')
    await V().humanClick(avatarBtn, { skipScroll: true })
    await V().humanDelay(700, 1150)

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

  function findComposerTrigger() {
    let best = null, bestScore = -Infinity
    // Quét rộng toàn bộ document.body để không bị kẹt ở [role="main"] ẩn cũ sau khi chuyển trang SPA
    for (const el of V().queryAllDeep(document.body, 'span, div[role="button"], button, div[tabindex="0"]')) {
      if (!V().isReallyVisible(el, { minWidth: 50, minHeight: 14 })) continue
      if (isInsideFixedTopBanner(el) || el.closest('[role="dialog"], [role="article"]')) continue
      const label = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      if (!label || label.length > 100 || EXCLUDE_NOTE_RE.test(label) || !COMPOSER_TEXT_RE.test(label)) continue
      const clickable = el.closest('[role="button"], button, [tabindex="0"]') || el
      if (isInsideFixedTopBanner(clickable) || clickable.closest('[role="dialog"], [role="article"]')) continue
      const cRect = clickable.getBoundingClientRect()
      if (cRect.width < 110 || cRect.height < 22 || cRect.height > 120) continue
      const score = 70 +
        (clickable.getAttribute('role') === 'button' ? 35 : 0) +
        (cRect.width >= 220 ? 30 : 0) +
        (label.length < 40 ? 25 : 0) +
        (cRect.top >= 0 && cRect.top < window.innerHeight ? 20 : 0)
      if (score > bestScore) { bestScore = score; best = clickable }
    }
    return best
  }

  // Hỗ trợ cả dialog riêng lẫn chế độ trượt ngay trong hộp thoại Tạo bài viết (Facebook 2026)
  function findAudienceSubDialog() {
    const dialogs = V().queryAllDeep(document, 'div[role="dialog"]')
      .filter((d) => V().isReallyVisible(d, { minWidth: 280, minHeight: 200 }))
    for (let i = dialogs.length - 1; i >= 0; i--) {
      const dlg = dialogs[i]
      const headText = V().normalizeText(dlg.innerText || dlg.textContent).slice(0, 380)
      if (/đối tượng của bài viết|ai có thể xem bài viết|post audience|who can see your post/i.test(headText)) {
        return dlg
      }
      const radios = V().queryAllDeep(dlg, '[role="radio"]').filter((r) => V().isReallyVisible(r, { minWidth: 20, minHeight: 16 }))
      if (radios.length >= 2 && /công khai|public|bạn bè|friends/i.test(headText)) return dlg
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
    const dRect = dialog ? dialog.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }

    for (const btn of V().queryAllDeep(scope, '[role="button"], button, [tabindex="0"]')) {
      if (btn.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(btn, { minWidth: 28, minHeight: 16, checkAriaHidden: false })) continue
      const r = btn.getBoundingClientRect()
      if (dialog && (r.top < dRect.top + 35 || r.top > dRect.top + 260)) continue
      const aria = V().normalizeText(btn.getAttribute('aria-label'))
      const vis = V().normalizeText(btn.innerText || btn.textContent)
      if (/nhãn ai|ai label|^(đóng|close|đăng|post|chỉnh sửa ảnh)/i.test(`${vis} ${aria}`)) continue
      if (/chỉnh sửa quyền riêng tư|edit privacy|chia sẻ với|sharing with|đối tượng|audience/i.test(aria) || AUDIENCE_EXACT_RE.test(vis)) {
        return btn
      }
    }

    for (const el of V().queryAllDeep(scope, 'span, div')) {
      if (el.closest('[contenteditable="true"], [role="textbox"]')) continue
      if (!V().isReallyVisible(el, { minWidth: 18, minHeight: 10, checkAriaHidden: false })) continue
      const txt = V().normalizeText(el.innerText || el.textContent)
      if (!txt || txt.length > 40 || !AUDIENCE_EXACT_RE.test(txt) || /nhãn ai|ai label/i.test(txt)) continue
      const r = el.getBoundingClientRect()
      if (dialog && (r.top < dRect.top + 35 || r.top > dRect.top + 260)) continue
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
      if (diff > 16 && el.clientHeight > 90 && /(auto|scroll|overlay)/.test(window.getComputedStyle(el).overflowY || '') && diff > bestDiff) {
        bestDiff = diff
        best = el
      }
    }
    return best
  }

  async function applyAudiencePrivacy(dialog, requestedPrivacy, stepLog) {
    if (isGroupPostPage()) return requestedPrivacy
    const targetLabel = requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
    const targetPattern = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE
    const oppositePattern = requestedPrivacy === 'only_me' ? PUBLIC_RE : ONLY_ME_RE

    for (let attempt = 1; attempt <= 3; attempt++) {
      const curDialog = findComposerDialog() || dialog
      const audienceBtn = findAudienceButton(curDialog)
      if (!audienceBtn) { await V().sleep(650); continue }

      if (parsePrivacyFromText(`${audienceBtn.innerText || ''} ${audienceBtn.getAttribute('aria-label') || ''}`) === requestedPrivacy) {
        return requestedPrivacy
      }

      stepLog('privacy', `Đang mở bảng đối tượng để chọn "${targetLabel}" (lần ${attempt}/3)...`)
      await V().humanClick(audienceBtn, { skipScroll: true })
      await M().waitFor(() => Boolean(findAudienceSubDialog()), 6500, 220)
      await V().humanDelay(550, 950)

      let subDialog = findAudienceSubDialog()
      if (!subDialog) continue

      const seeMoreBtn = V().queryAllDeep(subDialog, '[role="button"], button, span').find((el) =>
        V().isReallyVisible(el, { minWidth: 28, minHeight: 16 }) && /^(xem thêm|see more)$/i.test(V().normalizeText(el.innerText || el.textContent))
      )
      if (seeMoreBtn) {
        await V().humanClick(seeMoreBtn.closest('[role="button"], button') || seeMoreBtn, { skipScroll: true })
        await V().humanDelay(550, 900)
        subDialog = findAudienceSubDialog() || subDialog
      }

      const scroller = findScrollableBoxInside(subDialog)
      const findOptionRow = () => {
        const candidates = []
        for (const el of V().queryAllDeep(subDialog, '[role="radio"], [role="listitem"], [role="menuitem"], [role="button"]')) {
          if (el === audienceBtn) continue
          const txt = V().normalizeText(el.innerText || el.textContent)
          if (!txt || txt.length > 150 || !targetPattern.test(txt) || oppositePattern.test(txt)) continue
          candidates.push(el)
        }
        if (candidates.length > 0) {
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

      if (scroller) { scroller.scrollTop = 0; await V().sleep(260) }
      let optionEl = findOptionRow()

      for (let step = 0; step < 10 && (!optionEl || !V().isReallyVisible(optionEl, { minWidth: 28, minHeight: 16 })); step++) {
        if (!scroller) break
        scroller.scrollTop += 200
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
        await V().sleep(340)
        optionEl = findOptionRow()
      }

      if (optionEl) {
        if (scroller) {
          const sRect = scroller.getBoundingClientRect()
          const oRect = optionEl.getBoundingClientRect()
          if (oRect.bottom > sRect.bottom - 12 || oRect.top < sRect.top + 12) {
            scroller.scrollTop += (oRect.top - sRect.top) - 90
            await V().sleep(260)
          }
        }
        await V().humanClick(optionEl, { skipScroll: true })
        await V().humanDelay(550, 920)

        const innerRadio = optionEl.querySelector?.('[role="radio"], input[type="radio"]') || optionEl
        if (innerRadio?.getAttribute?.('aria-checked') === 'false' || innerRadio?.checked === false) {
          await V().humanClick(innerRadio, { skipScroll: true })
          await V().humanDelay(450, 800)
        }

        const confirmBtn = V().queryAllDeep(subDialog, '[role="button"], button').find((btn) =>
          V().isReallyVisible(btn, { minWidth: 48, minHeight: 28 }) && !V().isElementDisabled(btn) &&
          /^(xong|done|lưu|save|cập nhật|update)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
        )
        if (confirmBtn) {
          await V().humanClick(confirmBtn, { skipScroll: true })
          await V().humanDelay(750, 1250)
        }
      } else {
        const aiPick = await V().askSelfHealingAI({
          platform: 'facebook',
          stepKey: `facebook:audience_option_${requestedPrivacy}`,
          goal: `Trong bảng Đối tượng của bài viết đang mở trên Facebook, hãy bấm chọn mục "${targetLabel}" (hoặc cuộn xuống nếu bị che), sau đó bấm nút Xong/Lưu.`,
          root: subDialog,
          errorReason: `Không thấy nút chọn "${targetLabel}" trong danh sách đối tượng`
        })
        if (aiPick.ok && aiPick.action === 'scroll_down' && scroller) {
          scroller.scrollTop += 320
          await V().sleep(400)
        } else if (aiPick.ok && aiPick.element) {
          await V().humanClick(aiPick.element, { skipScroll: true })
          await V().humanDelay(600, 1000)
          const doneBtn = V().queryAllDeep(subDialog, '[role="button"], button').find((btn) =>
            V().isReallyVisible(btn) && !V().isElementDisabled(btn) && /^(xong|done|lưu|save)$/i.test(V().normalizeText(btn.innerText))
          )
          if (doneBtn) await V().humanClick(doneBtn, { skipScroll: true })
        } else {
          V().dispatchEscape()
        }
        await V().humanDelay(550, 900)
      }

      const confirmed = await M().waitFor(() => {
        if (findAudienceSubDialog()) return false
        const btn = findAudienceButton(findComposerDialog() || dialog)
        return Boolean(btn && parsePrivacyFromText(`${btn.innerText || ''} ${btn.getAttribute('aria-label') || ''}`) === requestedPrivacy)
      }, 6500, 260)

      if (confirmed) return requestedPrivacy
    }

    const finalBtn = findAudienceButton(findComposerDialog() || dialog)
    return finalBtn ? parsePrivacyFromText(`${finalBtn.innerText || ''} ${finalBtn.getAttribute('aria-label') || ''}`) : null
  }

  function inspectFacebookScreen() {
    const dlg = findComposerDialog()
    const audBtn = dlg ? findAudienceButton(dlg) : null
    return {
      url: location.href, health: V().inspectPageHealth(),
      loggedIn: !isLoginOrCheckpointScreen(), isNonProfilePage: isNonProfilePage(),
      scrollY: Math.round(window.scrollY), accountName: detectLoggedInAccountName(dlg),
      hasComposerTrigger: Boolean(findComposerTrigger()), hasOpenComposerDialog: Boolean(dlg),
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
    const targetGroupUrl = String(payload.targetGroupUrl || '').trim()
    const rawTitle = V().formatPostText(payload.title || '', 260)
    const rawContent = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''
    const bodyWithoutDupTitle = rawTitle && V().normalizeText(rawContent).startsWith(V().normalizeText(rawTitle))
      ? rawContent : [rawTitle, rawContent].filter(Boolean).join('\n\n')
    const fullText = V().composeBodyAndHashtags(bodyWithoutDupTitle, rawHashtags, 6000)

    if (!targetGroupUrl && isNonProfilePage()) {
      const moved = await navigateToProfileViaTopRightAvatar(stepLog)
      if (!moved && isNonProfilePage()) return { ok: false, needsNavigation: true, targetUrl: 'https://www.facebook.com/me', visionTrace: trace }
    }

    if (checkpoint.verifyOnly) {
      stepLog('verify', 'Phục hồi từ Checkpoint sau bước Đăng — đang xác nhận bài mới...')
      const prevSet = new Set(checkpoint.existingPermalinks || [])
      const verified = await waitForFacebookPublishConfirmation(fullText, prevSet, requestedPrivacy, detectLoggedInAccountName(null), stepLog)
      V().clearHud(4000)
      return { ...verified, visionTrace: trace }
    }

    await V().smoothScrollToTop()
    await M().waitFor(() => Boolean(findComposerTrigger() || findComposerDialog()), 7000, 300)
    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }
    if (!fullText) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }

    await V().humanDelay(550, 1100)
    const existingPermalinksList = collectPostPermalinks()
    const existingPermalinks = new Set(existingPermalinksList)
    stepLog('navigated', targetGroupUrl ? 'Đã vào Hội nhóm mục tiêu, chuẩn bị mở khung tạo bài...' : 'Đã ở Trang cá nhân, chuẩn bị mở khung tạo bài...', 'info', {
      checkpointStep: 'navigated', existingPermalinks: existingPermalinksList.slice(0, 25)
    })

    let dialog = findComposerDialog()
    if (!dialog) {
      const learnedTriggerRule = await V().getLearnedRule('facebook:composer_trigger')
      for (let openTry = 1; openTry <= 3 && !dialog; openTry++) {
        let trigger = (openTry === 1 && learnedTriggerRule) ? V().findByLearnedRule(learnedTriggerRule) : null
        const usedLearned = Boolean(trigger)
        if (!trigger) trigger = findComposerTrigger()
        if (!trigger && openTry === 2) {
          window.scrollTo({ top: 360, behavior: 'auto' })
          await V().sleep(650)
          trigger = findComposerTrigger()
          if (!trigger) { await V().smoothScrollToTop(); trigger = findComposerTrigger() }
        }

        if (trigger) {
          stepLog('open_composer', `Đang bấm khung tạo bài viết (lần ${openTry}/3)...`)
          await V().humanClick(trigger)
          if (await M().waitFor(() => Boolean(findComposerDialog()), 7500)) { dialog = findComposerDialog(); break }
          if (usedLearned) await V().invalidateLearnedRule('facebook:composer_trigger')
        }

        if (openTry === 3 && !dialog) {
          const aiRes = await V().askSelfHealingAI({
            platform: 'facebook', stepKey: 'facebook:composer_trigger',
            goal: 'Tìm và bấm vào ô "Bạn đang nghĩ gì?" hoặc "Bạn viết gì đi..." để mở hộp thoại "Tạo bài viết".',
            errorReason: 'Không mở được hộp thoại Tạo bài viết'
          })
          if (aiRes.ok && aiRes.element) {
            await V().humanClick(aiRes.element, { skipScroll: aiRes.clickMode === 'skip_scroll' })
            if (await M().waitFor(() => Boolean(findComposerDialog()), 8000)) {
              dialog = findComposerDialog()
              await V().saveLearnedRule('facebook:composer_trigger', aiRes.element, aiRes.learnedRule || {})
            }
          }
        }
      }
    }

    if (!dialog) return { ok: false, error: 'FACEBOOK_COMPOSER_NOT_OPENED', visionTrace: trace }

    const authorName = detectLoggedInAccountName(dialog)
    stepLog('open_composer', 'Đã mở hộp thoại "Tạo bài viết".', 'info', { checkpointStep: 'composer_opened' })
    await V().humanReadPause()

    let actualPrivacy = await applyAudiencePrivacy(findComposerDialog() || dialog, requestedPrivacy, stepLog)
    if (actualPrivacy !== requestedPrivacy) {
      const targetName = requestedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
      const aiPriv = await V().askSelfHealingAI({
        platform: 'facebook', stepKey: `facebook:privacy_${requestedPrivacy}`,
        goal: `Tìm và bấm vào nút chọn đối tượng bài viết ngay dưới tên tác giả (hiện chữ "Công khai" hoặc "Bạn bè", TUYỆT ĐỐI KHÔNG bấm nút "Nhãn AI đang tắt") để đổi sang "${targetName}".`,
        root: findComposerDialog() || document,
        errorReason: `Chưa xác nhận được quyền riêng tư "${targetName}"`
      })
      if (aiPriv.ok && aiPriv.element) {
        await V().humanClick(aiPriv.element, { skipScroll: true })
        await V().humanDelay(750, 1200)
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
    await V().humanDelay(550, 950)

    dialog = findComposerDialog() || dialog
    if (!hasExistingMediaInDialog(dialog)) {
      stepLog('upload_image', 'Đang nạp ảnh vào khung "Tạo bài viết"...')
      const imageSnapshot = V().captureVisualImageSnapshot(dialog)
      const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-fb-product.png')
      let previewOk = false

      const existingInput = await M().findImageInput(dialog, 1500, false)
      if (existingInput && M().attachFile(existingInput, imageFile)) {
        previewOk = await M().waitFor(() => {
          const d = findComposerDialog() || dialog
          return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
        }, 12000, 320)
      }

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
        }, 12000, 320)
      }

      if (!previewOk) {
        const photoIcon = findPhotoToolbarButtonInDialog(dialog)
        if (photoIcon) { await V().humanClick(photoIcon, { skipScroll: true }); await V().sleep(700) }
        const lateInput = await M().findImageInput(dialog, 4500, false) || await M().findImageInput(document, 2500, false)
        if (lateInput && M().attachFile(lateInput, imageFile)) {
          previewOk = await M().waitFor(() => {
            const d = findComposerDialog() || dialog
            return Boolean(V().findNewlyRenderedMedia(imageSnapshot, { root: d, minTop: 80, minWidth: 70, minHeight: 70 }) || hasExistingMediaInDialog(d))
          }, 16000, 350)
        }
      }

      if (!previewOk) return { ok: false, error: 'FACEBOOK_IMAGE_PREVIEW_NOT_CONFIRMED', visionTrace: trace }
      stepLog('upload_image', 'Đã nạp ảnh vào bài viết.', 'info', { checkpointStep: 'image_uploaded' })
      await V().humanDelay(1000, 1750)
    }

    dialog = findComposerDialog()
    if (!dialog) return { ok: false, error: 'FACEBOOK_COMPOSER_CLOSED_UNEXPECTEDLY', visionTrace: trace }
    const editorBox = findComposerEditor(dialog)
    if (!editorBox) return { ok: false, error: 'FACEBOOK_EDITOR_NOT_FOUND', visionTrace: trace }

    if (!V().isTextMatched(V().readEditorValue(editorBox), fullText, COMPOSER_TEXT_RE)) {
      stepLog('fill_text', 'Đang điền nội dung & hashtag...')
      let typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
      if (!typeResult.ok) {
        await V().humanDelay(800, 1300)
        typeResult = await V().smartTypeText(editorBox, fullText, { clearFirst: true, placeholderRe: COMPOSER_TEXT_RE })
      }
      if (!typeResult.ok) return { ok: false, error: 'FACEBOOK_TEXT_NOT_INSERTED', visionTrace: trace }
    }
    stepLog('fill_text', 'Đã điền xong nội dung.', 'info', { checkpointStep: 'text_filled' })
    await V().humanReviewPause()

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
      await V().humanDelay(850, 1350)
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
    const deadline = Date.now() + 120000
    let notifiedSlowNet = false
    const textProbe = V().normalizeText(fullText).slice(0, Math.min(28, fullText.length))
    let dialogClosedAt = 0

    while (Date.now() < deadline) {
      const dlg = findComposerDialog()
      const isUploading = Boolean(
        dlg && (
          dlg.querySelector('[role="progressbar"], [aria-busy="true"]') ||
          /đang đăng|posting|uploading/i.test(V().normalizeText(dlg.innerText || '').slice(0, 260))
        )
      )
      if (isUploading || navigator.onLine === false) {
        if (!notifiedSlowNet) {
          notifiedSlowNet = true
          stepLog('verify', '⏳ Mạng đang chậm, đang chờ Facebook hoàn tất tải bài lên...')
        }
        await V().sleep(1200)
        continue
      }

      const secondaryBtn = V().queryAllDeep(document, '[role="dialog"] [role="button"], [role="dialog"] button').find((btn) =>
        V().isReallyVisible(btn) && /^(không phải bây giờ|not now|đăng ngay|post now)$/i.test(V().normalizeText(btn.innerText || btn.textContent))
      )
      if (secondaryBtn && !findComposerDialog()) { await V().humanClick(secondaryBtn, { skipScroll: true }); await V().humanDelay(600, 1000) }

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
        else if (Date.now() - dialogClosedAt >= 15000) {
          const fallbackPost = await findNewlyPublishedArticleWithHover('', existingPermalinks)
          const postUrl = fallbackPost?.url || `${location.origin}${location.pathname}?story_fbid=${Date.now()}`
          return {
            ok: true, verified: Boolean(fallbackPost?.url), postUrl, realPostId: fallbackPost?.id || `fb-${Date.now()}`,
            platform: 'facebook', publishedTime: new Date().toISOString(), privacy: actualPrivacy, author: authorName
          }
        }
      }
      await V().sleep(800)
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
        return txt.length > 0 && txt.length <= 50 &&
          /vừa xong|hôm qua|phút|giờ|ngày|tháng|lúc|yesterday|just now|min|hr|hrs|\d{1,2}:\d{2}|\b\d+[hdwm]\b/i.test(txt)
      }).slice(0, 4)

    for (const a of timeLinks) {
      try {
        a.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }))
        a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
        a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        a.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
      } catch (_) {}
    }
    if (timeLinks.length > 0) await V().sleep(360)
    const afterHover = readLinks()[0]
    if (afterHover) return afterHover

    // Dự phòng 2026: đọc link ảnh/album hoặc pfbid nhúng trong HTML thẻ bài viết
    const anyMediaLink = Array.from(articleEl.querySelectorAll('a[href]'))
      .map((a) => cleanFacebookUrl(a.href))
      .find((u) => /facebook\.com\/(photo|watch|reel|videos|story\.php|permalink|groups\/[^/]+\/posts|[^/]+\/posts\/)/i.test(u))
    if (anyMediaLink) return anyMediaLink

    const html = articleEl.innerHTML || ''
    const pfbid = html.match(/pfbid[0-9A-Za-z]{20,}/)?.[0]
    const authorHref = articleEl.querySelector('h2 a[href], h3 a[href], h4 a[href], strong a[href]')?.href || ''
    if (pfbid && authorHref) {
      const base = cleanFacebookUrl(authorHref).split('?')[0].replace(/\/+$/, '')
      return `${base}/posts/${pfbid}`
    }
    const fbid = html.match(/(?:story_fbid|top_level_post_id|post_id|mf_story_key)["':=\s]+(\d{8,22})/i)?.[1]
    if (fbid) return `https://www.facebook.com/permalink.php?story_fbid=${fbid}`
    return null
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
      const u = new URL(raw, location.origin)
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
      document.querySelectorAll('a[href*="/posts/"], a[href*="/share/"], a[href*="permalink"], a[href*="story_fbid"], a[href*="story.php"], a[href*="/reel/"], a[href*="/videos/"], a[href*="/photo"], a[href*="/watch/?v="]')
    ).map((link) => cleanFacebookUrl(link.href))
  }

  function isFacebookPostPermalink(value) {
    try {
      const url = new URL(value)
      if (!/(^|\.)facebook\.com$/i.test(url.hostname)) return false
      const p = url.pathname.toLowerCase()
      return (
        /\/posts\//.test(p) || /\/permalink\//.test(p) || /\/permalink\.php/.test(p) || /\/story\.php/.test(p) ||
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
  // CÀO BÀI VIRAL FACEBOOK: BÀI VIẾT (ĐÁY BÀI >= 1K) & THƯỚC PHIM REELS (CẠNH PHẢI >= 5K)
  // =========================================================================

  function extractHashtagsFromText(text) {
    const matches = String(text || '').match(/#[\p{L}\p{N}_]{2,40}/gu) || []
    return Array.from(new Set(matches)).slice(0, 6).join(' ')
  }

  function collectFeedArticleCards() {
    const raw = Array.from(document.querySelectorAll('div[role="article"], article, div[data-pagelet^="FeedUnit"], div[role="feed"] > div[aria-posinset], div[role="feed"] > div'))
    return raw.filter((el) => {
      if (el.closest('[role="dialog"], [role="navigation"], [role="banner"]')) return false
      if (el.getAttribute('aria-label') && /bình luận|comment/i.test(el.getAttribute('aria-label'))) return false
      const r = el.getBoundingClientRect()
      return r.width >= 320 && r.height >= 160
    })
  }

  // Quét rộng từ trên xuống dưới theo biểu tượng Like/Comment/Share (không cố định vị trí + KHÔNG BAO GIỜ đọc nhầm số tỷ!)
  function extractFeedPostMetrics2026(article) {
    let likes = 0, comments = 0, shares = 0
    const clamp = (v) => Math.min(200000000, Math.max(0, Number(v) || 0))

    // 1. Neo trực tiếp vào các nút/nhãn Thích, Bình luận, Chia sẻ từ trên xuống dưới (không giới hạn vị trí cố định)
    for (const el of article.querySelectorAll('[aria-label], [role="button"], button, span')) {
      if (el.closest('form, [role="textbox"], [contenteditable="true"]')) continue
      const aria = V().normalizeText(el.getAttribute('aria-label') || '')
      const txt = V().normalizeText(el.innerText || el.textContent || '')
      if (!aria && !txt) continue

      // Bỏ qua thời gian đăng (VD: "47m", "10 Tháng 2", "2 giờ")
      if (/^(?:\d+\s*(?:phút|giờ|ngày|tuần|tháng|năm|m|h|d|w)|\d{1,2}\s+tháng\s+\d{1,2})$/i.test(txt)) continue

      if (aria && !/lượt xem|views?/i.test(aria)) {
        if (/^(thích:|like:|bày tỏ cảm xúc|xem ai đã bày tỏ|tất cả cảm xúc)/i.test(aria) || /\bngười đã thích|\breactions?\b/i.test(aria)) {
          likes = Math.max(likes, V().parseHumanCount(aria), V().parseHumanCount(txt))
          continue
        }
        if (/^(thích|like|bỏ thích|unlike)$/i.test(aria)) {
          const near = V().normalizeText(`${txt} ${el.nextElementSibling?.innerText || ''}`)
          if (near.length <= 24 && !/lượt xem|views?/i.test(near)) likes = Math.max(likes, V().parseHumanCount(near))
          continue
        }
        if (/bình luận|comment/i.test(aria) && !/viết bình luận|write a comment/i.test(aria)) {
          const near = V().normalizeText(`${txt} ${el.nextElementSibling?.innerText || ''} ${aria}`)
          if (near.length <= 42) comments = Math.max(comments, V().parseHumanCount(near))
          continue
        }
        if (/chia sẻ|share/i.test(aria)) {
          const near = V().normalizeText(`${txt} ${el.nextElementSibling?.innerText || ''} ${aria}`)
          if (near.length <= 42) shares = Math.max(shares, V().parseHumanCount(near))
          continue
        }
      }

      if (/^\d+(?:[.,]\d+)?\s*(?:k|n|tr|triệu)?\s*(?:bình luận|comments?)$/i.test(txt)) {
        comments = Math.max(comments, V().parseHumanCount(txt))
      } else if (/^\d+(?:[.,]\d+)?\s*(?:k|n|tr|triệu)?\s*(?:lượt chia sẻ|chia sẻ|shares?)$/i.test(txt)) {
        shares = Math.max(shares, V().parseHumanCount(txt))
      }
    }

    // 2. Bắt thanh 3 số nằm ngang ở bất kỳ độ cao nào trong bài: [👍 957] [💬 34] [↗ 35]
    if (likes === 0 || comments === 0) {
      const nums = []
      for (const el of article.querySelectorAll('span, div')) {
        if (el.children.length > 0 || el.closest('form, [role="textbox"], [contenteditable="true"]')) continue
        const txt = V().normalizeText(el.innerText || el.textContent || '')
        if (!/^\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|tr|triệu)?$/i.test(txt)) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0 || r.height > 34 || r.width > 90) continue
        const val = V().parseHumanCount(txt)
        if (val > 0) nums.push({ val, x: r.left, y: Math.round(r.top) })
      }
      const bands = []
      for (const n of nums) {
        let band = bands.find((b) => Math.abs(b.y - n.y) <= 18)
        if (!band) { band = { y: n.y, items: [] }; bands.push(band) }
        if (!band.items.some((i) => Math.abs(i.x - n.x) <= 18)) band.items.push(n)
      }
      // Ưu tiên hàng có từ 2–3 con số đứng cạnh nhau nhất (Like · Comment · Share)
      bands.sort((a, b) => (b.items.length - a.items.length) || (b.y - a.y))
      const row = (bands[0]?.items || []).sort((a, b) => a.x - b.x)
      if (likes === 0 && row[0]) likes = row[0].val
      if (comments === 0 && row[1]) comments = row[1].val
      if (shares === 0 && row[2]) shares = row[2].val
    }

    // Chặn tuyệt đối lỗi bình luận lớn bất thường vượt quá lượt thích x 5 (trừ khi đã rõ nhãn)
    likes = clamp(likes)
    comments = clamp(comments)
    shares = clamp(shares)
    if (likes > 0 && comments > Math.max(500000, likes * 10)) comments = 0
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
        .filter((img) => img.naturalWidth >= 100 && img.naturalHeight >= 100 && !/emoji|static\.xx|rsrc\.php/i.test(img.src))
        .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))
      thumbnailUrl = imgs[0]?.src || article.querySelector('svg image')?.getAttribute('xlink:href') || ''
    }
    return { authorName, authorUrl, thumbnailUrl }
  }

  // Đọc chính xác cột dọc bên phải của Thước phim (Reels) Facebook: [👍 10,7K] [💬 96] [↗ 372]
  function extractActiveReelPost2026() {
    if (!/\/reel\/\d+/i.test(location.pathname)) return null
    const postUrl = cleanFacebookUrl(location.href)
    let likes = 0, comments = 0, shares = 0

    const buttons = Array.from(document.querySelectorAll('[role="button"], button')).filter((b) => {
      if (!V().isReallyVisible(b, { minWidth: 20, minHeight: 20 })) return false
      const r = b.getBoundingClientRect()
      return r.top > 90 && r.bottom < window.innerHeight - 10 && r.left > window.innerWidth * 0.45 && r.right <= window.innerWidth
    })

    for (const btn of buttons) {
      const aria = V().normalizeText(btn.getAttribute('aria-label') || '')
      const nearText = V().normalizeText(`${btn.innerText || ''} ${btn.nextElementSibling?.innerText || ''} ${btn.parentElement?.innerText || ''}`)
      if (/thích|like/i.test(aria) && nearText.length <= 36) likes = Math.max(likes, V().parseHumanCount(nearText))
      else if (/bình luận|comment/i.test(aria) && nearText.length <= 36) comments = Math.max(comments, V().parseHumanCount(nearText))
      else if (/chia sẻ|share/i.test(aria) && nearText.length <= 36) shares = Math.max(shares, V().parseHumanCount(nearText))
    }

    if (likes === 0 || comments === 0) {
      const rightNumbers = Array.from(document.querySelectorAll('span, div'))
        .filter((el) => {
          if (el.children.length > 0 || !V().isReallyVisible(el)) return false
          const r = el.getBoundingClientRect()
          return r.left > window.innerWidth * 0.85 && r.top > window.innerHeight * 0.35 && /^\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?$/i.test(V().normalizeText(el.innerText || ''))
        })
        .map((el) => ({ val: V().parseHumanCount(el.innerText), top: el.getBoundingClientRect().top }))
        .sort((a, b) => a.top - b.top)
      if (likes === 0 && rightNumbers[0]) likes = rightNumbers[0].val
      if (comments === 0 && rightNumbers[1]) comments = rightNumbers[1].val
      if (shares === 0 && rightNumbers[2]) shares = rightNumbers[2].val
    }

    const bottomTexts = Array.from(document.querySelectorAll('span, a, div[dir="auto"]'))
      .filter((el) => {
        if (!V().isReallyVisible(el)) return false
        const r = el.getBoundingClientRect()
        return r.top > window.innerHeight * 0.62 && r.bottom <= window.innerHeight && r.left > 100 && r.right < window.innerWidth * 0.86
      })
      .map((el) => V().normalizeText(el.innerText || el.textContent))
      .filter((t) => t.length >= 4 && t.length <= 260 && !/^(theo dõi|đang theo dõi|follow|following|âm thanh gốc|xem thêm|see more)$/i.test(t))

    const bestCaption = bottomTexts.sort((a, b) => b.length - a.length)[0] || ''
    const authorLink = Array.from(document.querySelectorAll('a[href]')).find((a) => {
      if (!V().isReallyVisible(a)) return false
      const r = a.getBoundingClientRect()
      return r.top > window.innerHeight * 0.65 && r.left > 100 && r.right < window.innerWidth * 0.6 && V().normalizeText(a.innerText).length >= 2
    })
    const videoPoster = document.querySelector('video[poster]')?.getAttribute('poster') || document.querySelector('div[role="main"] img[src]')?.src || ''
    return {
      postUrl, likes, comments, shares,
      caption: bestCaption || `Thước phim Facebook #${extractFacebookPostId(postUrl) || Date.now()}`,
      authorName: V().normalizeText(authorLink?.innerText || ''),
      authorUrl: authorLink?.href ? cleanFacebookUrl(authorLink.href) : '',
      thumbnailUrl: videoPoster
    }
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
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 650, bubbles: true }))
    }
    await M().waitFor(() => cleanFacebookUrl(location.href) !== prevUrl, 6000, 280)
    await V().humanScrollPause()
  }

  async function scrapeFacebookViralPosts(options = {}) {
    scrapeAborted = false
    const targetCount = Number(options.targetCount) || 10
    const sourceKind = options.sourceKind || (/\/(reel|watch|search\/videos)/i.test(location.pathname) ? 'reels' : 'feed')
    const minLikes = Number(options.minLikes) || (sourceKind === 'reels' ? 5000 : 1000)
    const minRoundsOnPage = Number(options.minRoundsOnPage) || 12
    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 28
    const perSourceMaxMs = Number(options.perSourceMaxMs) || 150000
    const strictDurationMs = Number(options.strictDurationMs) || 0
    const idleTimeoutMs = Number(options.idleTimeoutMs) || 3 * 60 * 1000
    let lastFoundAt = Number(options.lastFoundAt) || Date.now()
    const startedAt = Date.now()
    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0
    const topicLabel = options.topicLabel || ''
    const sourceTag = sourceKind === 'reels' ? 'Thước phim (Reels)' : 'Bài viết'

    const seenUrls = new Set((options.excludeUrls || []).map((u) => cleanFacebookUrl(u).toLowerCase()))
    const seenFingerprints = new Set()

    const stable = await V().waitForPageStable('facebook', { maxWaitMs: 22000 })
    if (!stable.ok) return { ok: false, error: `FACEBOOK_${stable.reason}`, posts: [], lastFoundAt }
    if (isLoginOrCheckpointScreen()) return { ok: false, error: 'FACEBOOK_LOGIN_REQUIRED', posts: [], lastFoundAt }

    const collected = []
    let visionAssistCalled = false

    // Chế độ Reels trực tiếp (/reel/...)
    if (/\/reel\b/i.test(location.pathname)) {
      let stuckCount = 0
      for (let round = 0; round < maxRoundsOnPage; round++) {
        if (scrapeAborted) break
        if (!strictDurationMs && collected.length >= targetCount) break
        if (strictDurationMs && Date.now() - startedAt >= strictDurationMs) break
        if (Date.now() - startedAt >= perSourceMaxMs) break
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
            const hashtags = extractHashtagsFromText(reel.caption)
            const itemObj = {
              id: `fb-reel-${Date.now()}-${collected.length}`,
              title: V().truncateClean(reel.caption, 115),
              platform: 'facebook',
              category: topicLabel || 'Thước phim (Reels)',
              postUrl: reel.postUrl,
              summary: V().truncateClean(`${reel.caption} • ${reel.likes.toLocaleString('vi-VN')} thích • ${reel.comments} bình luận`, 250),
              viralityScore: Math.min(99, 86 + Math.min(13, Math.floor(Math.log10(Math.max(10, reel.likes)) * 3))),
              likesCount: reel.likes, sharesCount: reel.shares, commentsCount: reel.comments,
              trendingTopic: hashtags ? `Thước phim (Reels) • ${hashtags}` : `Thước phim (Reels) • ${(reel.likes / 1000).toFixed(1)}K+ thích`,
              thumbnailUrl: reel.thumbnailUrl || '',
              authorName: reel.authorName || '',
              authorUrl: reel.authorUrl || '',
              createdAt: new Date().toISOString()
            }
            collected.push(itemObj)
            chrome.runtime.sendMessage({ type: 'LIVE_VIRAL_POST', platform: 'facebook', sourceLabel: sourceTag, post: itemObj }, () => { void chrome.runtime.lastError })
            V().reportStep('facebook', 'scrape_viral', `FB Reels: ${totalAlreadyFound + collected.length} bài (👍 ${reel.likes.toLocaleString('vi-VN')} · 💬 ${reel.comments})`)
          }
        }
        if (!strictDurationMs && collected.length >= targetCount) break
        await advanceToNextFacebookReel(curUrl)
        if (cleanFacebookUrl(location.href) === curUrl) {
          stuckCount++
          if (stuckCount >= 3) break
        } else stuckCount = 0
      }
      V().clearHud(2500)
      return { ok: true, posts: collected, timedOut: false, lastFoundAt }
    }

    // Chế độ Bài viết / Tìm kiếm Facebook (kiên trì cuộn 12–28 lần khi mạng chậm!)
    let stagnantScrolls = 0, lastScrollHeight = 0
    for (let round = 0; round < maxRoundsOnPage; round++) {
      if (scrapeAborted) break
      if (!strictDurationMs && collected.length >= targetCount) break
      if (strictDurationMs && Date.now() - startedAt >= strictDurationMs) break
      if (Date.now() - startedAt >= perSourceMaxMs) break
      if (Date.now() - lastFoundAt >= idleTimeoutMs) return { ok: true, posts: collected, timedOut: true, lastFoundAt }

      if (V().inspectPageHealth().isOffline) await V().waitForPageStable('facebook', { maxWaitMs: 25000 })

      const cards = collectFeedArticleCards()
      for (const article of cards) {
        if (!strictDurationMs && collected.length >= targetCount) break
        try {
          const metrics = extractFeedPostMetrics2026(article)
          if (metrics.likes < minLikes) continue

          if (scrapeAborted) break
          // Cuộn bài viết vào giữa tầm nhìn để Facebook nạp đầy đủ ảnh gốc & permalink khi mạng chậm
          try { article.scrollIntoView({ behavior: 'auto', block: 'center' }) } catch (_) {}
          await V().sleep(V().randomGaussianBetween(500, 950))
          await M().waitFor(() => {
            const imgs = Array.from(article.querySelectorAll('img[src]')).filter((i) => !/emoji|static\.xx|rsrc\.php/i.test(i.src))
            return Boolean(article.querySelector('video[poster]') || imgs.some((i) => i.complete && i.naturalWidth >= 100))
          }, 3500, 300)

          const postUrl = await hoverAndExtractPostPermalink(article)
          if (!postUrl || !isFacebookPostPermalink(postUrl)) continue
          const urlKey = cleanFacebookUrl(postUrl).toLowerCase()
          if (seenUrls.has(urlKey)) continue

          const msgEl = article.querySelector('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]') ||
            Array.from(article.querySelectorAll('div[dir="auto"]')).find((d) => V().normalizeText(d.innerText).length >= 8)
          const rawText = V().normalizeText(msgEl?.innerText || msgEl?.textContent || '')
          const isVideoOrReel = Boolean(article.querySelector('video')) || /\/(reel|videos|watch)\//i.test(postUrl)
          const actualKindTag = isVideoOrReel ? 'Thước phim (Reels)' : 'Bài viết'
          const { authorName, authorUrl, thumbnailUrl } = extractArticleMediaAndAuthor(article)
          const hashtags = extractHashtagsFromText(rawText)

          const summaryText = rawText || `[${actualKindTag}] ${authorName || 'Bài Viral Facebook'} đạt ${metrics.likes.toLocaleString('vi-VN')} thích.`
          const fp = `${V().stripToMatchKey(summaryText).slice(0, 44)}|${metrics.likes}`
          if (seenFingerprints.has(fp)) continue

          seenUrls.add(urlKey)
          seenFingerprints.add(fp)
          lastFoundAt = Date.now()
          const itemObj = {
            id: `fb-${sourceKind}-${Date.now()}-${collected.length}`,
            title: V().truncateClean(rawText || `[${actualKindTag}] ${authorName || 'Bài Viral Facebook'}`, 115),
            platform: 'facebook',
            category: topicLabel || actualKindTag,
            postUrl,
            summary: V().truncateClean(`${authorName ? `[${authorName}] ` : ''}${summaryText}`, 250),
            viralityScore: Math.min(99, 85 + Math.min(14, Math.floor(Math.log10(Math.max(10, metrics.likes)) * 3))),
            likesCount: metrics.likes, sharesCount: metrics.shares, commentsCount: metrics.comments,
            trendingTopic: hashtags ? `${actualKindTag} • ${hashtags}` : `${actualKindTag} • ${(metrics.likes / 1000).toFixed(1)}K+ thích`,
            thumbnailUrl: thumbnailUrl || '',
            authorName: authorName || '',
            authorUrl: authorUrl || '',
            createdAt: new Date().toISOString()
          }
          collected.push(itemObj)
          chrome.runtime.sendMessage({ type: 'LIVE_VIRAL_POST', platform: 'facebook', sourceLabel: sourceTag, post: itemObj }, () => { void chrome.runtime.lastError })
          V().reportStep('facebook', 'scrape_viral', `FB ${sourceTag}: ${totalAlreadyFound + collected.length} bài (👍 ${metrics.likes.toLocaleString('vi-VN')} · 💬 ${metrics.comments})`)
        } catch (_) {}
      }

      if (!strictDurationMs && collected.length >= targetCount) break

      // Nếu đã cuộn 5 lượt mà vẫn 0 bài -> nhờ Mắt Vision qwen3.5:4b kiểm tra có popup che hoặc cần bấm lọc không!
      if (round === 5 && collected.length === 0 && !visionAssistCalled) {
        visionAssistCalled = true
        const aiHelp = await V().askSelfHealingAI({
          platform: 'facebook', stepKey: 'facebook:viral_scrape_rescue',
          goal: 'Trang tìm kiếm hoặc bảng tin Facebook đang cào bài Viral nhưng chưa lấy được bài. Kiểm tra xem có popup che cần đóng (dismiss_popup) hoặc nút Bài viết cần bấm (click_mark) hay chỉ cần cuộn tiếp (scroll_down).',
          errorReason: 'Đã cuộn 5 lần trên Facebook nhưng chưa đọc được bài viết nào >= ngưỡng like'
        })
        if (aiHelp.ok && aiHelp.action === 'dismiss_popup') {
          if (aiHelp.element) await V().humanClick(aiHelp.element, { skipScroll: true })
          else V().dispatchEscape()
        } else if (aiHelp.ok && aiHelp.action === 'click_mark' && aiHelp.element) {
          await V().humanClick(aiHelp.element, { skipScroll: true })
          await V().humanDelay(1600, 2600)
        }
      }

      const beforeH = document.documentElement.scrollHeight
      await V().scrollPageDownForFeed(1100)
      await V().humanScrollPause()

      // Chờ mạng chậm tải thêm nội dung tối đa 5s trước khi tính là đứng trang
      await M().waitFor(() => document.documentElement.scrollHeight > beforeH, 5000, 450)
      const afterH = document.documentElement.scrollHeight
      if (afterH <= lastScrollHeight) stagnantScrolls++
      else { stagnantScrolls = 0; lastScrollHeight = afterH }

      if (!strictDurationMs && round >= minRoundsOnPage && stagnantScrolls >= 6) break
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

    for (let round = 0; round < 14 && groups.length < targetCount; round++) {
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
      await V().scrollPageDownForFeed(950)
      await V().humanScrollPause()
    }
    V().clearHud(2500)
    return { ok: true, groups }
  }

  async function watchFacebookItem(options = {}) {
    const watchedMs = await V().humanWatchPause(Number(options.dwellSeconds) || 8)
    if (options.advanceNext !== false) {
      if (/\/reel\//i.test(location.pathname)) await advanceToNextFacebookReel(cleanFacebookUrl(location.href))
      else await V().scrollPageDownForFeed(880)
    }
    return { ok: true, watchedMs }
  }

  async function scrapeFacebookPostComments(options = {}) {
    const maxComments = Number(options.maxComments) || 40
    const comments = []
    const seen = new Set()
    const postTitle = V().truncateClean(document.querySelector('h1, div[data-ad-preview="message"]')?.innerText || document.title, 120)

    for (let round = 0; round < 12 && comments.length < maxComments; round++) {
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
        comments.push({ author, text, likes: likeMatch ? V().parseHumanCount(likeMatch[1]) : 0 })
      }
      const moreBtn = Array.from(document.querySelectorAll('[role="button"], span')).find((b) =>
        V().isReallyVisible(b) && /xem thêm bình luận|view more comments/i.test(V().normalizeText(b.innerText))
      )
      if (moreBtn) await V().humanClick(moreBtn)
      else await V().scrollPageDownForFeed(700)
      await V().humanDelay(1200, 2200)
    }
    return { ok: true, postTitle, comments }
  }

  async function scrapeFacebookChannelInfo(options = {}) {
    await V().humanDelay(900, 1500)
    const channelName = V().normalizeText(document.querySelector('h1')?.innerText || document.title)
    const bio = V().normalizeText(document.body?.innerText || '').slice(0, 600)
    const followersMatch = bio.match(/(\d+(?:[.,]\d+)?\s*(?:k|n|nghìn|m|tr|triệu)?)\s*(?:người theo dõi|followers?)/i)
    const followersCount = followersMatch ? V().parseHumanCount(followersMatch[1]) : 0
    const sampleTitles = Array.from(document.querySelectorAll('div[role="article"] div[dir="auto"]'))
      .map((el) => V().normalizeText(el.innerText)).filter((t) => t.length >= 12 && t.length <= 160).slice(0, 10)
    const avatarUrl = document.querySelector('svg image')?.getAttribute('xlink:href') || ''
    return {
      ok: true,
      channel: {
        platform: 'facebook', channelUrl: options.channelUrl || location.href, channelName,
        handle: location.pathname.replace(/^\/+|\/+$/g, ''), bio: bio.slice(0, 260),
        avatarUrl, followersCount, totalLikesCount: 0, sampleTitles
      }
    }
  }

  async function surfOneFacebookStep(options = {}) {
    scrapeAborted = false
    const minLikes = Number(options.minLikes) || 300
    const seenUrls = new Set((options.excludeUrls || []).map((u) => cleanFacebookUrl(u).toLowerCase()))
    const found = []

    if (/\/reel\b/i.test(location.pathname)) {
      const curUrl = cleanFacebookUrl(location.href)
      const reel = extractActiveReelPost2026()
      if (reel && reel.likes >= minLikes && !seenUrls.has(reel.postUrl.toLowerCase())) {
        found.push({
          id: `fb-surf-${Date.now()}`, title: V().truncateClean(reel.caption, 115), platform: 'facebook',
          category: options.topicLabel || 'Thước phim (Reels)', postUrl: reel.postUrl,
          summary: V().truncateClean(reel.caption, 220), likesCount: reel.likes, commentsCount: reel.comments, sharesCount: reel.shares,
          trendingTopic: extractHashtagsFromText(reel.caption) || 'Thước phim (Reels)',
          thumbnailUrl: reel.thumbnailUrl || '', authorName: reel.authorName || '', authorUrl: reel.authorUrl || '', createdAt: new Date().toISOString()
        })
      }
      await advanceToNextFacebookReel(curUrl)
      return { ok: true, posts: found }
    }

    for (const article of collectFeedArticleCards()) {
      const metrics = extractFeedPostMetrics2026(article)
      if (metrics.likes < minLikes) continue
      const postUrl = await hoverAndExtractPostPermalink(article)
      if (!postUrl || seenUrls.has(cleanFacebookUrl(postUrl).toLowerCase())) continue
      seenUrls.add(cleanFacebookUrl(postUrl).toLowerCase())
      const msgEl = article.querySelector('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]') ||
        Array.from(article.querySelectorAll('div[dir="auto"]')).find((d) => V().normalizeText(d.innerText).length >= 8)
      const rawText = V().normalizeText(msgEl?.innerText || '')
      const { authorName, authorUrl, thumbnailUrl } = extractArticleMediaAndAuthor(article)
      found.push({
        id: `fb-surf-${Date.now()}-${found.length}`, title: V().truncateClean(rawText || authorName || 'Bài Facebook', 115),
        platform: 'facebook', category: options.topicLabel || 'Trang chủ', postUrl,
        summary: V().truncateClean(rawText || authorName, 220), likesCount: metrics.likes, commentsCount: metrics.comments, sharesCount: metrics.shares,
        trendingTopic: extractHashtagsFromText(rawText) || 'Trang chủ',
        thumbnailUrl: thumbnailUrl || '', authorName: authorName || '', authorUrl: authorUrl || '', createdAt: new Date().toISOString()
      })
    }
    await V().scrollPageDownForFeed(980)
    return { ok: true, posts: found }
  }
})()
