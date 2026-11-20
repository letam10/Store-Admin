/*
  FILE NOTE
  - Mục đích: Lõi nhận thức thị giác (OmniVision Engine) cho content script trên Facebook & TikTok.
  - Tính năng chính:
    1. Quét DOM sâu xuyên Shadow DOM & same-origin iframe, kiểm tra độ hiển thị hình học thực tế.
    2. Neo không gian (Spatial Grounding): định vị ô nhập / dropdown dựa trên vị trí tương đối với nhãn hiển thị như mắt người.
    3. Set-of-Mark (SoM): đánh số trực quan các phần tử tương tác và gọi Vision AI qua background.js khi cần.
    4. Nhập liệu đa chiến lược có tự kiểm chứng (Lexical / Draft.js / Slate / React input) chạy được cả ở tab nền.
    5. Lớp phủ HUD trực quan (pointer-events: none) giúp quan sát mắt extension theo thời gian thực.
*/

;(() => {
  if (globalThis.__OMNICART_VISION_VERSION__ === '2.0.0' && globalThis.OmniVision) {
    return
  }
  globalThis.__OMNICART_VISION_VERSION__ = '2.0.0'

  const HUD_HOST_ID = 'omnicart-vision-hud-host'
  const MARK_LAYER_ID = 'omnicart-vision-som-layer'
  const HIGHLIGHT_ID = 'omnicart-vision-target-box'

  let hudEnabled = true
  let currentMarkLookup = new Map()

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function truncateClean(text, maxLen) {
    const clean = normalizeText(text)
    if (clean.length <= maxLen) return clean
    const slice = clean.slice(0, maxLen)
    const lastSpace = slice.lastIndexOf(' ')
    return (lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice).trim()
  }

  // Duyệt DOM sâu qua open ShadowRoot và same-origin iframe
  function queryAllDeep(root = document, selector = '*') {
    const results = []
    const visited = new Set()

    function walk(node) {
      if (!node || visited.has(node)) return
      visited.add(node)

      if (typeof node.querySelectorAll === 'function') {
        try {
          const matched = node.querySelectorAll(selector)
          for (const el of matched) results.push(el)
        } catch (_) {}

        try {
          const allNodes = node.querySelectorAll('*')
          for (const el of allNodes) {
            if (el.shadowRoot) walk(el.shadowRoot)
            if (el.tagName === 'IFRAME') {
              try {
                if (el.contentDocument) walk(el.contentDocument)
              } catch (_) {}
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
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false
    }
    if (parseFloat(style.opacity || '1') < 0.05) return false

    return true
  }

  function isElementDisabled(el) {
    if (!el) return true
    if (el.disabled === true) return true
    if (el.getAttribute('aria-disabled') === 'true') return true
    if (el.getAttribute('data-disabled') === 'true') return true
    const style = window.getComputedStyle(el)
    if (style && style.pointerEvents === 'none') return true
    return false
  }

  function isInViewport(rect) {
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    )
  }

  function getAccessibleLabel(el) {
    if (!el) return ''
    const parts = [
      el.getAttribute?.('aria-label'),
      el.getAttribute?.('placeholder'),
      el.getAttribute?.('data-placeholder'),
      el.getAttribute?.('title'),
      el.getAttribute?.('alt'),
      el.innerText || el.textContent
    ]
    return normalizeText(parts.filter(Boolean).join(' '))
  }

  function getElementColorInfo(el) {
    try {
      const style = window.getComputedStyle(el)
      const bg = style.backgroundColor || ''
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (!match) return { bg, isRedPink: false, isBlue: false, isBrightPrimary: false }
      const r = Number(match[1])
      const g = Number(match[2])
      const b = Number(match[3])
      const isRedPink = r > 180 && g < 100 && b < 130
      const isBlue = b > 180 && r < 90 && g < 150
      return { bg, r, g, b, isRedPink, isBlue, isBrightPrimary: isRedPink || isBlue }
    } catch (_) {
      return { bg: '', isRedPink: false, isBlue: false, isBrightPrimary: false }
    }
  }

  function getScrollableAncestor(el) {
    let cur = el?.parentElement
    while (cur && cur !== document.body && cur !== document.documentElement) {
      const style = window.getComputedStyle(cur)
      const overflowY = style.overflowY
      if ((overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight + 20) {
        return cur
      }
      cur = cur.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  async function scrollIntoViewSafely(el, block = 'center') {
    if (!el) return
    try {
      el.scrollIntoView({ behavior: 'instant', block, inline: 'nearest' })
      await sleep(180)
    } catch (_) {}
  }

  async function scrollContainerToBottom(referenceEl) {
    const scroller = referenceEl ? getScrollableAncestor(referenceEl) : (document.scrollingElement || document.documentElement)
    try {
      scroller.scrollTop = scroller.scrollHeight
      window.scrollTo(0, document.body.scrollHeight)
    } catch (_) {}
    await sleep(350)
  }

  // Tìm nhãn chữ hiển thị trên màn hình (ưu tiên lá text nhỏ gọn nhất)
  function findLabelElement(pattern, options = {}) {
    const { root = document, minTop = 0, minLeft = 0, maxLength = 120 } = options
    const candidates = queryAllDeep(root, 'label, span, div, p, h1, h2, h3, h4, strong, b, legend')
    let best = null
    let bestScore = Infinity

    for (const el of candidates) {
      if (!isReallyVisible(el)) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < minTop || rect.left < minLeft) continue
      const text = normalizeText(el.innerText || el.textContent)
      if (!text || text.length > maxLength) continue
      if (!pattern.test(text)) continue

      // Ưu tiên node gọn nhất (ít ký tự nhất & diện tích nhỏ nhất)
      const score = text.length * 10 + Math.round(rect.width * rect.height / 500)
      if (score < bestScore) {
        bestScore = score
        best = el
      }
    }
    return best
  }

  // Tìm điều khiển tương tác theo vị trí hình học tương đối với nhãn (giống mắt người đọc form)
  function findControlNearLabel(labelEl, selector, options = {}) {
    if (!labelEl) return null
    const {
      root = document,
      direction = 'below', // 'below' | 'right' | 'any'
      maxVertical = 140,
      maxHorizontal = 260
    } = options

    const lRect = labelEl.getBoundingClientRect()
    const candidates = queryAllDeep(root, selector)
    let best = null
    let bestDist = Infinity

    for (const el of candidates) {
      if (el === labelEl || el.contains(labelEl)) continue
      if (!isReallyVisible(el, { minWidth: 20, minHeight: 16 })) continue
      const r = el.getBoundingClientRect()

      if (direction === 'below') {
        const dy = r.top - lRect.bottom
        if (dy < -16 || dy > maxVertical) continue
        const horizontalOverlap = r.right >= lRect.left - 60 && r.left <= lRect.right + maxHorizontal
        if (!horizontalOverlap) continue
        const dx = Math.abs(r.left - lRect.left)
        const dist = Math.max(0, dy) * 2 + dx
        if (dist < bestDist) {
          bestDist = dist
          best = el
        }
      } else if (direction === 'right') {
        const dx = r.left - lRect.right
        if (dx < -10 || dx > maxHorizontal) continue
        const dy = Math.abs((r.top + r.bottom) / 2 - (lRect.top + lRect.bottom) / 2)
        if (dy > maxVertical) continue
        const dist = Math.max(0, dx) + dy * 3
        if (dist < bestDist) {
          bestDist = dist
          best = el
        }
      } else {
        const cx1 = (lRect.left + lRect.right) / 2
        const cy1 = (lRect.top + lRect.bottom) / 2
        const cx2 = (r.left + r.right) / 2
        const cy2 = (r.top + r.bottom) / 2
        const dist = Math.hypot(cx2 - cx1, cy2 - cy1)
        if (dist < bestDist) {
          bestDist = dist
          best = el
        }
      }
    }

    return best
  }

  // Click giả lập đầy đủ chuỗi sự kiện pointer + mouse như người thật
  async function humanClick(el, label = '') {
    if (!el) return false
    await scrollIntoViewSafely(el, 'center')
    highlightTarget(el, label || getAccessibleLabel(el).slice(0, 32), '#10b981')

    const rect = el.getBoundingClientRect()
    const cx = Math.round(rect.left + rect.width / 2)
    const cy = Math.round(rect.top + rect.height / 2)

    const common = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1
    }

    try { el.dispatchEvent(new PointerEvent('pointerover', common)) } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerenter', { ...common, bubbles: false })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseover', common)) } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', common)) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', common)) } catch (_) {}
    try { el.focus({ preventScroll: true }) } catch (_) {}
    await sleep(45)
    try { el.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 })) } catch (_) {}
    try { el.click() } catch (_) {
      try { el.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 })) } catch (_) {}
    }

    await sleep(120)
    return true
  }

  function readEditorValue(el) {
    if (!el) return ''
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value || ''
    }
    return el.innerText || el.textContent || ''
  }

  function isTextMatched(actualRaw, expectedRaw) {
    const actual = normalizeText(actualRaw)
    const expected = normalizeText(expectedRaw)
    if (!actual || !expected) return false
    const probe = expected.slice(0, Math.min(18, expected.length))
    if (actual.includes(probe) && actual.length >= Math.min(expected.length * 0.5, 25)) {
      return true
    }
    const cleanA = actual.replace(/\s+/g, '')
    const cleanE = expected.replace(/\s+/g, '')
    return cleanA.includes(cleanE.slice(0, Math.min(16, cleanE.length)))
  }

  function placeCaretAtEnd(el) {
    try {
      el.focus({ preventScroll: true })
      const sel = window.getSelection()
      if (!sel) return
      const range = document.createRange()
      const target = el.querySelector('p, span[data-text="true"], div') || el
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
      await sleep(80)
    } catch (_) {}
  }

  // Nhập văn bản đa chiến lược có tự kiểm chứng — hoạt động ổn định trên Lexical, Draft.js, Slate, React Input cả khi ở tab nền
  async function smartTypeText(el, text, options = {}) {
    if (!el) return { ok: false, method: 'none', actual: '' }
    const { clearFirst = true, label = 'Nhập văn bản', dismissPopover = false } = options
    const targetText = String(text || '').trim()
    if (!targetText) return { ok: false, method: 'empty', actual: '' }

    await scrollIntoViewSafely(el, 'center')
    highlightTarget(el, label, '#38bdf8')

    // Case 1: Native <input> / <textarea> (React controlled input)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      await humanClick(el, label)
      if (clearFirst) await clearEditable(el)
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      if (setter) setter.call(el, targetText)
      else el.value = targetText

      el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: targetText }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await sleep(250)

      const actual = readEditorValue(el)
      return { ok: isTextMatched(actual, targetText), method: 'native-setter', actual }
    }

    // Case 2: ContentEditable (Facebook Lexical / TikTok Draft.js / Slate)
    await humanClick(el, label)
    if (clearFirst) await clearEditable(el)
    placeCaretAtEnd(el)

    // Chiến lược 1: Synthetic ClipboardEvent('paste') — Tốt nhất cho Lexical & Draft.js kể cả tab nền!
    try {
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      const pasteEvt = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt
      })
      el.dispatchEvent(pasteEvt)
      await sleep(380)
      const actual1 = readEditorValue(el)
      if (isTextMatched(actual1, targetText)) {
        if (dismissPopover) dispatchEscape(el)
        return { ok: true, method: 'synthetic-paste', actual: actual1 }
      }
    } catch (_) {}

    // Chiến lược 2: InputEvent('beforeinput') với insertFromPaste (Lexical bắt trực tiếp)
    try {
      if (clearFirst) await clearEditable(el)
      placeCaretAtEnd(el)
      const dt = new DataTransfer()
      dt.setData('text/plain', targetText)
      const beforeInput = new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertFromPaste',
        data: targetText,
        dataTransfer: dt
      })
      el.dispatchEvent(beforeInput)
      await sleep(350)
      const actual2 = readEditorValue(el)
      if (isTextMatched(actual2, targetText)) {
        if (dismissPopover) dispatchEscape(el)
        return { ok: true, method: 'beforeinput-paste', actual: actual2 }
      }
    } catch (_) {}

    // Chiến lược 3: document.execCommand('insertText')
    try {
      if (clearFirst) await clearEditable(el)
      placeCaretAtEnd(el)
      document.execCommand('insertText', false, targetText)
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: targetText }))
      await sleep(350)
      const actual3 = readEditorValue(el)
      if (isTextMatched(actual3, targetText)) {
        if (dismissPopover) dispatchEscape(el)
        return { ok: true, method: 'execCommand-insertText', actual: actual3 }
      }
    } catch (_) {}

    // Chiến lược 4: InputEvent('beforeinput', insertText) từng dòng
    try {
      if (clearFirst) await clearEditable(el)
      placeCaretAtEnd(el)
      const lines = targetText.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line) {
          el.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: line
          }))
          document.execCommand('insertText', false, line)
        }
        if (i < lines.length - 1) {
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
          document.execCommand('insertLineBreak', false, null)
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
        }
        await sleep(35)
      }
      await sleep(350)
      const actual4 = readEditorValue(el)
      if (isTextMatched(actual4, targetText)) {
        if (dismissPopover) dispatchEscape(el)
        return { ok: true, method: 'line-by-line', actual: actual4 }
      }
    } catch (_) {}

    // Chiến lược 5: Clipboard API thật (chỉ chạy nếu tab đang focus để không báo lỗi NotAllowedError)
    if (document.hasFocus()) {
      try {
        if (clearFirst) await clearEditable(el)
        placeCaretAtEnd(el)
        await navigator.clipboard.writeText(targetText)
        document.execCommand('paste')
        await sleep(350)
        const actual5 = readEditorValue(el)
        if (isTextMatched(actual5, targetText)) {
          if (dismissPopover) dispatchEscape(el)
          return { ok: true, method: 'clipboard-api', actual: actual5 }
        }
      } catch (_) {}
    }

    const finalActual = readEditorValue(el)
    return {
      ok: isTextMatched(finalActual, targetText),
      method: 'failed',
      actual: finalActual
    }
  }

  function dispatchEscape(target = document.activeElement || document.body) {
    try {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
      target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }))
    } catch (_) {}
  }

  // Chụp danh sách ảnh hiện có trước khi upload để phân biệt chính xác ảnh sản phẩm mới (không nhầm với avatar)
  function captureVisualImageSnapshot(root = document) {
    const knownSrcs = new Set()
    const knownNodes = new WeakSet()
    const imgs = queryAllDeep(root, 'img, canvas, video')
    for (const el of imgs) {
      knownNodes.add(el)
      const src = el.getAttribute?.('src') || el.currentSrc || ''
      if (src) knownSrcs.add(src)
    }
    return { knownSrcs, knownNodes }
  }

  function findNewlyRenderedMedia(snapshot, options = {}) {
    const {
      root = document,
      minTop = 70,
      minWidth = 60,
      minHeight = 60,
      excludeAvatar = true
    } = options

    const candidates = queryAllDeep(root, 'img, canvas, video')
    for (const el of candidates) {
      if (!isReallyVisible(el, { minWidth, minHeight })) continue
      const rect = el.getBoundingClientRect()
      if (rect.top < minTop) continue

      // Loại trừ ảnh avatar tròn nhỏ ở góc hoặc class avatar
      if (excludeAvatar) {
        const meta = `${el.className || ''} ${el.getAttribute('alt') || ''} ${el.getAttribute('data-e2e') || ''}`
        if (/avatar|profile-icon/i.test(meta) && rect.width < 90 && rect.height < 90) continue
      }

      const src = el.getAttribute?.('src') || el.currentSrc || ''
      const isNewNode = !snapshot.knownNodes.has(el)
      const isNewSrc = src && !snapshot.knownSrcs.has(src)
      const isBlobOrData = src.startsWith('blob:') || src.startsWith('data:image/')

      if (el.tagName === 'IMG') {
        if (!el.complete || el.naturalWidth < 40) continue
        if (isNewSrc || (isNewNode && isBlobOrData) || (isNewNode && rect.width >= 90 && rect.height >= 90)) {
          return el
        }
      } else if (el.tagName === 'CANVAS') {
        if (isNewNode && el.width >= 60 && el.height >= 60) return el
      } else if (el.tagName === 'VIDEO') {
        if ((isNewSrc || isNewNode) && (el.readyState >= 1 || el.videoWidth > 0)) return el
      }
    }
    return null
  }

  // Xây dựng bản đồ Set-of-Mark (SoM) toàn bộ nút/ô tương tác đang hiển thị trên màn hình
  function buildInteractiveMap(root = document, maxItems = 75) {
    currentMarkLookup = new Map()
    const selector = [
      'button',
      '[role="button"]',
      '[role="tab"]',
      '[role="combobox"]',
      '[role="option"]',
      '[role="menuitem"]',
      '[role="radio"]',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]',
      'input:not([type="hidden"]):not([type="file"])',
      'textarea',
      'select',
      'a[href]'
    ].join(',')

    const raw = queryAllDeep(root, selector)
    const items = []
    let id = 1

    for (const el of raw) {
      if (id > maxItems) break
      if (el.closest?.(`#${HUD_HOST_ID}, #${MARK_LAYER_ID}`)) continue
      if (!isReallyVisible(el, { minWidth: 16, minHeight: 16 })) continue

      const rect = el.getBoundingClientRect()
      if (!isInViewport(rect)) continue

      const label = getAccessibleLabel(el).slice(0, 90)
      const tag = el.tagName.toLowerCase()
      const role = el.getAttribute('role') || tag
      const isEditable = el.isContentEditable || tag === 'input' || tag === 'textarea'

      if (!label && !isEditable) continue

      const color = getElementColorInfo(el)
      const markId = id++
      currentMarkLookup.set(markId, el)
      items.push({
        id: markId,
        tag,
        role,
        label,
        disabled: isElementDisabled(el),
        editable: isEditable,
        primaryColor: color.isRedPink ? 'red' : color.isBlue ? 'blue' : 'neutral',
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height)
        }
      })
    }

    return {
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visibleHeadings: queryAllDeep(root, 'h1, h2, h3, [role="dialog"] span, [role="alert"], [role="status"]')
        .filter((el) => isReallyVisible(el))
        .map((el) => normalizeText(el.innerText || el.textContent))
        .filter((t) => t.length >= 2 && t.length <= 100)
        .slice(0, 25),
      items
    }
  }

  function showVisualMarks(somMap) {
    clearVisualMarks()
    if (!somMap?.items?.length) return
    const layer = document.createElement('div')
    layer.id = MARK_LAYER_ID
    layer.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;'

    for (const item of somMap.items) {
      const box = document.createElement('div')
      box.style.cssText = `
        position:fixed;
        left:${item.rect.x}px;
        top:${item.rect.y}px;
        width:${item.rect.w}px;
        height:${item.rect.h}px;
        border:2px solid #ef4444;
        border-radius:4px;
        box-sizing:border-box;
      `
      const badge = document.createElement('span')
      badge.textContent = String(item.id)
      badge.style.cssText = `
        position:absolute;
        top:-10px;
        left:-2px;
        background:#ef4444;
        color:#fff;
        font:700 11px/14px monospace;
        padding:0 4px;
        border-radius:3px;
      `
      box.appendChild(badge)
      layer.appendChild(box)
    }

    document.documentElement.appendChild(layer)
  }

  function clearVisualMarks() {
    try { document.getElementById(MARK_LAYER_ID)?.remove() } catch (_) {}
  }

  function getElementByMarkId(markId) {
    return currentMarkLookup.get(Number(markId)) || null
  }

  // Gọi Multimodal Vision AI (thông qua background.js) khi DOM cần hỗ trợ thị giác thực
  async function askVisionAI(goal, context = {}) {
    try {
      const somMap = buildInteractiveMap(context.root || document)
      if (!somMap.items.length) return { ok: false, reason: 'NO_INTERACTIVE_ELEMENTS' }

      showVisualMarks(somMap)
      await sleep(100)

      const response = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            {
              type: 'VISION_AI_ANALYZE',
              goal,
              platform: context.platform || 'unknown',
              step: context.step || '',
              somMap
            },
            (res) => {
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message })
              } else {
                resolve(res || { ok: false, error: 'NO_VISION_RESPONSE' })
              }
            }
          )
        } catch (err) {
          resolve({ ok: false, error: err.message })
        }
      })

      clearVisualMarks()

      if (response?.ok && response.targetMarkId) {
        const el = getElementByMarkId(response.targetMarkId)
        return { ...response, element: el }
      }
      return response
    } catch (err) {
      clearVisualMarks()
      return { ok: false, error: err.message }
    }
  }

  // Báo tiến độ bước thực hiện về background -> Store-Admin Live Dock
  function reportStep(platform, step, message, level = 'info', extra = {}) {
    try {
      showHudStatus(`[${platform.toUpperCase()}] ${message}`, level)
      chrome.runtime.sendMessage({
        type: 'JOB_STEP_PROGRESS',
        platform,
        step,
        message,
        level,
        extra,
        timestamp: new Date().toISOString()
      }).catch?.(() => {})
    } catch (_) {}
  }

  // Lớp phủ HUD trực quan góc màn hình (pointer-events: none — không cản thao tác)
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
      host.innerHTML = `
        <div style="
          display:flex;align-items:center;gap:8px;
          background:${theme.bg};
          border:1px solid ${theme.border};
          color:#f8fafc;
          padding:8px 12px;
          border-radius:10px;
          box-shadow:0 8px 24px rgba(0,0,0,0.35);
          font-size:12px;
          font-weight:600;
          max-width:340px;
          backdrop-filter:blur(6px);
        ">
          <span style="width:8px;height:8px;border-radius:50%;background:${theme.dot};flex-shrink:0;"></span>
          <span>👁️ ${String(text).replace(/[<>&]/g, '')}</span>
        </div>
      `
    } catch (_) {}
  }

  function clearHud(delayMs = 4000) {
    setTimeout(() => {
      try { document.getElementById(HUD_HOST_ID)?.remove() } catch (_) {}
      try { document.getElementById(HIGHLIGHT_ID)?.remove() } catch (_) {}
    }, delayMs)
  }

  function highlightTarget(el, label = '', color = '#10b981') {
    if (!hudEnabled || !el) return
    try {
      document.getElementById(HIGHLIGHT_ID)?.remove()
      const rect = el.getBoundingClientRect()
      if (!rect || rect.width < 4 || rect.height < 4) return

      const box = document.createElement('div')
      box.id = HIGHLIGHT_ID
      box.style.cssText = `
        position:fixed;
        left:${Math.max(0, rect.left - 3)}px;
        top:${Math.max(0, rect.top - 3)}px;
        width:${rect.width + 6}px;
        height:${rect.height + 6}px;
        border:2px solid ${color};
        background:${color}1a;
        border-radius:6px;
        z-index:2147483645;
        pointer-events:none;
        box-sizing:border-box;
        transition:all 0.15s ease;
      `
      if (label) {
        const tag = document.createElement('div')
        tag.textContent = `👁️ ${label}`
        tag.style.cssText = `
          position:absolute;
          top:-20px;
          left:0;
          background:${color};
          color:#04130c;
          font:700 10px/16px system-ui,sans-serif;
          padding:1px 6px;
          border-radius:4px;
          white-space:nowrap;
        `
        box.appendChild(tag)
      }
      document.documentElement.appendChild(box)
      setTimeout(() => {
        try { box.remove() } catch (_) {}
      }, 2200)
    } catch (_) {}
  }

  function setHudEnabled(enabled) {
    hudEnabled = enabled !== false
    if (!hudEnabled) {
      try { document.getElementById(HUD_HOST_ID)?.remove() } catch (_) {}
      try { document.getElementById(HIGHLIGHT_ID)?.remove() } catch (_) {}
    }
  }

  // Đọc cấu hình HUD từ storage nếu có
  try {
    chrome.storage?.local?.get('visionConfig', (res) => {
      if (res?.visionConfig && typeof res.visionConfig.showHud === 'boolean') {
        hudEnabled = res.visionConfig.showHud
      }
    })
  } catch (_) {}

  globalThis.OmniVision = {
    version: '2.0.0',
    sleep,
    normalizeText,
    truncateClean,
    queryAllDeep,
    isReallyVisible,
    isElementDisabled,
    isInViewport,
    getAccessibleLabel,
    getElementColorInfo,
    getScrollableAncestor,
    scrollIntoViewSafely,
    scrollContainerToBottom,
    findLabelElement,
    findControlNearLabel,
    humanClick,
    readEditorValue,
    isTextMatched,
    smartTypeText,
    dispatchEscape,
    captureVisualImageSnapshot,
    findNewlyRenderedMedia,
    buildInteractiveMap,
    showVisualMarks,
    clearVisualMarks,
    getElementByMarkId,
    askVisionAI,
    reportStep,
    showHudStatus,
    highlightTarget,
    clearHud,
    setHudEnabled
  }
})()