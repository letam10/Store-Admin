/*
  FILE NOTE
  - Mục đích: Logic kịch bản cho popup menu Extension OmniCart Social Bridge, kiểm tra trạng thái các tab trình duyệt và gửi lệnh kích hoạt đăng bài / cào dữ liệu viral.
  - Liên kết trực tiếp: Store-Admin/extension/popup.html, Store-Admin/extension/background.js.
  - Vùng ảnh hưởng khi sửa: Tương tác người dùng khi bấm các nút trên popup của extension.
*/

const ADMIN_BASE_URL = 'http://127.0.0.1:5174'

document.addEventListener('DOMContentLoaded', async () => {
  const tabsStatusEl = document.getElementById('tabs-status')
  const logEl = document.getElementById('log-output')
  const btnPostFb = document.getElementById('btn-post-fb') || document.getElementById('btn-post-now')
  const btnPostTikTok = document.getElementById('btn-post-tiktok')
  const btnScrapeViral = document.getElementById('btn-scrape-viral')
  const btnOpenAdmin = document.getElementById('btn-open-admin')

  function log(msg) {
    if (logEl) {
      logEl.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + logEl.textContent
    }
  }

  async function openAdminForPosting() {
    const tabs = await chrome.tabs.query({})
    const adminTab = tabs.find((tab) => tab.url && /^(http:\/\/localhost:5174|http:\/\/127\.0\.0\.1:5174)\//i.test(tab.url))
    if (adminTab) {
      await chrome.tabs.update(adminTab.id, { active: true })
    } else {
      await chrome.tabs.create({ url: ADMIN_BASE_URL + '/', active: true })
    }
    log('Mở Admin. Hãy chọn nội dung AI và ảnh sản phẩm; popup không tự tạo bài hoặc báo đã đăng.')
  }

  // Kiểm tra trạng thái 3 tab
  async function checkTabs() {
    try {
      chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          tabsStatusEl.textContent = 'Chưa kết nối được Background Service Worker.'
          return
        }

        const t = res.tabs || {}
        tabsStatusEl.innerHTML = `
          <div>${t.admin ? '🟢' : '⚪'} Tab 1: Store-Admin (${t.admin ? 'Đang mở' : 'Chưa mở'})</div>
          <div>${t.facebook ? '🟢' : '⚪'} Tab 2: Facebook John Harper (61580644871703) (${t.facebook ? 'Sẵn sàng' : 'Sẽ tự mở khi đăng'})</div>
          <div>${t.tiktok ? '🟢' : '⚪'} Tab 3: TikTok @harutv666 (${t.tiktok ? 'Sẵn sàng' : 'Sẽ tự mở khi đăng'})</div>
        `
      })
    } catch (e) {
      tabsStatusEl.textContent = 'Lỗi kiểm tra tab: ' + e.message
    }
  }

  await checkTabs()

  btnPostFb?.addEventListener('click', openAdminForPosting)
  btnPostTikTok?.addEventListener('click', openAdminForPosting)

  btnScrapeViral?.addEventListener('click', async () => {
    log('Đang quét bài viral thật từ Facebook feed...')
    chrome.runtime.sendMessage({
      type: 'FETCH_REAL_VIRAL',
      platform: 'facebook'
    }, (res) => {
      if (res?.ok) {
        log(`✓ Đã quét được ${(res.posts || []).length} bài viết viral thực tế!`)
      } else {
        log(`⚠️ Lỗi quét: ${res?.error || 'Không có dữ liệu'}`)
      }
    })
  })

  btnOpenAdmin?.addEventListener('click', openAdminForPosting)
})
