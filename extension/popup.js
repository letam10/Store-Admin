/*
  FILE NOTE
  - Mục đích: Logic kịch bản cho popup menu Extension OmniCart Social Bridge, kiểm tra trạng thái các tab trình duyệt và gửi lệnh kích hoạt đăng bài / cào dữ liệu viral.
  - Liên kết trực tiếp: Store-Admin/extension/popup.html, Store-Admin/extension/background.js.
  - Vùng ảnh hưởng khi sửa: Tương tác người dùng khi bấm các nút trên popup của extension.
*/

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

  btnPostFb?.addEventListener('click', async () => {
    log('Đang gửi lệnh đăng bài thật qua tab Facebook John Harper...')
    chrome.runtime.sendMessage({
      type: 'AUTO_POST',
      platform: 'facebook',
      post: {
        title: '🔥 Ưu đãi cực hot hôm nay cùng OmniCart',
        content: 'Sản phẩm chính hãng với mức giá hấp dẫn nhất, giao hàng nhanh chóng tận tay!',
        hashtags: '#OmniCart #JohnHarper #Deals',
        privacy: 'only_me'
      }
    }, (res) => {
      if (res?.ok) {
        log(`✓ Đã đăng bài thật thành công trên FB John Harper! Link: ${res.postUrl}`)
      } else {
        log(`⚠️ ${res?.error || 'Không thể đăng tự động'}`)
      }
      checkTabs()
    })
  })

  btnPostTikTok?.addEventListener('click', async () => {
    log('Đang gửi kịch bản/hashtag lên tab TikTok Studio của @harutv666...')
    chrome.runtime.sendMessage({
      type: 'AUTO_POST',
      platform: 'tiktok',
      post: {
        title: '✨ Review đồ công nghệ đỉnh chóp tại OmniCart',
        content: 'Sản phẩm chính hãng, bảo hành 12 tháng, mua ngay kẻo lỡ!',
        hashtags: '#OmniCart #harutv #viral #technology'
      }
    }, (res) => {
      if (res?.ok) {
        log(`✓ Đã điền kịch bản và hashtag lên tab TikTok @harutv666 thành công!`)
      } else {
        log(`⚠️ ${res?.error || 'Không thể gửi lên TikTok'}`)
      }
      checkTabs()
    })
  })

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

  btnOpenAdmin?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:5174/admin' })
  })
})
