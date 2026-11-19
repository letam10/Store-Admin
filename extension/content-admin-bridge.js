/*
  FILE NOTE
  - Mục đích: Cầu nối (Content Script Bridge) giữa giao diện web Store-Admin (React) và Chrome Extension Background Service Worker, cho phép gọi lệnh đăng bài thật và đồng bộ bài viral.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/background.js, Store-Admin/src/pages/AdminSocialAutomation.jsx.
  - Vùng ảnh hưởng khi sửa: Cơ chế trao đổi thông điệp qua postMessage và sự kiện tùy biến giữa Admin Portal và Extension.
*/

// Đánh dấu để giao diện React nhận diện ngay lập tức tiện ích đã hoạt động
try {
  document.documentElement.setAttribute('data-omnicart-extension-active', 'true')
  const markerScript = document.createElement('script')
  markerScript.textContent = `
    window.__OMNICART_EXTENSION_INSTALLED__ = true;
    window.__OMNICART_EXTENSION_VERSION__ = "1.0.0";
    window.dispatchEvent(new CustomEvent('omnicart-extension-ready', { detail: { version: '1.0.0' } }));
  `
  document.documentElement.appendChild(markerScript)
  markerScript.remove()
} catch (e) {
  // Bỏ qua lỗi DOM sớm
}

// Lắng nghe yêu cầu từ Store-Admin Web App
window.addEventListener('message', (event) => {
  if (!event.data || event.data.source !== 'OMNICART_ADMIN_REQUEST') return

  const { action, payload, requestId } = event.data

  if (action === 'PING') {
    window.postMessage({
      source: 'OMNICART_EXTENSION_RESPONSE',
      requestId,
      ok: true,
      data: { installed: true, version: '1.0.0' }
    }, '*')
    return
  }

  // Chuyển tiếp tới Background Service Worker
  chrome.runtime.sendMessage({
    type: action,
    ...payload
  }, (response) => {
    const lastError = chrome.runtime.lastError
    window.postMessage({
      source: 'OMNICART_EXTENSION_RESPONSE',
      requestId,
      ok: !lastError && response?.ok !== false,
      data: response,
      error: lastError ? lastError.message : response?.error
    }, '*')
  })
})
