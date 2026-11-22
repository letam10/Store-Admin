/*
  FILE NOTE
  - Mục đích: Lõi nhận thức thị giác & mô phỏng hành vi người thật chạy ngầm 24/7 (OmniVision Engine v3.5.1).
  - Nâng cấp: Mở rộng smoothScrollToTop, cuộn mượt từng nấc scrollPageDownForFeed, ưu tiên từ khóa goal và tăng maxItems trong buildRichInteractiveMap/askSelfHealingAI.
  - Liên kết trực tiếp: extension/background.js, extension/content-facebook.js, extension/content-tiktok.js
  - Vùng ảnh hưởng khi sửa: Khả năng nhận thức thị giác, tự sửa lỗi DOM và độ trễ hành vi người thật trên Facebook và TikTok.
*/

;(() => {
  if (globalThis.__OMNICART_VISION_VERSION__ === '3.5.1' && globalThis.OmniVision) {
    return
  }
  globalThis.__OMNICART_VISION_VERSION__ = '3.5.1'

  const HUD_HOST_ID = 'omnicart-vision-hud-host'

  let hudEnabled = true
  let pacingMode = 'normal'
  let currentMarkLookup = new Map()

  function sleep(ms) {
    const duration = Math.max(0, Math.round(Number(ms) || 0))
    if (duration <= 0) return Promise.resolve()
    return new Promise((resolve) => {
      let done = false
      const startedAt = Date.now()
      const finish = () => {
        if (done) return
        done = true
        clearTimeout(localTimer)
        resolve()
      }
      const localTimer = setTimeout(finish, duration)
      if (duration >= 150 && typeof chrome !== 'undefined' && chrome.runtime?.id) {
        try {
          chrome.runtime.sendMessage({ type: 'SW_SLEEP', ms: Math.min(duration, 25000) }, (res) => {
            void chrome.runtime.lastError
            if (res?.ok === true && Date.now() - startedAt >= duration * 0.85) {
              finish()
            }
          })
        } catch (_) {}
      }
    })
  }

  function getPacingMultiplier() {
    if (pacingMode === 'careful') return 1.45
    if (pacingMode === 'fast') return 0.55
    return 1.0
  }

  function randomGaussianBetween(minMs, maxMs) {
    const low = Math.min(minMs, maxMs)
    const high = Math.max(minMs, maxMs)
    const u = (Math.random() + Math.random() + Math.random()) / 3
    const jitter = 0.88 + Math.random() * 0.24
    return Math.round(Math.max(low, Math.min(high * 1.15, (low + u * (high - low)) * jitter)))
  }

  async function humanDelay(minMs = 650, maxMs = 1550) {
    const ms = Math.max(120, Math.round(randomGaussianBetween(minMs, maxMs) * getPacingMultiplier()))
    await sleep(ms)
    return ms
  }

  async function humanMicroPause() { return humanDelay(240, 560) }
  async function humanReadPause() { return humanDelay(1100, 2300) }
  async function humanReviewPause() { return humanDelay(1450, 2750) }

  async function humanScrollPause() {
    const base = randomGaussianBetween(1900, 4100)
    const extraRead = Math.random() < 0.22 ? randomGaussianBetween(1400, 3200) : 0
    const ms = Math.round((base + extraRead) * getPacingMultiplier())
    await sleep(ms)
    return ms
  }

  async function humanWatchPause(baseSeconds = 8) {
    const baseMs = Math.max(3000, Number(baseSeconds || 8) * 1000)
    const factor = 0.78 + Math.random() * 0.48
    const ms = Math.round(baseMs * factor)
    await sleep(ms)
    return ms
  }

  async function smoothScrollToTop() {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' })
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      for (const el of document.querySelectorAll('[role="main"], main, div')) {
        if (el.scrollTop > 0 && el.clientHeight > 300) el.scrollTop = 0
      }
      window.dispatchEvent(new Event('scroll'))
    } catch (_) {
      try { window.scrollTo(0, 0) } catch (_) {}
    }
    await humanDelay(450, 850)
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function stripToMatchKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function formatPostText(value, maxLen = 4000) {
    let text = String(value || '')
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (text.length > maxLen) {
      const sliced = text.slice(0, maxLen)
      const cutAt = Math.max(sliced.lastIndexOf('\n'), sliced.lastIndexOf(' '))
      text = (cutAt > maxLen * 0.7 ? sliced.slice(0, cutAt) : sliced).trim()
    }
    return text
  }

  function truncateClean(text, maxLen) {
    const clean = normalizeText(text)
    if (clean.length <= maxLen) return clean
    const slice = clean.slice(0, maxLen)
    const lastSpace = slice.lastIndexOf(' ')
    return (lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice).trim()
  }

  function formatHashtags(rawHashtags) {
    if (!rawHashtags) return ''
    const list = Array.isArray(rawHashtags) ? rawHashtags : String(rawHashtags).split(/[\s,;]+/)
    const seen = new Set()
    const cleanTags = []
    for (const item of list) {
      const stripped = normalizeText(item).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '')
      if (!stripped) continue
      const key = stripped.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      cleanTags.push(`#${stripped}`)
    }
    return cleanTags.join(' ')
  }

  function composeBodyAndHashtags(rawBody, rawHashtags, maxLen = 3900) {
    const body = formatPostText(rawBody || '', maxLen)
    const tags = formatHashtags(rawHashtags)
    if (!tags) return body
    if (!body) return formatPostText(tags, maxLen)
    const bodyLower = body.toLowerCase()
    const missingTags = tags.split(' ').filter((tag) => tag && !bodyLower.includes(tag.toLowerCase()))
    if (!missingTags.length) return body
    return formatPostText(`${body}\n\n${missingTags.join(' ')}`, maxLen)
  }

  function parseHumanCount(raw) {
    const str = normalizeText(raw).toLowerCase()
    if (!str) return 0
    const unitMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(triệu|nghìn|ngàn|tỷ|tỉ|tr|k|n|m|b)(?:\b|[^\p{L}])/iu)
    if (unitMatch) {
      const num = parseFloat(unitMatch[1].replace(',', '.'))
      const unit = unitMatch[2].toLowerCase()
      if (!Number.isFinite(num)) return 0
      if (unit === 'k' || unit === 'n' || unit === 'nghìn' || unit === 'ngàn') return Math.round(num * 1000)
      if (unit === 'm' || unit === 'tr' || unit === 'triệu') return Math.round(num * 1000000)
      if (unit === 'b' || unit === 'tỷ' || unit === 'tỉ') return Math.round(num * 1000000000)
    }
    const plainMatch = str.match(/(?:^|[^\d])(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:$|[^\d])/)
    if (plainMatch) {
      const num = parseInt(plainMatch[1].replace(/[^\d]/g, ''), 10)
      return Number.isFinite(num) ? num : 0
    }
    return 0
  }

  function getDeepActiveElement(rootDoc = document) {
    let active = rootDoc?.activeElement || null
    let guard = 0
    while (active && guard < 8) {
      guard++
      if (active.shadowRoot?.activeElement) { active = active.shadowRoot.activeElement; continue }
      if (active.tagName === 'IFRAME') {
        try { if (active.contentDocument?.activeElement) { active = active.contentDocument.activeElement; continue } } catch (_) {}
      }
      break
    }
    return active
  }

  function queryAllDeep(root = document, selector = '*') {
    const results = []
    const visited = new Set()
    function walk(node) {
      if (!node || visited.has(node)) return
      visited.add(node)
      if (typeof node.querySelectorAll === 'function') {
        try {
          for (const el of node.querySelectorAll(selector)) results.push(el)
        } catch (_) {}
        try {
          for (const el of node.querySelectorAll('*')) {
            if (el.shadowRoot) walk(el.shadowRoot)
            if (el.tagName === 'IFRAME') {
              try { if (el.contentDocument) walk(el.contentDocument) } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }
    walk(root)
    return results
  }

  function isReallyVisible(el, options = {}) {
    if (!el || !el.isConnected) return false
    const { minWidth = 2, minHeight = 2, checkAriaHidden = true } = options
    if (checkAriaHidden) {
      if (el.getAttribute?.('aria-hidden') === 'true') return false
      if (el.closest?.('[aria-hidden="true"]')) return false
    }
    const rect = el.getBoundingClientRect()
    if (!rect || rect.width < minWidth || rect.height < minHeight) return false
    const style = window.getComputedStyle(el)
    if (!style) return false
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    if (parseFloat(style.opacity || '1') < 0.05) return false
    return true
  }

  function isElementDisabled(el) {
    if (!el) return true
    if (el.disabled === true) return true
    if (el.getAttribute('aria-disabled') === 'true') return true
    if (el.getAttribute('data-disabled') === 'true') return true
    const style = window.getComputedStyle(el)
    return Boolean(style && style.pointerEvents === 'none')
  }

  function isInViewport(rect) {
    return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
  }

  function getAccessibleLabel(el) {
    if (!el) return ''
    return normalizeText([
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('placeholder'),
      el.getAttribute?.('data-placeholder'),
      el.getAttribute?.('title'),
      el.getAttribute?.('alt'),
      el.innerText || el.textContent
    ].filter(Boolean).join(' '))
  }

  function getElementColorInfo(el) {
    try {
      const style = window.getComputedStyle(el)
      const bg = style.backgroundColor || ''
      const fg = style.color || ''
      const mBg = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      const mFg = fg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      const r = mBg ? Number(mBg[1]) : 0, g = mBg ? Number(mBg[2]) : 0, b = mBg ? Number(mBg[3]) : 0
      const fr = mFg ? Number(mFg[1]) : 0, fg2 = mFg ? Number(mFg[2]) : 0, fb = mFg ? Number(mFg[3]) : 0
      const isRedPink = r > 180 && g < 100 && b < 130
      const isTextRed = fr > 175 && fg2 < 95 && fb < 95
      const isBlue = b > 180 && r < 90 && g < 150
      return { bg, fg, isRedPink, isTextRed, isBlue, isBrightPrimary: isRedPink || isBlue }
    } catch (_) {
      return { bg: '', fg: '', isRedPink: false, isTextRed: false, isBlue: false, isBrightPrimary: false }
    }
  }

  function inspectPageHealth() {
    const bodyText = normalizeText(document.body?.innerText || '').slice(0, 1500)
    const isOffline =
      navigator.onLine === false ||
      /không có kết nối internet|no internet|err_internet_disconnected|err_connection|err_name_not_resolved|mất kết nối mạng|unable to connect|network error|check your internet/i.test(bodyText)

    const isCaptchaOrCheckpoint =
      /\/checkpoint|\/verify/i.test(location.pathname) ||
      /verify to continue|kéo thanh trượt|drag the slider|xác minh bảo mật|security check|captcha|chứng minh bạn không phải người máy/i.test(bodyText)

    const isPageError =
      /trang này không hiển thị|this content isn't available|page isn't available|đã xảy ra lỗi|something went wrong|couldn't load|502 bad gateway|503 service/i.test(bodyText) &&
      bodyText.length < 550

    const activeSpinners = Array.from(
      document.querySelectorAll('[role="progressbar"], [aria-busy="true"], [class*="Spinner"], [class*="spinner"], [class*="Loading"]')
    ).filter((el) => {
      if (!isReallyVisible(el, { minWidth: 16, minHeight: 16 })) return false
      const r = el.getBoundingClientRect()
      return r.top > 40 && r.top < window.innerHeight - 40
    })

    const isStillLoading =
      document.readyState !== 'complete' ||
      bodyText.length < 25 ||
      (activeSpinners.length > 0 && bodyText.length < 240)

    return {
      ok: !isOffline && !isCaptchaOrCheckpoint && !isPageError,
      online: navigator.onLine !== false && !isOffline,
      isOffline, isCaptchaOrCheckpoint, isPageError, isStillLoading,
      spinnerCount: activeSpinners.length, url: location.href, textLen: bodyText.length
    }
  }

  async function waitForPageStable(platform = 'system', options = {}) {
    const { maxWaitMs = 25000, onStatus = null } = options
    const deadline = Date.now() + maxWaitMs
    let reportedOffline = false
    let reportedLoading = false

    while (Date.now() < deadline) {
      const health = inspectPageHealth()
      if (health.isCaptchaOrCheckpoint) {
        const msg = 'Phát hiện xác minh bảo mật / Captcha — cần xác minh 1 lần.'
        if (onStatus) onStatus('captcha', msg, 'warn')
        else reportStep(platform, 'captcha', msg, 'warn')
        return { ok: false, reason: 'CAPTCHA_OR_CHECKPOINT', health }
      }
      if (health.isOffline) {
        if (!reportedOffline) {
          reportedOffline = true
          const msg = 'Phát hiện mất mạng, đang đợi kết nối phục hồi...'
          if (onStatus) onStatus('network', msg, 'warn')
          else reportStep(platform, 'network', msg, 'warn')
        }
        await sleep(2200)
        continue
      }
      if (health.isPageError) return { ok: false, reason: 'PAGE_ERROR_STATE', health }
      if (health.isStillLoading) {
        if (!reportedLoading) {
          reportedLoading = true
          const msg = 'Trang đang tải dữ liệu, đang đợi ổn định...'
          if (onStatus) onStatus('loading', msg, 'info')
          else reportStep(platform, 'loading', msg, 'info')
        }
        await sleep(850)
        continue
      }
      return { ok: true, reason: 'STABLE', health }
    }
    const finalHealth = inspectPageHealth()
    if (finalHealth.isOffline) return { ok: false, reason: 'NETWORK_OFFLINE', health: finalHealth }
    return { ok: true, reason: 'TIMEOUT_PROCEED', health: finalHealth }
  }

  function getScrollableAncestor(el) {
    let cur = el?.parentElement
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur)
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') && cur.scrollHeight > cur.clientHeight + 20) return cur
      cur = cur.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  async function scrollIntoViewSafely(el, block = 'center') {
    if (!el) return
    try {
      el.scrollIntoView({ behavior: 'auto', block, inline: 'nearest' })
      await sleep(260)
    } catch (_) {
      try { el.scrollIntoView({ block }) } catch (_) {}
      await sleep(260)
    }
  }

  async function scrollContainerToBottom(referenceEl) {
    const scroller = referenceEl ? getScrollableAncestor(referenceEl) : (document.scrollingElement || document.documentElement)
    try {
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      if (maxTop > 0) {
        scroller.scrollTop = maxTop
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
      }
      const docMax = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
      window.scrollTo({ top: docMax, behavior: 'auto' })
      window.dispatchEvent(new Event('scroll'))
    } catch (_) {
      try { window.scrollTo(0, document.body.scrollHeight) } catch (_) {}
    }
    await humanDelay(450, 820)
  }

  async function scrollPageDownForFeed(deltaY = 1050, containerHint = null) {
    const totalY = Math.round(deltaY * (0.78 + Math.random() * 0.48))
    const steps = randomGaussianBetween(6, 10)
    const stepBase = totalY / steps

    const candidates = []
    if (containerHint) candidates.push(getScrollableAncestor(containerHint))
    candidates.push(document.scrollingElement || document.documentElement, document.documentElement, document.body)
    for (const el of document.querySelectorAll('main, [role="main"], [id*="main-content"], [class*="DivBodyContainer"], [class*="SearchMain"]')) {
      if (el.scrollHeight > el.clientHeight + 80) candidates.push(el)
    }
    const scrollers = Array.from(new Set(candidates.filter(Boolean)))

    for (let s = 0; s < steps; s++) {
      const piece = Math.round(stepBase * (0.72 + Math.random() * 0.56))
      for (const scroller of scrollers) {
        try {
          scroller.scrollTop += piece
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
          scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: piece, deltaMode: 0, bubbles: true, cancelable: true }))
        } catch (_) {}
      }
      try {
        window.scrollBy({ top: piece, behavior: 'auto' })
        window.dispatchEvent(new Event('scroll'))
      } catch (_) {}
      await sleep(randomGaussianBetween(55, 135))
    }

    // Thỉnh thoảng nhích ngược nhẹ lên giống người đang nhìn lại bài
    if (Math.random() < 0.14) {
      const back = -randomGaussianBetween(60, 150)
      try { window.scrollBy({ top: back, behavior: 'auto' }) } catch (_) {}
      await sleep(randomGaussianBetween(260, 520))
    }
  }

  function findLabelElement(pattern, options = {}) {
    const { root = document, minTop = 0, minLeft = 0, maxLength = 140 } = options
    let best = null, bestScore = Infinity
    for (const el of queryAllDeep(root, 'label, span, div, p, h1, h2, h3, h4, strong, b, legend')) {
      if (!isReallyVisible(el)) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < minTop || rect.left < minLeft) continue
      const text = normalizeText(el.innerText || el.textContent)
      if (!text || text.length > maxLength || !pattern.test(text)) continue
      const score = text.length * 10 + Math.round((rect.width * rect.height) / 500)
      if (score < bestScore) { bestScore = score; best = el }
    }
    return best
  }

  function findControlNearLabel(labelEl, selector, options = {}) {
    if (!labelEl) return null
    const { root = document, direction = 'below', maxVertical = 140, maxHorizontal = 260 } = options
    const lRect = labelEl.getBoundingClientRect()
    let best = null, bestDist = Infinity
    for (const el of queryAllDeep(root, selector)) {
      if (el === labelEl || el.contains(labelEl)) continue
      if (!isReallyVisible(el, { minWidth: 20, minHeight: 16 })) continue
      const r = el.getBoundingClientRect()
      if (direction === 'below') {
        const dy = r.top - lRect.bottom
        if (dy < -16 || dy > maxVertical) continue
        if (!(r.right >= lRect.left - 60 && r.left <= lRect.right + maxHorizontal)) continue
        const dist = Math.max(0, dy) * 2 + Math.abs(r.left - lRect.left)
        if (dist < bestDist) { bestDist = dist; best = el }
      } else {
        const dist = Math.hypot((r.left + r.right) / 2 - (lRect.left + lRect.right) / 2, (r.top + r.bottom) / 2 - (lRect.top + lRect.bottom) / 2)
        if (dist < bestDist) { bestDist = dist; best = el }
      }
    }
    return best
  }

  async function humanClick(el, options = {}) {
    if (!el) return false
    const { skipScroll = false } = options
    if (!skipScroll) await scrollIntoViewSafely(el, 'center')

    const rect = el.getBoundingClientRect()
    const cx = Math.round(rect.left + rect.width * (0.3 + Math.random() * 0.4))
    const cy = Math.round(rect.top + rect.height * (0.3 + Math.random() * 0.4))
    const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 }

    try { el.dispatchEvent(new PointerEvent('pointermove', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerover', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousemove', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseover', { ...common, buttons: 0 })) } catch (_) {}
    await sleep(randomGaussianBetween(110, 260))

    try { el.dispatchEvent(new PointerEvent('pointerdown', common)) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', common)) } catch (_) {}
    try { el.focus({ preventScroll: true }) } catch (_) {}
    await sleep(randomGaussianBetween(75, 165))

    try { el.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.click() } catch (_) {
      try { el.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 })) } catch (_) {}
    }

    await humanDelay(320, 680)
    return true
  }

  function readEditorValue(el) {
    if (!el) return ''
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || ''
    return el.innerText || el.textContent || ''
  }

  function isTextMatched(actualRaw, expectedRaw, placeholderRe = null) {
    const actual = normalizeText(actualRaw)
    const expected = normalizeText(expectedRaw)
    if (!actual || !expected) return false
    if (placeholderRe && placeholderRe.test(actual) && actual.length < 110) return false
    const probe = expected.slice(0, Math.min(20, expected.length))
    if (actual.includes(probe) && actual.length >= Math.min(expected.length * 0.45, 22)) return true
    const cleanA = actual.replace(/\s+/g, '')
    const cleanE = expected.replace(/\s+/g, '')
    return cleanA.includes(cleanE.slice(0, Math.min(18, cleanE.length))) && cleanA.length >= Math.min(cleanE.length * 0.45, 20)
  }

  function placeCaretAtEnd(el) {
    try {
      el.focus({ preventScroll: true })
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      const target = el.querySelector('[data-text="true"]') || el.querySelector('[data-block="true"]') || el.querySelector('p') || el
      range.selectNodeContents(target)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    } catch (_) {}
  }

  async function clearEditable(el) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) setter.call(el, '')
      else el.value = ''
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(140)
      return
    }
    try {
      el.focus({ preventScroll: true })
      const sel = window.getSelection()
      if (sel) {
        const range = document.createRange()
        range.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      document.execCommand('selectAll', false, null)
      document.execCommand('delete', false, null)
      el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }))
      await sleep(180)
    } catch (_) {}
  }

  async function typeNativeInputHumanLike(el, targetText) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    let built = '', idx = 0
    while (idx < targetText.length) {
      const step = Math.min(targetText.length - idx, randomGaussianBetween(3, 8))
      const chunk = targetText.slice(idx, idx + step)
      built += chunk
      idx += step
      if (setter) setter.call(el, built)
      else el.value = built
      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: chunk }))
      await sleep(Math.round(randomGaussianBetween(45, 115) * getPacingMultiplier()))
    }
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  async function smartTypeText(el, text, options = {}) {
    if (!el) return { ok: false, method: 'none', actual: '' }
    const { clearFirst = true, dismissPopover = false, humanBurst = false, placeholderRe = null, verifyFn = null } = options
    const targetText = formatPostText(text, 4000)
    if (!targetText) return { ok: false, method: 'empty', actual: '' }

    const verifySuccess = (node) => {
      const actual = readEditorValue(node)
      const textOk = isTextMatched(actual, targetText, placeholderRe)
      const customOk = typeof verifyFn === 'function' ? Boolean(verifyFn(node, actual)) : true
      return { ok: textOk && customOk, actual }
    }

    await scrollIntoViewSafely(el, 'center')

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      await humanClick(el)
      if (clearFirst) await clearEditable(el)
      if (humanBurst && targetText.length <= 110) await typeNativeInputHumanLike(el, targetText)
      else {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
        if (setter) setter.call(el, targetText)
        else el.value = targetText
        el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: targetText }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await humanDelay(350, 650)
      const res = verifySuccess(el)
      return { ok: res.ok, method: humanBurst ? 'human-native-burst' : 'native-setter', actual: res.actual }
    }

    const editableEl = el.isContentEditable
      ? (el.querySelector('[contenteditable="true"]') || el)
      : (el.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"]') || el)

    await humanClick(editableEl)
    if (clearFirst) await clearEditable(editableEl)
    placeCaretAtEnd(editableEl)
    await humanDelay(420, 780)

    try {
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      editableEl.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true, clipboardData: dt }))
      await humanDelay(520, 880)
      const c1 = verifySuccess(editableEl)
      if (c1.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'synthetic-paste', actual: c1.actual } }
    } catch (_) {}

    try {
      if (clearFirst) await clearEditable(editableEl)
      placeCaretAtEnd(editableEl)
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      editableEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertFromPaste', data: targetText, dataTransfer: dt }))
      await humanDelay(500, 840)
      const c2 = verifySuccess(editableEl)
      if (c2.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'beforeinput-paste', actual: c2.actual } }
    } catch (_) {}

    try {
      if (clearFirst) await clearEditable(editableEl)
      placeCaretAtEnd(editableEl)
      const lines = targetText.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) {
          const textEvent = document.createEvent('TextEvent')
          textEvent.initTextEvent('textInput', true, true, window, lines[i])
          editableEl.dispatchEvent(textEvent)
        }
        if (i < lines.length - 1) document.execCommand('insertLineBreak', false, null)
        await sleep(Math.round(randomGaussianBetween(60, 140) * getPacingMultiplier()))
      }
      await humanDelay(500, 820)
      const c3 = verifySuccess(editableEl)
      if (c3.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'chromium-textInput', actual: c3.actual } }
    } catch (_) {}

    try {
      if (clearFirst) await clearEditable(editableEl)
      placeCaretAtEnd(editableEl)
      const lines = targetText.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) document.execCommand('insertText', false, lines[i])
        if (i < lines.length - 1) document.execCommand('insertLineBreak', false, null)
        await sleep(Math.round(randomGaussianBetween(55, 130) * getPacingMultiplier()))
      }
      editableEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: targetText }))
      await humanDelay(480, 820)
      const c4 = verifySuccess(editableEl)
      if (c4.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'execCommand-lines', actual: c4.actual } }
    } catch (_) {}

    if (document.hasFocus()) {
      try {
        if (clearFirst) await clearEditable(editableEl)
        placeCaretAtEnd(editableEl)
        await navigator.clipboard.writeText(targetText)
        document.execCommand('paste')
        await humanDelay(480, 780)
        const c5 = verifySuccess(editableEl)
        if (c5.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'clipboard-api', actual: c5.actual } }
      } catch (_) {}
    }

    const finalCheck = verifySuccess(editableEl)
    return { ok: finalCheck.ok, method: 'failed', actual: finalCheck.actual }
  }

  function dispatchEscape(target = document.activeElement || document.body) {
    try {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
      target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
    } catch (_) {}
  }

  function captureVisualImageSnapshot(root = document) {
    const knownSrcs = new Set()
    const knownNodes = new WeakSet()
    for (const el of queryAllDeep(root, 'img, canvas, video')) {
      knownNodes.add(el)
      const src = el.getAttribute?.('src') || el.currentSrc || ''
      if (src) knownSrcs.add(src)
    }
    return { knownSrcs, knownNodes }
  }

  function findNewlyRenderedMedia(snapshot, options = {}) {
    const { root = document, minTop = 70, minWidth = 60, minHeight = 60, excludeAvatar = true } = options
    for (const el of queryAllDeep(root, 'img, canvas, video')) {
      if (!isReallyVisible(el, { minWidth, minHeight })) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < minTop) continue
      if (excludeAvatar) {
        const meta = `${el.className || ''} ${el.getAttribute('alt') || ''} ${el.getAttribute('data-e2e') || ''}`
        if (/avatar|profile-icon/i.test(meta) && rect.width < 95 && rect.height < 95) continue
      }
      const src = el.getAttribute?.('src') || el.currentSrc || ''
      const isNewNode = !snapshot.knownNodes.has(el)
      const isNewSrc = src && !snapshot.knownSrcs.has(src)
      const isBlobOrData = src.startsWith('blob:') || src.startsWith('data:image/')
      if (el.tagName === 'IMG') {
        if (!el.complete || el.naturalWidth < 40) continue
        if (isNewSrc || (isNewNode && isBlobOrData) || (isNewNode && rect.width >= 90 && rect.height >= 90)) return el
      } else if (el.tagName === 'CANVAS' && isNewNode && el.width >= 60 && el.height >= 60) {
        return el
      } else if (el.tagName === 'VIDEO' && (isNewSrc || isNewNode) && (el.readyState >= 1 || el.videoWidth > 0)) {
        return el
      }
    }
    return null
  }

  function buildStableSelector(el) {
    if (!el || !el.tagName) return ''
    const tag = el.tagName.toLowerCase()
    const parts = []
    if (el.closest('[role="dialog"]')) parts.push('div[role="dialog"]')
    else if (el.closest('[role="listbox"]')) parts.push('[role="listbox"]')
    else if (el.closest('[role="main"]')) parts.push('[role="main"]')

    let nodeSel = tag
    const e2e = el.getAttribute('data-e2e')
    const role = el.getAttribute('role')
    const aria = el.getAttribute('aria-label')
    const hasPopup = el.getAttribute('aria-haspopup')
    const editable = el.getAttribute('contenteditable')
    if (e2e) nodeSel += `[data-e2e="${CSS.escape(e2e)}"]`
    else {
      if (role) nodeSel += `[role="${CSS.escape(role)}"]`
      if (hasPopup) nodeSel += `[aria-haspopup="${CSS.escape(hasPopup)}"]`
      if (editable === 'true') nodeSel += '[contenteditable="true"]'
      if (aria && aria.length <= 40) nodeSel += `[aria-label*="${CSS.escape(aria.slice(0, 22))}"]`
    }
    parts.push(nodeSel)
    return parts.join(' ')
  }

  function buildRichInteractiveMap(root = document, maxItems = 110, goalHint = '') {
    currentMarkLookup = new Map()
    const selector = 'button,[role="button"],[role="tab"],[role="combobox"],[role="option"],[role="menuitem"],[role="radio"],[role="textbox"],[contenteditable="true"],input:not([type="hidden"]):not([type="file"]),textarea,select,a[href],div[class*="Select"],div[class*="Option"],div[class*="option"]'
    const allNodes = queryAllDeep(root, selector)
    const goalWords = stripToMatchKey(goalHint).split(' ').filter((w) => w.length >= 3)
    const scoredNodes = []

    for (const el of allNodes) {
      if (el.closest?.(`#${HUD_HOST_ID}`)) continue
      if (!isReallyVisible(el, { minWidth: 14, minHeight: 14 })) continue
      const rect = el.getBoundingClientRect()
      const text = normalizeText(el.innerText || el.textContent).slice(0, 80)
      const ariaLabel = normalizeText(el.getAttribute('aria-label')).slice(0, 80)
      const dataE2e = el.getAttribute('data-e2e') || ''
      const tag = el.tagName.toLowerCase()
      const role = el.getAttribute('role') || tag
      const isEditable = el.isContentEditable || tag === 'input' || tag === 'textarea'
      if (!text && !ariaLabel && !dataE2e && !isEditable) continue

      const inDialog = Boolean(el.closest('[role="dialog"], [aria-modal="true"]'))
      const inPortal = Boolean(
        el.closest('[role="listbox"], [role="menu"], [data-floating-ui-portal], [class*="Popover"], [class*="SelectList"], [class*="Dropdown"]') ||
        ['option', 'menuitem', 'radio'].includes(role)
      )
      const combined = `${text} ${ariaLabel}`
      const combinedKey = stripToMatchKey(combined)
      let priority = 0
      if (inPortal) priority += 130
      if (inDialog) priority += 85
      if (isInViewport(rect)) priority += 45
      if (/bạn đang nghĩ gì|tạo bài viết|viết gì|what's on your mind|mọi người|chỉ mình|bạn bè|công khai|đối tượng|quyền riêng tư|xong|lưu|đăng|post|everyone|only|private|done|save/i.test(combined)) priority += 120
      if (goalWords.length > 0) {
        const hitCount = goalWords.filter((w) => combinedKey.includes(w)).length
        priority += hitCount * 35
      }
      if (/nhãn ai|ai label|chia sẻ suy nghĩ/i.test(combined)) priority -= 120
      if (el.querySelectorAll('*').length > 10) priority -= 25

      scoredNodes.push({ el, rect, text, ariaLabel, dataE2e, tag, role, inDialog, inPortal, priority })
    }

    scoredNodes.sort((a, b) => b.priority - a.priority)
    const items = []
    let id = 1
    for (const n of scoredNodes.slice(0, maxItems)) {
      const color = getElementColorInfo(n.el)
      const markId = id++
      currentMarkLookup.set(markId, n.el)
      items.push({
        id: markId, tag: n.tag, role: n.role,
        label: (n.ariaLabel || n.text).slice(0, 80),
        text: n.text, ariaLabel: n.ariaLabel, dataE2e: n.dataE2e,
        stableSelector: buildStableSelector(n.el),
        inDialog: n.inDialog, inPortal: n.inPortal,
        disabled: isElementDisabled(n.el),
        primaryColor: color.isRedPink ? 'red' : color.isBlue ? 'blue' : 'neutral',
        x: Math.round(n.rect.left), y: Math.round(n.rect.top),
        w: Math.round(n.rect.width), h: Math.round(n.rect.height)
      })
    }
    return items
  }

  function getElementByMarkId(markId) { return currentMarkLookup.get(Number(markId)) || null }

  function reportStep(platform, step, message, level = 'info', extra = {}) {
    try {
      showHudStatus(`[${platform.toUpperCase()}] ${message}`, level)
      chrome.runtime.sendMessage({ type: 'JOB_STEP_PROGRESS', platform, step, message, level, extra, timestamp: new Date().toISOString() }, () => { void chrome.runtime.lastError })
    } catch (_) {}
  }

  function ensureHudHost() {
    let host = document.getElementById(HUD_HOST_ID)
    if (host) return host
    host = document.createElement('div')
    host.id = HUD_HOST_ID
    host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;'
    document.documentElement.appendChild(host)
    return host
  }

  function showHudStatus(text, level = 'info') {
    if (!hudEnabled) return
    try {
      const host = ensureHudHost()
      const colors = {
        info: { bg: 'rgba(15, 23, 42, 0.92)', border: '#10b981', dot: '#10b981' },
        warn: { bg: 'rgba(30, 27, 15, 0.94)', border: '#f59e0b', dot: '#f59e0b' },
        error: { bg: 'rgba(42, 14, 18, 0.95)', border: '#ef4444', dot: '#ef4444' },
        success: { bg: 'rgba(6, 42, 28, 0.95)', border: '#22c55e', dot: '#22c55e' }
      }
      const theme = colors[level] || colors.info
      host.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:${theme.bg};border:1px solid ${theme.border};color:#f8fafc;padding:8px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-size:12px;font-weight:600;max-width:400px;backdrop-filter:blur(6px);"><span style="width:8px;height:8px;border-radius:50%;background:${theme.dot};flex-shrink:0;"></span><span>👁️ ${String(text).replace(/[<>&]/g, '')}</span></div>`
    } catch (_) {}
  }

  function clearHud(delayMs = 4500) {
    setTimeout(() => { try { document.getElementById(HUD_HOST_ID)?.remove() } catch (_) {} }, delayMs)
  }

  function applyConfig(cfg = {}) {
    if (typeof cfg.showHud === 'boolean') {
      hudEnabled = cfg.showHud
      if (!hudEnabled) { try { document.getElementById(HUD_HOST_ID)?.remove() } catch (_) {} }
    }
    if (cfg.pacingMode && ['normal', 'careful', 'fast'].includes(cfg.pacingMode)) pacingMode = cfg.pacingMode
  }

  try {
    chrome.storage?.local?.get('visionConfig', (res) => { if (res?.visionConfig) applyConfig(res.visionConfig) })
  } catch (_) {}

  async function getLearnedRule(stepKey) {
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_LEARNED_KNOWLEDGE', stepKey }, (r) => {
          void chrome.runtime.lastError
          resolve(r || null)
        })
      })
      return res?.rule || null
    } catch (_) { return null }
  }

  async function saveLearnedRule(stepKey, el, extra = {}) {
    if (!stepKey) return
    const rule = {
      selector: extra.selector || (el ? buildStableSelector(el) : ''),
      role: extra.role || el?.getAttribute?.('role') || el?.tagName?.toLowerCase() || '',
      textPattern: extra.textPattern || (el ? normalizeText(el.innerText || el.textContent).slice(0, 45) : ''),
      ariaPattern: extra.ariaPattern || (el ? normalizeText(el.getAttribute?.('aria-label')).slice(0, 45) : ''),
      inDialog: typeof extra.inDialog === 'boolean' ? extra.inDialog : Boolean(el?.closest?.('[role="dialog"], [aria-modal="true"]')),
      clickMode: extra.clickMode || 'normal',
      learnedAt: new Date().toISOString()
    }
    try {
      chrome.runtime.sendMessage({ type: 'SAVE_LEARNED_KNOWLEDGE', stepKey, rule }, () => { void chrome.runtime.lastError })
    } catch (_) {}
  }

  async function invalidateLearnedRule(stepKey) {
    if (!stepKey) return
    try {
      chrome.runtime.sendMessage({ type: 'INVALIDATE_LEARNED_KNOWLEDGE', stepKey }, () => { void chrome.runtime.lastError })
    } catch (_) {}
  }

  function findByLearnedRule(rule, root = document) {
    if (!rule) return null
    const scope = rule.inDialog ? (document.querySelector('div[role="dialog"], div[aria-modal="true"]') || root) : root
    const textRe = rule.textPattern ? new RegExp(rule.textPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('|').join('|'), 'i') : null
    const ariaRe = rule.ariaPattern ? new RegExp(rule.ariaPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null

    const candidates = []
    if (rule.selector) {
      try {
        for (const el of queryAllDeep(scope, rule.selector)) {
          if (isReallyVisible(el, { minWidth: 16, minHeight: 14 })) candidates.push(el)
        }
      } catch (_) {}
    }
    if (!candidates.length && rule.role) {
      for (const el of queryAllDeep(scope, `[role="${rule.role}"], ${rule.role}`)) {
        if (isReallyVisible(el, { minWidth: 16, minHeight: 14 })) candidates.push(el)
      }
    }

    for (const el of candidates) {
      const txt = normalizeText(el.innerText || el.textContent)
      const aria = normalizeText(el.getAttribute('aria-label'))
      if (textRe && txt && textRe.test(txt) && txt.length <= 120) return el
      if (ariaRe && aria && ariaRe.test(aria)) return el
    }
    return candidates.length === 1 ? candidates[0] : null
  }

  async function askSelfHealingAI({ platform, stepKey, goal, root = document, errorReason = '' }) {
    reportStep(platform, 'ai_heal', `🧠 Đang nhờ Mắt Vision qwen3.5:4b phân tích "${stepKey}"...`, 'warn')
    const elements = buildRichInteractiveMap(root, 95, goal)
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'AI_SELF_HEAL',
          payload: {
            platform, stepKey, goal,
            url: location.href,
            errorReason,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            scrollY: Math.round(window.scrollY),
            elements
          }
        }, (reply) => {
          void chrome.runtime.lastError
          resolve(reply || { ok: false })
        })
      })

      if (res?.ok) {
        const element = res.targetMarkId ? getElementByMarkId(res.targetMarkId) : null
        reportStep(platform, 'ai_heal', `🧠 Vision AI phán đoán: ${res.diagnosis || res.action}`, 'info')
        return { ...res, element }
      }
      reportStep(platform, 'ai_heal', `⚠️ Vision AI chưa kết nối được (${res?.error || 'kiểm tra tab Admin & Ollama'})`, 'warn')
      return { ok: false, action: 'wait_and_retry', element: null, error: res?.error }
    } catch (err) {
      return { ok: false, error: err.message, element: null }
    }
  }

  globalThis.OmniVision = {
    version: '3.5.1',
    sleep, randomGaussianBetween, humanDelay, humanMicroPause, humanReadPause, humanReviewPause,
    humanScrollPause, humanWatchPause, smoothScrollToTop,
    normalizeText, stripToMatchKey, formatPostText, truncateClean, formatHashtags, composeBodyAndHashtags, parseHumanCount,
    getDeepActiveElement, queryAllDeep, isReallyVisible, isElementDisabled, isInViewport,
    getAccessibleLabel, getElementColorInfo, inspectPageHealth, waitForPageStable,
    getScrollableAncestor, scrollIntoViewSafely, scrollContainerToBottom, scrollPageDownForFeed,
    findLabelElement, findControlNearLabel, humanClick, readEditorValue, isTextMatched, smartTypeText, dispatchEscape,
    captureVisualImageSnapshot, findNewlyRenderedMedia,
    buildStableSelector, buildRichInteractiveMap, getElementByMarkId,
    reportStep, showHudStatus, clearHud, applyConfig,
    getLearnedRule, saveLearnedRule, invalidateLearnedRule, findByLearnedRule, askSelfHealingAI
  }
})()
