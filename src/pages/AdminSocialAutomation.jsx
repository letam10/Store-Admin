/*
  FILE NOTE
  - Mục đích: Trang quản trị Tự động hóa Mạng xã hội v3.5.2 (AdminSocialAutomation).
  - Nâng cấp:
    1. Sắp xếp Mới lấy nhất (newest) mặc định cho cả 2 cột Viral FB & TikTok.
    2. Bổ sung referrerPolicy="no-referrer" cho ảnh thumbnail, hiển thị giờ lấy bài.
    3. Nút ⏹ Dừng FB và ⏹ Dừng TikTok luôn bấm được.
    4. Thêm Panel Dữ liệu Lướt theo thời gian đầy đủ ở Tab Nhật ký & Báo cáo.
  - Liên kết trực tiếp: src/pages/AdminSocialPowerPanels.jsx, src/pages/AdminSocialAutomation.css, src/pages/socialPrivacy.js, src/api/chat.js
  - Vùng ảnh hưởng khi sửa: Toàn bộ giao diện tab Quản lý MXH, bảng bài viral song song 2 cột, bảng lịch sử lướt ở tab nhật ký.
*/

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiJson } from '../api/chat'
import { privacyForSocialPlatform } from './socialPrivacy'
import { ViralSalesIdeasPanel, SmartProductVisionPanel, AutomationSuitePanels } from './AdminSocialPowerPanels'
import './AdminSocialAutomation.css'

export const copyPostToClipboard = async (text) => {
  if (!text) return false
  let copied = false
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); copied = true } catch (_) {}
  }
  if (!copied && typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      ta.setAttribute('readonly', '')
      document.body.appendChild(ta)
      ta.select()
      copied = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (_) {}
  }
  return copied
}

const VIRAL_TOPICS = [
  ['all', '🌐 Tất cả xu hướng'],
  ['vehicles', '🚗 Xe cộ'],
  ['anime', '🎌 Anime'],
  ['cartoon', '🎬 Hoạt hình'],
  ['game', '🎮 Game'],
  ['new_product', '🛍️ Quảng bá sản phẩm mới'],
  ['electronics_compare', '📱 So sánh sản phẩm điện tử'],
  ['custom', '✏️ Chủ đề tự nhập...']
]

function extractHashtagChips(item) {
  const raw = `${item?.title || ''} ${item?.trendingTopic || ''} ${item?.summary || ''}`
  return Array.from(new Set(raw.match(/#[\p{L}\p{N}_]{2,40}/gu) || [])).slice(0, 5)
}

export default function AdminSocialAutomation({ csrfToken }) {
  const [activeSubTab, setActiveSubTab] = useState('settings')
  const [stats, setStats] = useState({
    totalPostsToday: 0, publishedCount: 0, pendingCount: 0, failedCount: 0,
    totalLikes: 0, totalShares: 0, totalComments: 0, lastRunAt: null, nextRunAt: null,
    isActive: true, intervalHours: 2, intervalMinutes: 120, privacy: 'only_me', mode: 'full_auto'
  })

  const [settings, setSettings] = useState({
    id: 1, isActive: true, mode: 'full_auto', intervalHours: 2, intervalMinutes: 120, intervalSeconds: 7200,
    privacy: 'only_me', channels: 'facebook,tiktok', preferredCategory: 'all', toneStyle: 'viral_engaging',
    includeHashtags: true, includeEmojis: true, includeCta: true, includeHotline: true,
    contactHotline: '0901.234.567', orderLinkTemplate: 'https://omnicart.vn/products/{id}'
  })

  const [posts, setPosts] = useState([])
  const [postFilterStatus, setPostFilterStatus] = useState('all')
  const [postFilterPlatform, setPostFilterPlatform] = useState('all')
  const [selectedPostModal, setSelectedPostModal] = useState(null)
  const [copiedPostId, setCopiedPostId] = useState(null)

  const [groups, setGroups] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [groupSort, setGroupSort] = useState('members_desc')
  const [groupKeyword, setGroupKeyword] = useState('')
  const [scrapingGroupsBusy, setScrapingGroupsBusy] = useState(false)
  const [newGroup, setNewGroup] = useState({
    groupName: '', groupUrl: '', category: 'Đồ gia dụng & Gia đình',
    membersCount: 0, interactionRate: 'Cao', isAutoShare: true, notes: ''
  })

  const [viralPosts, setViralPosts] = useState([])
  const [viralTopic, setViralTopic] = useState('all')
  const [fbSourceMode, setFbSourceMode] = useState('both')
  const [ttSourceMode, setTtSourceMode] = useState('explore')
  const [scrapingPlatformBusy, setScrapingPlatformBusy] = useState({ facebook: false, tiktok: false })
  const [viralFilterTopic, setViralFilterTopic] = useState('all')
  const [viralFbKindFilter, setViralFbKindFilter] = useState('all')
  const [viralSearch, setViralSearch] = useState('')
  const [aiCleaningViral, setAiCleaningViral] = useState(false)
  const [customViralTopic, setCustomViralTopic] = useState('')
  const [fbViralSort, setFbViralSort] = useState('newest')
  const [ttViralSort, setTtViralSort] = useState('newest')
  const [surfHistory, setSurfHistory] = useState([])
  const [surfHistoryFilter, setSurfHistoryFilter] = useState('all')
  const [surfHistorySort, setSurfHistorySort] = useState('newest')
  const [scrapingViralBusy, setScrapingViralBusy] = useState(false)

  const [extensionConnected, setExtensionConnected] = useState(false)
  const [showExtensionHelp, setShowExtensionHelp] = useState(false)
  // Tách trạng thái đăng từng nền tảng để Facebook & TikTok chạy SONG SONG không khóa chéo nhau!
  const [postingBusy, setPostingBusy] = useState({ facebook: false, tiktok: false })
  const [batchPosting, setBatchPosting] = useState(false)

  const [studioPlatform, setStudioPlatform] = useState('facebook')
  const [studioTone, setStudioTone] = useState('viral_engaging')
  const [studioTopic, setStudioTopic] = useState('')
  const [studioTargetGroup, setStudioTargetGroup] = useState('')
  const [studioGenerating, setStudioGenerating] = useState(false)
  const [studioDraft, setStudioDraft] = useState({
    productId: '', title: '', content: '', hashtags: '',
    productName: '', productPrice: 0, productImage: '', generatedBy: ''
  })

  const [studioPrivacy, setStudioPrivacy] = useState('only_me')
  const [studioSelectionMode, setStudioSelectionMode] = useState('smart')
  const [studioProductId, setStudioProductId] = useState('')
  const [catalogList, setCatalogList] = useState([])

  const [alertMessage, setAlertMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const noticeTimerRef = useRef(null)
  const copiedTimerRef = useRef(null)
  const extensionPingCancelRef = useRef(null)
  const autoPostAttemptedIdsRef = useRef(new Set())
  const autoPostInFlightRef = useRef(false)
  const extensionPingInFlightRef = useRef(false)

  const configuredChannels = useMemo(() => {
    const raw = String(settings.channels || 'facebook,tiktok').toLowerCase()
    const list = []
    if (raw.includes('facebook')) list.push('facebook')
    if (raw.includes('tiktok')) list.push('tiktok')
    return list.length ? list : ['facebook', 'tiktok']
  }, [settings.channels])

  const markCopiedPost = (id) => {
    setCopiedPostId(id)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopiedPostId(null), 2500)
  }

  const showNotice = (text, type = 'success') => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setAlertMessage({ text, type })
    noticeTimerRef.current = setTimeout(() => setAlertMessage(null), 6500)
  }

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
  }, [])

  const formatPostText = (post) => {
    if (!post) return ''
    let text = (post.content || '').replace(/\*\*([^*]+)\*\*/g, '$1').trim()
    if (!text) return ''
    if (post.title && !text.includes(post.title)) text = post.title + '\n\n' + text
    const orderLink = `https://omnicart.vn/products/${post.productId || '1'}`
    if (post.productId && !text.includes('omnicart.vn/products/')) text += `\n\n🛒 Đặt hàng: ${orderLink}`
    if (post.hashtags && !text.includes(post.hashtags)) text += '\n\n' + post.hashtags
    return text
  }

  const handleCopyPost = async (post) => {
    if (!post) return
    await copyPostToClipboard(formatPostText(post))
    markCopiedPost(post.id)
  }

  const sendExtensionMessage = (action, payload = {}) => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.postMessage) {
        resolve({ ok: false, error: 'NO_WINDOW' })
        return
      }
      const requestId = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
      let timer = null
      let settled = false

      const idleLimitMs =
        action === 'SURF_AND_COLLECT' ? Math.max(180000, ((Number(payload.durationMinutes) || 2) + 3) * 60000)
          : action === 'AUTO_WATCH_TASK' ? Math.max(180000, ((Number(payload.repeatCount) || 5) * ((Number(payload.dwellSeconds) || 8) + 5) + 60) * 1000)
            : action === 'FETCH_REAL_VIRAL' ? 420000
              : action === 'SCRAPE_FB_GROUPS' || action === 'SCRAPE_CHANNEL_PROFILES' || action === 'SCRAPE_POST_COMMENTS' ? 240000
                : action === 'AUTO_POST' ? 210000
                  : action === 'PING' ? 8000 : 18000

      const cleanup = () => {
        if (settled) return
        settled = true
        window.removeEventListener('message', handler)
        if (timer) clearTimeout(timer)
        if (action === 'PING' && extensionPingCancelRef.current === cancelPing) extensionPingCancelRef.current = null
      }

      const armTimeout = () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          cleanup()
          if (action === 'PING') setExtensionConnected(false)
          resolve({ ok: false, error: 'EXTENSION_NOT_DETECTED' })
        }, idleLimitMs)
      }

      const handler = (event) => {
        if (event.source !== window || event.origin !== window.location.origin) return
        if (event.data?.source === 'OMNICART_EXTENSION_PROGRESS' && ['FETCH_REAL_VIRAL', 'SURF_AND_COLLECT', 'AUTO_WATCH_TASK', 'SCRAPE_CHANNEL_PROFILES'].includes(action)) {
          armTimeout()
          return
        }
        if (event.data && event.data.source === 'OMNICART_EXTENSION_RESPONSE' && event.data.requestId === requestId) {
          cleanup()
          if (action === 'PING') setExtensionConnected(event.data.ok === true && event.data.data?.ok === true)
          else if (event.data.ok === true) setExtensionConnected(true)
          resolve(event.data)
        }
      }

      const cancelPing = () => { cleanup(); resolve({ ok: false, error: 'PING_CANCELLED' }) }
      window.addEventListener('message', handler)
      if (action === 'PING') extensionPingCancelRef.current = cancelPing
      armTimeout()

      try { window.postMessage({ source: 'OMNICART_ADMIN_REQUEST', action, payload, requestId }, '*') }
      catch (e) { cleanup(); resolve({ ok: false, error: e.message }) }
    })
  }

  const handleOpenViralSingleTab = async (url, platform) => {
    if (!url) return
    const res = await sendExtensionMessage('OPEN_SINGLE_TAB', { url, platform })
    if (!res?.ok) window.open(url, 'omnicart_viral_single_tab', 'noopener')
  }

  const loadAll = async () => {
    try {
      setLoading(true)
      const [resStats, resSettings, resPosts, resGroups, resViral, resProducts] = await Promise.all([
        apiJson('/api/admin/social/stats'),
        apiJson('/api/admin/social/settings'),
        apiJson('/api/admin/social/posts'),
        apiJson('/api/admin/social/groups'),
        apiJson('/api/admin/social/viral'),
        apiJson('/api/admin/products?offset=0&limit=100').catch(() => null)
      ])
      apiJson('/api/admin/social/surf-history').then((res) => { if (res?.posts) setSurfHistory(res.posts) }).catch(() => {})
      if (resStats?.stats) setStats(resStats.stats)
      if (resSettings?.settings) {
        const nextPrivacy = resSettings.settings.privacy === 'public' ? 'public' : 'only_me'
        setSettings(cur => ({ ...cur, ...resSettings.settings, privacy: nextPrivacy }))
        setStudioPrivacy(nextPrivacy)
      }
      if (resPosts?.posts) setPosts(resPosts.posts)
      if (resGroups?.groups) setGroups(resGroups.groups)
      if (resViral?.posts) setViralPosts(resViral.posts)
      if (resProducts?.products) setCatalogList(resProducts.products)
    } catch { showNotice('Không thể kết nối API Mạng Xã Hội.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    let disposed = false
    const pingExtension = async () => {
      if (disposed || extensionPingInFlightRef.current) return
      extensionPingInFlightRef.current = true
      try {
        const res = await sendExtensionMessage('PING')
        if (!disposed) setExtensionConnected(res?.ok === true && res?.data?.ok === true)
      } finally { extensionPingInFlightRef.current = false }
    }

    const onPostVerified = async (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (!event.data || event.data.source !== 'OMNICART_POST_VERIFIED') return
      const payload = event.data.payload
      if (!payload?.postId) return
      try {
        if (payload.status === 'published' && payload.postUrl) {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(payload.postId)}/publish-real`, {
            method: 'POST', headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              postUrl: payload.postUrl, publishedTime: payload.publishedTime,
              platform: payload.platform || 'tiktok', realPostId: payload.realPostId || `tiktok-${Date.now()}`,
              privacy: payload.privacy || 'only_me'
            })
          })
          showNotice(`✅ TikTok đã duyệt bài #${payload.postId} thành công!`)
        } else {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(payload.postId)}/publish-failure`, {
            method: 'POST', headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              status: payload.status === 'failed' ? 'failed' : 'unverified',
              errorMessage: payload.error || 'Bài đăng bị từ chối duyệt.'
            })
          })
          showNotice(payload.error || 'Bài đăng TikTok bị từ chối duyệt.', 'error')
        }
        await loadAll()
      } catch (_) {}
    }

    const onViralBatch = async (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (event.data?.source !== 'OMNICART_VIRAL_BATCH' || !event.data.payload?.posts?.length) return
      const batch = event.data.payload
      try {
        let postsToSave = batch.posts
        const classified = await apiJson('/api/admin/social/ai/classify-viral', {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ requestedTopic: batch.topic || 'all', requestedTopicLabel: batch.topicLabel || '', posts: postsToSave })
        }).catch(() => null)
        if (classified?.ok && Array.isArray(classified.posts)) postsToSave = classified.posts
        if (postsToSave.length > 0) {
          postsToSave = postsToSave.map((p) => ({
            ...p,
            likesCount: Math.min(200000000, Math.max(0, Math.round(Number(p.likesCount) || 0))),
            commentsCount: Math.min(200000000, Math.max(0, Math.round(Number(p.commentsCount) || 0))),
            sharesCount: Math.min(200000000, Math.max(0, Math.round(Number(p.sharesCount) || 0)))
          }))
          const saved = await apiJson('/api/admin/social/viral/import-real', {
            method: 'POST', headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({ posts: postsToSave })
          })
          if (saved?.posts) setViralPosts(saved.posts)
          showNotice(`⚡ ${batch.sourceLabel} vừa về: +${postsToSave.length} bài!`, 'info')
        }
      } catch (_) {}
    }

    pingExtension()
    const pingTimer = setInterval(pingExtension, 6000)
    const onReady = () => pingExtension()
    window.addEventListener('omnicart-extension-ready', onReady)
    window.addEventListener('message', onPostVerified)
    window.addEventListener('message', onViralBatch)
    return () => {
      disposed = true
      clearInterval(pingTimer)
      if (extensionPingCancelRef.current) extensionPingCancelRef.current()
      window.removeEventListener('omnicart-extension-ready', onReady)
      window.removeEventListener('message', onPostVerified)
      window.removeEventListener('message', onViralBatch)
    }
  }, [csrfToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleIntervalChange = (val) => {
    let min = 120, hrs = 2, sec = 7200
    if (val === '2m') { min = 2; hrs = 2 / 60; sec = 120 }
    else if (val === '1') { min = 60; hrs = 1; sec = 3600 }
    else if (val === '4') { min = 240; hrs = 4; sec = 14400 }
    setSettings(prev => ({ ...prev, intervalMinutes: min, intervalHours: hrs, intervalSeconds: sec }))
  }

  const currentIntervalKey = useMemo(() => {
    if (settings.intervalSeconds === 120 || settings.intervalMinutes === 2) return '2m'
    if (settings.intervalMinutes === 60) return '1'
    if (settings.intervalMinutes === 240 || settings.intervalHours === 4) return '4'
    return settings.intervalMinutes <= 2 ? '2m' : settings.intervalMinutes <= 90 ? '1' : '4'
  }, [settings.intervalMinutes, settings.intervalHours, settings.intervalSeconds])

  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    try {
      setLoading(true)
      const nextPrivacy = settings.privacy === 'public' ? 'public' : 'only_me'
      const res = await apiJson('/api/admin/social/settings', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ...settings, privacy: nextPrivacy })
      })
      if (res?.settings) {
        const savedPriv = res.settings.privacy === 'public' ? 'public' : 'only_me'
        setSettings(cur => ({ ...cur, ...res.settings, privacy: savedPriv }))
        setStudioPrivacy(savedPriv)
        showNotice(`✅ Đã lưu cấu hình (${savedPriv === 'public' ? 'Công khai' : 'Chỉ mình tôi'} • ${res.settings.channels}).`)
        const resStats = await apiJson('/api/admin/social/stats')
        if (resStats?.stats) setStats(resStats.stats)
      }
    } catch (err) { showNotice(err.message || 'Lỗi lưu cấu hình.', 'error') }
    finally { setLoading(false) }
  }

  // Đăng đồng thời song song theo đúng Kênh đăng trong Cấu hình (chỉ FB / chỉ TikTok / cả 2 song song!)
  const handleTriggerCycle = async () => {
    if (batchPosting) return
    try {
      setBatchPosting(true); setLoading(true)
      const extensionStatus = await sendExtensionMessage('CHECK_STATUS', {})
      if (extensionStatus?.ok !== true || extensionStatus.data?.tabs?.admin !== true) {
        setShowExtensionHelp(true)
        throw new Error('Chưa kết nối Chrome Extension.')
      }

      const platforms = configuredChannels
      const results = await Promise.all(platforms.map(async (platform) => {
        try {
          const res = await apiJson('/api/admin/social/trigger-cycle?platform=' + encodeURIComponent(platform), {
            method: 'POST', headers: { 'x-csrf-token': csrfToken }
          })
          if (!res?.ok || !res.post) return { platform, ok: false, error: 'Chưa tạo được bài AI.' }
          const postResult = await handleRealAutoPostThroughExtension({ ...res.post, privacy: settings.privacy })
          return { platform, ...postResult }
        } catch (err) { return { platform, ok: false, error: err.message } }
      }))

      const okCount = results.filter(r => r.ok).length
      showNotice(`Hoàn tất đăng song song ${okCount}/${platforms.length} kênh.`, okCount === platforms.length ? 'success' : 'error')
      await loadAll()
      setActiveSubTab('logs')
    } catch (err) { showNotice(err.message || 'Lỗi kích hoạt.', 'error') }
    finally { setLoading(false); setBatchPosting(false) }
  }

  const handleGenerateStudio = async () => {
    try {
      setStudioGenerating(true)
      const res = await apiJson('/api/admin/social/generate', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          platform: studioPlatform, toneStyle: studioTone, customTopic: studioTopic,
          productId: studioSelectionMode === 'custom' ? studioProductId : undefined,
          selectionMode: studioSelectionMode
        })
      })
      if (res?.generated && res?.product) {
        setStudioDraft({
          productId: res.product.id || '1', title: res.generated.title, content: res.generated.content,
          hashtags: res.generated.hashtags, productName: res.product.name, productPrice: res.product.price,
          productImage: res.product.image, generatedBy: res.generated.generatedBy
        })
        showNotice('Đã tạo xong nội dung AI.')
      }
    } catch (err) { showNotice(err.message || 'Lỗi tạo nội dung AI.', 'error') }
    finally { setStudioGenerating(false) }
  }

  const handlePublishStudio = async (immediate = true) => {
    const targetPrivacy = privacyForSocialPlatform(studioPlatform, studioPrivacy || settings.privacy)
    if (!targetPrivacy) return showNotice('Kênh không được hỗ trợ.', 'error')
    const chosenGroup = studioPlatform === 'facebook' && studioTargetGroup
      ? groups.find((g) => g.groupName === studioTargetGroup)
      : null
    const draft = {
      ...studioDraft,
      platform: studioPlatform,
      privacy: targetPrivacy,
      targetGroup: chosenGroup ? chosenGroup.groupName : 'Trang cá nhân đang đăng nhập',
      targetGroupUrl: chosenGroup ? chosenGroup.groupUrl : ''
    }
    if (immediate) return handleRealAutoPostThroughExtension(draft)

    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/posts/create', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          productId: studioDraft.productId || '1', productName: studioDraft.productName,
          productPrice: studioDraft.productPrice, productImage: studioDraft.productImage,
          platform: studioPlatform, title: studioDraft.title, content: studioDraft.content,
          hashtags: studioDraft.hashtags, targetGroup: draft.targetGroup,
          privacy: targetPrivacy, publishImmediately: false
        })
      })
      if (!res?.ok || !res.post?.id) throw new Error('Không lưu được bản nháp.')
      showNotice('Đã lưu bản nháp.')
      await loadAll()
      setActiveSubTab('logs')
    } catch (err) { showNotice(err.message || 'Lỗi lưu bài.', 'error') }
    finally { setLoading(false) }
  }

  const handleRealAutoPostThroughExtension = async (targetPost) => {
    const post = { ...studioDraft, ...(targetPost || {}) }
    const platform = String(post.platform || studioPlatform || 'facebook').toLowerCase()
    if (!['facebook', 'tiktok'].includes(platform)) {
      showNotice('Kênh không được hỗ trợ.', 'error')
      return { ok: false, platform }
    }
    if (postingBusy[platform]) {
      showNotice(`Kênh ${platform.toUpperCase()} đang đăng bài — bạn vẫn có thể đăng song song kênh còn lại!`, 'info')
      return { ok: false, platform }
    }

    if (targetPost?.id) autoPostAttemptedIdsRef.current.add(String(targetPost.id))
    let postId = targetPost?.id || null
    let failureCode = null
    let livePostUrl = null
    let livePostId = null

    try {
      setPostingBusy((cur) => ({ ...cur, [platform]: true }))

      const productImage = post.productImage || studioDraft.productImage
      if (!productImage) throw new Error('Thiếu ảnh sản phẩm — hãy bấm "Tạo bài bằng AI" trước.')
      const imageUrl = new URL(productImage, window.location.origin).href
      const fullText = formatPostText(post)
      if (!fullText) throw new Error('Thiếu nội dung bài viết.')
      const targetPrivacy = privacyForSocialPlatform(platform, post.privacy || studioPrivacy || settings.privacy || 'only_me')
      if (!targetPrivacy) throw new Error('Quyền riêng tư không hợp lệ.')

      postId = post.id || postId
      if (!postId) {
        const created = await apiJson('/api/admin/social/posts/create', {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            productId: post.productId || '1', productName: post.productName || 'Sản phẩm OmniCart',
            productPrice: post.productPrice || 0, productImage, platform,
            title: post.title || '', content: post.content || '', hashtags: post.hashtags || '',
            targetGroup: post.targetGroup || 'Trang cá nhân đang đăng nhập',
            privacy: targetPrivacy, publishImmediately: false
          })
        })
        if (!created?.ok || !created.post?.id) throw new Error('Chưa lưu được bản nháp.')
        postId = created.post.id
        autoPostAttemptedIdsRef.current.add(String(postId))
      }

      const reply = await sendExtensionMessage('AUTO_POST', {
        platform,
        post: {
          postId, title: post.title || '', content: fullText, hashtags: post.hashtags || '',
          privacy: targetPrivacy, targetGroupUrl: post.targetGroupUrl || '', imageUrl
        }
      })

      if (reply?.error === 'EXTENSION_NOT_DETECTED') {
        failureCode = reply.error
        setShowExtensionHelp(true)
        throw new Error('Chưa phát hiện Chrome Extension.')
      }

      const result = reply?.data
      if (reply?.ok === true && result?.ok === true && result.pendingReview === true) {
        await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/pending-review`, {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ platform, privacy: result.privacy || targetPrivacy, message: 'Đang chờ TikTok xét duyệt (~2–3 phút).' })
        })
        showNotice('⏳ Đã gửi bài lên TikTok — đang chờ xét duyệt.', 'info')
        await loadAll()
        return { ok: true, pendingReview: true, platform }
      }

      if (result?.postUrl && result?.realPostId) { livePostUrl = result.postUrl; livePostId = result.realPostId }
      if (reply?.ok !== true || result?.ok !== true || result.platform !== platform ||
          result.privacy !== targetPrivacy || !result.postUrl || !result.realPostId) {
        failureCode = result?.error || reply?.error || 'POST_NOT_VERIFIED'
        throw new Error(getExtensionPostErrorMessage(failureCode))
      }

      const saved = await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/publish-real`, {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          postUrl: result.postUrl, publishedTime: result.publishedTime,
          platform, realPostId: result.realPostId, privacy: result.privacy || targetPrivacy
        })
      })
      if (!saved?.ok || saved.post?.status !== 'published') throw new Error('Chưa lưu được kết quả đăng.')

      showNotice(`✅ Đăng ${platform === 'facebook' ? 'Facebook' : 'TikTok'} thành công!`)
      await loadAll()
      return { ok: true, platform, postUrl: result.postUrl }
    } catch (err) {
      const errorMessage = err.message || 'Lỗi đăng bài'
      const outcome = livePostUrl || ['FACEBOOK_POST_NOT_VERIFIED', 'TIKTOK_POST_NOT_VERIFIED'].includes(failureCode) ? 'unverified' : 'failed'
      if (postId && targetPost?.status !== 'published') {
        try {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/publish-failure`, {
            method: 'POST', headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({ status: outcome, errorMessage: failureCode ? `${errorMessage} (${failureCode})` : errorMessage, postUrl: livePostUrl, realPostId: livePostId })
          })
          await loadAll()
        } catch (_) {}
      }
      showNotice(errorMessage, 'error')
      return { ok: false, platform, error: errorMessage }
    } finally {
      setPostingBusy((cur) => ({ ...cur, [platform]: false }))
    }
  }

  const getExtensionPostErrorMessage = (code) => ({
    EXTENSION_CONTEXT_INVALIDATED: 'Extension vừa tải lại. Nhấn F5 để kết nối lại.',
    PRODUCT_IMAGE_REQUIRED: 'Thiếu ảnh sản phẩm.',
    FACEBOOK_LOGIN_REQUIRED: 'Chưa đăng nhập Facebook.',
    TIKTOK_LOGIN_REQUIRED: 'Chưa đăng nhập TikTok.',
    FACEBOOK_NETWORK_OFFLINE: 'Facebook đang mất mạng.',
    TIKTOK_NETWORK_OFFLINE: 'TikTok đang mất mạng.',
    TIKTOK_DESCRIPTION_NOT_INSERTED: 'Không điền được Mô tả & Hashtag TikTok.',
    FACEBOOK_PUBLIC_NOT_CONFIRMED: 'Không đổi được sang Công khai trên Facebook.',
    FACEBOOK_ONLY_ME_NOT_CONFIRMED: 'Không đổi được sang Chỉ mình tôi trên Facebook.',
    TIKTOK_PRIVACY_NOT_CONFIRMED: 'Không xác nhận được quyền riêng tư trên TikTok Studio.'
  }[code] || `Chưa xác nhận đăng thành công (${code}).`)

  useEffect(() => {
    if (!settings.isActive || settings.mode !== 'full_auto' || !extensionConnected) return undefined
    let disposed = false
    const pollNextReadyPosts = async () => {
      if (disposed || autoPostInFlightRef.current || batchPosting) return
      autoPostInFlightRef.current = true
      try {
        const response = await apiJson('/api/admin/social/posts')
        const availablePosts = Array.isArray(response?.posts) ? response.posts : []
        setPosts(availablePosts)
        for (const plat of configuredChannels) {
          if (disposed || postingBusy[plat]) continue
          const nextPost = availablePosts
            .filter(post => (post.status === 'ready_for_publish' || post.status === 'ready_for_api') &&
              String(post.platform || '').toLowerCase() === plat &&
              post.id && !autoPostAttemptedIdsRef.current.has(String(post.id)))
            .sort((a, b) => Date.parse(b.createdAt || b.triggerTime || 0) - Date.parse(a.createdAt || a.triggerTime || 0))[0]
          if (nextPost) {
            autoPostAttemptedIdsRef.current.add(String(nextPost.id))
            handleRealAutoPostThroughExtension({ ...nextPost, privacy: nextPost.privacy || settings.privacy })
          }
        }
      } catch (_) {}
      finally { autoPostInFlightRef.current = false }
    }
    pollNextReadyPosts()
    const timer = setInterval(pollNextReadyPosts, 10000)
    return () => { disposed = true; clearInterval(timer) }
  }, [settings.isActive, settings.mode, settings.channels, extensionConnected, batchPosting, postingBusy.facebook, postingBusy.tiktok])

  const handleStopViralPlatform = async (platform) => {
    await sendExtensionMessage('STOP_VIRAL_PLATFORM', { platform })
    setScrapingPlatformBusy((cur) => ({ ...cur, [platform]: false }))
    showNotice(`⏹ Đã gửi lệnh dừng cào ${platform === 'facebook' ? 'Facebook' : 'TikTok'}.`, 'info')
  }

  // Cào Viral (FB Bài ≥ 1K • FB Reels ≥ 5K • TikTok ≥ 1M)
  const handleScrapeRealViralThroughExtension = async (overrideCfg = null) => {
    if (scrapingViralBusy) return
    const activeTopic = overrideCfg?.topic || viralTopic
    const activeCustomTopic = (overrideCfg?.customTopic !== undefined ? overrideCfg.customTopic : customViralTopic).trim()
    const activeFbSource = overrideCfg?.fbSourceMode || fbSourceMode
    const activeTtSource = overrideCfg?.ttSourceMode || ttSourceMode
    const targetPlat = overrideCfg?.platform || 'both'

    if (activeTopic === 'custom' && !activeCustomTopic) {
      return showNotice('Vui lòng nhập từ khóa chủ đề muốn cào.', 'error')
    }
    try {
      setScrapingViralBusy(true)
      setScrapingPlatformBusy({ facebook: targetPlat !== 'tiktok', tiktok: targetPlat !== 'facebook' })
      const topicLabel = activeTopic === 'custom'
        ? activeCustomTopic
        : (VIRAL_TOPICS.find(([k]) => k === activeTopic)?.[1]?.replace(/^[^\p{L}\p{N}]+/u, '').trim() || '')

      let fbKeywords = [], ttKeywords = []
      if (activeTopic !== 'all') {
        showNotice(`🤖 AI Local đang mở rộng từ khóa "${topicLabel}"...`, 'info')
        try {
          const expanded = await apiJson('/api/admin/social/ai/expand-topic', {
            method: 'POST', headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({ topicKey: activeTopic, customTopic: activeCustomTopic })
          })
          fbKeywords = expanded?.fbKeywords || []
          ttKeywords = expanded?.ttKeywords || []
        } catch (_) {}
      }

      showNotice(`🔥 Đang cào Viral (${topicLabel || 'Tất cả'} • FB Bài ≥1K • FB Reels ≥5K • TikTok ≥1M)...`, 'info')
      const res = await sendExtensionMessage('FETCH_REAL_VIRAL', {
        platform: overrideCfg?.platform || 'both',
        fbCount: overrideCfg?.fbCount || 10,
        tiktokCount: overrideCfg?.tiktokCount || 10,
        fbFeedMinLikes: overrideCfg?.fbFeedMinLikes ?? 1000,
        fbReelMinLikes: overrideCfg?.fbReelMinLikes ?? 5000,
        tiktokMinLikes: overrideCfg?.tiktokMinLikes ?? 1000000,
        fbSourceMode: activeFbSource,
        ttSourceMode: activeTtSource,
        topic: activeTopic,
        customTopic: activeCustomTopic,
        topicLabel, fbKeywords, ttKeywords,
        excludeUrls: viralPosts.map(v => v.postUrl).filter(Boolean)
      })
      if (res?.error === 'EXTENSION_NOT_DETECTED') { setShowExtensionHelp(true); throw new Error('Chưa kết nối Chrome Extension.') }

      const resViral = await apiJson('/api/admin/social/viral')
      if (resViral?.posts) setViralPosts(resViral.posts)
      const totalNew = (res?.data?.posts || []).length
      showNotice(totalNew > 0 ? `✅ Hoàn tất cào Viral (+${totalNew} bài mới)!` : '✅ Đã đồng bộ xong danh sách bài Viral.')
      setActiveSubTab('groups')
    } catch (err) { showNotice(err.message || 'Lỗi cào bài viral.', 'error') }
    finally {
      setScrapingViralBusy(false)
      setScrapingPlatformBusy({ facebook: false, tiktok: false })
    }
  }

  const handleAiCleanExistingViral = async () => {
    if (aiCleaningViral || !viralPosts.length) return
    try {
      setAiCleaningViral(true)
      showNotice(`🤖 AI Local đang phân loại xu hướng, gắn tag & lọc trùng ${viralPosts.length} bài...`, 'info')
      const res = await apiJson('/api/admin/social/ai/classify-viral', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ requestedTopic: 'all', requestedTopicLabel: '', posts: [] })
      })
      if (res?.ok && Array.isArray(res.posts)) {
        setViralPosts(res.posts)
        showNotice(`✅ AI đã phân loại chuẩn xác ${res.posts.length} bài (lọc ${res.removedDuplicates || 0} bài trùng).`)
      }
    } catch (err) { showNotice(err.message || 'Lỗi lọc AI.', 'error') }
    finally { setAiCleaningViral(false) }
  }

  const handleAutoScrape5FacebookGroups = async () => {
    if (scrapingGroupsBusy) return
    try {
      setScrapingGroupsBusy(true)
      const res = await sendExtensionMessage('SCRAPE_FB_GROUPS', {
        count: 5, keyword: groupKeyword.trim(),
        excludeUrls: groups.map(g => g.groupUrl).filter(Boolean),
        excludeNames: groups.map(g => g.groupName).filter(Boolean)
      })
      if (res?.error === 'EXTENSION_NOT_DETECTED') { setShowExtensionHelp(true); throw new Error('Chưa kết nối Chrome Extension.') }
      if (!res?.ok) throw new Error(getExtensionPostErrorMessage(res?.error || 'GROUP_SCRAPE_FAILED'))

      const scrapedGroups = res?.data?.groups || []
      if (!scrapedGroups.length) return showNotice('Chưa thấy nhóm mới phù hợp. Thử từ khóa khác.', 'info')
      const saved = await apiJson('/api/admin/social/groups/import-real', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ groups: scrapedGroups })
      })
      if (saved?.groups) setGroups(saved.groups)
      showNotice(`Đã thêm ${saved?.addedCount ?? scrapedGroups.length} hội nhóm mới.`)
    } catch (err) { showNotice(err.message || 'Lỗi lấy hội nhóm.', 'error') }
    finally { setScrapingGroupsBusy(false) }
  }

  const handleClearAllViralPosts = async () => {
    if (!viralPosts.length || !window.confirm(`Xóa toàn bộ ${viralPosts.length} bài viral?`)) return
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/viral/clear-all', { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
      if (res?.ok) { setViralPosts([]); showNotice('Đã xóa toàn bộ bài viral.') }
    } catch (err) { showNotice(err.message || 'Lỗi xóa bài viral.', 'error') }
    finally { setLoading(false) }
  }

  const handleClearAllPostLogs = async () => {
    if (!posts.length || !window.confirm(`Xóa toàn bộ ${posts.length} bản ghi nhật ký?`)) return
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/posts/clear-all', { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
      if (res?.ok) { setPosts([]); showNotice('Đã xóa toàn bộ nhật ký.'); await loadAll() }
    } catch (err) { showNotice(err.message || 'Lỗi xóa nhật ký.', 'error') }
    finally { setLoading(false) }
  }

  const handleDeletePost = async (id) => {
    if (!window.confirm('Xóa bản ghi này?')) return
    try {
      const res = await apiJson(`/api/admin/social/posts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
      if (res?.ok) await loadAll()
    } catch (err) { showNotice(err.message || 'Lỗi xóa bài.', 'error') }
  }

  const handleAddGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.groupName || !newGroup.groupUrl) return showNotice('Điền tên và link nhóm.', 'error')
    try {
      const res = await apiJson('/api/admin/social/groups', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(newGroup) })
      if (res?.ok) {
        setNewGroup({ groupName: '', groupUrl: '', category: 'Đồ gia dụng & Gia đình', membersCount: 0, interactionRate: 'Cao', isAutoShare: true, notes: '' })
        const updated = await apiJson('/api/admin/social/groups')
        if (updated?.groups) setGroups(updated.groups)
      }
    } catch (err) { showNotice(err.message || 'Lỗi thêm nhóm.', 'error') }
  }

  const handleToggleGroup = async (id, currentShare) => {
    try {
      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}/toggle`, {
        method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ isAutoShare: !currentShare })
      })
      if (res?.ok) setGroups(prev => prev.map(g => g.id === id ? { ...g, isAutoShare: !currentShare } : g))
    } catch (err) { showNotice(err.message || 'Lỗi đổi trạng thái nhóm.', 'error') }
  }

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Xóa nhóm này?')) return
    try {
      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
      if (res?.ok) setGroups(prev => prev.filter(g => g.id !== id))
    } catch (err) { showNotice(err.message || 'Lỗi xóa nhóm.', 'error') }
  }

  const handleExportExcel = () => {
    if (!posts.length) return showNotice('Không có dữ liệu để xuất.', 'info')
    const params = new URLSearchParams()
    if (postFilterStatus !== 'all') params.set('status', postFilterStatus)
    if (postFilterPlatform !== 'all') params.set('platform', postFilterPlatform)
    const link = document.createElement('a')
    link.href = '/api/admin/social/posts/export' + (params.toString() ? `?${params.toString()}` : '')
    link.download = `Bao_Cao_Dang_Bai_MXH_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredPosts = useMemo(() => posts.filter(post =>
    (postFilterStatus === 'all' || post.status === postFilterStatus) &&
    (postFilterPlatform === 'all' || post.platform === postFilterPlatform)
  ), [posts, postFilterStatus, postFilterPlatform])

  const filteredAndSortedGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase()
    const list = q ? groups.filter(g => g.groupName.toLowerCase().includes(q) || (g.category || '').toLowerCase().includes(q)) : [...groups]
    return list.sort((a, b) => {
      if (groupSort === 'name_asc') return String(a.groupName || '').localeCompare(String(b.groupName || ''), 'vi')
      if (groupSort === 'name_desc') return String(b.groupName || '').localeCompare(String(a.groupName || ''), 'vi')
      if (groupSort === 'members_asc') return Number(a.membersCount || 0) - Number(b.membersCount || 0)
      return Number(b.membersCount || 0) - Number(a.membersCount || 0)
    })
  }, [groups, groupSearch, groupSort])

  const sortViralList = (list, mode) => [...list].sort((a, b) => {
    if (mode === 'newest') return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
    if (mode === 'oldest') return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0)
    if (mode === 'name_asc') return String(a.title || '').localeCompare(String(b.title || ''), 'vi')
    if (mode === 'name_desc') return String(b.title || '').localeCompare(String(a.title || ''), 'vi')
    if (mode === 'likes_asc') return Number(a.likesCount || 0) - Number(b.likesCount || 0)
    return Number(b.likesCount || 0) - Number(a.likesCount || 0)
  })

  const isFacebookReelItem = (v) =>
    /\/reel\/|\/videos\/|\/watch/i.test(String(v.postUrl || '')) ||
    /thước phim|reels/i.test(`${v.category || ''} ${v.trendingTopic || ''}`)

  const availableViralCategories = useMemo(() => {
    const set = new Set()
    for (const v of viralPosts) {
      const cat = String(v.category || '').trim()
      if (cat) set.add(cat)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))
  }, [viralPosts])

  const matchesViralFilters = (v) => {
    if (viralFilterTopic !== 'all' && String(v.category || '').trim().toLowerCase() !== viralFilterTopic.toLowerCase()) return false
    if (viralSearch.trim()) {
      const q = viralSearch.trim().toLowerCase()
      const hay = `${v.title || ''} ${v.category || ''} ${v.trendingTopic || ''} ${v.summary || ''} ${v.authorName || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }

  const facebookViralAll = useMemo(() => {
    const list = viralPosts.filter((v) => {
      if (String(v.platform || '').toLowerCase() !== 'facebook') return false
      if (!matchesViralFilters(v)) return false
      if (viralFbKindFilter === 'reels') return isFacebookReelItem(v)
      if (viralFbKindFilter === 'feed') return !isFacebookReelItem(v)
      return true
    })
    return sortViralList(list, fbViralSort)
  }, [viralPosts, fbViralSort, viralFilterTopic, viralFbKindFilter, viralSearch])

  const tiktokViralAll = useMemo(() => {
    const list = viralPosts.filter((v) => String(v.platform || '').toLowerCase() === 'tiktok' && matchesViralFilters(v))
    return sortViralList(list, ttViralSort)
  }, [viralPosts, ttViralSort, viralFilterTopic, viralSearch])

  const formatTime = (isoString) => {
    if (!isoString) return '—'
    try { return new Date(isoString).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) }
    catch { return isoString }
  }

  const triggerBtnLabel = configuredChannels.length === 2
    ? '⚡ Đăng FB + TikTok'
    : configuredChannels[0] === 'facebook' ? '⚡ Đăng Facebook' : '⚡ Đăng TikTok'

  return (
    <div className="admin-social-workspace admin-social-posting admin-social-automation" data-module="social-automation">
      {alertMessage && (
        <div className={`social-alert social-alert--${alertMessage.type || 'success'}`}>
          <span>{alertMessage.type === 'error' ? '⚠️' : alertMessage.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span>{alertMessage.text}</span>
        </div>
      )}

      <section className="social-kpi-banner">
        <div className="social-kpi-banner__head">
          <div className="social-kpi-title">
            <span style={{ fontSize: '22px' }}>📢</span>
            <h2>Tự Động Đăng Bài MXH</h2>
            <span className={'social-status-pill ' + (settings.isActive ? 'is-active' : 'is-paused')}>
              {settings.isActive ? `● Đang chạy (${currentIntervalKey === '2m' ? '2 phút' : currentIntervalKey === '1' ? '1 giờ' : '4 giờ'})` : '○ Tạm dừng'}
            </span>
          </div>
          <div className="social-kpi-actions">
            <button type="button" className="social-btn-trigger" onClick={handleTriggerCycle} disabled={loading || batchPosting}>{batchPosting ? '⏳ Đang chạy...' : triggerBtnLabel}</button>
            <button type="button" className="social-btn-secondary" onClick={loadAll} disabled={loading}>🔄 Làm mới</button>
          </div>
        </div>
        <div className="social-kpi-grid">
          <div className="social-kpi-card"><small>Đã đăng</small><strong>{stats.publishedCount} bài</strong></div>
          <div className="social-kpi-card"><small>Chờ duyệt</small><strong>{stats.pendingCount} bài</strong></div>
          <div className="social-kpi-card"><small>Lượt thích</small><strong>{stats.totalLikes.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card"><small>Chia sẻ</small><strong>{stats.totalShares.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card"><small>Bình luận</small><strong>{stats.totalComments.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card"><small>Chu kỳ kế tiếp</small><strong style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{formatTime(stats.nextRunAt)}</strong></div>
        </div>
      </section>

      <section className="social-extension-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>👁️</span>
          <strong style={{ fontSize: '13px' }}>OmniVision v3.5</strong>
          <span className={'social-ext-badge ' + (extensionConnected ? 'is-on' : 'is-wait')}>
            {extensionConnected ? '🟢 Đã kết nối' : '🟡 Chờ Extension'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="social-btn-trigger"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            disabled={postingBusy.facebook || !studioDraft.productImage || !studioDraft.content}
            onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'facebook', privacy: studioPrivacy })}
          >
            {postingBusy.facebook ? '⏳ Đang đăng FB...' : '🚀 Đăng FB'}
          </button>
          <button
            type="button"
            className="social-btn-trigger"
            style={{ fontSize: '12px', padding: '6px 12px', background: '#000', borderColor: '#fe2c55', color: '#fe2c55' }}
            disabled={postingBusy.tiktok || !studioDraft.productImage || !studioDraft.content}
            onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'tiktok', privacy: studioPrivacy })}
          >
            {postingBusy.tiktok ? '⏳ Đang đăng TikTok...' : '🚀 Đăng TikTok'}
          </button>
          <button
            type="button"
            className="social-btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', background: '#0f172a', borderColor: '#334155', color: '#38bdf8' }}
            disabled={scrapingViralBusy}
            onClick={() => handleScrapeRealViralThroughExtension()}
          >
            {scrapingViralBusy ? '⏳ Đang cào...' : '🔥 Cào Viral'}
          </button>
          <button type="button" className="social-btn-secondary" style={{ fontSize: '12px', padding: '6px 10px' }} onClick={() => setShowExtensionHelp(true)}>📖 Hướng dẫn</button>
        </div>
      </section>

      <nav className="social-subnav" aria-label="Phân hệ tiếp thị MXH">
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'settings' ? 'is-active' : '')} onClick={() => setActiveSubTab('settings')}>⚙️ Cấu hình</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'studio' ? 'is-active' : '')} onClick={() => setActiveSubTab('studio')}>✍️ Soạn bài AI</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'groups' ? 'is-active' : '')} onClick={() => setActiveSubTab('groups')}>👥 Nhóm & Viral ({viralPosts.length})</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'logs' ? 'is-active' : '')} onClick={() => setActiveSubTab('logs')}>📋 Nhật ký ({posts.length})</button>
      </nav>

      {/* TAB 1: CẤU HÌNH + 5 PANEL TỰ ĐỘNG HÓA */}
      {activeSubTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="social-panel">
            <div className="social-panel__heading"><h3>⚙️ Cấu hình đăng bài tự động</h3></div>
            <form onSubmit={handleSaveSettings}>
              <div className="social-form-grid">
                <div className="social-field"><label htmlFor="cfg-status">Trạng thái</label><select id="cfg-status" className="social-select" value={settings.isActive ? '1' : '0'} onChange={e => setSettings({ ...settings, isActive: e.target.value === '1' })}><option value="1">🟢 Bật</option><option value="0">🔴 Tắt</option></select></div>
                <div className="social-field"><label htmlFor="cfg-mode">Chế độ</label><select id="cfg-mode" className="social-select" value={settings.mode} onChange={e => setSettings({ ...settings, mode: e.target.value })}><option value="full_auto">🚀 Tự động (Full-Auto)</option><option value="semi_auto">📝 Duyệt trước (Semi-Auto)</option></select></div>
                <div className="social-field"><label htmlFor="cfg-interval">Chu kỳ đăng</label><select id="cfg-interval" className="social-select" value={currentIntervalKey} onChange={e => handleIntervalChange(e.target.value)}><option value="2m">⚡ Mỗi 2 phút</option><option value="1">🕐 Mỗi 1 giờ</option><option value="4">🕓 Mỗi 4 giờ</option></select></div>
                <div className="social-field"><label htmlFor="cfg-privacy">Quyền riêng tư</label><select id="cfg-privacy" className="social-select" value={settings.privacy || 'only_me'} onChange={e => { const v = e.target.value; setSettings({ ...settings, privacy: v }); setStudioPrivacy(v) }}><option value="only_me">🔒 Chỉ mình tôi</option><option value="public">🌐 Công khai</option></select></div>
                <div className="social-field"><label htmlFor="cfg-channels">Kênh đăng</label><select id="cfg-channels" className="social-select" value={settings.channels} onChange={e => setSettings({ ...settings, channels: e.target.value })}><option value="facebook,tiktok">Facebook + TikTok (Song song)</option><option value="facebook">Chỉ Facebook</option><option value="tiktok">Chỉ TikTok</option></select></div>
                <div className="social-field"><label htmlFor="cfg-category">Danh mục sản phẩm</label><select id="cfg-category" className="social-select" value={settings.preferredCategory} onChange={e => setSettings({ ...settings, preferredCategory: e.target.value })}><option value="all">Tất cả</option><option value="Đồ gia dụng">Đồ gia dụng</option><option value="Thời trang">Thời trang</option><option value="Công nghệ">Công nghệ</option></select></div>
                <div className="social-field"><label htmlFor="cfg-tone">Phong cách viết</label><select id="cfg-tone" className="social-select" value={settings.toneStyle} onChange={e => setSettings({ ...settings, toneStyle: e.target.value })}><option value="viral_engaging">Bắt trend</option><option value="humorous">Hài hước</option><option value="fomo_sales">Chốt đơn gấp</option><option value="authentic_review">Review chân thực</option><option value="storytelling">Kể chuyện</option></select></div>
                <div className="social-field"><label htmlFor="cfg-hotline">Hotline</label><input id="cfg-hotline" type="text" className="social-input" value={settings.contactHotline} onChange={e => setSettings({ ...settings, contactHotline: e.target.value })} /></div>
                <div className="social-field"><label htmlFor="cfg-link">Mẫu link đặt hàng</label><input id="cfg-link" type="text" className="social-input" value={settings.orderLinkTemplate} onChange={e => setSettings({ ...settings, orderLinkTemplate: e.target.value })} /></div>
              </div>
              <div className="social-checkbox-group" style={{ marginBottom: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeEmojis} onChange={e => setSettings({ ...settings, includeEmojis: e.target.checked })} /><span>Chèn Emoji</span></label>
                  <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeHashtags} onChange={e => setSettings({ ...settings, includeHashtags: e.target.checked })} /><span>Chèn Hashtag</span></label>
                  <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeCta} onChange={e => setSettings({ ...settings, includeCta: e.target.checked })} /><span>Kêu gọi mua hàng</span></label>
                  <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeHotline} onChange={e => setSettings({ ...settings, includeHotline: e.target.checked })} /><span>Đính kèm Hotline</span></label>
                </div>
              </div>
              <button type="submit" className="social-btn-trigger" style={{ padding: '10px 22px', fontSize: '13px' }} disabled={loading}>💾 Lưu cấu hình</button>
            </form>
          </section>

          <AutomationSuitePanels
            csrfToken={csrfToken}
            sendExtensionMessage={sendExtensionMessage}
            viralPosts={viralPosts}
            onCustomViralScrape={(cfg) => { setActiveSubTab('groups'); handleScrapeRealViralThroughExtension(cfg) }}
            onOpenSingleTab={handleOpenViralSingleTab}
            showNotice={showNotice}
            onSurfSaved={() => apiJson('/api/admin/social/surf-history').then((r) => r?.posts && setSurfHistory(r.posts)).catch(() => {})}
          />
        </div>
      )}

      {/* TAB 2: SOẠN BÀI AI */}
      {activeSubTab === 'studio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="social-panel">
            <div className="social-panel__heading"><h3>✍️ Soạn bài AI</h3></div>
            <div className="social-studio-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className={'social-action-btn ' + (studioPlatform === 'facebook' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => setStudioPlatform('facebook')}>🔵 Facebook {postingBusy.facebook ? '(Đang đăng...)' : ''}</button>
                  <button type="button" className={'social-action-btn ' + (studioPlatform === 'tiktok' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => setStudioPlatform('tiktok')}>🎵 TikTok {postingBusy.tiktok ? '(Đang đăng...)' : ''}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="social-field">
                    <label htmlFor="studio-privacy">Quyền riêng tư</label>
                    <select id="studio-privacy" className="social-select" value={studioPrivacy} onChange={e => setStudioPrivacy(e.target.value)}>
                      <option value="only_me">🔒 Chỉ mình tôi</option>
                      <option value="public">🌐 Công khai</option>
                    </select>
                  </div>
                  <div className="social-field">
                    <label htmlFor="studio-selection-mode">Chọn sản phẩm</label>
                    <select id="studio-selection-mode" className="social-select" value={studioSelectionMode} onChange={e => setStudioSelectionMode(e.target.value)}>
                      <option value="smart">🤖 AI tự chọn thông minh</option>
                      <option value="random">🎲 Ngẫu nhiên</option>
                      <option value="custom">🎯 Chọn sản phẩm cụ thể</option>
                    </select>
                  </div>
                </div>
                {studioSelectionMode === 'custom' && (
                  <div className="social-field">
                    <label htmlFor="studio-product-select">Sản phẩm trong kho ({catalogList.length})</label>
                    <select
                      id="studio-product-select"
                      className="social-select"
                      value={studioProductId}
                      onChange={e => {
                        const pid = e.target.value
                        setStudioProductId(pid)
                        const found = catalogList.find(p => String(p.id) === String(pid))
                        if (found) setStudioDraft(cur => ({ ...cur, productId: found.id, productName: found.name, productPrice: found.price, productImage: found.image }))
                      }}
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {catalogList.map(p => <option key={p.id} value={p.id}>{p.name} ({Number(p.price || 0).toLocaleString('vi-VN')} đ)</option>)}
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: studioPlatform === 'facebook' ? '1fr 1fr' : '1fr', gap: '10px' }}>
                  <div className="social-field">
                    <label htmlFor="studio-tone">Phong cách</label>
                    <select id="studio-tone" className="social-select" value={studioTone} onChange={e => setStudioTone(e.target.value)}>
                      <option value="viral_engaging">Bắt trend</option>
                      <option value="humorous">Hài hước</option>
                      <option value="fomo_sales">Chốt đơn gấp</option>
                      <option value="authentic_review">Review chân thực</option>
                      <option value="storytelling">Kể chuyện</option>
                    </select>
                  </div>
                  {studioPlatform === 'facebook' && (
                    <div className="social-field">
                      <label htmlFor="studio-target-group">Nơi đăng Facebook</label>
                      <select id="studio-target-group" className="social-select" value={studioTargetGroup} onChange={e => setStudioTargetGroup(e.target.value)}>
                        <option value="">👤 Trang cá nhân (Mặc định)</option>
                        {groups.map(grp => <option key={grp.id} value={grp.groupName}>👥 {grp.groupName} ({grp.membersCount.toLocaleString('vi-VN')} tv)</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="social-field">
                  <label htmlFor="studio-topic">Chủ đề bổ sung</label>
                  <input id="studio-topic" type="text" className="social-input" value={studioTopic} onChange={e => setStudioTopic(e.target.value)} placeholder="VD: Freeship, bảo hành 1 đổi 1..." />
                </div>
                <button type="button" className="social-btn-trigger" style={{ padding: '11px', fontSize: '13px', justifyContent: 'center' }} onClick={handleGenerateStudio} disabled={studioGenerating}>
                  {studioGenerating ? '⏳ Đang viết...' : '⚡ Tạo bài bằng AI'}
                </button>
                <div className="social-field">
                  <label htmlFor="studio-draft-content">Nội dung</label>
                  <textarea id="studio-draft-content" className="social-textarea" rows={8} value={studioDraft.content} onChange={e => setStudioDraft({ ...studioDraft, content: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="social-btn-trigger"
                    style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                    onClick={() => handlePublishStudio(true)}
                    disabled={loading || postingBusy[studioPlatform]}
                  >
                    {postingBusy[studioPlatform] ? `⏳ Đang đăng ${studioPlatform.toUpperCase()}...` : `🚀 Đăng ngay (${studioPlatform === 'facebook' ? (studioTargetGroup ? 'Nhóm FB' : 'Trang cá nhân') : 'TikTok'})`}
                  </button>
                  <button type="button" className="social-action-btn" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(false)} disabled={loading}>⏳ Lưu nháp</button>
                </div>
              </div>

              <div className="social-preview-container">
                <span className="social-subhead" style={{ fontWeight: 800 }}>Xem trước ({studioPlatform === 'facebook' ? 'Facebook' : 'TikTok'})</span>
                <div className={'social-preview-card ' + (studioPlatform === 'facebook' ? 'social-preview-card--facebook' : 'social-preview-card--tiktok')}>
                  <div className="preview-header">
                    <div className="preview-avatar">O</div>
                    <div className="preview-author">
                      <strong>{studioPlatform === 'facebook' && studioTargetGroup ? studioTargetGroup : 'Trang cá nhân đang đăng nhập'} <span className="preview-badge-verified">✓</span></strong>
                      <small>Vừa xong · {studioPrivacy === 'public' ? 'Công khai 🌐' : 'Chỉ mình tôi 🔒'}</small>
                    </div>
                  </div>
                  <div className="preview-content">{studioDraft.content}</div>
                  <div className="preview-media"><img src={studioDraft.productImage || '/products/headphones.svg'} alt={studioDraft.productName} onError={e => { e.currentTarget.src = '/products/bag.svg' }} /></div>
                  <div className="preview-footer"><span>👍 Thích</span><span>💬 Bình luận</span><span>🔁 Chia sẻ</span></div>
                </div>
              </div>
            </div>
          </section>

          <SmartProductVisionPanel
            csrfToken={csrfToken}
            onProductCreated={(prod) => setCatalogList((cur) => [prod, ...cur])}
            onSelectForPost={(prod) => {
              setStudioSelectionMode('custom')
              setStudioProductId(prod.id)
              setStudioDraft((cur) => ({ ...cur, productId: prod.id, productName: prod.name, productPrice: prod.price, productImage: prod.image }))
              showNotice(`Đã chọn "${prod.name}" vào Soạn bài AI!`)
            }}
          />
        </div>
      )}

      {/* TAB 3: HỘI NHÓM & KHO BÀI VIRAL 2 CỘT TRÁI (FB) — PHẢI (TIKTOK) */}
      {activeSubTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>👥 Hội nhóm Facebook</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" className="social-input" style={{ width: '200px', padding: '7px 10px' }} placeholder="Từ khóa tìm nhóm..." value={groupKeyword} onChange={e => setGroupKeyword(e.target.value)} />
                <button type="button" className="social-btn-trigger" onClick={handleAutoScrape5FacebookGroups} disabled={scrapingGroupsBusy} style={{ fontSize: '12px', padding: '8px 14px' }}>
                  {scrapingGroupsBusy ? '⏳ Đang lấy...' : '🔍 Lấy 5 nhóm FB'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="search" className="social-input" style={{ maxWidth: '280px' }} placeholder="🔍 Lọc nhóm..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} />
              <div className="social-sort-bar">
                <label htmlFor="sort-groups">Sắp xếp:</label>
                <select id="sort-groups" className="social-sort-select" value={groupSort} onChange={e => setGroupSort(e.target.value)}>
                  <option value="members_desc">Thành viên (Cao → Thấp)</option>
                  <option value="members_asc">Thành viên (Thấp → Cao)</option>
                  <option value="name_asc">Tên (A → Z)</option>
                  <option value="name_desc">Tên (Z → A)</option>
                </select>
              </div>
              <span className="social-muted-text" style={{ marginLeft: 'auto' }}>{filteredAndSortedGroups.length} nhóm</span>
            </div>

            <div className="social-table-shell" style={{ marginBottom: '18px' }}>
              <table className="social-table">
                <thead><tr><th>Tên nhóm</th><th>Chủ đề</th><th>Thành viên</th><th>Tương tác</th><th>Chia sẻ</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {filteredAndSortedGroups.map(grp => (
                    <tr key={grp.id}>
                      <td><strong>{grp.groupName}</strong><div style={{ fontSize: '11px' }}><a href={grp.groupUrl} target="_blank" rel="noopener noreferrer" className="social-table-link">{grp.groupUrl} ↗</a></div></td>
                      <td>{grp.category}</td>
                      <td><strong>{Number(grp.membersCount || 0).toLocaleString('vi-VN')}</strong></td>
                      <td><span className="status-tag status-tag--published">{grp.interactionRate}</span></td>
                      <td><button type="button" className={'social-action-btn ' + (grp.isAutoShare ? 'social-action-btn--primary' : '')} onClick={() => handleToggleGroup(grp.id, grp.isAutoShare)}>{grp.isAutoShare ? '✓ Bật' : '○ Tắt'}</button></td>
                      <td><button type="button" className="social-action-btn social-action-btn--danger" onClick={() => handleDeleteGroup(grp.id)}>Xóa</button></td>
                    </tr>
                  ))}
                  {filteredAndSortedGroups.length === 0 && <tr><td colSpan={6} className="social-table-empty">Chưa có hội nhóm.</td></tr>}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleAddGroup} className="social-subform-card">
              <h4>➕ Thêm nhóm thủ công</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <input type="text" className="social-input" placeholder="Tên nhóm *" value={newGroup.groupName} onChange={e => setNewGroup({ ...newGroup, groupName: e.target.value })} />
                <input type="url" className="social-input" placeholder="Link nhóm Facebook *" value={newGroup.groupUrl} onChange={e => setNewGroup({ ...newGroup, groupUrl: e.target.value })} />
                <input type="text" className="social-input" placeholder="Chủ đề" value={newGroup.category} onChange={e => setNewGroup({ ...newGroup, category: e.target.value })} />
                <input type="number" className="social-input" placeholder="Thành viên" value={newGroup.membersCount} onChange={e => setNewGroup({ ...newGroup, membersCount: Number(e.target.value) })} />
              </div>
              <button type="submit" className="social-btn-trigger">Thêm</button>
            </form>
          </section>

          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>🔥 Bài đăng Viral ({viralPosts.length} bài)</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select id="viral-fb-source-select" aria-label="Nguồn cào Facebook" className="social-sort-select" value={fbSourceMode} onChange={e => setFbSourceMode(e.target.value)}>
                  <option value="both">📘 FB: Bài viết + Reels</option>
                  <option value="feed">🏠 FB: Bài viết (≥1K)</option>
                  <option value="reels">🎬 FB: Thước phim (≥5K)</option>
                </select>
                <select id="viral-tt-source-select" aria-label="Nguồn cào TikTok" className="social-sort-select" value={ttSourceMode} onChange={e => setTtSourceMode(e.target.value)}>
                  <option value="explore">🧭 TikTok: Khám phá</option>
                  <option value="search">🔎 TikTok: Từ khóa</option>
                </select>
                <select id="viral-topic-select" aria-label="Chủ đề cào bài viral" className="social-sort-select" value={viralTopic} onChange={e => setViralTopic(e.target.value)}>
                  {VIRAL_TOPICS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                {viralTopic === 'custom' && (
                  <input type="text" className="social-input" style={{ width: '185px', padding: '6px 10px' }} placeholder="Nhập chủ đề..." value={customViralTopic} onChange={e => setCustomViralTopic(e.target.value)} />
                )}
                <button type="button" className="social-btn-trigger" onClick={() => handleScrapeRealViralThroughExtension()} disabled={scrapingViralBusy || loading} style={{ fontSize: '12px', padding: '8px 14px' }}>
                  {scrapingViralBusy ? '⏳ Đang cào...' : '⚡ Cào Viral (AI)'}
                </button>
                <button type="button" className="social-action-btn" onClick={handleAiCleanExistingViral} disabled={aiCleaningViral || viralPosts.length === 0} style={{ fontSize: '12px', padding: '8px 12px' }}>
                  {aiCleaningViral ? '⏳ AI đang lọc...' : '🤖 AI Gắn Tag & Lọc Trùng'}
                </button>
                <button type="button" className="social-action-btn social-action-btn--danger" onClick={handleClearAllViralPosts} disabled={loading || viralPosts.length === 0} style={{ fontSize: '12px', padding: '8px 12px' }}>
                  🗑️ Xóa ({viralPosts.length})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="search" className="social-input" style={{ maxWidth: '250px', padding: '7px 11px' }} placeholder="🔍 Tìm tiêu đề, hashtag, tác giả..." value={viralSearch} onChange={e => setViralSearch(e.target.value)} />
              <div className="social-sort-bar">
                <label htmlFor="filter-viral-topic">Xu hướng:</label>
                <select id="filter-viral-topic" className="social-sort-select" value={viralFilterTopic} onChange={e => setViralFilterTopic(e.target.value)}>
                  <option value="all">Tất cả ({viralPosts.length})</option>
                  {availableViralCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="social-sort-bar">
                <label htmlFor="filter-fb-kind">Loại FB:</label>
                <select id="filter-fb-kind" className="social-sort-select" value={viralFbKindFilter} onChange={e => setViralFbKindFilter(e.target.value)}>
                  <option value="all">Tất cả</option>
                  <option value="feed">🏠 Bài viết</option>
                  <option value="reels">🎬 Thước phim</option>
                </select>
              </div>
              {(viralFilterTopic !== 'all' || viralFbKindFilter !== 'all' || viralSearch) && (
                <button type="button" className="social-action-btn" onClick={() => { setViralFilterTopic('all'); setViralFbKindFilter('all'); setViralSearch('') }}>✕ Bỏ lọc</button>
              )}
            </div>

            {/* CHIA 2 CỘT SONG SONG: FACEBOOK TRÁI | TIKTOK PHẢI */}
            <div className="social-viral-split-grid">
              {/* CỘT TRÁI: FACEBOOK (Bài ≥1K • Reels ≥5K) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--fb">
                  <span>📘 Facebook (Bài ≥1K • Reels ≥5K)</span>
                  <div className="social-viral-head-tools">
                    <select aria-label="Sắp xếp bài viral Facebook" className="social-sort-select social-sort-select--mini" value={fbViralSort} onChange={e => setFbViralSort(e.target.value)}>
                      <option value="newest">🕒 Mới lấy nhất</option>
                      <option value="oldest">🕒 Cũ nhất</option>
                      <option value="likes_desc">Like ↓</option>
                      <option value="likes_asc">Like ↑</option>
                      <option value="name_asc">A → Z</option>
                    </select>
                    <span className="social-viral-count">{facebookViralAll.length} bài</span>
                    <button type="button" className="social-action-btn social-action-btn--danger" style={{ padding: '4px 9px' }} onClick={() => handleStopViralPlatform('facebook')}>⏹ Dừng FB</button>
                  </div>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead><tr><th>#</th><th>Bài viết / Thước phim</th><th>Tương tác</th><th>Link</th></tr></thead>
                    <tbody>
                      {facebookViralAll.map((v, idx) => {
                        const tags = extractHashtagChips(v)
                        return (
                          <tr key={v.id}>
                            <td><strong>{idx + 1}</strong></td>
                            <td>
                              <div className="viral-card-cell">
                                {v.thumbnailUrl
                                  ? <img src={v.thumbnailUrl} alt={v.title} referrerPolicy="no-referrer" className="viral-thumb-lg" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                  : <div className="viral-thumb-lg viral-thumb-lg--fb">📘</div>}
                                <div className="viral-card-meta">
                                  <div className="viral-card-title">{v.title}</div>
                                  {v.authorName && <div className="viral-card-author">👤 {v.authorUrl ? <a href={v.authorUrl} target="_blank" rel="noopener noreferrer">{v.authorName}</a> : v.authorName}</div>}
                                  {v.createdAt && <div style={{ fontSize: '11px', color: '#64748b' }}>🕒 {formatTime(v.createdAt)}</div>}
                                  <div className="viral-card-badges">
                                    <span className="channel-tag channel-tag--facebook">{v.category || 'Xu hướng FB'}</span>
                                    <span className="viral-kind-badge">{isFacebookReelItem(v) ? '🎬 Reels' : '🏠 Bài viết'}</span>
                                    {tags.map((t) => <span key={t} className="viral-hashtag-chip">{t}</span>)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="viral-metrics-cell">
                              <div>👍 <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></div>
                              <div>💬 <strong>{Number(v.commentsCount || 0).toLocaleString('vi-VN')}</strong></div>
                              {Number(v.sharesCount || 0) > 0 && <div>🔁 {Number(v.sharesCount).toLocaleString('vi-VN')}</div>}
                            </td>
                            <td>
                              <button type="button" className="social-action-btn social-table-link" onClick={() => handleOpenViralSingleTab(v.postUrl, 'facebook')}>Mở ↗</button>
                            </td>
                          </tr>
                        )
                      })}
                      {facebookViralAll.length === 0 && <tr><td colSpan={4} className="social-table-empty">Chưa có bài Facebook phù hợp.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT PHẢI: TIKTOK (≥ 1M Tim) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--tt">
                  <span>🎵 TikTok (≥ 1M Tim)</span>
                  <div className="social-viral-head-tools">
                    <select aria-label="Sắp xếp bài viral TikTok" className="social-sort-select social-sort-select--mini" value={ttViralSort} onChange={e => setTtViralSort(e.target.value)}>
                      <option value="newest">🕒 Mới lấy nhất</option>
                      <option value="oldest">🕒 Cũ nhất</option>
                      <option value="likes_desc">Tim ↓</option>
                      <option value="likes_asc">Tim ↑</option>
                      <option value="name_asc">A → Z</option>
                    </select>
                    <span className="social-viral-count">{tiktokViralAll.length} bài</span>
                    <button type="button" className="social-action-btn social-action-btn--danger" style={{ padding: '4px 9px' }} onClick={() => handleStopViralPlatform('tiktok')}>⏹ Dừng TikTok</button>
                  </div>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead><tr><th>#</th><th>Video / Ảnh</th><th>Tương tác</th><th>Link</th></tr></thead>
                    <tbody>
                      {tiktokViralAll.map((v, idx) => {
                        const tags = extractHashtagChips(v)
                        return (
                          <tr key={v.id}>
                            <td><strong>{idx + 1}</strong></td>
                            <td>
                              <div className="viral-card-cell">
                                {v.thumbnailUrl
                                  ? <img src={v.thumbnailUrl} alt={v.title} referrerPolicy="no-referrer" className="viral-thumb-lg" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                  : <div className="viral-thumb-lg viral-thumb-lg--tt">🎵</div>}
                                <div className="viral-card-meta">
                                  <div className="viral-card-title">{v.title}</div>
                                  {v.authorName && <div className="viral-card-author">👤 {v.authorUrl ? <a href={v.authorUrl} target="_blank" rel="noopener noreferrer">{v.authorName}</a> : v.authorName}</div>}
                                  {v.createdAt && <div style={{ fontSize: '11px', color: '#64748b' }}>🕒 {formatTime(v.createdAt)}</div>}
                                  <div className="viral-card-badges">
                                    <span className="channel-tag channel-tag--tiktok">{v.category || 'Xu hướng TikTok'}</span>
                                    {tags.map((t) => <span key={t} className="viral-hashtag-chip viral-hashtag-chip--tt">{t}</span>)}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="viral-metrics-cell">
                              <div>❤️ <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></div>
                              <div>💬 <strong>{Number(v.commentsCount || 0).toLocaleString('vi-VN')}</strong></div>
                              {Number(v.sharesCount || 0) > 0 && <div>🔁 {Number(v.sharesCount).toLocaleString('vi-VN')}</div>}
                            </td>
                            <td>
                              <button type="button" className="social-action-btn social-table-link" onClick={() => handleOpenViralSingleTab(v.postUrl, 'tiktok')}>Mở ↗</button>
                            </td>
                          </tr>
                        )
                      })}
                      {tiktokViralAll.length === 0 && <tr><td colSpan={4} className="social-table-empty">Chưa có bài TikTok phù hợp.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <ViralSalesIdeasPanel
            csrfToken={csrfToken}
            viralCount={viralPosts.length}
            onUseIdea={(idea) => {
              setStudioPlatform(idea.platform === 'tiktok' ? 'tiktok' : 'facebook')
              setStudioSelectionMode('custom')
              setStudioProductId(idea.productId || '')
              setStudioTopic(`${idea.hook} — ${idea.angle}`)
              setActiveSubTab('studio')
              showNotice(`Đã chuyển ý tưởng "${idea.trendName}" sang Soạn bài AI!`)
            }}
          />
        </div>
      )}

      {/* TAB 4: NHẬT KÝ & BÁO CÁO EXCEL */}
      {activeSubTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>📋 Nhật ký & Báo cáo</h3>
              <button type="button" className="social-action-btn social-action-btn--danger" onClick={handleClearAllPostLogs} disabled={loading || posts.length === 0} style={{ fontSize: '12px', padding: '7px 12px' }}>
                🗑️ Xóa tất cả ({posts.length})
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="social-select" style={{ width: '200px' }} value={postFilterStatus} onChange={e => setPostFilterStatus(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="published">🟢 Đã đăng</option>
                <option value="pending_review">⏳ Đang xét duyệt</option>
                <option value="internal_draft">📝 Bản nháp</option>
                <option value="unverified">⚠️ Chưa xác minh</option>
                <option value="failed">🔴 Lỗi / Từ chối duyệt</option>
              </select>
              <select className="social-select" style={{ width: '150px' }} value={postFilterPlatform} onChange={e => setPostFilterPlatform(e.target.value)}>
                <option value="all">Tất cả kênh</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
              <button type="button" className="social-action-btn social-action-btn--primary" onClick={handleExportExcel}>📊 Xuất Excel (.xlsx)</button>
              <span className="social-muted-text" style={{ marginLeft: 'auto' }}>{filteredPosts.length}/{posts.length} bài</span>
            </div>

            <div className="social-table-shell">
              <table className="social-table">
                <thead><tr><th>Thời gian</th><th>Kênh</th><th>Sản phẩm</th><th>Nội dung</th><th>Trạng thái</th><th>Tương tác</th><th>Link</th><th>Hành động</th></tr></thead>
                <tbody>
                  {filteredPosts.map(p => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{formatTime(p.publishedTime || p.triggerTime)}</strong></td>
                      <td><span className={'channel-tag channel-tag--' + p.platform}>{p.platform}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={p.productImage || '/products/bag.svg'} alt={p.productName} className="social-product-thumb" onError={e => { e.currentTarget.src = '/products/bag.svg' }} />
                          <div><strong>{p.productName}</strong><div style={{ fontSize: '11px', color: '#2e8658', fontWeight: 700 }}>{Number(p.productPrice).toLocaleString('vi-VN')}đ</div></div>
                        </div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.title}</div>
                        <button type="button" className="social-modal-open-btn" onClick={() => setSelectedPostModal(p)}>Xem ↗</button>
                      </td>
                      <td>
                        <span className={'status-tag status-tag--' + p.status} title={p.errorMessage || ''}>
                          {p.status === 'published' ? '🟢 Đã đăng'
                            : p.status === 'pending_review' ? '⏳ Đang xét duyệt'
                              : p.status === 'unverified' ? '⚠️ Chưa xác minh'
                                : p.status === 'internal_draft' ? '📝 Bản nháp'
                                  : p.status === 'failed' && /từ chối/i.test(p.errorMessage || '') ? '🔴 Bị từ chối duyệt' : '🔴 Lỗi'}
                        </span>
                      </td>
                      <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>👍 {p.likesCount} · 🔁 {p.sharesCount} · 💬 {p.commentsCount}</td>
                      <td>
                        {p.postUrl
                          ? <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">Mở bài ↗</a>
                          : <span className="social-muted-text">{p.status === 'pending_review' ? 'Đang xét duyệt...' : '—'}</span>}
                        {p.errorMessage && <small className="social-muted-text" style={{ display: 'block', maxWidth: '185px', whiteSpace: 'normal', color: '#f87171' }}>{p.errorMessage}</small>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button type="button" className="social-action-btn" onClick={() => handleCopyPost(p)}>{copiedPostId === p.id ? '✓' : '📋'}</button>
                          {p.status !== 'pending_review' && (
                            <button type="button" className="social-action-btn social-action-btn--primary" onClick={() => handleRealAutoPostThroughExtension(p)} disabled={postingBusy[p.platform]}>🚀</button>
                          )}
                          <button type="button" className="social-action-btn social-action-btn--danger" onClick={() => handleDeletePost(p.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredPosts.length === 0 && <tr><td colSpan={8} className="social-table-empty">Chưa có nhật ký.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          {/* PANEL DỮ LIỆU LƯỚT THEO THỜI GIAN ĐẦY ĐỦ */}
          <section className="social-panel">
            <div className="social-panel__head-row" style={{ marginBottom: '14px' }}>
              <h3>🧭 Dữ liệu Lướt theo thời gian ({surfHistory.length} bài)</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="social-sort-select" value={surfHistoryFilter} onChange={e => setSurfHistoryFilter(e.target.value)}>
                  <option value="all">Tất cả kênh</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                </select>
                <select className="social-sort-select" value={surfHistorySort} onChange={e => setSurfHistorySort(e.target.value)}>
                  <option value="newest">🕒 Mới lấy nhất</option>
                  <option value="likes_desc">❤️ Tim / Like ↓</option>
                  <option value="name_asc">A → Z</option>
                </select>
                <button
                  type="button"
                  className="social-action-btn social-action-btn--danger"
                  disabled={!surfHistory.length}
                  onClick={async () => {
                    if (!window.confirm(`Xóa toàn bộ ${surfHistory.length} bài đã lướt?`)) return
                    await apiJson('/api/admin/social/surf-history', { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
                    setSurfHistory([])
                  }}
                >
                  🗑️ Xóa ({surfHistory.length})
                </button>
              </div>
            </div>
            <div className="social-table-shell">
              <table className="social-table">
                <thead><tr><th>#</th><th>Kênh</th><th>Bài viết / Video</th><th>Tương tác</th><th>Thời gian lấy</th><th>Link</th></tr></thead>
                <tbody>
                  {sortViralList(
                    surfHistory.filter((p) => surfHistoryFilter === 'all' || String(p.platform || '').toLowerCase() === surfHistoryFilter),
                    surfHistorySort
                  ).map((item, idx) => (
                    <tr key={item.id || item.postUrl || idx}>
                      <td><strong>{idx + 1}</strong></td>
                      <td><span className={'channel-tag channel-tag--' + (item.platform === 'tiktok' ? 'tiktok' : 'facebook')}>{item.platform}</span></td>
                      <td>
                        <div className="viral-card-cell">
                          {item.thumbnailUrl
                            ? <img src={item.thumbnailUrl} alt={item.title} referrerPolicy="no-referrer" className="viral-thumb-lg" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                            : <div className="viral-thumb-lg viral-thumb-lg--tt">{item.platform === 'facebook' ? '📘' : '🎵'}</div>}
                          <div className="viral-card-meta">
                            <div className="viral-card-title">{item.title}</div>
                            {item.authorName && <div className="viral-card-author">👤 {item.authorName}</div>}
                            <div className="viral-card-badges">
                              <span className="channel-tag channel-tag--facebook">{item.category || 'Xu hướng'}</span>
                              {extractHashtagChips(item).map((t) => <span key={t} className="viral-hashtag-chip">{t}</span>)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="viral-metrics-cell">
                        <div>{item.platform === 'facebook' ? '👍' : '❤️'} <strong>{Number(item.likesCount || 0).toLocaleString('vi-VN')}</strong></div>
                        <div>💬 <strong>{Number(item.commentsCount || 0).toLocaleString('vi-VN')}</strong></div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>{formatTime(item.createdAt)}</td>
                      <td><button type="button" className="social-action-btn social-table-link" onClick={() => handleOpenViralSingleTab(item.postUrl, item.platform)}>Mở ↗</button></td>
                    </tr>
                  ))}
                  {surfHistory.length === 0 && <tr><td colSpan={6} className="social-table-empty">Chưa có dữ liệu lướt theo thời gian.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {selectedPostModal && (
        <div className="social-modal-overlay" onClick={() => setSelectedPostModal(null)}>
          <div className="social-modal-card" onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>📄 Chi tiết bài #{selectedPostModal.id}</h3>
              <button type="button" className="social-modal-close" onClick={() => setSelectedPostModal(null)}>✕</button>
            </div>
            <div><strong>{selectedPostModal.title}</strong><div className="social-modal-body-content">{selectedPostModal.content}</div></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="social-btn-trigger" onClick={() => handleCopyPost(selectedPostModal)}>📋 Chép</button>
              {selectedPostModal.postUrl && <a href={selectedPostModal.postUrl} target="_blank" rel="noopener noreferrer" className="social-btn-trigger" style={{ textDecoration: 'none' }}>Mở bài ↗</a>}
              <button type="button" className="social-action-btn" onClick={() => setSelectedPostModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showExtensionHelp && (
        <div className="social-modal-overlay" onClick={() => setShowExtensionHelp(false)}>
          <div className="social-modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>👁️ Cài đặt OmniVision v3.5</h3>
              <button type="button" className="social-modal-close" onClick={() => setShowExtensionHelp(false)}>✕</button>
            </div>
            <ol style={{ paddingLeft: '20px', fontSize: '13px', lineHeight: 1.65 }}>
              <li>Vào <code>chrome://extensions/</code> → bật <strong>Developer mode</strong>.</li>
              <li>Chọn <strong>Load unpacked</strong> vào <code>Store-Admin/extension</code> hoặc bấm <strong>Reload ↻</strong>.</li>
              <li>Đăng nhập Facebook & TikTok trên cùng trình duyệt Chrome và đảm bảo Ollama đang chạy <code>qwen3.5:4b</code>.</li>
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="social-btn-trigger" onClick={() => setShowExtensionHelp(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
