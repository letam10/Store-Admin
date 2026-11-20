/*
  FILE NOTE
  - Mục đích: Kịch bản điều khiển Popup OmniVision v3.0 (Đa tài khoản, không hardcode tên/ID nick, theo dõi duyệt TikTok 3–5 phút).
*/

const ADMIN_BASE_URL = 'http://localhost:5174'

document.addEventListener('DOMContentLoaded', async () => {
  const tabsStatusEl = document.getElementById('tabs-status')
  const logEl = document.getElementById('log-output')
  const visionLogEl = document.getElementById('vision-log')

  const cfgShowHud = document.getElementById('cfg-show-hud')
  const cfgPacing = document.getElementById('cfg-pacing')
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
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message })
        else resolve(res || { ok: false, error: 'NO_RESPONSE' })
      })
    })
  }

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`panel-${btn.dataset.tab}`)?.classList.add('active')
    })
  })

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

  function collectConfig() {
    return {
      showHud: cfgShowHud.checked,
      pacingMode: cfgPacing.value || 'normal',
      aiMode: cfgAiMode.value,
      provider: cfgProvider.value,
      endpoint: cfgEndpoint.value.trim(),
      model: cfgModel.value.trim(),
      apiKey: cfgApiKey.value.trim()
    }
  }

  async function refreshStatus() {
    const res = await sendBg({ type: 'CHECK_STATUS' })
    if (!res?.ok) {
      tabsStatusEl.textContent = 'Chưa kết nối được Service Worker: ' + (res?.error || '')
      return
    }
    const t = res.tabs || {}
    const pendingCount = (res.pendingVerifications || []).length
    const pacingLabel = { normal: 'Tự nhiên', careful: 'Cẩn trọng', fast: 'Nhanh' }[res.vision?.pacingMode || 'normal']
    tabsStatusEl.innerHTML = `
      <div>${t.admin ? '🟢' : '⚪'} Tab Store-Admin (${t.admin ? 'Đang mở' : 'Chưa mở'})</div>
      <div>${t.facebook ? '🟢' : '⚪'} Tab Facebook (${t.facebook ? 'Đã phát hiện' : 'Tự mở khi cần'})</div>
      <div>${t.tiktok ? '🟢' : '⚪'} Tab TikTok (${t.tiktok ? 'Đã phát hiện' : 'Tự mở khi cần'})</div>
      <div style="margin-top:4px;color:#86efac;">⏱️ Nhịp: <b>${pacingLabel}</b> • ⏳ Chờ TikTok duyệt: <b>${pendingCount}</b></div>
    `
  }

  async function loadVisionConfig() {
    const res = await sendBg({ type: 'GET_VISION_CONFIG' })
    if (!res?.ok || !res.config) return
    const c = res.config
    cfgShowHud.checked = c.showHud !== false
    cfgPacing.value = c.pacingMode || 'normal'
    cfgAiMode.value = c.aiMode || 'layout'
    cfgProvider.value = c.provider || 'ollama'
    cfgEndpoint.value = c.endpoint || ''
    cfgModel.value = c.model || ''
    cfgApiKey.value = c.apiKey || ''
  }

  document.getElementById('btn-open-admin')?.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({})
    const adminTab = tabs.find((tab) => tab.url && /^http:\/\/(localhost|127\.0\.0\.1):5174\//i.test(tab.url))
    if (adminTab) await chrome.tabs.update(adminTab.id, { active: true })
    else await chrome.tabs.create({ url: ADMIN_BASE_URL + '/', active: true })
    log('Đã mở Store-Admin.')
  })

  document.getElementById('btn-inspect-fb')?.addEventListener('click', async () => {
    log('👁️ Đang soi Tab Facebook...')
    const res = await sendBg({ type: 'INSPECT_TAB', platform: 'facebook' })
    if (res?.ok) {
      const i = res.inspection || {}
      log(`FB Vision → Nick: ${i.accountName} | Đăng nhập: ${i.loggedIn ? 'CÓ' : 'CHƯA'} | Mạng: ${i.health?.online ? 'OK' : 'OFFLINE'} | Khung đăng: ${i.hasComposerTrigger ? 'THẤY' : 'CHƯA'} | Nút quyền: "${i.audienceButtonText || '—'}"`)
    } else {
      log('⚠️ Lỗi soi FB: ' + (res?.error || ''))
    }
  })

  document.getElementById('btn-inspect-tt')?.addEventListener('click', async () => {
    log('👁️ Đang soi Tab TikTok...')
    const res = await sendBg({ type: 'INSPECT_TAB', platform: 'tiktok' })
    if (res?.ok) {
      const i = res.inspection || {}
      log(`TikTok Vision → ${i.accountHandle} | Trạng thái: ${i.screenState} | Tiêu đề: ${i.titleCounter ?? '—'}/90 | Mô tả: ${i.descriptionCounter ?? '—'}/4000 | Đăng: ${i.publishButtonEnabled ? 'SẴN SÀNG' : 'CHƯA'}`)
    } else {
      log('⚠️ Lỗi soi TikTok: ' + (res?.error || ''))
    }
  })

  document.getElementById('btn-check-pending')?.addEventListener('click', async () => {
    log('⏳ Đang kiểm tra ngay trạng thái bài TikTok chờ duyệt...')
    const res = await sendBg({ type: 'CHECK_PENDING_NOW' })
    log(res?.ok ? `Còn ${(res.pending || []).length} bài đang chờ duyệt.` : `Lỗi: ${res?.error}`)
    await refreshStatus()
  })

  document.getElementById('btn-reset-jobs')?.addEventListener('click', async () => {
    await sendBg({ type: 'CANCEL_JOB' })
    log('🧹 Đã mở khóa hàng đợi tác vụ.')
    await refreshStatus()
  })

  document.getElementById('btn-save-vision')?.addEventListener('click', async () => {
    const res = await sendBg({ type: 'SAVE_VISION_CONFIG', config: collectConfig() })
    log(res?.ok ? '✅ Đã lưu cấu hình!' : `⚠️ Lỗi: ${res?.error}`, visionLogEl)
    await refreshStatus()
  })

  document.getElementById('btn-test-vision')?.addEventListener('click', async () => {
    log('🧪 Đang kiểm tra Vision AI...', visionLogEl)
    await sendBg({ type: 'SAVE_VISION_CONFIG', config: collectConfig() })
    const res = await sendBg({ type: 'TEST_VISION_AI' })
    log((res?.ok ? '✅ ' : '⚠️ ') + (res?.message || res?.error || ''), visionLogEl)
  })

  await Promise.all([refreshStatus(), loadVisionConfig()])
})
