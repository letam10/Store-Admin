/*
  FILE NOTE
  - Mục đích: Content Script OmniVision v3.3.0 cho TikTok Studio & TikTok Web 2026 (Chạy ngầm tab + Checkpoint nhớ bước + sửa triệt để chọn Đối tượng + cuộn sâu Tìm kiếm đa từ khóa).
  - Liên kết trực tiếp: vision-engine.js, background.js, content-admin-bridge.js
  - Vùng ảnh hưởng khi sửa: Luồng tự động tải video, chọn quyền riêng tư TikTok Studio và cào video viral TikTok.
*/

;(() => {
  if (typeof window.__OMNICART_TT_CLEANUP__ === 'function') {
    try { window.__OMNICART_TT_CLEANUP__() } catch (_) {}
  }

  const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload'
  const PUBLIC_RE = /^(mọi người|công khai|everyone|public)$/i
  const ONLY_ME_RE = /^(chỉ mình bạn|chỉ mình tôi|chỉ bạn|only you|only me|private)$/i
  const PUBLIC_LOOSE_RE = /mọi người|công khai|everyone|public/i
  const ONLY_ME_LOOSE_RE = /chỉ mình bạn|chỉ mình tôi|chỉ bạn|only you|only me|private/i
  const PRIVACY_LABEL_RE = /người có thể nhìn thấy|ai có thể xem|who can (watch|view|see)|quyền riêng tư|privacy/i
  const DESC_PLACEHOLDER_RE = /mô tả dài có thể giúp|mô tả dài|longer descriptions can help|share more about your|describe your|thêm mô tả/i
  const PENDING_REVIEW_RE = /nội dung đang được xét duyệt|đang được xét duyệt|đang xét duyệt|đang xem xét|under review|being reviewed|in review|đang xử lý|processing|đang kiểm tra/i
  const REJECTED_REVIEW_RE = /bị từ chối|từ chối duyệt|không được duyệt|không được phê duyệt|không đủ điều kiện|vi phạm|nguyên tắc cộng đồng|bị xóa|đã xóa|bị tắt tiếng|removed|rejected|violation|community guidelines|ineligible|not eligible/i

  const V = () => globalThis.OmniVision
  const M = () => globalThis.OmniCartMedia

  const handleMessage = (message, sender, sendResponse) => {
    if (!message?.type) return false
    if (message.type === 'VISION_SET_CONFIG' || message.type === 'VISION_SET_HUD') {
      V()?.applyConfig(message.config || { showHud: message.enabled })
      sendResponse({ ok: true })
      return false
    }
    if (message.type === 'TIKTOK_INSPECT_VISION') { sendResponse(inspectTikTokScreen()); return false }
    if (message.type === 'TIKTOK_EXECUTE_POST') {
      executeTikTokPost(message.payload, message.checkpoint || {})
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

  function isUploadPath() { return /^\/(tiktokstudio\/upload|creator-center\/upload|upload)\/?$/i.test(location.pathname) }
  function isTikTokStudioPage() { return /^\/(tiktokstudio|creator-center)/i.test(location.pathname) }

  function detectCurrentTikTokHandle() {
    const pathMatch = location.pathname.match(/^\/(@[A-Za-z0-9._-]+)/)
    if (pathMatch) return pathMatch[1]
    const profileLinks = Array.from(document.querySelectorAll('a[href*="/@"]'))
      .map((a) => String(a.getAttribute('href') || a.href || '').match(/\/(@[A-Za-z0-9._-]+)/)?.[1] || null)
      .filter(Boolean)
    return profileLinks[0] || null
  }

  function isAccountLoggedIn() {
    const topRightAvatars = V().queryAllDeep(document, 'img, [data-e2e="nav-avatar"], [data-e2e="profile-icon"]')
      .filter((el) => V().isReallyVisible(el, { minWidth: 20, minHeight: 20 }) && el.getBoundingClientRect().top < 90 && el.getBoundingClientRect().left > window.innerWidth * 0.65)
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

  async function dismissStaleDraftBanners2026() {
    for (let i = 0; i < 3; i++) {
      const topDiscard = V().queryAllDeep(document, 'button, [role="button"]').find((btn) => {
        if (!V().isReallyVisible(btn, { minWidth: 40, minHeight: 20 })) return false
        const r = btn.getBoundingClientRect()
        if (r.top > 300 || r.left < 180) return false
        const txt = V().normalizeText(btn.innerText || btn.textContent)
        if (!/^(hủy bỏ|bỏ qua|discard|xóa bỏ)$/i.test(txt)) return false
        const barTxt = V().normalizeText(btn.parentElement?.parentElement?.innerText || '')
        return /chưa được lưu|wasn't saved|bản nháp|draft|editing/i.test(barTxt)
      })
      if (!topDiscard) break
      await V().humanClick(topDiscard, { skipScroll: true })
      await V().humanDelay(500, 850)
      const modalConfirm = V().queryAllDeep(document, '[role="dialog"] button, [class*="modal"] button').find((b) => {
        if (!V().isReallyVisible(b)) return false
        return b.getBoundingClientRect().top > 200 && /^(hủy bỏ|discard|xác nhận|confirm)$/i.test(V().normalizeText(b.innerText || b.textContent))
      })
      if (modalConfirm) {
        await V().humanClick(modalConfirm, { skipScroll: true })
        await V().humanDelay(550, 950)
      }
    }
  }

  async function clickStudioSidebarUploadPhoto(stepLog) {
    const uploadBtn = V().queryAllDeep(document, 'button, [role="button"], a').find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 70, minHeight: 28 })) return false
      const r = el.getBoundingClientRect()
      return r.left <= 240 && r.top <= 180 && /^(\+?\s*tải lên|\+?\s*upload)$/i.test(V().normalizeText(el.innerText || el.textContent))
    })
    if (!uploadBtn) return false
    stepLog('nav', 'Đang bấm "+ Tải lên" -> "Ảnh" trên TikTok Studio...')
    await V().humanClick(uploadBtn, { skipScroll: true })
    await V().humanDelay(480, 850)
    const photoOption = V().queryAllDeep(document, '[role="menuitem"], [role="option"], button, a, div, span').find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 30, minHeight: 18 })) return false
      const r = el.getBoundingClientRect()
      return r.left <= 260 && r.top >= 80 && r.top <= 340 && /^(ảnh|photo|photos)$/i.test(V().normalizeText(el.innerText || el.textContent))
    })
    if (photoOption) await V().humanClick(photoOption, { skipScroll: true })
    await M().waitFor(() => isUploadPath() || detectScreenState() === 'upload_photo_tab' || detectScreenState() === 'upload_video_tab', 10000)
    await V().humanDelay(750, 1250)
    return isUploadPath()
  }

  async function clickStudioSidebarTab(targetRe) {
    const navBtn = V().queryAllDeep(document, 'a, button, [role="button"], div, span').find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 20 })) return false
      const r = el.getBoundingClientRect()
      return r.left <= 220 && r.top >= 110 && r.top <= 340 && targetRe.test(V().normalizeText(el.innerText || el.textContent))
    })
    if (!navBtn) return false
    await V().humanClick(navBtn, { skipScroll: true })
    await V().humanDelay(1000, 1600)
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
      const score = 50 + (r.left > 180 ? 30 : 0) + ((el.getAttribute('role') === 'tab' || el.tagName === 'BUTTON') ? 20 : 0)
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

  function findDescriptionPlaceholder() { return V().findLabelElement(DESC_PLACEHOLDER_RE, { minLeft: 180, minTop: 80, maxLength: 160 }) }
  function findDescriptionFooterAnchor() {
    return V().findLabelElement(/^\d+\s*\/\s*4000$/i, { minLeft: 180, maxLength: 20 }) ||
      V().findLabelElement(/^#\s*hashtag$/i, { minLeft: 180, maxLength: 24 })
  }

  function findDescriptionEditorPassive() {
    const titleEl = findTitleInput()
    const direct2026 = V().queryAllDeep(document, 'div[contenteditable="true"][role="combobox"]')
      .find((el) => el !== titleEl && !titleEl?.contains(el) && V().isReallyVisible(el, { minWidth: 20, minHeight: 10 }) && el.getBoundingClientRect().left >= 160)
    if (direct2026) return direct2026

    const footerRect = findDescriptionFooterAnchor()?.getBoundingClientRect() || null
    const titleRect = titleEl?.getBoundingClientRect() || null
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

  async function findAndFocusDescriptionEditor() {
    const titleEl = findTitleInput()
    let editor = findDescriptionEditorPassive()
    if (editor) return editor
    const ph = findDescriptionPlaceholder()
    if (ph) {
      await V().humanClick(ph)
      await V().humanDelay(320, 560)
      const active = V().getDeepActiveElement()
      if (active && active !== titleEl && !titleEl?.contains(active) && (active.isContentEditable || active.tagName === 'TEXTAREA' || active.getAttribute('role') === 'textbox' || active.getAttribute('role') === 'combobox')) return active
      editor = findDescriptionEditorPassive()
      if (editor) return editor
    }
    const footerEl = findDescriptionFooterAnchor()
    if (footerEl) {
      const fRect = footerEl.getBoundingClientRect()
      const hit = document.elementFromPoint(Math.round(fRect.left + 60), Math.round(Math.max(100, fRect.top - 48)))
      if (hit && hit !== titleEl && !titleEl?.contains(hit)) {
        await V().humanClick(hit)
        await V().humanDelay(300, 520)
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
      const nearby = V().findControlNearLabel(label, 'button, [role="combobox"], [role="button"], select, div[class*="select"], div[class*="Select"]', { direction: 'below', maxVertical: 110, maxHorizontal: 280 })
      if (nearby) return nearby
    }
    return V().queryAllDeep(document, 'select, button, [role="combobox"], [role="button"], div[class*="select"], div[class*="Select"]').find((el) => {
      if (!V().isReallyVisible(el, { minWidth: 80, minHeight: 24 })) return false
      const r = el.getBoundingClientRect()
      if (r.left < 180 || r.top < 140) return false
      const txt = V().normalizeText(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`)
      return txt.length <= 45 && /^(mọi người|công khai|bạn bè|chỉ mình bạn|chỉ mình tôi|chỉ bạn|everyone|friends|only you|only me|private)$/i.test(txt)
    }) || null
  }

  function parsePrivacyValue(text) {
    const clean = V().normalizeText(text)
    if (ONLY_ME_LOOSE_RE.test(clean)) return 'only_me'
    if (PUBLIC_LOOSE_RE.test(clean)) return 'public'
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
      url: location.href, health: V().inspectPageHealth(), screenState: detectScreenState(),
      loggedIn: isAccountLoggedIn(), accountHandle: detectCurrentTikTokHandle() || 'Tài khoản TikTok',
      titleCounter: readTitleCounter(), descriptionCounter: readDescriptionCounter(),
      privacyControlText: V().normalizeText(findPrivacyControl()?.innerText || findPrivacyControl()?.value || ''),
      publishButtonEnabled: Boolean(findPublishButton() && !V().isElementDisabled(findPublishButton()))
    }
  }

  async function executeTikTokPost(payload, checkpoint = {}) {
    const trace = []
    const stepLog = (step, msg, level = 'info', extra = {}) => {
      trace.push({ step, msg, level, ts: Date.now() })
      V().reportStep('tiktok', step, msg, level, extra)
    }

    if (!/(^|\.)tiktok\.com$/i.test(location.hostname)) return { ok: false, error: 'TIKTOK_HOST_INVALID', visionTrace: trace }
    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 25000, onStatus: stepLog })
    if (!stable.ok) return { ok: false, error: `TIKTOK_${stable.reason}`, visionTrace: trace }

    const readyAuth = await M().waitFor(() => isAccountLoggedIn() || isLoginRequired(), 15000)
    if (!readyAuth || isLoginRequired()) return { ok: false, error: 'TIKTOK_LOGIN_REQUIRED', visionTrace: trace }

    const requestedPrivacy = String(payload?.privacy || 'only_me').toLowerCase()
    const rawTitle = V().normalizeText(payload.title || '')
    const rawBody = payload.content || payload.description || payload.caption || payload.body || ''
    const rawHashtags = payload.hashtags || payload.tags || ''
    const shortTitle = V().truncateClean(rawTitle || V().formatPostText(rawBody, 200).split('\n')[0] || 'Ưu đãi OmniCart', 85)

    // CHECKPOINT: Nếu trước đó ĐÃ BẤM ĐĂNG rồi mới tải lại/chuyển trang -> chuyển sang chờ xét duyệt thay vì đăng lại!
    if (checkpoint.verifyOnly) {
      stepLog('verify', 'Phục hồi từ Checkpoint sau bước Đăng TikTok — chuyển sang theo dõi xét duyệt...')
      return {
        ok: true, pendingReview: true, status: 'pending_review', platform: 'tiktok',
        account: detectCurrentTikTokHandle() || '', privacy: requestedPrivacy,
        titleProbe: shortTitle.slice(0, 40), submittedAt: new Date().toISOString(),
        message: 'Đang chờ TikTok xét duyệt (~2–3 phút).', visionTrace: trace
      }
    }

    if (!isUploadPath()) {
      if (isTikTokStudioPage()) {
        if (!await clickStudioSidebarUploadPhoto(stepLog)) return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      } else {
        return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      }
    }

    if (!['only_me', 'public'].includes(requestedPrivacy)) return { ok: false, error: 'INVALID_PRIVACY', visionTrace: trace }
    if (!payload?.imageDataUrl) return { ok: false, error: 'PRODUCT_IMAGE_REQUIRED', visionTrace: trace }

    let fullDescription = V().composeBodyAndHashtags(rawBody || rawTitle, rawHashtags, 3850)
    if (!fullDescription) return { ok: false, error: 'POST_TEXT_REQUIRED', visionTrace: trace }
    if (/#[\p{L}\p{N}_]+$/u.test(fullDescription)) fullDescription += ' '

    await V().humanDelay(550, 950)
    await dismissStaleDraftBanners2026()
    await M().waitFor(() => detectScreenState() !== 'loading_or_unknown', 12000)
    let state = detectScreenState()

    const alreadyUploadedOwnImage = (checkpoint.completedSteps || []).includes('image_uploaded')

    // Chỉ xóa bản nháp cũ nếu KHÔNG phải bài hiện tại đang chạy dở!
    if (state === 'detail_editor_form' && !alreadyUploadedOwnImage) {
      await V().scrollContainerToBottom(findDescriptionFooterAnchor() || findTitleInput())
      const discardBtn = findDiscardButton()
      if (discardBtn) {
        await V().humanClick(discardBtn)
        await V().humanDelay(600, 1000)
        const confirmDiscard = V().queryAllDeep(document, '[role="dialog"] button, [class*="modal"] button').find((b) =>
          V().isReallyVisible(b) && /^(hủy bỏ|hủy|discard|xác nhận|confirm)$/i.test(V().normalizeText(b.innerText || b.textContent))
        )
        if (confirmDiscard) {
          await V().humanClick(confirmDiscard, { skipScroll: true })
          await M().waitFor(() => detectScreenState() !== 'detail_editor_form', 8000)
        }
        await V().humanDelay(700, 1150)
      }
      state = detectScreenState()
    }

    if (state !== 'detail_editor_form') {
      if (state === 'upload_video_tab' || state === 'loading_or_unknown') {
        const photoTab = findPhotoTabButton()
        if (photoTab) {
          stepLog('switch_tab', 'Chuyển sang tab Ảnh...')
          await V().humanClick(photoTab)
          await M().waitFor(() => detectScreenState() === 'upload_photo_tab' || Boolean(M().findImageInput(document, 200, false)), 8000)
          await V().humanDelay(500, 900)
        }
      }

      stepLog('upload_image', 'Đang tải ảnh lên TikTok Studio...')
      const imageSnapshot = V().captureVisualImageSnapshot(document)
      const imageFile = await M().createProductImageFile(payload.imageDataUrl, 'omnicart-tiktok-product.png')
      const imageInput = await M().findImageInput(document, 6000, false)
      let attached = imageInput ? M().attachFile(imageInput, imageFile) : false
      if (!attached) {
        const dropzone = findPhotoDropzoneElement()
        if (dropzone) attached = M().attachViaDrop(dropzone, imageFile)
      }
      if (!attached) return { ok: false, error: 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE', visionTrace: trace }

      const detailFormReady = await M().waitFor(() => {
        if (!findTitleInput() && !findDescriptionPlaceholder() && !findDescriptionEditorPassive()) return false
        return Boolean(
          V().findNewlyRenderedMedia(imageSnapshot, { root: document, minTop: 110, minWidth: 55, minHeight: 55 }) ||
          V().findLabelElement(/ảnh bìa|đã tải lên \d+ ảnh|uploaded \d+ photo|cover/i, { minLeft: 180, maxLength: 80 })
        )
      }, 30000, 350)
      if (!detailFormReady) return { ok: false, needsNavigation: true, targetUrl: TIKTOK_UPLOAD_URL, visionTrace: trace }
      stepLog('upload_image', 'Đã tải ảnh bìa thành công.', 'info', { checkpointStep: 'image_uploaded' })
      await V().humanDelay(1200, 2000)
    }

    const confirmedHandle = detectCurrentTikTokHandle() || ''

    // Điền Tiêu đề (bỏ qua nếu đã điền đúng)
    const titleInput = findTitleInput()
    if (titleInput && !V().isTextMatched(V().readEditorValue(titleInput), shortTitle)) {
      stepLog('fill_title', 'Đang điền Tiêu đề...')
      await V().smartTypeText(titleInput, shortTitle, { clearFirst: true, humanBurst: true })
      stepLog('fill_title', 'Đã điền Tiêu đề.', 'info', { checkpointStep: 'title_filled' })
      await V().humanDelay(550, 950)
    }

    // Điền Mô tả & Hashtag (bỏ qua nếu đã điền đủ)
    const existingCounter = readDescriptionCounter()
    const descEditor = await findAndFocusDescriptionEditor()
    if (!descEditor) return { ok: false, error: 'TIKTOK_DESCRIPTION_EDITOR_NOT_FOUND', visionTrace: trace }

    if (!(existingCounter && existingCounter >= Math.min(20, fullDescription.length) && V().isTextMatched(V().readEditorValue(descEditor), fullDescription, DESC_PLACEHOLDER_RE))) {
      stepLog('fill_desc', 'Đang điền Mô tả & Hashtag...')
      const descVerifyFn = (el, actual) => {
        const counter = readDescriptionCounter()
        if (counter !== null && counter >= Math.min(15, fullDescription.trim().length)) return true
        const clean = V().normalizeText(actual)
        return clean.length >= Math.min(18, fullDescription.trim().length) && !DESC_PLACEHOLDER_RE.test(clean)
      }

      let descRes = await V().smartTypeText(descEditor, fullDescription, { clearFirst: true, dismissPopover: true, placeholderRe: DESC_PLACEHOLDER_RE, verifyFn: descVerifyFn })
      await V().humanDelay(550, 950)
      let counterAfter = readDescriptionCounter()
      if (!descRes.ok && (counterAfter === null || counterAfter === 0)) {
        const reFocused = await findAndFocusDescriptionEditor()
        if (reFocused) {
          descRes = await V().smartTypeText(reFocused, fullDescription, { clearFirst: true, dismissPopover: true, placeholderRe: DESC_PLACEHOLDER_RE, verifyFn: descVerifyFn })
          await V().humanDelay(550, 950)
          counterAfter = readDescriptionCounter()
        }
      }
      if ((counterAfter !== null && counterAfter === 0) || (!descRes.ok && counterAfter === null)) return { ok: false, error: 'TIKTOK_DESCRIPTION_NOT_INSERTED', visionTrace: trace }
      V().dispatchEscape(descEditor)
    }
    stepLog('fill_desc', 'Đã điền xong Mô tả & Hashtag.', 'info', { checkpointStep: 'desc_filled' })

    // Chọn quyền riêng tư (đã sửa triệt để lỗi không chọn được "Chỉ mình bạn"!)
    await V().humanDelay(550, 950)
    stepLog('privacy', `Đang chọn đối tượng: ${requestedPrivacy === 'only_me' ? 'Chỉ mình bạn' : 'Mọi người'}...`)
    const privacyResult = await setAndVerifyTikTokPrivacy(requestedPrivacy)
    if (!privacyResult.ok) return { ok: false, error: 'TIKTOK_PRIVACY_NOT_CONFIRMED', actualPrivacy: privacyResult.actual, visionTrace: trace }
    stepLog('privacy', `Đã xác nhận đối tượng TikTok: ${privacyResult.actual === 'only_me' ? 'Chỉ mình bạn' : 'Mọi người'}.`, 'info', { checkpointStep: 'privacy_set' })

    await V().scrollContainerToBottom(findPrivacyControl() || descEditor)
    await V().humanReviewPause()

    let publishBtn = null
    await M().waitFor(() => { const btn = findPublishButton(); if (btn && !V().isElementDisabled(btn)) { publishBtn = btn; return true } return false }, 12000)
    if (!publishBtn) return { ok: false, error: 'TIKTOK_PUBLISH_BUTTON_NOT_READY', visionTrace: trace }

    stepLog('publish', 'Đang bấm Đăng bài TikTok...', 'info', { checkpointStep: 'submitted' })
    await V().humanClick(publishBtn, { skipScroll: true })

    const confirm = await waitForTikTokSubmitResult(38000)
    V().clearHud(4000)
    if (!confirm.ok) return { ok: false, error: confirm.error || 'TIKTOK_POST_NOT_VERIFIED', visionTrace: trace }

    return {
      ok: true, pendingReview: true, status: 'pending_review', platform: 'tiktok',
      account: confirmedHandle, privacy: privacyResult.actual,
      titleProbe: shortTitle.slice(0, 40), submittedAt: new Date().toISOString(),
      message: 'Đang chờ TikTok xét duyệt (~2–3 phút).', visionTrace: trace
    }
  }

  // SỬA TRIỆT ĐỂ CHỌN ĐỐI TƯỢNG TIKTOK STUDIO 2026 (KHÔNG CUỘN LÀM ĐÓNG POPOVER + CHỌN ĐÚNG LÁ OPTION + PHÍM DỰ PHÒNG)
  async function setAndVerifyTikTokPrivacy(requestedPrivacy) {
    const stepKeyTrigger = 'tiktok:privacy_trigger'
    const stepKeyOption = `tiktok:privacy_option_${requestedPrivacy}`
    const targetLabel = requestedPrivacy === 'only_me' ? 'Chỉ mình bạn' : 'Mọi người'

    // Tạo khoảng đệm 260px dưới cùng vùng cuộn để menu "Mọi người / Bạn bè / Chỉ mình bạn" KHÔNG BỊ CẮT ĐÁY!
    const label = V().findLabelElement(PRIVACY_LABEL_RE, { minLeft: 180, maxLength: 90 })
    const scroller = V().getScrollableAncestor(label || document.body)
    const prevPaddingBottom = scroller?.style?.paddingBottom || ''
    if (scroller && scroller !== document.documentElement) {
      scroller.style.paddingBottom = '260px'
    } else {
      document.body.style.paddingBottom = '260px'
    }

    try {
      await V().scrollContainerToBottom(label || findPrivacyControl())
      await V().sleep(350)

      // Tầng 1: Kiến thức đã học -> Tầng 2: Bộ tìm mặc định
      const learnedTriggerRule = await V().getLearnedRule(stepKeyTrigger)
      let control = (learnedTriggerRule ? V().findByLearnedRule(learnedTriggerRule) : null) || findPrivacyControl()
      if (!control) {
        const aiTrig = await V().askSelfHealingAI({
          platform: 'tiktok',
          stepKey: stepKeyTrigger,
          goal: 'Tìm nút dropdown chọn quyền riêng tư bên dưới nhãn "Người có thể nhìn thấy bài đăng này" (hiện chữ Mọi người / Bạn bè / Chỉ mình bạn).',
          errorReason: 'Không tìm thấy nút dropdown chọn quyền riêng tư TikTok'
        })
        if (aiTrig.ok && aiTrig.element) {
          control = aiTrig.element
          await V().saveLearnedRule(stepKeyTrigger, control, aiTrig.learnedRule || {})
        }
      }
      if (!control) return { ok: false, actual: null }

      const exactTargetRe = requestedPrivacy === 'only_me' ? ONLY_ME_RE : PUBLIC_RE
      const looseTargetRe = requestedPrivacy === 'only_me' ? ONLY_ME_LOOSE_RE : PUBLIC_LOOSE_RE
      const oppositeRe = requestedPrivacy === 'only_me' ? PUBLIC_LOOSE_RE : ONLY_ME_LOOSE_RE

      if (control.tagName === 'SELECT') {
        if (parsePrivacyValue(control.options[control.selectedIndex]?.textContent || '') === requestedPrivacy) return { ok: true, actual: requestedPrivacy }
        const matchOpt = Array.from(control.options).find((o) => looseTargetRe.test(V().normalizeText(o.textContent)))
        if (!matchOpt) return { ok: false, actual: null }
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
        if (setter) setter.call(control, matchOpt.value); else control.value = matchOpt.value
        control.dispatchEvent(new Event('input', { bubbles: true }))
        control.dispatchEvent(new Event('change', { bubbles: true }))
        return { ok: control.value === matchOpt.value, actual: requestedPrivacy }
      }

      const readCurrent = () => {
        const c = findPrivacyControl() || control
        return parsePrivacyValue(V().normalizeText(c.innerText || c.textContent || c.getAttribute('aria-label') || ''))
      }
      if (readCurrent() === requestedPrivacy) return { ok: true, actual: requestedPrivacy }

      const findBestDropdownOption = () => {
        const cRect = (findPrivacyControl() || control).getBoundingClientRect()
        const candidates = []
        for (const el of V().queryAllDeep(document, '[role="option"], [role="menuitem"], [role="radio"], li, button, div[class*="Option"], div[class*="option"], span, div')) {
          if (el === control || el.contains(control) || control.contains(el)) continue
          if (!V().isReallyVisible(el, { minWidth: 36, minHeight: 16 })) continue
          const txt = V().normalizeText(el.innerText || el.textContent)
          if (!txt || txt.length > 55) continue
          if (!looseTargetRe.test(txt)) continue
          if (oppositeRe.test(txt) || /bạn bè|friends/i.test(txt)) continue
          const r = el.getBoundingClientRect()
          if (Math.abs(r.left - cRect.left) > 260) continue
          let score = 0
          if (exactTargetRe.test(txt)) score += 60
          if (['option', 'menuitem', 'radio'].includes(el.getAttribute('role'))) score += 50
          if (/option|item|select/i.test(String(el.className || ''))) score += 25
          score -= el.querySelectorAll('*').length * 8
          candidates.push({ el, score })
        }
        if (!candidates.length) return null
        candidates.sort((a, b) => b.score - a.score)
        const best = candidates[0].el
        return best.closest('[role="option"], [role="menuitem"], li, [class*="Option"], [class*="option"]') || best
      }

      const learnedOptRule = await V().getLearnedRule(stepKeyOption)

      for (let attempt = 1; attempt <= 3; attempt++) {
        const curControl = findPrivacyControl() || control
        await V().humanClick(curControl, { skipScroll: true })
        await V().sleep(520)

        let opt = (attempt === 1 && learnedOptRule) ? V().findByLearnedRule(learnedOptRule) : null
        const usedLearnedOpt = Boolean(opt)
        if (!opt) {
          await M().waitFor(() => Boolean(findBestDropdownOption()), 3800, 180)
          opt = findBestDropdownOption()
        }

        if (opt) {
          await V().humanClick(opt, { skipScroll: true })
          await V().sleep(600)
          if (readCurrent() === requestedPrivacy) return { ok: true, actual: requestedPrivacy }
          if (usedLearnedOpt) await V().invalidateLearnedRule(stepKeyOption)
        }

        // Lần 2: Phím mũi tên + Enter
        if (attempt === 2) {
          try {
            curControl.focus({ preventScroll: true })
            if (!findBestDropdownOption()) {
              curControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
              await V().sleep(350)
            }
            const steps = requestedPrivacy === 'only_me' ? 3 : 1
            const navKey = requestedPrivacy === 'only_me' ? 'ArrowDown' : 'ArrowUp'
            for (let k = 0; k < steps; k++) {
              curControl.dispatchEvent(new KeyboardEvent('keydown', { key: navKey, code: navKey, bubbles: true }))
              await V().sleep(180)
            }
            curControl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
            await V().sleep(600)
            if (readCurrent() === requestedPrivacy) return { ok: true, actual: requestedPrivacy }
          } catch (_) {}
        }

        // Lần 3: Tự nhờ AI Local qwen3.5:4b nhìn dropdown đang mở, bấm đúng nút & lưu kiến thức mới!
        if (attempt === 3) {
          if (!findBestDropdownOption()) {
            await V().humanClick(curControl, { skipScroll: true })
            await V().sleep(500)
          }
          const aiOpt = await V().askSelfHealingAI({
            platform: 'tiktok',
            stepKey: stepKeyOption,
            goal: `Trong danh sách thả xuống quyền riêng tư đang mở của TikTok Studio, chọn mục "${targetLabel}" (không chọn Bạn bè hay mục khác).`,
            errorReason: `Không chọn được "${targetLabel}" trên TikTok Studio (có thể giao diện mới hoặc bị popup che)`
          })
          if (aiOpt.ok && aiOpt.element) {
            await V().humanClick(aiOpt.element, { skipScroll: true })
            await V().sleep(650)
            if (readCurrent() === requestedPrivacy) {
              // Ghi nhớ vĩnh viễn quy tắc mới để những lần sau KHÔNG cần hỏi AI nữa!
              await V().saveLearnedRule(stepKeyOption, aiOpt.element, { ...(aiOpt.learnedRule || {}), clickMode: 'skip_scroll' })
              return { ok: true, actual: requestedPrivacy }
            }
          }
        }

        V().dispatchEscape()
        await V().sleep(320)
      }

      return { ok: readCurrent() === requestedPrivacy, actual: readCurrent() }
    } finally {
      if (scroller && scroller !== document.documentElement) scroller.style.paddingBottom = prevPaddingBottom
      else document.body.style.paddingBottom = ''
    }
  }

  function cleanTikTokPostUrl(raw) {
    try {
      const u = new URL(raw, location.origin)
      const m = u.pathname.match(/^\/(@[A-Za-z0-9._-]+)\/(video|photo)\/(\d+)/i)
      return m ? `https://www.tiktok.com/${m[1]}/${m[2].toLowerCase()}/${m[3]}` : null
    } catch (_) { return null }
  }

  function isRealTikTokPostUrl(url) { return Boolean(url && /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._-]+\/(?:video|photo)\/\d+$/i.test(url)) }
  function extractRealTikTokPostLinks(root = document) { return V().queryAllDeep(root, 'a[href*="/video/"], a[href*="/photo/"]').map((a) => cleanTikTokPostUrl(a.href)).filter(isRealTikTokPostUrl) }

  async function waitForTikTokSubmitResult(timeoutMs) {
    const startUrl = location.href, deadline = Date.now() + timeoutMs
    let handledConfirmModal = false
    while (Date.now() < deadline) {
      if (location.href !== startUrl && !/\/upload\/?(\?|$)/i.test(location.href)) return { ok: true }
      for (const modal of V().queryAllDeep(document, '[role="dialog"], [class*="modal"], [class*="Modal"]').filter((m) => V().isReallyVisible(m, { minWidth: 200, minHeight: 90 }))) {
        const txt = V().normalizeText(modal.innerText || modal.textContent)
        if (!handledConfirmModal && /tiếp tục đăng|continue to post|kiểm tra bản quyền|copyright/i.test(txt)) {
          const confirmBtn = V().queryAllDeep(modal, 'button, [role="button"]').find((b) => V().isReallyVisible(b) && !V().isElementDisabled(b) && /^(đăng ngay|đăng|tiếp tục|post now|post|continue)$/i.test(V().normalizeText(b.innerText || b.textContent)))
          if (confirmBtn) { handledConfirmModal = true; await V().humanClick(confirmBtn, { skipScroll: true }); await V().humanDelay(750, 1150) }
        }
        if (/đã được tải lên|has been uploaded|đã đăng|xét duyệt|đang xem xét|under review|quản lý bài đăng|manage your posts/i.test(txt)) {
          const manageBtn = V().queryAllDeep(modal, 'button, a, [role="button"]').find((b) => V().isReallyVisible(b) && /quản lý bài đăng|manage your posts|bài đăng/i.test(V().normalizeText(b.innerText || b.textContent)))
          if (manageBtn) await V().humanClick(manageBtn, { skipScroll: true })
          return { ok: true }
        }
      }
      const toasts = V().queryAllDeep(document, '[role="status"], [role="alert"], [class*="toast"], [class*="Toast"]').filter((el) => V().isReallyVisible(el)).map((el) => V().normalizeText(el.innerText || el.textContent)).join(' | ')
      if (/không thể đăng|thất bại|failed|captcha|xác minh/i.test(toasts)) return { ok: false, error: `TIKTOK_PUBLISH_ERROR: ${toasts.slice(0, 120)}` }
      if (/đã đăng|posted|đã tải lên|thành công|xét duyệt|đang xem xét/i.test(toasts)) return { ok: true }
      await V().sleep(700)
    }
    return { ok: false, error: 'TIKTOK_POST_NOT_VERIFIED' }
  }

  function findRowOnStudio(titleProbe) {
    const probeWords = V().stripToMatchKey(titleProbe).slice(0, 22).split(' ').filter((w) => w.length >= 2).slice(0, 4)
    const privacyPills = V().queryAllDeep(document, 'button, [role="button"], [role="combobox"], div, span').filter((el) => {
      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 16 })) return false
      const r = el.getBoundingClientRect()
      if (r.left < 200 || r.top < 110 || r.height > 48 || r.width > 200) return false
      const t = V().normalizeText(el.innerText || el.textContent)
      return t.length <= 28 && /^(mọi người|công khai|bạn bè|chỉ mình.*|chỉ bạn|everyone|public|friends|only you|only me|private)$/i.test(t)
    })

    const candidateRows = [], visited = new Set()
    for (const pill of privacyPills) {
      let row = pill.parentElement
      for (let d = 0; d < 7 && row && row !== document.body; d++) {
        const r = row.getBoundingClientRect()
        if (r.width >= 560 && r.height >= 52 && r.height <= 210) {
          if (!visited.has(row)) { visited.add(row); candidateRows.push({ row, top: r.top }) }
          break
        }
        row = row.parentElement
      }
    }
    candidateRows.sort((a, b) => a.top - b.top)
    if (probeWords.length >= 2) {
      for (const item of candidateRows) {
        const rowKey = V().stripToMatchKey(item.row.innerText || item.row.textContent)
        if (probeWords.filter((w) => rowKey.includes(w)).length >= Math.min(2, probeWords.length)) return item.row
      }
    }
    return candidateRows[0]?.row || null
  }

  function detectRedRejectionNoticeInRow(row) {
    if (!row) return null
    const fullText = V().normalizeText(row.innerText || row.textContent)
    if (REJECTED_REVIEW_RE.test(fullText)) {
      const m = fullText.match(/[^.|\n]*(?:bị từ chối|từ chối duyệt|không được duyệt|không đủ điều kiện|vi phạm|nguyên tắc cộng đồng|bị xóa|removed|rejected|violation|ineligible)[^.|\n]*/i)
      return m ? V().normalizeText(m[0]).slice(0, 120) : 'Bài đăng bị từ chối duyệt'
    }
    for (const el of row.querySelectorAll('span, div, p, a')) {
      if (!V().isReallyVisible(el)) continue
      const txt = V().normalizeText(el.innerText || el.textContent)
      if (txt.length < 6 || txt.length > 140 || PENDING_REVIEW_RE.test(txt)) continue
      if (V().getElementColorInfo(el).isTextRed) return txt
    }
    return null
  }

  async function tryExtractLinkFromStudioRow(row) {
    if (!row) return null
    const directLinks = extractRealTikTokPostLinks(row)
    if (directLinks.length > 0) return directLinks[0]
    const rRect = row.getBoundingClientRect()
    const moreBtn = Array.from(row.querySelectorAll('button, [role="button"]'))
      .filter((b) => V().isReallyVisible(b, { minWidth: 18, minHeight: 18 }))
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]

    if (moreBtn && moreBtn.getBoundingClientRect().left > rRect.left + rRect.width * 0.65) {
      await V().humanClick(moreBtn, { skipScroll: true })
      await V().humanDelay(400, 720)
      const menuLinks = extractRealTikTokPostLinks(document)
      if (menuLinks.length > 0) { V().dispatchEscape(); return menuLinks[0] }
      const viewLink = V().queryAllDeep(document, 'a[href], [role="menuitem"] a[href]').find((a) =>
        V().isReallyVisible(a) && /xem trên tiktok|view on tiktok|mở trên tiktok/i.test(V().normalizeText(a.innerText || a.textContent))
      )
      if (viewLink && cleanTikTokPostUrl(viewLink.href)) { V().dispatchEscape(); return cleanTikTokPostUrl(viewLink.href) }
      V().dispatchEscape()
    }
    return null
  }

  async function checkTikTokApprovedPostLink(options = {}) {
    const titleProbe = options.titleProbe || ''
    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 15000 })
    if (!stable.ok) return { ok: false, status: 'pending_review', reason: stable.reason }

    await V().humanDelay(750, 1250)
    const detectedHandle = detectCurrentTikTokHandle() || options.accountHandle || null

    if (/^\/@[A-Za-z0-9._-]+/i.test(location.pathname)) {
      const probeWords = V().stripToMatchKey(titleProbe).split(' ').filter((w) => w.length >= 2).slice(0, 4)
      for (const card of Array.from(document.querySelectorAll('[data-e2e="user-post-item"], [class*="DivItemContainer"]')).slice(0, 8)) {
        const cardLink = extractRealTikTokPostLinks(card)[0]
        if (!cardLink) continue
        const cardKey = V().stripToMatchKey(`${card.innerText || ''} ${card.querySelector('img')?.getAttribute('alt') || ''}`)
        if (!probeWords.length || probeWords.filter((w) => cardKey.includes(w)).length >= Math.min(2, probeWords.length)) {
          return { ok: true, status: 'published', postUrl: cardLink, postId: extractTikTokPostId(cardLink), accountHandle: detectedHandle }
        }
      }
      const newestLink = extractRealTikTokPostLinks(document)[0]
      if (newestLink) return { ok: true, status: 'published', postUrl: newestLink, postId: extractTikTokPostId(newestLink), accountHandle: detectedHandle }
      return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'Chờ bài hiển thị trên trang cá nhân...' }
    }

    if (options.refreshViaSidebar && isTikTokStudioPage()) {
      await clickStudioSidebarTab(/^(trang chủ|home)$/i)
      await clickStudioSidebarTab(/^(bài đăng|posts)$/i)
    }

    const row = findRowOnStudio(titleProbe)
    if (!row) return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'Chờ bài hiển thị trên TikTok Studio...' }

    const redRejection = detectRedRejectionNoticeInRow(row)
    if (redRejection) return { ok: false, status: 'rejected', error: `Bài đăng TikTok bị từ chối duyệt: ${redRejection}` }

    const rowText = V().normalizeText(row.innerText || row.textContent)
    if (PENDING_REVIEW_RE.test(rowText)) return { ok: true, status: 'pending_review', accountHandle: detectedHandle, message: 'Nội dung đang được TikTok xét duyệt...' }

    const exactUrl = await tryExtractLinkFromStudioRow(row)
    if (exactUrl && isRealTikTokPostUrl(exactUrl)) {
      return { ok: true, status: 'published', postUrl: exactUrl, postId: extractTikTokPostId(exactUrl), accountHandle: detectedHandle }
    }
    return { ok: true, status: 'approved_need_profile_link', accountHandle: detectedHandle, message: 'Đã duyệt xong! Đang lấy link bài viết thật...' }
  }

  function extractTikTokPostId(postUrl) { return String(postUrl || '').match(/\/(?:video|photo)\/([0-9]+)/i)?.[1] || null }

  function extractTikTokCardMetrics(card) {
    let likes = 0, comments = 0, shares = 0
    for (const sel of [
      '[data-e2e="like-count"]', '[data-e2e="video-like-count"]',
      '[data-e2e="search-card-like-container"]', 'strong[data-e2e="like-count"]',
      '[class*="StrongCount"]', '[class*="LikeCount"]', '[class*="PlayCount"]'
    ]) {
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
        if (/^\d+(?:[.,]\d+)?\s*(k|n|nghìn|m|tr|triệu)$/i.test(t)) likes = Math.max(likes, V().parseHumanCount(t))
      }
    }
    return { likes, comments, shares }
  }

  async function clickExploreCategoryPill(categoryIndex, preferredName = '') {
    if (!location.pathname.includes('/explore')) return false
    const pills = Array.from(document.querySelectorAll('[data-e2e^="explore"] button, button, [role="tab"], [role="button"]')).filter((el) => {
      if (!V().isReallyVisible(el, { minWidth: 40, minHeight: 24 })) return false
      const r = el.getBoundingClientRect()
      if (r.top > 95 || r.left < 180 || r.height > 54) return false
      const t = V().normalizeText(el.innerText || el.textContent)
      return t.length >= 2 && t.length <= 32 && !/tìm kiếm|đăng nhập|tải lên/i.test(t)
    })
    if (pills.length <= 1) return false
    let targetPill = preferredName ? pills.find((p) => V().normalizeText(p.innerText).toLowerCase().includes(preferredName.toLowerCase())) : null
    if (!targetPill && categoryIndex > 0) targetPill = pills[categoryIndex % pills.length]
    if (!targetPill) return false
    await V().humanClick(targetPill, { skipScroll: true })
    await V().humanDelay(1400, 2200)
    return true
  }

  // SỬA TRIỆT ĐỂ CUỘN SÂU TRÊN TRANG TÌM KIẾM TIKTOK (KỂ CẢ TAB NỀN!)
  async function scrapeTikTokViralPosts(options = {}) {
    const targetCount = Number(options.targetCount) || 10
    const minLikes = Number(options.minLikes) || 200000
    const maxRoundsOnPage = Number(options.maxRoundsOnPage) || 18
    const idleTimeoutMs = Number(options.idleTimeoutMs) || 4 * 60 * 1000
    let lastFoundAt = Number(options.lastFoundAt) || Date.now()
    const totalAlreadyFound = Number(options.totalAlreadyFound) || 0
    const startCategoryIndex = Number(options.categoryIndex) || 0
    const preferredExploreTab = options.preferredExploreTab || ''
    const topicLabel = options.topicLabel || ''
    const seenUrls = new Set((options.excludeUrls || []).map((u) => String(u).trim().toLowerCase()))

    const stable = await V().waitForPageStable('tiktok', { maxWaitMs: 20000 })
    if (!stable.ok) return { ok: false, error: `TIKTOK_${stable.reason}`, posts: [], lastFoundAt }
    if (location.pathname.includes('/explore') && (preferredExploreTab || startCategoryIndex > 0)) {
      await clickExploreCategoryPill(startCategoryIndex, preferredExploreTab)
    }

    const collected = []
    let stagnantRounds = 0, catSwitchCount = 0, lastCardsLen = 0

    for (let round = 0; round < maxRoundsOnPage && collected.length < targetCount; round++) {
      if (Date.now() - lastFoundAt >= idleTimeoutMs) return { ok: true, posts: collected, timedOut: true, lastFoundAt }
      const health = V().inspectPageHealth()
      if (health.isOffline) await V().waitForPageStable('tiktok', { maxWaitMs: 25000 })
      if (health.isCaptchaOrCheckpoint) break

      const cards = Array.from(
        document.querySelectorAll('div[data-e2e="explore-item"], div[data-e2e="search_video-item"], div[data-e2e="search_top-item"], div[data-e2e="recommend-list-item-container"], article[data-e2e="recommend-list-item-container"], div[class*="DivItemContainer"], article[data-e2e]')
      )

      for (const card of cards) {
        if (collected.length >= targetCount || Date.now() - lastFoundAt >= idleTimeoutMs) break
        try {
          // Bỏ qua các thẻ LIVE stream (số trên thẻ là người đang xem LIVE, không phải lượt tim video!)
          const cardTextQuick = V().normalizeText(card.innerText || '').slice(0, 60)
          if (card.querySelector('[data-e2e*="live"], a[href*="/live"]') || /\bLIVE\b/.test(cardTextQuick)) continue

          const linkEl = card.querySelector('a[href*="/video/"], a[href*="/photo/"]')
          const postUrl = linkEl ? cleanTikTokPostUrl(linkEl.href) : null
          if (!postUrl || !isRealTikTokPostUrl(postUrl)) continue
          const urlKey = postUrl.toLowerCase()
          if (seenUrls.has(urlKey)) continue

          const metrics = extractTikTokCardMetrics(card)
          if (metrics.likes < minLikes) continue

          const imgAlt = V().normalizeText(card.querySelector('img[alt]')?.getAttribute('alt') || '')
          const descEl = card.querySelector('[data-e2e="explore-card-desc"], [data-e2e="search-card-desc"], [data-e2e="video-desc"], a[title], h1')
          const descTxt = V().normalizeText(descEl?.getAttribute?.('title') || descEl?.innerText || descEl?.textContent || '')
          const authorMatch = postUrl.match(/tiktok\.com\/(@[A-Za-z0-9._-]+)\//i)
          const author = V().normalizeText(card.querySelector('[data-e2e="explore-card-user-unique-id"], [data-e2e="search-card-user-unique-id"], [data-e2e="video-author-uniqueid"]')?.textContent || '') || (authorMatch ? authorMatch[1] : '@creator')
          const bestCaption = (imgAlt.length > descTxt.length && !/avatar/i.test(imgAlt)) ? imgAlt : (descTxt || `Video TikTok Viral của ${author}`)

          seenUrls.add(urlKey)
          lastFoundAt = Date.now()
          collected.push({
            id: `tt-viral-${Date.now()}-${collected.length}`,
            title: V().truncateClean(bestCaption, 105),
            platform: 'tiktok',
            category: topicLabel || (postUrl.includes('/photo/') ? 'Ảnh TikTok' : 'Video TikTok'),
            postUrl,
            summary: V().truncateClean(`[${author}] ${bestCaption} • ${metrics.likes.toLocaleString('vi-VN')} tim`, 250),
            viralityScore: Math.min(99, 90 + Math.min(9, Math.floor(Math.log10(metrics.likes) * 1.5))),
            likesCount: metrics.likes, sharesCount: metrics.shares, commentsCount: metrics.comments,
            trendingTopic: `${postUrl.includes('/photo/') ? 'Ảnh TikTok' : 'Video TikTok'} • ${(metrics.likes / 1000).toFixed(0)}K+ tim`,
            createdAt: new Date().toISOString()
          })
          V().reportStep('tiktok', 'scrape_viral', `TikTok Viral: ${totalAlreadyFound + collected.length} bài (${metrics.likes.toLocaleString('vi-VN')} tim)`)
        } catch (_) {}
      }

      if (collected.length >= targetCount) break

      // Bấm nút "Tải thêm" / "Load more" nếu TikTok hiển thị nút phân trang ở cuối danh sách tìm kiếm
      const loadMoreBtn = V().queryAllDeep(document, 'button, [role="button"]').find((b) =>
        V().isReallyVisible(b, { minWidth: 60, minHeight: 24 }) && /^(tải thêm|xem thêm|load more|show more)$/i.test(V().normalizeText(b.innerText || b.textContent))
      )
      if (loadMoreBtn) {
        await V().humanClick(loadMoreBtn)
        await V().humanDelay(1400, 2200)
      }

      // Cuộn sâu container thật của TikTok Search/Explore (kể cả khi tab đang ở nền!)
      const lastCard = cards[cards.length - 1]
      if (lastCard) {
        try { lastCard.scrollIntoView({ behavior: 'auto', block: 'end' }) } catch (_) {}
      }
      await V().scrollPageDownForFeed(1400 + Math.round(Math.random() * 500), lastCard)
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', code: 'PageDown', keyCode: 34, bubbles: true }))
      } catch (_) {}
      await V().humanDelay(1400, 2200)

      const newCardsLen = document.querySelectorAll('div[data-e2e="explore-item"], div[data-e2e="search_video-item"], div[data-e2e="search_top-item"], div[class*="DivItemContainer"]').length
      if (newCardsLen <= lastCardsLen) {
        stagnantRounds++
        if (stagnantRounds >= 3 && location.pathname.includes('/explore') && !preferredExploreTab && catSwitchCount < 6) {
          catSwitchCount++
          stagnantRounds = 0
          await clickExploreCategoryPill(startCategoryIndex + catSwitchCount)
          continue
        }
        // Ở trang search: nếu cuộn 3 lần liên tiếp không ra thêm video mới -> kết thúc từ khóa này để chuyển sang từ khóa kế tiếp!
        if (stagnantRounds >= 3 && location.pathname.includes('/search')) break
      } else {
        stagnantRounds = 0
        lastCardsLen = newCardsLen
      }
    }

    V().clearHud(2500)
    return { ok: true, posts: collected, timedOut: false, lastFoundAt }
  }
})()
