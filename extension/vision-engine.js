/*
  FILE NOTE
  - Mục đích: Lõi nhận thức thị giác & mô phỏng hành vi người thật 24/7 (OmniVision Engine v3.2.0).
  - Nâng cấp v3.2.0:
    1. Giữ nguyên thanh thông báo trạng thái con mắt (👁️) ở góc phải dưới màn hình.
    2. Ẩn hoàn toàn mọi khung viền/nhãn thao tác đè lên giao diện FB/TikTok (highlightTarget & showVisualMarks chạy ngầm không hiển thị khung che màn hình).
*/

;(() => {
  if (globalThis.__OMNICART_VISION_VERSION__ === '3.2.0' && globalThis.OmniVision) {
    return
  }
  globalThis.__OMNICART_VISION_VERSION__ = '3.2.0'

  const HUD_HOST_ID = 'omnicart-vision-hud-host'

  let hudEnabled = true
  let pacingMode = 'normal'
  let currentMarkLookup = new Map()

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))
  }

  function getPacingMultiplier() {
    if (pacingMode === 'careful') return 1.55
    if (pacingMode === 'fast') return 0.45
    return 1.0
  }

  function randomGaussianBetween(minMs, maxMs) {
    const low = Math.min(minMs, maxMs)
    const high = Math.max(minMs, maxMs)
    const u = (Math.random() + Math.random() + Math.random()) / 3
    return Math.round(low + u * (high - low))
  }

  async function humanDelay(minMs = 600, maxMs = 1400) {
    const ms = Math.max(80, Math.round(randomGaussianBetween(minMs, maxMs) * getPacingMultiplier()))
    await sleep(ms)
    return ms
  }

  async function humanMicroPause() { return humanDelay(180, 420) }
  async function humanReadPause() { return humanDelay(1050, 2100) }
  async function humanReviewPause() { return humanDelay(1500, 2700) }

  async function smoothScrollToTop() {
    if (window.scrollY <= 60) return
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      const deadline = Date.now() + 2600
      while (window.scrollY > 60 && Date.now() < deadline) await sleep(160)
      if (window.scrollY > 60) window.scrollTo(0, 0)
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
        await sleep(2000)
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
        await sleep(800)
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
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 20) return cur
      cur = cur.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  async function scrollIntoViewSafely(el, block = 'center') {
    if (!el) return
    try {
      el.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' })
      await humanDelay(280, 540)
    } catch (_) {
      try { el.scrollIntoView({ block }) } catch (_) {}
      await sleep(220)
    }
  }

  async function scrollContainerToBottom(referenceEl) {
    const scroller = referenceEl ? getScrollableAncestor(referenceEl) : (document.scrollingElement || document.documentElement)
    try {
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      const current = scroller.scrollTop || 0
      const remaining = maxTop - current
      if (remaining > 60) {
        const steps = Math.min(5, Math.max(2, Math.ceil(remaining / 380)))
        for (let i = 1; i <= steps; i++) {
          const nextTop = current + (remaining * i) / steps
          scroller.scrollTo ? scroller.scrollTo({ top: nextTop, behavior: 'smooth' }) : (scroller.scrollTop = nextTop)
          await humanDelay(240, 460)
        }
      }
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } catch (_) {
      try { window.scrollTo(0, document.body.scrollHeight) } catch (_) {}
    }
    await humanDelay(400, 720)
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

  // Click ngầm mô phỏng hành vi người thật (KHÔNG vẽ khung xanh che màn hình!)
  async function humanClick(el) {
    if (!el) return false
    await scrollIntoViewSafely(el, 'center')

    const rect = el.getBoundingClientRect()
    const cx = Math.round(rect.left + rect.width * (0.3 + Math.random() * 0.4))
    const cy = Math.round(rect.top + rect.height * (0.3 + Math.random() * 0.4))
    const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 }

    try { el.dispatchEvent(new PointerEvent('pointermove', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerover', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousemove', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseover', { ...common, buttons: 0 })) } catch (_) {}
    await humanDelay(110, 240)

    try { el.dispatchEvent(new PointerEvent('pointerdown', common)) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', common)) } catch (_) {}
    try { el.focus({ preventScroll: true }) } catch (_) {}
    await sleep(randomGaussianBetween(65, 145))

    try { el.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.click() } catch (_) {
      try { el.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 })) } catch (_) {}
    }

    await humanDelay(240, 480)
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
      await sleep(90)
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
      await sleep(120)
    } catch (_) {}
  }

  async function typeNativeInputHumanLike(el, targetText) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    let built = '', idx = 0
    while (idx < targetText.length) {
      const step = Math.min(targetText.length - idx, randomGaussianBetween(2, 6))
      const chunk = targetText.slice(idx, idx + step)
      built += chunk
      idx += step
      if (setter) setter.call(el, built)
      else el.value = built
      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: chunk }))
      await sleep(Math.round(randomGaussianBetween(35, 90) * getPacingMultiplier()))
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
      await humanDelay(320, 620)
      const res = verifySuccess(el)
      return { ok: res.ok, method: humanBurst ? 'human-native-burst' : 'native-setter', actual: res.actual }
    }

    const editableEl = el.isContentEditable
      ? (el.querySelector('[contenteditable="true"]') || el)
      : (el.querySelector('[contenteditable="true"], [contenteditable="plaintext-only"]') || el)

    await humanClick(editableEl)
    if (clearFirst) await clearEditable(editableEl)
    placeCaretAtEnd(editableEl)
    await humanDelay(450, 900)

    try {
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      editableEl.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true, clipboardData: dt }))
      await humanDelay(550, 880)
      const c1 = verifySuccess(editableEl)
      if (c1.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'synthetic-paste', actual: c1.actual } }
    } catch (_) {}

    try {
      if (clearFirst) await clearEditable(editableEl)
      placeCaretAtEnd(editableEl)
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      editableEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, composed: true, inputType: 'insertFromPaste', data: targetText, dataTransfer: dt }))
      await humanDelay(500, 820)
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
        await sleep(Math.round(randomGaussianBetween(65, 150) * getPacingMultiplier()))
      }
      await humanDelay(520, 850)
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
      await humanDelay(500, 820)
      const c4 = verifySuccess(editableEl)
      if (c4.ok) { if (dismissPopover) dispatchEscape(editableEl); return { ok: true, method: 'execCommand-lines', actual: c4.actual } }
    } catch (_) {}

    if (document.hasFocus()) {
      try {
        if (clearFirst) await clearEditable(editableEl)
        placeCaretAtEnd(editableEl)
        await navigator.clipboard.writeText(targetText)
        document.execCommand('paste')
        await humanDelay(500, 800)
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

  function buildInteractiveMap(root = document, maxItems = 75) {
    currentMarkLookup = new Map()
    const selector = 'button,[role="button"],[role="tab"],[role="combobox"],[role="option"],[role="menuitem"],[role="radio"],[role="textbox"],[contenteditable="true"],input:not([type="hidden"]):not([type="file"]),textarea,select,a[href]'
    const items = []
    let id = 1
    for (const el of queryAllDeep(root, selector)) {
      if (id > maxItems) break
      if (el.closest?.(`#${HUD_HOST_ID}`)) continue
      if (!isReallyVisible(el, { minWidth: 14, minHeight: 14 })) continue
      const rect = el.getBoundingClientRect()
      if (!isInViewport(rect)) continue
      const label = getAccessibleLabel(el).slice(0, 90)
      const tag = el.tagName.toLowerCase()
      const isEditable = el.isContentEditable || tag === 'input' || tag === 'textarea'
      if (!label && !isEditable) continue
      const color = getElementColorInfo(el)
      const markId = id++
      currentMarkLookup.set(markId, el)
      items.push({
        id: markId, tag, role: el.getAttribute('role') || tag, label,
        disabled: isElementDisabled(el), editable: isEditable,
        primaryColor: color.isRedPink ? 'red' : color.isBlue ? 'blue' : 'neutral',
        rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
      })
    }
    return { url: location.href, title: document.title, viewport: { width: window.innerWidth, height: window.innerHeight }, items }
  }

  function getElementByMarkId(markId) { return currentMarkLookup.get(Number(markId)) || null }

  // Chạy ngầm không vẽ ô đỏ lên màn hình
  async function askVisionAI(goal, context = {}) {
    try {
      const somMap = buildInteractiveMap(context.root || document)
      if (!somMap.items.length) return { ok: false, reason: 'NO_INTERACTIVE_ELEMENTS' }
      const response = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: 'VISION_AI_ANALYZE', goal, platform: context.platform || 'unknown', step: context.step || '', somMap }, (res) => {
            if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message })
            else resolve(res || { ok: false, error: 'NO_VISION_RESPONSE' })
          })
        } catch (err) { resolve({ ok: false, error: err.message }) }
      })
      if (response?.ok && response.targetMarkId) return { ...response, element: getElementByMarkId(response.targetMarkId) }
      return response
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  function reportStep(platform, step, message, level = 'info', extra = {}) {
    try {
      showHudStatus(`[${platform.toUpperCase()}] ${message}`, level)
      chrome.runtime.sendMessage({ type: 'JOB_STEP_PROGRESS', platform, step, message, level, extra, timestamp: new Date().toISOString() }).catch?.(() => {})
    } catch (_) {}
  }

  // CHỈ HIỆN DÒNG THÔNG BÁO CON MẮT NHỎ Ở GÓC PHẢI DƯỚI MÀN HÌNH
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
      host.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:${theme.bg};border:1px solid ${theme.border};color:#f8fafc;padding:8px 12px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-size:12px;font-weight:600;max-width:390px;backdrop-filter:blur(6px);"><span style="width:8px;height:8px;border-radius:50%;background:${theme.dot};flex-shrink:0;"></span><span>👁️ ${String(text).replace(/[<>&]/g, '')}</span></div>`
    } catch (_) {}
  }

  function clearHud(delayMs = 4500) {
    setTimeout(() => { try { document.getElementById(HUD_HOST_ID)?.remove() } catch (_) {} }, delayMs)
  }

  // Ẩn hoàn toàn khung highlight đè lên trang web!
  function highlightTarget() {}
  function showVisualMarks() {}
  function clearVisualMarks() {}

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

  globalThis.OmniVision = {
    version: '3.2.0',
    sleep, humanDelay, humanMicroPause, humanReadPause, humanReviewPause, smoothScrollToTop,
    normalizeText, stripToMatchKey, formatPostText, truncateClean, formatHashtags, composeBodyAndHashtags, parseHumanCount,
    getDeepActiveElement, queryAllDeep, isReallyVisible, isElementDisabled, isInViewport,
    getAccessibleLabel, getElementColorInfo, inspectPageHealth, waitForPageStable,
    getScrollableAncestor, scrollIntoViewSafely, scrollContainerToBottom,
    findLabelElement, findControlNearLabel, humanClick, readEditorValue, isTextMatched, smartTypeText, dispatchEscape,
    captureVisualImageSnapshot, findNewlyRenderedMedia, buildInteractiveMap,
    showVisualMarks, clearVisualMarks, getElementByMarkId, askVisionAI,
    reportStep, showHudStatus, highlightTarget, clearHud, applyConfig
  }
})()
