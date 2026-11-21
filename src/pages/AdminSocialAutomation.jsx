/*
  FILE NOTE
  - Mục đích: Giao diện Tự động đăng bài MXH v3.2 — Gọn gàng, tối giản, cào Viral theo chủ đề (FB >= 5K, TikTok >= 200K), bộ sắp xếp & xuất Excel (.xlsx).
*/

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiJson } from '../api/chat'
import { privacyForSocialPlatform } from './socialPrivacy'
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
  const [customViralTopic, setCustomViralTopic] = useState('')
  const [fbViralSort, setFbViralSort] = useState('likes_desc')
  const [ttViralSort, setTtViralSort] = useState('likes_desc')
  const [scrapingViralBusy, setScrapingViralBusy] = useState(false)

  const [extensionConnected, setExtensionConnected] = useState(false)
  const [showExtensionHelp, setShowExtensionHelp] = useState(false)
  const [realPostingBusy, setRealPostingBusy] = useState(false)
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

  const [alertMessage, setAlertMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const noticeTimerRef = useRef(null)
  const copiedTimerRef = useRef(null)
  const extensionPingCancelRef = useRef(null)
  const autoPostAttemptedIdsRef = useRef(new Set())
  const autoPostInFlightRef = useRef(false)
  const autoPostLastAttemptAtRef = useRef(0)
  const extensionPingInFlightRef = useRef(false)

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
    let text = (post.content || '').trim()
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
        action === 'FETCH_REAL_VIRAL' ? 360000
          : action === 'SCRAPE_FB_GROUPS' ? 150000
            : action === 'AUTO_POST' ? 180000
              : action === 'PING' ? 8000 : 14000

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
        if (event.data?.source === 'OMNICART_EXTENSION_PROGRESS' && action === 'FETCH_REAL_VIRAL') { armTimeout(); return }
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

  const loadAll = async () => {
    try {
      setLoading(true)
      const [resStats, resSettings, resPosts, resGroups, resViral] = await Promise.all([
        apiJson('/api/admin/social/stats'),
        apiJson('/api/admin/social/settings'),
        apiJson('/api/admin/social/posts'),
        apiJson('/api/admin/social/groups'),
        apiJson('/api/admin/social/viral')
      ])
      if (resStats?.stats) setStats(resStats.stats)
      if (resSettings?.settings) setSettings(cur => ({ ...cur, ...resSettings.settings, privacy: resSettings.settings.privacy === 'public' ? 'public' : 'only_me' }))
      if (resPosts?.posts) setPosts(resPosts.posts)
      if (resGroups?.groups) setGroups(resGroups.groups)
      if (resViral?.posts) setViralPosts(resViral.posts)
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

    pingExtension()
    const pingTimer = setInterval(pingExtension, 6000)
    const onReady = () => pingExtension()
    window.addEventListener('omnicart-extension-ready', onReady)
    window.addEventListener('message', onPostVerified)
    return () => {
      disposed = true
      clearInterval(pingTimer)
      if (extensionPingCancelRef.current) extensionPingCancelRef.current()
      window.removeEventListener('omnicart-extension-ready', onReady)
      window.removeEventListener('message', onPostVerified)
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
      const res = await apiJson('/api/admin/social/settings', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ...settings, privacy: settings.privacy === 'public' ? 'public' : 'only_me' })
      })
      if (res?.settings) {
        setSettings(cur => ({ ...cur, ...res.settings, privacy: res.settings.privacy === 'public' ? 'public' : 'only_me' }))
        showNotice('Đã lưu cấu hình.')
        const resStats = await apiJson('/api/admin/social/stats')
        if (resStats?.stats) setStats(resStats.stats)
      }
    } catch (err) { showNotice(err.message || 'Lỗi lưu cấu hình.', 'error') }
    finally { setLoading(false) }
  }

  const handleTriggerCycle = async () => {
    if (batchPosting || realPostingBusy) return
    try {
      setBatchPosting(true); setLoading(true)
      const extensionStatus = await sendExtensionMessage('CHECK_STATUS', {})
      if (extensionStatus?.ok !== true || extensionStatus.data?.tabs?.admin !== true) {
        setShowExtensionHelp(true)
        throw new Error('Chưa kết nối Chrome Extension.')
      }
      const platforms = ['facebook', 'tiktok']
      const results = []
      for (const [index, platform] of platforms.entries()) {
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 1800 + Math.floor(Math.random() * 1200)))
        try {
          const res = await apiJson('/api/admin/social/trigger-cycle?platform=' + encodeURIComponent(platform), {
            method: 'POST', headers: { 'x-csrf-token': csrfToken }
          })
          if (!res?.ok || !res.post) { results.push({ platform, ok: false, error: 'Chưa tạo được bài AI.' }); continue }
          const result = await handleRealAutoPostThroughExtension(res.post)
          results.push({ platform, ...result })
        } catch (err) { results.push({ platform, ok: false, error: err.message }) }
      }
      const okCount = results.filter(r => r.ok).length
      showNotice(`Hoàn tất ${okCount}/${platforms.length} kênh.`, okCount === platforms.length ? 'success' : 'error')
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
        body: JSON.stringify({ platform: studioPlatform, toneStyle: studioTone, customTopic: studioTopic })
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
    const targetPrivacy = privacyForSocialPlatform(studioPlatform, settings.privacy)
    if (!targetPrivacy) return showNotice('Kênh không được hỗ trợ.', 'error')
    const draft = { ...studioDraft, platform: studioPlatform, privacy: targetPrivacy }
    if (immediate) return handleRealAutoPostThroughExtension(draft)

    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/posts/create', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          productId: studioDraft.productId || '1', productName: studioDraft.productName,
          productPrice: studioDraft.productPrice, productImage: studioDraft.productImage,
          platform: studioPlatform, title: studioDraft.title, content: studioDraft.content,
          hashtags: studioDraft.hashtags, targetGroup: studioTargetGroup || undefined,
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
    if (targetPost?.id) autoPostAttemptedIdsRef.current.add(String(targetPost.id))
    let postId = targetPost?.id || null
    let platform = String(targetPost?.platform || 'unknown').toLowerCase()
    let failureCode = null
    let livePostUrl = null
    let livePostId = null

    try {
      setRealPostingBusy(true)
      const post = { ...studioDraft, ...(targetPost || {}) }
      platform = (post.platform || studioPlatform || 'facebook').toLowerCase()
      if (!['facebook', 'tiktok'].includes(platform)) throw new Error('Kênh không được hỗ trợ.')

      const productImage = post.productImage || studioDraft.productImage
      if (!productImage) throw new Error('Thiếu ảnh sản phẩm.')
      const imageUrl = new URL(productImage, window.location.origin).href
      const fullText = formatPostText(post)
      if (!fullText) throw new Error('Thiếu nội dung bài viết.')
      const targetPrivacy = privacyForSocialPlatform(platform, settings.privacy || 'only_me')
      if (!targetPrivacy) throw new Error('Quyền riêng tư không hợp lệ.')

      postId = post.id || postId
      if (!postId) {
        const created = await apiJson('/api/admin/social/posts/create', {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            productId: post.productId || '1', productName: post.productName || 'Sản phẩm OmniCart',
            productPrice: post.productPrice || 0, productImage, platform,
            title: post.title || '', content: post.content || '', hashtags: post.hashtags || '',
            privacy: targetPrivacy, publishImmediately: false
          })
        })
        if (!created?.ok || !created.post?.id) throw new Error('Chưa lưu được bản nháp.')
        postId = created.post.id
        autoPostAttemptedIdsRef.current.add(String(postId))
      }

      const reply = await sendExtensionMessage('AUTO_POST', {
        platform,
        post: { postId, title: post.title || '', content: fullText, hashtags: post.hashtags || '', privacy: targetPrivacy, imageUrl }
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
          body: JSON.stringify({
            platform, privacy: result.privacy || targetPrivacy,
            message: 'Đang chờ TikTok xét duyệt (~2–3 phút).'
          })
        })
        showNotice('⏳ Đã gửi bài lên TikTok — đang chờ xét duyệt.', 'info')
        await loadAll()
        setActiveSubTab('logs')
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
      setActiveSubTab('logs')
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
    } finally { setRealPostingBusy(false) }
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
    FACEBOOK_ONLY_ME_NOT_CONFIRMED: 'Không đổi được sang Chỉ mình tôi trên Facebook.'
  }[code] || `Chưa xác nhận đăng thành công (${code}).`)

  useEffect(() => {
    if (!settings.isActive || settings.mode !== 'full_auto' || !extensionConnected) return undefined
    let disposed = false
    const pollNextReadyPost = async () => {
      if (disposed || autoPostInFlightRef.current || batchPosting || realPostingBusy) return
      autoPostInFlightRef.current = true
      try {
        const response = await apiJson('/api/admin/social/posts')
        const availablePosts = Array.isArray(response?.posts) ? response.posts : []
        setPosts(availablePosts)
        const nextPost = availablePosts
          .filter(post => (post.status === 'ready_for_publish' || post.status === 'ready_for_api') &&
            ['facebook', 'tiktok'].includes(String(post.platform || '').toLowerCase()) &&
            post.id && !autoPostAttemptedIdsRef.current.has(String(post.id)))
          .sort((a, b) => Date.parse(b.createdAt || b.triggerTime || 0) - Date.parse(a.createdAt || a.triggerTime || 0))[0]
        if (!nextPost || disposed) return
        const remainingGapMs = (1800 + Math.floor(Math.random() * 1200)) - (Date.now() - autoPostLastAttemptAtRef.current)
        if (remainingGapMs > 0) await new Promise(resolve => setTimeout(resolve, remainingGapMs))
        if (disposed) return
        autoPostAttemptedIdsRef.current.add(String(nextPost.id))
        autoPostLastAttemptAtRef.current = Date.now()
        await handleRealAutoPostThroughExtension(nextPost)
      } catch (_) {}
      finally { autoPostInFlightRef.current = false }
    }
    pollNextReadyPost()
    const timer = setInterval(pollNextReadyPost, 10000)
    return () => { disposed = true; clearInterval(timer) }
  }, [settings.isActive, settings.mode, extensionConnected, batchPosting, realPostingBusy])

  // Cào 20 bài Viral theo Chủ đề đã chọn (FB >= 5K • TikTok >= 200K)
  const handleScrapeRealViralThroughExtension = async () => {
    if (scrapingViralBusy) return
    if (viralTopic === 'custom' && !customViralTopic.trim()) {
      return showNotice('Vui lòng nhập từ khóa chủ đề muốn cào.', 'error')
    }
    try {
      setScrapingViralBusy(true)
      const topicLabel = VIRAL_TOPICS.find(([k]) => k === viralTopic)?.[1] || 'Tất cả'
      showNotice(`Đang cào 20 bài Viral (${viralTopic === 'custom' ? customViralTopic.trim() : topicLabel})...`, 'info')
      const res = await sendExtensionMessage('FETCH_REAL_VIRAL', {
        platform: 'both',
        fbCount: 10,
        tiktokCount: 10,
        fbMinLikes: 5000,
        tiktokMinLikes: 200000,
        topic: viralTopic,
        customTopic: customViralTopic.trim(),
        excludeUrls: viralPosts.map(v => v.postUrl).filter(Boolean)
      })
      if (res?.error === 'EXTENSION_NOT_DETECTED') { setShowExtensionHelp(true); throw new Error('Chưa kết nối Chrome Extension.') }

      const scrapedPosts = res?.data?.posts || []
      const fbCount = (res?.data?.facebookPosts || []).length
      const ttCount = (res?.data?.tiktokPosts || []).length

      if (scrapedPosts.length > 0) {
        const saved = await apiJson('/api/admin/social/viral/import-real', {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ posts: scrapedPosts })
        })
        if (saved?.posts) setViralPosts(saved.posts)
        else {
          const resViral = await apiJson('/api/admin/social/viral')
          if (resViral?.posts) setViralPosts(resViral.posts)
        }
        showNotice(`Đã cào thêm: Facebook +${fbCount} • TikTok +${ttCount} bài.`)
        setActiveSubTab('groups')
      } else {
        showNotice('Không tìm thấy thêm bài viral nào đạt ngưỡng.', 'error')
      }
    } catch (err) { showNotice(err.message || 'Lỗi cào bài viral.', 'error') }
    finally { setScrapingViralBusy(false) }
  }

  const handleAutoScrape5FacebookGroups = async () => {
    if (scrapingGroupsBusy) return
    try {
      setScrapingGroupsBusy(true)
      const res = await sendExtensionMessage('SCRAPE_FB_GROUPS', {
        count: 5,
        keyword: groupKeyword.trim(),
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
    if (mode === 'name_asc') return String(a.title || '').localeCompare(String(b.title || ''), 'vi')
    if (mode === 'name_desc') return String(b.title || '').localeCompare(String(a.title || ''), 'vi')
    if (mode === 'likes_asc') return Number(a.likesCount || 0) - Number(b.likesCount || 0)
    return Number(b.likesCount || 0) - Number(a.likesCount || 0)
  })

  const facebookViralTop10 = useMemo(() => sortViralList(viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'facebook'), fbViralSort).slice(0, 10), [viralPosts, fbViralSort])
  const tiktokViralTop10 = useMemo(() => sortViralList(viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'tiktok'), ttViralSort).slice(0, 10), [viralPosts, ttViralSort])

  const formatTime = (isoString) => {
    if (!isoString) return '—'
    try { return new Date(isoString).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) }
    catch { return isoString }
  }

  return (
    <div className="admin-social-workspace admin-social-posting admin-social-automation" data-module="social-automation">
      {alertMessage && (
        <div className={`social-alert social-alert--${alertMessage.type || 'success'}`}>
          <span>{alertMessage.type === 'error' ? '⚠️' : alertMessage.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* KPI Banner — Gọn gàng */}
      <section className="social-kpi-banner">
        <div className="social-kpi-banner__head">
          <div className="social-kpi-title">
            <span style={{ fontSize: '22px' }}>📢</span>
            <h2>Tự Động Đăng Bài MXH</h2>
            <span className={'social-status-pill ' + (settings.isActive ? 'is-active' : 'is-paused')}>
              {settings.isActive
                ? `● Đang chạy (${currentIntervalKey === '2m' ? '2 phút' : currentIntervalKey === '1' ? '1 giờ' : '4 giờ'})`
                : '○ Tạm dừng'}
            </span>
          </div>
          <div className="social-kpi-actions">
            <button type="button" className="social-btn-trigger" onClick={handleTriggerCycle} disabled={loading || realPostingBusy || batchPosting}>⚡ Đăng FB + TikTok</button>
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

      {/* Extension Bar — Tối giản, bỏ chữ thừa */}
      <section className="social-extension-bar" style={{
        margin: '4px 0', padding: '10px 14px',
        background: 'linear-gradient(135deg, rgba(16, 42, 30, 0.95), rgba(24, 76, 52, 0.95))',
        border: '1px solid #28543a', borderRadius: '10px', color: '#edf7ef',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>👁️</span>
          <strong style={{ fontSize: '13px' }}>OmniVision v3.2</strong>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: extensionConnected ? '#10b981' : '#f59e0b', color: '#fff' }}>
            {extensionConnected ? '🟢 Đã kết nối' : '🟡 Chờ Extension'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="social-btn-trigger" style={{ fontSize: '12px', padding: '6px 12px' }} disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content} onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'facebook' })}>🚀 Đăng FB</button>
          <button type="button" className="social-btn-trigger" style={{ fontSize: '12px', padding: '6px 12px', background: '#000', borderColor: '#fe2c55', color: '#fe2c55' }} disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content} onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'tiktok' })}>🚀 Đăng TikTok</button>
          <button type="button" className="social-btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', background: '#0f172a', borderColor: '#334155', color: '#38bdf8' }} disabled={scrapingViralBusy} onClick={handleScrapeRealViralThroughExtension}>
            {scrapingViralBusy ? '⏳ Đang cào...' : '🔥 Cào Viral'}
          </button>
          <button type="button" className="social-btn-secondary" style={{ fontSize: '12px', padding: '6px 10px' }} onClick={() => setShowExtensionHelp(true)}>📖 Hướng dẫn</button>
        </div>
      </section>

      {/* Subnav — Ngắn gọn */}
      <nav className="social-subnav" aria-label="Phân hệ tiếp thị MXH">
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'settings' ? 'is-active' : '')} onClick={() => setActiveSubTab('settings')}>⚙️ Cấu hình</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'studio' ? 'is-active' : '')} onClick={() => setActiveSubTab('studio')}>✍️ Soạn bài AI</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'groups' ? 'is-active' : '')} onClick={() => setActiveSubTab('groups')}>👥 Nhóm & Viral ({viralPosts.length})</button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'logs' ? 'is-active' : '')} onClick={() => setActiveSubTab('logs')}>📋 Nhật ký ({posts.length})</button>
      </nav>

      {/* TAB 1: CẤU HÌNH */}
      {activeSubTab === 'settings' && (
        <section className="social-panel">
          <div className="social-panel__heading"><h3>⚙️ Cấu hình tự động</h3></div>
          <form onSubmit={handleSaveSettings}>
            <div className="social-form-grid">
              <div className="social-field"><label htmlFor="cfg-status">Trạng thái</label><select id="cfg-status" className="social-select" value={settings.isActive ? '1' : '0'} onChange={e => setSettings({ ...settings, isActive: e.target.value === '1' })}><option value="1">🟢 Bật</option><option value="0">🔴 Tắt</option></select></div>
              <div className="social-field"><label htmlFor="cfg-mode">Chế độ</label><select id="cfg-mode" className="social-select" value={settings.mode} onChange={e => setSettings({ ...settings, mode: e.target.value })}><option value="full_auto">🚀 Tự động (Full-Auto)</option><option value="semi_auto">📝 Duyệt trước (Semi-Auto)</option></select></div>
              <div className="social-field"><label htmlFor="cfg-interval">Chu kỳ đăng</label><select id="cfg-interval" className="social-select" value={currentIntervalKey} onChange={e => handleIntervalChange(e.target.value)}><option value="2m">⚡ Mỗi 2 phút</option><option value="1">🕐 Mỗi 1 giờ</option><option value="4">🕓 Mỗi 4 giờ</option></select></div>
              <div className="social-field"><label htmlFor="cfg-privacy">Quyền riêng tư</label><select id="cfg-privacy" className="social-select" value={settings.privacy || 'only_me'} onChange={e => setSettings({ ...settings, privacy: e.target.value })}><option value="only_me">🔒 Chỉ mình tôi</option><option value="public">🌐 Công khai</option></select></div>
              <div className="social-field"><label htmlFor="cfg-channels">Kênh đăng</label><select id="cfg-channels" className="social-select" value={settings.channels} onChange={e => setSettings({ ...settings, channels: e.target.value })}><option value="facebook,tiktok">Facebook + TikTok</option><option value="facebook">Chỉ Facebook</option><option value="tiktok">Chỉ TikTok</option></select></div>
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
      )}

      {/* TAB 2: SOẠN BÀI AI */}
      {activeSubTab === 'studio' && (
        <section className="social-panel">
          <div className="social-panel__heading"><h3>✍️ Soạn bài AI</h3></div>
          <div className="social-studio-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className={'social-action-btn ' + (studioPlatform === 'facebook' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px' }} onClick={() => setStudioPlatform('facebook')}>🔵 Facebook</button>
                <button type="button" className={'social-action-btn ' + (studioPlatform === 'tiktok' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px' }} onClick={() => setStudioPlatform('tiktok')}>🎵 TikTok</button>
              </div>
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
                  <label htmlFor="studio-target-group">Nhóm mục tiêu</label>
                  <select id="studio-target-group" className="social-select" value={studioTargetGroup} onChange={e => setStudioTargetGroup(e.target.value)}>
                    <option value="">Tự động</option>
                    {groups.map(grp => <option key={grp.id} value={grp.groupName}>{grp.groupName} ({grp.membersCount.toLocaleString('vi-VN')} tv)</option>)}
                  </select>
                </div>
              )}
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
                <button type="button" className="social-btn-trigger" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(true)} disabled={loading || realPostingBusy || batchPosting}>🚀 Đăng ngay</button>
                <button type="button" className="social-action-btn" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(false)} disabled={loading || realPostingBusy || batchPosting}>⏳ Lưu nháp</button>
              </div>
            </div>
            <div className="social-preview-container">
              <span className="social-subhead" style={{ fontWeight: 800 }}>Xem trước ({studioPlatform === 'facebook' ? 'Facebook' : 'TikTok'})</span>
              <div className={'social-preview-card ' + (studioPlatform === 'facebook' ? 'social-preview-card--facebook' : 'social-preview-card--tiktok')}>
                <div className="preview-header">
                  <div className="preview-avatar">O</div>
                  <div className="preview-author">
                    <strong>Tài khoản đang đăng nhập <span className="preview-badge-verified">✓</span></strong>
                    <small>Vừa xong · {settings.privacy === 'public' ? 'Công khai 🌐' : 'Chỉ mình tôi 🔒'}</small>
                  </div>
                </div>
                <div className="preview-content">{studioDraft.content}</div>
                <div className="preview-media"><img src={studioDraft.productImage || '/products/headphones.svg'} alt={studioDraft.productName} onError={e => { e.currentTarget.src = '/products/bag.svg' }} /></div>
                <div className="preview-footer"><span>👍 Thích</span><span>💬 Bình luận</span><span>🔁 Chia sẻ</span></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: HỘI NHÓM & BÀI VIRAL THEO CHỦ ĐỀ */}
      {activeSubTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Hội nhóm Facebook */}
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
                      <td>
                        <strong>{grp.groupName}</strong>
                        <div style={{ fontSize: '11px' }}><a href={grp.groupUrl} target="_blank" rel="noopener noreferrer" className="social-table-link">{grp.groupUrl} ↗</a></div>
                      </td>
                      <td>{grp.category}</td>
                      <td><strong>{Number(grp.membersCount || 0).toLocaleString('vi-VN')}</strong></td>
                      <td><span className="status-tag status-tag--published">{grp.interactionRate}</span></td>
                      <td>
                        <button type="button" className={'social-action-btn ' + (grp.isAutoShare ? 'social-action-btn--primary' : '')} onClick={() => handleToggleGroup(grp.id, grp.isAutoShare)}>
                          {grp.isAutoShare ? '✓ Bật' : '○ Tắt'}
                        </button>
                      </td>
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

          {/* Bài đăng Viral theo Chủ đề — Chia đôi FB (>= 5K) & TikTok (>= 200K) */}
          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>🔥 Bài đăng Viral</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  id="viral-topic-select"
                  aria-label="Chủ đề cào bài viral"
                  className="social-sort-select"
                  value={viralTopic}
                  onChange={e => setViralTopic(e.target.value)}
                >
                  {VIRAL_TOPICS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
                {viralTopic === 'custom' && (
                  <input
                    type="text"
                    className="social-input"
                    style={{ width: '190px', padding: '6px 10px' }}
                    placeholder="Nhập chủ đề muốn cào..."
                    value={customViralTopic}
                    onChange={e => setCustomViralTopic(e.target.value)}
                  />
                )}
                <button type="button" className="social-btn-trigger" onClick={handleScrapeRealViralThroughExtension} disabled={scrapingViralBusy || loading} style={{ fontSize: '12px', padding: '8px 14px' }}>
                  {scrapingViralBusy ? '⏳ Đang cào 2 Tab...' : '⚡ Cào 20 Bài Viral'}
                </button>
                <button type="button" className="social-action-btn social-action-btn--danger" onClick={handleClearAllViralPosts} disabled={loading || viralPosts.length === 0} style={{ fontSize: '12px', padding: '8px 12px' }}>
                  🗑️ Xóa tất cả ({viralPosts.length})
                </button>
              </div>
            </div>

            <div className="social-viral-split-grid">
              {/* CỘT TRÁI: FACEBOOK (≥ 5K) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--fb">
                  <span>📘 Facebook (≥ 5K)</span>
                  <div className="social-viral-head-tools">
                    <select aria-label="Sắp xếp bài viral Facebook" className="social-sort-select social-sort-select--mini" value={fbViralSort} onChange={e => setFbViralSort(e.target.value)}>
                      <option value="likes_desc">Cảm xúc (Cao → Thấp)</option>
                      <option value="likes_asc">Cảm xúc (Thấp → Cao)</option>
                      <option value="name_asc">Tên (A → Z)</option>
                      <option value="name_desc">Tên (Z → A)</option>
                    </select>
                    <span className="social-viral-count">{facebookViralTop10.length}/10</span>
                  </div>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead><tr><th>#</th><th>Bài đăng</th><th>Cảm xúc</th><th>Link</th></tr></thead>
                    <tbody>
                      {facebookViralTop10.map((v, idx) => (
                        <tr key={v.id}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>
                            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{v.title}</div>
                            <span className="channel-tag channel-tag--facebook">{v.category || 'Facebook'}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>👍 <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}><a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">Mở ↗</a></td>
                        </tr>
                      ))}
                      {facebookViralTop10.length === 0 && <tr><td colSpan={4} className="social-table-empty">Chưa có bài Facebook ≥ 5K.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT PHẢI: TIKTOK (≥ 200K) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--tt">
                  <span>🎵 TikTok (≥ 200K)</span>
                  <div className="social-viral-head-tools">
                    <select aria-label="Sắp xếp bài viral TikTok" className="social-sort-select social-sort-select--mini" value={ttViralSort} onChange={e => setTtViralSort(e.target.value)}>
                      <option value="likes_desc">Tim (Cao → Thấp)</option>
                      <option value="likes_asc">Tim (Thấp → Cao)</option>
                      <option value="name_asc">Tên (A → Z)</option>
                      <option value="name_desc">Tên (Z → A)</option>
                    </select>
                    <span className="social-viral-count">{tiktokViralTop10.length}/10</span>
                  </div>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead><tr><th>#</th><th>Video / Ảnh</th><th>Lượt Tim</th><th>Link</th></tr></thead>
                    <tbody>
                      {tiktokViralTop10.map((v, idx) => (
                        <tr key={v.id}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>
                            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{v.title}</div>
                            <span className="channel-tag channel-tag--tiktok">{v.category || 'TikTok'}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>❤️ <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></td>
                          <td style={{ whiteSpace: 'nowrap' }}><a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">Mở ↗</a></td>
                        </tr>
                      ))}
                      {tiktokViralTop10.length === 0 && <tr><td colSpan={4} className="social-table-empty">Chưa có bài TikTok ≥ 200K tim.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: NHẬT KÝ & BÁO CÁO EXCEL */}
      {activeSubTab === 'logs' && (
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
                        <div>
                          <strong>{p.productName}</strong>
                          <div style={{ fontSize: '11px', color: '#2e8658', fontWeight: 700 }}>{Number(p.productPrice).toLocaleString('vi-VN')}đ</div>
                        </div>
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
                                : p.status === 'failed' && /từ chối/i.test(p.errorMessage || '') ? '🔴 Bị từ chối duyệt'
                                  : '🔴 Lỗi'}
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
                          <button type="button" className="social-action-btn social-action-btn--primary" onClick={() => handleRealAutoPostThroughExtension(p)} disabled={realPostingBusy || batchPosting}>🚀</button>
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
      )}

      {/* Modal chi tiết */}
      {selectedPostModal && (
        <div className="social-modal-overlay" onClick={() => setSelectedPostModal(null)}>
          <div className="social-modal-card" onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>📄 Chi tiết bài #{selectedPostModal.id}</h3>
              <button type="button" className="social-modal-close" onClick={() => setSelectedPostModal(null)}>✕</button>
            </div>
            <div>
              <strong>{selectedPostModal.title}</strong>
              <div className="social-modal-body-content">{selectedPostModal.content}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="social-btn-trigger" onClick={() => handleCopyPost(selectedPostModal)}>📋 Chép</button>
              {selectedPostModal.postUrl && <a href={selectedPostModal.postUrl} target="_blank" rel="noopener noreferrer" className="social-btn-trigger" style={{ textDecoration: 'none' }}>Mở bài ↗</a>}
              <button type="button" className="social-action-btn" onClick={() => setSelectedPostModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hướng dẫn */}
      {showExtensionHelp && (
        <div className="social-modal-overlay" onClick={() => setShowExtensionHelp(false)}>
          <div className="social-modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>👁️ Cài đặt OmniVision v3.2</h3>
              <button type="button" className="social-modal-close" onClick={() => setShowExtensionHelp(false)}>✕</button>
            </div>
            <ol style={{ paddingLeft: '20px', fontSize: '13px', lineHeight: 1.65 }}>
              <li>Vào <code>chrome://extensions/</code> → bật <strong>Developer mode</strong>.</li>
              <li>Chọn <strong>Load unpacked</strong> vào <code>Store-Admin/extension</code> hoặc bấm <strong>Reload ↻</strong> lên <strong>3.2.0</strong>.</li>
              <li>Đăng nhập Facebook & TikTok trên cùng trình duyệt Chrome.</li>
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
