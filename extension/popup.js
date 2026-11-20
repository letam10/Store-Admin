/*
  FILE NOTE
  - Mục đích: Xử lý giao diện Popup OmniVision v2.0 — kiểm tra 3 tab, soi trạng thái màn hình FB/TikTok, cấu hình & kiểm thử Vision AI.
  - Liên kết trực tiếp: popup.html, background.js.
*/

const ADMIN_BASE_URL = 'http://localhost:5174'

document.addEventListener('DOMContentLoaded', async () => {
  const tabsStatusEl = document.getElementById('tabs-status')
  const logEl = document.getElementById('log-output')
  const visionLogEl = document.getElementById('vision-log')

  const cfgShowHud = document.getElementById('cfg-show-hud')
  const cfgAiMode = document.getElementById('cfg-ai-mode')
  const cfgProvider = document.getElementById('cfg-provider')
  const cfgEndpoint = document.getElementById('cfg-endpoint')
  const cfgModel = document.getElementById('cfg-model')
  const cfgApiKey = document.getElementById('cfg-apikey')

  function log(msg, target = logEl) {
    if (!target) return
    target.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}\n` + target.textContent
  }

  function sendBg(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message })
        } else {
          resolve(res || { ok: false, error: 'NO_RESPONSE' })
        }
      })
    })
  }

  // Chuyển tab trong Popup
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`panel-${btn.dataset.tab}`)?.classList.add('active')
    })
  })

  // Gợi ý endpoint & model mặc định khi đổi provider
  cfgProvider.addEventListener('change', () => {
    if (cfgProvider.value === 'ollama') {
      cfgEndpoint.value = 'http://localhost:11434/api/chat'
      cfgModel.value = 'qwen2.5vl:7b'
    } else if (cfgProvider.value === 'gemini') {
      cfgEndpoint.value = 'https://generativelanguage.googleapis.com'
      cfgModel.value = 'gemini-2.5-flash'
    } else {
      cfgEndpoint.value = 'https://api.openai.com/v1/chat/completions'
      cfgModel.value = 'gpt-4o-mini'
    }
  })

  async function refreshStatus() {
    const res = await sendBg({ type: 'CHECK_STATUS' })
    if (!res?.ok) {
      tabsStatusEl.textContent = 'Chưa kết nối được Service Worker: ' + (res?.error || '')
      return
    }
    const t = res.tabs || {}
    const jobs = (res.activeJobs || []).map((j) => j.platform).join(', ')
    tabsStatusEl.innerHTML = `
      <div>${t.admin ? '🟢' : '⚪'} Tab 1: Store-Admin (${t.admin ? 'Đang mở' : 'Chưa mở'})</div>
      <div>${t.facebook ? '🟢' : '⚪'} Tab 2: FB Hoàng Thái HT (${t.facebook ? 'Sẵn sàng' : 'Tự mở khi đăng'})</div>
      <div>${t.tiktok ? '🟢' : '⚪'} Tab 3: TikTok @harutv666 (${t.tiktok ? 'Sẵn sàng' : 'Tự mở khi đăng'})</div>
      <div style="margin-top:4px;color:#86efac;">👁️ Vision AI: <b>${res.vision?.aiMode || 'layout'}</b> (${res.vision?.provider || 'ollama'})${jobs ? ` • Đang chạy: ${jobs}` : ''}</div>
    `
  }

  async function loadVisionConfig() {
    const res = await sendBg({ type: 'GET_VISION_CONFIG' })
    if (!res?.ok || !res.config) return
    const c = res.config
    cfgShowHud.checked = c.showHud !== false
    cfgAiMode.value = c.aiMode || 'layout'
    cfgProvider.value = c.provider || 'ollama'
    cfgEndpoint.value = c.endpoint || ''
    cfgModel.value = c.model || ''
    cfgApiKey.value = c.apiKey || ''
  }

  async function openAdminTab() {
    const tabs = await chrome.tabs.query({})
    const adminTab = tabs.find((tab) => tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url))
    if (adminTab) {
      await chrome.tabs.update(adminTab.id, { active: true })
    } else {
      await chrome.tabs.create({ url: ADMIN_BASE_URL + '/', active: true })
    }
    log('Đã mở Store-Admin. Chọn bài viết AI & bấm Đăng Thật FB / TikTok.')
  }

  document.getElementById('btn-open-admin')?.addEventListener('click', openAdminTab)

  document.getElementById('btn-inspect-fb')?.addEventListener('click', async () => {
    log('👁️ Đang dùng OmniVision soi tab Facebook...')
    const res = await sendBg({ type: 'INSPECT_TAB', platform: 'facebook' })
    if (res?.ok) {
      const i = res.inspection || {}
      log(`FB Vision → Profile đúng: ${i.isOnTargetProfile ? 'CÓ' : 'KHÔNG'} | Khung đăng: ${i.hasComposerTrigger ? 'THẤY' : 'CHƯA'} | Hộp thoại mở: ${i.hasOpenComposerDialog ? 'CÓ' : 'KHÔNG'} | Nút nhìn thấy: ${i.somCount}`)
    } else {
      log('⚠️ Soi FB lỗi: ' + (res?.error || 'Không rõ'))
    }
  })

  document.getElementById('btn-inspect-tt')?.addEventListener('click', async () => {
    log('👁️ Đang dùng OmniVision soi tab TikTok Studio...')
    const res = await sendBg({ type: 'INSPECT_TAB', platform: 'tiktok' })
    if (res?.ok) {
      const i = res.inspection || {}
      log(`TikTok Vision → Màn hình: ${i.screenState} | Tiêu đề: ${i.hasTitleInput ? 'THẤY' : '—'} | Mô tả: ${i.hasDescriptionEditor ? 'THẤY' : '—'} | Quyền: "${i.privacyControlText || '—'}" | Nút Đăng: ${i.hasPublishButton ? (i.publishButtonEnabled ? 'SẴN SÀNG' : 'BỊ KHÓA') : 'CHƯA'}`)
    } else {
      log('⚠️ Soi TikTok lỗi: ' + (res?.error || 'Không rõ'))
    }
  })

  document.getElementById('btn-scrape-viral')?.addEventListener('click', async () => {
    log('🔥 Đang quét bài viral thực tế từ Facebook...')
    const res = await sendBg({ type: 'FETCH_REAL_VIRAL', platform: 'facebook' })
    if (res?.ok) {
      log(`✅ Quét được ${(res.posts || []).length} bài viết viral thực tế!`)
    } else {
      log(`⚠️ Lỗi quét: ${res?.error || 'Không có dữ liệu'}`)
    }
  })

  document.getElementById('btn-reset-jobs')?.addEventListener('click', async () => {
    await sendBg({ type: 'CANCEL_JOB' })
    log('🧹 Đã mở khóa hàng đợi tác vụ Facebook & TikTok.')
    await refreshStatus()
  })

  document.getElementById('btn-save-vision')?.addEventListener('click', async () => {
    const res = await sendBg({
      type: 'SAVE_VISION_CONFIG',
      config: {
        showHud: cfgShowHud.checked,
        aiMode: cfgAiMode.value,
        provider: cfgProvider.value,
        endpoint: cfgEndpoint.value.trim(),
        model: cfgModel.value.trim(),
        apiKey: cfgApiKey.value.trim()
      }
    })
    if (res?.ok) {
      log('✅ Đã lưu cấu hình OmniVision!', visionLogEl)
      await refreshStatus()
    } else {
      log('⚠️ Lỗi lưu cấu hình: ' + res?.error, visionLogEl)
    }
  })

  document.getElementById('btn-test-vision')?.addEventListener('click', async () => {
    log('🧪 Đang kiểm tra kết nối Vision AI...', visionLogEl)
    await sendBg({
      type: 'SAVE_VISION_CONFIG',
      config: {
        showHud: cfgShowHud.checked,
        aiMode: cfgAiMode.value,
        provider: cfgProvider.value,
        endpoint: cfgEndpoint.value.trim(),
        model: cfgModel.value.trim(),
        apiKey: cfgApiKey.value.trim()
      }
    })
    const res = await sendBg({ type: 'TEST_VISION_AI' })
    log((res?.ok ? '✅ ' : '⚠️ ') + (res?.message || res?.error || 'Hoàn tất'), visionLogEl)
  })

  await Promise.all([refreshStatus(), loadVisionConfig()])
})