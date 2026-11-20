/*
  FILE NOTE
  - Mục đích: Cầu nối hai chiều bền vững giữa Store-Admin (React localhost:5174) và Background Service Worker.
  - Nâng cấp v2.0.0:
    1. Tương thích ngược 100% giao thức OMNICART_ADMIN_REQUEST / OMNICART_EXTENSION_RESPONSE.
    2. Persistent Port tự động kết nối lại + heartbeat giữ Service Worker không bị ngủ giữa chừng.
    3. Tự dọn dẹp sạch khi extension reload & bơm lại (triệt tiêu lỗi nhân đôi listener / context invalidated).
    4. Hiển thị Live OmniVision Status Dock (Shadow DOM tách biệt CSS) ngay góc phải dưới Store-Admin để theo dõi từng bước mắt extension đang làm.
*/

;(() => {
  if (typeof window.__OMNICART_ADMIN_BRIDGE_CLEANUP__ === 'function') {
    try { window.__OMNICART_ADMIN_BRIDGE_CLEANUP__() } catch (_) {}
  }

  let port = null
  let heartbeatTimer = null
  let reconnectTimer = null
  let destroyed = false
  const pendingPortRequests = new Map()
  const dockLogs = []
  let dockExpanded = false
  let dockShadow = null

  function getExtensionVersion() {
    try {
      return chrome.runtime.getManifest().version
    } catch (_) {
      return '2.0.0'
    }
  }

  function isRuntimeAlive() {
    try {
      return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)
    } catch (_) {
      return false
    }
  }

  // =========================================================================
  // LIVE OMNIVISION DOCK (Shadow DOM nổi gọn góc phải dưới trang Store-Admin)
  // =========================================================================
  function mountLiveDock() {
    try {
      document.getElementById('omnicart-admin-vision-dock')?.remove()
      const host = document.createElement('div')
      host.id = 'omnicart-admin-vision-dock'
      host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;font-family:system-ui,-apple-system,sans-serif;'
      dockShadow = host.attachShadow({ mode: 'open' })
      dockShadow.innerHTML = `
        <style>
          .pill {
            display:flex;align-items:center;gap:8px;
            background:#0c2419;color:#e2f8ec;
            border:1px solid #1e6042;border-radius:999px;
            padding:7px 13px;font-size:12px;font-weight:600;
            box-shadow:0 8px 24px rgba(0,0,0,0.35);
            cursor:pointer;user-select:none;
          }
          .pill:hover { border-color:#22c55e; }
          .dot { width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0; }
          .dot.busy { background:#f59e0b;animation:pulse 1s infinite; }
          .dot.err { background:#ef4444; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
          .panel {
            width:360px;max-height:300px;
            background:#071710;color:#e2f8ec;
            border:1px solid #1f5c3f;border-radius:12px;
            box-shadow:0 14px 36px rgba(0,0,0,0.5);
            overflow:hidden;display:none;flex-direction:column;
            margin-bottom:8px;
          }
          .panel.open { display:flex; }
          .head {
            display:flex;align-items:center;justify-content:space-between;
            padding:9px 12px;background:#0e2c1f;border-bottom:1px solid #1a4731;
            font-size:12px;font-weight:700;
          }
          .head-btn {
            background:transparent;border:1px solid #2b6e4c;color:#a7f3d0;
            border-radius:6px;padding:2px 7px;font-size:11px;cursor:pointer;
          }
          .logs {
            padding:8px 10px;overflow-y:auto;font-family:ui-monospace,monospace;
            font-size:11px;line-height:1.45;display:flex;flex-direction:column;gap:5px;
          }
          .row { padding:4px 6px;border-radius:6px;background:#0b2117;border-left:3px solid #10b981;word-break:break-word; }
          .row.warn { border-left-color:#f59e0b;color:#fde68a; }
          .row.error { border-left-color:#ef4444;color:#fecaca; }
          .row.success { border-left-color:#22c55e;color:#bbf7d0; }
          .meta { color:#6ee7b7;font-size:10px;opacity:0.8; }
        </style>
        <div class="panel" id="panel">
          <div class="head">
            <span>👁️ OmniVision Live Telemetry</span>
            <div style="display:flex;gap:6px;">
              <button class="head-btn" id="btn-clear">Xóa log</button>
              <button class="head-btn" id="btn-close">Thu gọn</button>
            </div>
          </div>
          <div class="logs" id="logs">
            <div class="row">Đã kết nối cầu nối v${getExtensionVersion()} (OmniVision sẵn sàng).</div>
          </div>
        </div>
        <div class="pill" id="pill">
          <span class="dot" id="dot"></span>
          <span id="pill-text">👁️ OmniVision v${getExtensionVersion()} • Sẵn sàng</span>
        </div>
      `
      document.documentElement.appendChild(host)

      const panel = dockShadow.getElementById('panel')
      const pill = dockShadow.getElementById('pill')
      const btnClose = dockShadow.getElementById('btn-close')
      const btnClear = dockShadow.getElementById('btn-clear')

      pill.addEventListener('click', () => {
        dockExpanded = !dockExpanded
        panel.classList.toggle('open', dockExpanded)
      })
      btnClose.addEventListener('click', () => {
        dockExpanded = false
        panel.classList.remove('open')
      })
      btnClear.addEventListener('click', () => {
        dockLogs.length = 0
        renderDockLogs()
      })
    } catch (_) {}
  }

  function updateDockStatus(text, state = 'ready') {
    if (!dockShadow) return
    const dot = dockShadow.getElementById('dot')
    const pillText = dockShadow.getElementById('pill-text')
    if (dot) {
      dot.className = 'dot' + (state === 'busy' ? ' busy' : state === 'error' ? ' err' : '')
    }
    if (pillText && text) {
      pillText.textContent = text
    }
  }

  function renderDockLogs() {
    if (!dockShadow) return
    const container = dockShadow.getElementById('logs')
    if (!container) return
    if (!dockLogs.length) {
      container.innerHTML = '<div class="row">Chưa có sự kiện mới.</div>'
      return
    }
    container.innerHTML = dockLogs
      .slice(0, 25)
      .map((item) => {
        const time = new Date(item.timestamp || Date.now()).toLocaleTimeString('vi-VN')
        const safeMsg = String(item.message || '').replace(/[<>&]/g, '')
        const plat = String(item.platform || 'sys').toUpperCase()
        return `<div class="row ${item.level || 'info'}"><div class="meta">[${time}] ${plat}</div>${safeMsg}</div>`
      })
      .join('')
  }

  function pushDockEvent(evt) {
    if (!evt) return
    dockLogs.unshift(evt)
    if (dockLogs.length > 40) dockLogs.length = 40
    renderDockLogs()

    if (evt.level === 'error') {
      updateDockStatus(`⚠️ ${String(evt.message || 'Lỗi').slice(0, 42)}`, 'error')
      dockExpanded = true
      dockShadow?.getElementById('panel')?.classList.add('open')
    } else if (evt.level === 'success') {
      updateDockStatus(`✅ ${String(evt.message || 'Hoàn tất').slice(0, 42)}`, 'ready')
    } else if (evt.step && !['done', 'scrape_done'].includes(evt.step)) {
      updateDockStatus(`👁️ ${String(evt.message || 'Đang chạy...').slice(0, 42)}`, 'busy')
    }
  }

  // =========================================================================
  // KẾT NỐI PERSISTENT PORT TỚI BACKGROUND SERVICE WORKER
  // =========================================================================
  function connectPort() {
    if (destroyed || !isRuntimeAlive()) return
    try {
      port = chrome.runtime.connect({ name: 'omnicart-admin-bridge' })

      port.onMessage.addListener((msg) => {
        if (!msg) return

        if (msg.type === 'BRIDGE_HELLO') {
          updateDockStatus(`👁️ OmniVision v${msg.version || getExtensionVersion()} • Kết nối tốt`, 'ready')
          if (Array.isArray(msg.recentLogs)) {
            msg.recentLogs.slice(0, 10).reverse().forEach((ev) => {
              dockLogs.unshift(ev)
            })
            renderDockLogs()
          }
          return
        }

        if (msg.type === 'PROGRESS_EVENT' && msg.event) {
          pushDockEvent(msg.event)
          // Phát sự kiện tiến độ về Website React Admin nếu Admin lắng nghe
          window.postMessage({
            source: 'OMNICART_EXTENSION_PROGRESS',
            event: msg.event
          }, window.location.origin)
          window.dispatchEvent(new CustomEvent('omnicart-extension-progress', { detail: msg.event }))
          return
        }

        if (msg.type === 'ADMIN_COMMAND_RESULT' && msg.requestId) {
          const pending = pendingPortRequests.get(msg.requestId)
          if (pending) {
            pendingPortRequests.delete(msg.requestId)
            pending.resolve(msg)
          }
        }
      })

      port.onDisconnect.addListener(() => {
        port = null
        // Trả lỗi sạch nếu còn request đang chờ trên port vừa ngắt
        for (const [reqId, pending] of pendingPortRequests.entries()) {
          pendingPortRequests.delete(reqId)
          pending.reject(new Error('PORT_DISCONNECTED'))
        }
        if (!destroyed && isRuntimeAlive()) {
          updateDockStatus('🔄 Đang nối lại Service Worker...', 'busy')
          clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(connectPort, 1200)
        }
      })

      clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (port) {
          try { port.postMessage({ type: 'HEARTBEAT' }) } catch (_) {}
        }
      }, 22000)
    } catch (_) {
      port = null
    }
  }

  async function sendToBackground(command, requestId) {
    if (!isRuntimeAlive()) {
      throw new Error('EXTENSION_CONTEXT_INVALIDATED')
    }

    // Ưu tiên gửi qua Persistent Port (không bị timeout 30s của MV3 one-shot sendMessage)
    if (!port) connectPort()
    if (port) {
      try {
        return await new Promise((resolve, reject) => {
          pendingPortRequests.set(requestId, { resolve, reject })
          port.postMessage({ type: 'ADMIN_COMMAND', requestId, command })
        })
      } catch (_) {
        // Fallback sang sendMessage nếu port vừa ngắt ngay khoảnh khắc gửi
      }
    }

    return await new Promise((resolve) => {
      chrome.runtime.sendMessage(command, (response) => {
        let lastError = null
        try { lastError = chrome.runtime.lastError || null } catch (_) {
          lastError = { message: 'EXTENSION_CONTEXT_INVALIDATED' }
        }
        const ok = !lastError && response?.ok === true
        resolve({
          ok,
          data: response || null,
          error: lastError?.message || response?.error || (response ? null : 'NO_EXTENSION_RESPONSE')
        })
      })
    })
  }

  // Đánh dấu DOM để Website Store-Admin nhận diện extension tức thì
  try {
    document.documentElement.setAttribute('data-omnicart-extension-active', 'true')
    document.documentElement.setAttribute('data-omnicart-extension-version', getExtensionVersion())
    document.documentElement.setAttribute('data-omnicart-vision-ready', 'true')
  } catch (_) {}

  try {
    window.dispatchEvent(new CustomEvent('omnicart-extension-ready', {
      detail: { version: getExtensionVersion(), vision: true }
    }))
  } catch (_) {}

  mountLiveDock()
  connectPort()

  // Lắng nghe lệnh từ React Admin app qua window.postMessage (tương thích ngược 100%)
  const handleAdminMessage = async (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    if (!event.data || event.data.source !== 'OMNICART_ADMIN_REQUEST') return

    const { action, payload, requestId } = event.data

    if (!isRuntimeAlive()) {
      cleanup()
      window.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId,
        ok: false,
        data: null,
        error: 'EXTENSION_CONTEXT_INVALIDATED'
      }, window.location.origin)
      return
    }

    if (action === 'AUTO_POST') {
      dockExpanded = true
      dockShadow?.getElementById('panel')?.classList.add('open')
      updateDockStatus(`🚀 Đang chạy AUTO_POST (${payload?.platform || 'social'})...`, 'busy')
    }

    try {
      const result = await sendToBackground({ type: action, ...(payload || {}) }, requestId)
      window.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId,
        ok: Boolean(result?.ok),
        data: result?.data || null,
        error: result?.ok ? null : (result?.error || 'NO_EXTENSION_RESPONSE')
      }, window.location.origin)
    } catch (err) {
      if (String(err.message).includes('INVALIDATED')) cleanup()
      window.postMessage({
        source: 'OMNICART_EXTENSION_RESPONSE',
        requestId,
        ok: false,
        data: null,
        error: err.message || 'EXTENSION_CONTEXT_INVALIDATED'
      }, window.location.origin)
    }
  }

  window.addEventListener('message', handleAdminMessage)

  function cleanup() {
    destroyed = true
    try { window.removeEventListener('message', handleAdminMessage) } catch (_) {}
    clearInterval(heartbeatTimer)
    clearTimeout(reconnectTimer)
    try { port?.disconnect() } catch (_) {}
    port = null
  }

  window.__OMNICART_ADMIN_BRIDGE_CLEANUP__ = cleanup
})()