/*
  FILE NOTE
  - Mục đích: Giao diện Quản trị Tự động hóa đăng bài MXH đa tài khoản (v3.0 — không hardcode tên/ID nick).
  - Nâng cấp mới:
    1. Gửi đủ title + content + hashtags riêng biệt sang Extension (sửa lỗi TikTok thiếu mô tả & hashtag).
    2. Lắng nghe sự kiện OMNICART_POST_VERIFIED từ Extension để tự động cập nhật bài TikTok "⏳ Chờ duyệt (3-5p)" -> "🟢 Đã đăng" kèm link thật.
    3. Nút "🔍 Lấy 5 Hội Nhóm FB Tự Động" qua Extension.
    4. Kho Bài Viral chia đôi 2 cột (Trái: 10 bài Facebook >= 5K tương tác | Phải: 10 bài TikTok >= 50K tim) cào bằng 2 tab chuyên biệt.
    5. Nút "🗑️ Xóa toàn bộ bài viral" (Tab 3) & Nút "🗑️ Xóa toàn bộ nhật ký" (Tab 4).
*/

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiJson } from '../api/chat'
import { privacyForSocialPlatform } from './socialPrivacy'
import './AdminSocialAutomation.css'

export const copyPostToClipboard = async (text) => {
  if (!text) return false
  let copied = false
  if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch (_) {}
  }
  if (!copied && typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '-9999px'
      textarea.setAttribute('readonly', '')
      document.body.appendChild(textarea)
      textarea.select()
      copied = document.execCommand('copy')
      document.body.removeChild(textarea)
    } catch (_) {}
  }
  return copied
}

export default function AdminSocialAutomation({ csrfToken }) {
  const [activeSubTab, setActiveSubTab] = useState('settings')
  const [stats, setStats] = useState({
    totalPostsToday: 0,
    publishedCount: 0,
    pendingCount: 0,
    failedCount: 0,
    totalLikes: 0,
    totalShares: 0,
    totalComments: 0,
    lastRunAt: null,
    nextRunAt: null,
    isActive: true,
    intervalHours: 2,
    intervalMinutes: 120,
    privacy: 'only_me',
    mode: 'full_auto'
  })

  const [settings, setSettings] = useState({
    id: 1,
    isActive: true,
    mode: 'full_auto',
    intervalHours: 2,
    intervalMinutes: 120,
    intervalSeconds: 7200,
    privacy: 'only_me',
    channels: 'facebook,tiktok',
    preferredCategory: 'all',
    toneStyle: 'viral_engaging',
    includeHashtags: true,
    includeEmojis: true,
    includeCta: true,
    includeHotline: true,
    contactHotline: '0901.234.567',
    orderLinkTemplate: 'https://omnicart.vn/products/{id}'
  })

  const [posts, setPosts] = useState([])
  const [postFilterStatus, setPostFilterStatus] = useState('all')
  const [postFilterPlatform, setPostFilterPlatform] = useState('all')
  const [selectedPostModal, setSelectedPostModal] = useState(null)
  const [copiedPostId, setCopiedPostId] = useState(null)

  const [groups, setGroups] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [groupKeyword, setGroupKeyword] = useState('')
  const [scrapingGroupsBusy, setScrapingGroupsBusy] = useState(false)
  const [newGroup, setNewGroup] = useState({
    groupName: '',
    groupUrl: '',
    category: 'Đồ gia dụng & Gia đình',
    membersCount: 0,
    interactionRate: 'Cao',
    isAutoShare: true,
    notes: ''
  })

  const [viralPosts, setViralPosts] = useState([])
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
    productId: '',
    title: '',
    content: '',
    hashtags: '',
    productName: '',
    productPrice: 0,
    productImage: '',
    generatedBy: ''
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
    noticeTimerRef.current = setTimeout(() => setAlertMessage(null), 6000)
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  const formatPostText = (post) => {
    if (!post) return ''
    let text = (post.content || '').trim()
    if (!text) return ''
    if (post.title && !text.includes(post.title)) {
      text = post.title + '\n\n' + text
    }
    const orderLink = `https://omnicart.vn/products/${post.productId || '1'}`
    if (post.productId && !text.includes('omnicart.vn/products/')) {
      text = text + `\n\n🛒 Đặt hàng online chính hãng: ${orderLink}`
    }
    if (post.hashtags && !text.includes(post.hashtags)) {
      text = text + '\n\n' + post.hashtags
    }
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
      const cleanup = () => {
        if (settled) return
        settled = true
        if (typeof window !== 'undefined') window.removeEventListener('message', handler)
        if (timer) clearTimeout(timer)
        if (action === 'PING' && extensionPingCancelRef.current === cancelPing) {
          extensionPingCancelRef.current = null
        }
      }
      const handler = (event) => {
        if (event.source !== window || event.origin !== window.location.origin) return
        if (event.data && event.data.source === 'OMNICART_EXTENSION_RESPONSE' && event.data.requestId === requestId) {
          cleanup()
          if (action === 'PING') {
            setExtensionConnected(event.data.ok === true && event.data.data?.ok === true)
          } else if (event.data.ok === true) {
            setExtensionConnected(true)
          }
          resolve(event.data)
        }
      }
      const cancelPing = () => {
        cleanup()
        resolve({ ok: false, error: 'PING_CANCELLED' })
      }
      window.addEventListener('message', handler)
      if (action === 'PING') extensionPingCancelRef.current = cancelPing

      const timeoutMs =
        action === 'FETCH_REAL_VIRAL' ? 240000
          : action === 'SCRAPE_FB_GROUPS' ? 120000
            : action === 'AUTO_POST' ? 140000
              : action === 'PING' ? 8000 : 12000

      timer = setTimeout(() => {
        cleanup()
        if (action === 'PING') setExtensionConnected(false)
        resolve({ ok: false, error: 'EXTENSION_NOT_DETECTED' })
      }, timeoutMs)

      try {
        window.postMessage({ source: 'OMNICART_ADMIN_REQUEST', action, payload, requestId }, '*')
      } catch (e) {
        cleanup()
        resolve({ ok: false, error: e.message })
      }
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
      if (resSettings?.settings) {
        setSettings(current => ({
          ...current,
          ...resSettings.settings,
          privacy: resSettings.settings.privacy === 'public' ? 'public' : 'only_me'
        }))
      }
      if (resPosts?.posts) setPosts(resPosts.posts)
      if (resGroups?.groups) setGroups(resGroups.groups)
      if (resViral?.posts) setViralPosts(resViral.posts)
    } catch {
      showNotice('Không thể kết nối đến máy chủ API Mạng Xã Hội.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ping duy trì kết nối Extension 24/7 + lắng nghe sự kiện TikTok duyệt xong sau 3-5 phút!
  useEffect(() => {
    if (typeof window === 'undefined') return
    let disposed = false

    const pingExtension = async () => {
      if (disposed || extensionPingInFlightRef.current) return
      extensionPingInFlightRef.current = true
      try {
        const response = await sendExtensionMessage('PING')
        if (!disposed) {
          setExtensionConnected(response?.ok === true && response?.data?.ok === true)
        }
      } finally {
        extensionPingInFlightRef.current = false
      }
    }

    const onPostVerified = async (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return
      if (!event.data || event.data.source !== 'OMNICART_POST_VERIFIED') return
      const payload = event.data.payload
      if (!payload?.postId) return

      try {
        if (payload.status === 'published' && payload.postUrl) {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(payload.postId)}/publish-real`, {
            method: 'POST',
            headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              postUrl: payload.postUrl,
              publishedTime: payload.publishedTime,
              platform: payload.platform || 'tiktok',
              realPostId: payload.realPostId || `tiktok-${Date.now()}`,
              privacy: payload.privacy || 'only_me'
            })
          })
          showNotice(`🎉 TikTok đã duyệt xong bài #${payload.postId}! Link thật: ${payload.postUrl}`)
        } else {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(payload.postId)}/publish-failure`, {
            method: 'POST',
            headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              status: payload.status === 'failed' ? 'failed' : 'unverified',
              errorMessage: payload.error || 'Chưa xác minh được sau thời gian chờ duyệt.'
            })
          })
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
    if (settings.intervalSeconds <= 120 || settings.intervalMinutes <= 2) return '2m'
    if (settings.intervalMinutes <= 90) return '1'
    return '4'
  }, [settings.intervalMinutes, settings.intervalHours, settings.intervalSeconds])

  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/settings', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ ...settings, privacy: settings.privacy === 'public' ? 'public' : 'only_me' })
      })
      if (res?.settings) {
        setSettings(current => ({
          ...current,
          ...res.settings,
          privacy: res.settings.privacy === 'public' ? 'public' : 'only_me'
        }))
        showNotice('Đã lưu cấu hình tự động hóa thành công!')
        const resStats = await apiJson('/api/admin/social/stats')
        if (resStats?.stats) setStats(resStats.stats)
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi lưu cấu hình.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerCycle = async () => {
    if (batchPosting || realPostingBusy) return
    try {
      setBatchPosting(true)
      setLoading(true)
      const extensionStatus = await sendExtensionMessage('CHECK_STATUS', {})
      if (extensionStatus?.ok !== true || extensionStatus.data?.tabs?.admin !== true) {
        setShowExtensionHelp(true)
        throw new Error('Chưa kết nối được Chrome Extension; chưa tạo hoặc đăng bài.')
      }

      const platforms = ['facebook', 'tiktok']
      const results = []
      for (const [index, platform] of platforms.entries()) {
        if (index > 0) await new Promise(resolve => setTimeout(resolve, 1800 + Math.floor(Math.random() * 1200)))
        try {
          showNotice(`AI Local đang chuẩn bị bài có ảnh sản phẩm cho ${platform}...`, 'info')
          const res = await apiJson('/api/admin/social/trigger-cycle?platform=' + encodeURIComponent(platform), {
            method: 'POST',
            headers: { 'x-csrf-token': csrfToken }
          })
          if (!res?.ok || !res.post) {
            results.push({ platform, ok: false, error: 'Máy chủ chưa tạo được bài AI.' })
            continue
          }
          const result = await handleRealAutoPostThroughExtension(res.post)
          results.push({ platform, ...result })
        } catch (err) {
          results.push({ platform, ok: false, error: err.message || 'Không thể tạo bài AI.' })
        }
      }

      const okCount = results.filter(r => r.ok).length
      const summary = results.map(r => r.ok
        ? (r.pendingReview ? `${r.platform}: đang chờ duyệt (3-5p)` : `${r.platform}: ${r.postUrl}`)
        : `${r.platform}: lỗi (${r.error})`
      ).join(' | ')
      showNotice(`Hoàn tất ${okCount}/${platforms.length} kênh. ${summary}`, okCount === platforms.length ? 'success' : 'error')
      await loadAll()
      setActiveSubTab('logs')
    } catch (err) {
      showNotice(err.message || 'Lỗi kích hoạt chu kỳ.', 'error')
    } finally {
      setLoading(false)
      setBatchPosting(false)
    }
  }

  const handleGenerateStudio = async () => {
    try {
      setStudioGenerating(true)
      const res = await apiJson('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ platform: studioPlatform, toneStyle: studioTone, customTopic: studioTopic })
      })
      if (res?.generated && res?.product) {
        setStudioDraft({
          productId: res.product.id || '1',
          title: res.generated.title,
          content: res.generated.content,
          hashtags: res.generated.hashtags,
          productName: res.product.name,
          productPrice: res.product.price,
          productImage: res.product.image,
          generatedBy: res.generated.generatedBy
        })
        showNotice(`AI ${res.generated.generatedBy} đã tạo xong nội dung tiếp thị!`)
      }
    } catch (err) {
      showNotice(err.message || 'Không thể tạo nội dung từ AI.', 'error')
    } finally {
      setStudioGenerating(false)
    }
  }

  const handlePublishStudio = async (immediate = true) => {
    const targetPrivacy = privacyForSocialPlatform(studioPlatform, settings.privacy)
    if (!targetPrivacy) return showNotice('Kênh đăng bài không được hỗ trợ.', 'error')
    const draft = { ...studioDraft, platform: studioPlatform, privacy: targetPrivacy }
    if (immediate) return handleRealAutoPostThroughExtension(draft)

    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/posts/create', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          productId: studioDraft.productId || '1',
          productName: studioDraft.productName,
          productPrice: studioDraft.productPrice,
          productImage: studioDraft.productImage,
          platform: studioPlatform,
          title: studioDraft.title,
          content: studioDraft.content,
          hashtags: studioDraft.hashtags,
          targetGroup: studioTargetGroup || undefined,
          privacy: targetPrivacy,
          publishImmediately: false
        })
      })
      if (!res?.ok || !res.post?.id) throw new Error('Máy chủ chưa xác nhận lưu bản nháp.')
      showNotice('Đã lưu bản nháp chờ đăng.')
      await loadAll()
      setActiveSubTab('logs')
    } catch (err) {
      showNotice(err.message || 'Lỗi khi lưu bài viết.', 'error')
    } finally {
      setLoading(false)
    }
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
      showNotice('Đang gửi ảnh sản phẩm và nội dung qua Chrome Extension (thao tác thật như người)...', 'info')

      const post = { ...studioDraft, ...(targetPost || {}) }
      platform = (post.platform || studioPlatform || 'facebook').toLowerCase()
      if (!['facebook', 'tiktok'].includes(platform)) throw new Error('Kênh đăng bài không được hỗ trợ.')

      const productImage = post.productImage || studioDraft.productImage
      if (!productImage) throw new Error('Thiếu ảnh sản phẩm nên chưa thể đăng.')

      const imageUrl = new URL(productImage, window.location.origin).href
      const fullText = formatPostText(post)
      if (!fullText) throw new Error('Bài viết chưa có nội dung để đăng.')

      const targetPrivacy = privacyForSocialPlatform(platform, settings.privacy || 'only_me')
      if (!targetPrivacy) throw new Error('Kênh đăng bài không được hỗ trợ.')

      postId = post.id || postId
      if (!postId) {
        const created = await apiJson('/api/admin/social/posts/create', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            productId: post.productId || '1',
            productName: post.productName || 'Sản phẩm OmniCart',
            productPrice: post.productPrice || 0,
            productImage,
            platform,
            title: post.title || '',
            content: post.content || '',
            hashtags: post.hashtags || '',
            privacy: targetPrivacy,
            publishImmediately: false
          })
        })
        if (!created?.ok || !created.post?.id) throw new Error('Máy chủ chưa lưu được bản nháp.')
        postId = created.post.id
        autoPostAttemptedIdsRef.current.add(String(postId))
      }

      // Gửi đầy đủ title, content (có link sản phẩm), hashtags riêng biệt và postId để theo dõi duyệt!
      const reply = await sendExtensionMessage('AUTO_POST', {
        platform,
        post: {
          postId,
          title: post.title || '',
          content: fullText,
          hashtags: post.hashtags || '',
          privacy: targetPrivacy,
          imageUrl
        }
      })

      if (reply?.error === 'EXTENSION_NOT_DETECTED') {
        failureCode = reply.error
        setShowExtensionHelp(true)
        throw new Error('Chưa phát hiện Chrome Extension. Bản nháp đã lưu, bài chưa đăng.')
      }

      const result = reply?.data

      // Trường hợp TikTok đã nhận bài & đang trong 3–5 phút duyệt bài!
      if (reply?.ok === true && result?.ok === true && result.pendingReview === true) {
        await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/pending-review`, {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            platform,
            privacy: result.privacy || targetPrivacy,
            message: result.message || 'TikTok đang duyệt bài (3–5 phút). Extension đang tự động theo dõi lấy link thật.'
          })
        })
        showNotice('⏳ TikTok đã nhận bài & đang duyệt (3–5 phút). Extension đang tự theo dõi ngầm và sẽ tự cập nhật link thật!', 'info')
        await loadAll()
        setActiveSubTab('logs')
        return { ok: true, pendingReview: true, platform }
      }

      if (result?.postUrl && result?.realPostId) {
        livePostUrl = result.postUrl
        livePostId = result.realPostId
      }

      if (reply?.ok !== true || result?.ok !== true || result.platform !== platform ||
          result.privacy !== targetPrivacy || !result.postUrl || !result.realPostId) {
        const errorCode = result?.error || reply?.error || 'POST_NOT_VERIFIED'
        failureCode = errorCode
        throw new Error(getExtensionPostErrorMessage(errorCode))
      }

      const confirmedPrivacy = result.privacy || targetPrivacy
      const saved = await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/publish-real`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          postUrl: result.postUrl,
          publishedTime: result.publishedTime,
          platform,
          realPostId: result.realPostId,
          privacy: confirmedPrivacy
        })
      })
      if (!saved?.ok || saved.post?.status !== 'published' || saved.post?.postUrl !== result.postUrl) {
        throw new Error('Đã có liên kết bài đăng nhưng máy chủ chưa xác nhận lưu lịch sử.')
      }

      const privacyLabel = confirmedPrivacy === 'only_me' ? 'Chỉ mình tôi' : 'Công khai'
      showNotice(`✅ Đã xác nhận đăng bài ${platform === 'facebook' ? 'Facebook' : 'TikTok'} (${privacyLabel}): ${result.postUrl}`)
      await loadAll()
      setActiveSubTab('logs')
      return { ok: true, platform, postUrl: result.postUrl }
    } catch (err) {
      const errorMessage = err.message || 'Lỗi khi đăng bài qua Extension'
      const ambiguousPostErrors = new Set(['FACEBOOK_POST_NOT_VERIFIED', 'TIKTOK_POST_NOT_VERIFIED'])
      const outcome = livePostUrl || ambiguousPostErrors.has(failureCode) ? 'unverified' : 'failed'

      if (postId && targetPost?.status !== 'published') {
        try {
          await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/publish-failure`, {
            method: 'POST',
            headers: { 'x-csrf-token': csrfToken },
            body: JSON.stringify({
              status: outcome,
              errorMessage: failureCode ? `${errorMessage} (${failureCode})` : errorMessage,
              postUrl: livePostUrl,
              realPostId: livePostId
            })
          })
          await loadAll()
        } catch (_) {}
      }

      showNotice(errorMessage, 'error')
      return { ok: false, platform, error: errorMessage }
    } finally {
      setRealPostingBusy(false)
    }
  }

  const getExtensionPostErrorMessage = (code) => {
    const messages = {
      EXTENSION_CONTEXT_INVALIDATED: 'Extension vừa tải lại. Nhấn F5 để nối lại cầu nối.',
      PRODUCT_IMAGE_REQUIRED: 'Thiếu ảnh sản phẩm; bài chưa được đăng.',
      FACEBOOK_LOGIN_REQUIRED: 'Trình duyệt chưa đăng nhập Facebook. Hãy đăng nhập Facebook trước.',
      TIKTOK_LOGIN_REQUIRED: 'Trình duyệt chưa đăng nhập TikTok. Hãy đăng nhập TikTok trước.',
      FACEBOOK_NETWORK_OFFLINE: 'Tab Facebook đang mất kết nối mạng.',
      TIKTOK_NETWORK_OFFLINE: 'Tab TikTok đang mất kết nối mạng.',
      FACEBOOK_CAPTCHA_OR_CHECKPOINT: 'Facebook đang yêu cầu xác minh bảo mật (Checkpoint).',
      TIKTOK_CAPTCHA_OR_CHECKPOINT: 'TikTok đang yêu cầu kéo Captcha xác minh.',
      TIKTOK_PHOTO_UPLOAD_UNAVAILABLE: 'TikTok Studio chưa mở được ô tải ảnh.',
      TIKTOK_DESCRIPTION_NOT_INSERTED: 'Không điền được Mô tả & Hashtag TikTok; đã dừng an toàn.',
      TIKTOK_PRIVACY_NOT_CONFIRMED: 'TikTok chưa xác nhận đúng quyền riêng tư đã chọn.',
      FACEBOOK_COMPOSER_NOT_FOUND: 'Không thấy khung "Bạn đang nghĩ gì?" trên Facebook.',
      FACEBOOK_COMPOSER_DID_NOT_OPEN: 'Hộp thoại "Tạo bài viết" Facebook không mở ra.',
      FACEBOOK_PUBLIC_NOT_CONFIRMED: 'Facebook chưa xác nhận đối tượng Công khai; đã dừng an toàn.',
      FACEBOOK_ONLY_ME_NOT_CONFIRMED: 'Facebook chưa xác nhận đối tượng Chỉ mình tôi; đã dừng an toàn.',
      FACEBOOK_POST_NOT_VERIFIED: 'Facebook chưa hiển thị bài mới có đường dẫn riêng.',
      TIKTOK_POST_NOT_VERIFIED: 'TikTok chưa xác nhận tiếp nhận bài đăng.'
    }
    return messages[code] || `Extension chưa xác nhận đăng thành công (${code}).`
  }

  // Tự động chạy bài Full-Auto khi tab Admin + Extension đang mở
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
          .filter(post =>
            (post.status === 'ready_for_publish' || post.status === 'ready_for_api') &&
            ['facebook', 'tiktok'].includes(String(post.platform || '').toLowerCase()) &&
            post.id &&
            !autoPostAttemptedIdsRef.current.has(String(post.id))
          )
          .sort((a, b) => Date.parse(b.createdAt || b.triggerTime || 0) - Date.parse(a.createdAt || a.triggerTime || 0))[0]

        if (!nextPost || disposed) return
        const gapMs = 1800 + Math.floor(Math.random() * 1200)
        const remainingGapMs = gapMs - (Date.now() - autoPostLastAttemptAtRef.current)
        if (remainingGapMs > 0) await new Promise(resolve => setTimeout(resolve, remainingGapMs))
        if (disposed) return

        autoPostAttemptedIdsRef.current.add(String(nextPost.id))
        autoPostLastAttemptAtRef.current = Date.now()
        await handleRealAutoPostThroughExtension(nextPost)
      } catch (err) {
        if (!disposed) showNotice(err.message || 'Không thể kiểm tra bài chờ xuất bản.', 'error')
      } finally {
        autoPostInFlightRef.current = false
      }
    }

    pollNextReadyPost()
    const timer = setInterval(pollNextReadyPost, 10000)
    return () => {
      disposed = true
      clearInterval(timer)
    }
  }, [settings.isActive, settings.mode, extensionConnected, batchPosting, realPostingBusy])

  // Cào 20 bài Viral thật bằng 2 Tab chuyên biệt (10 FB >= 5K + 10 TikTok >= 50K)
  const handleScrapeRealViralThroughExtension = async () => {
    if (scrapingViralBusy) return
    try {
      setScrapingViralBusy(true)
      showNotice('🔥 Extension đang mở 2 tab riêng (Facebook >= 5K tương tác & TikTok >= 50K tim) để cào 20 bài viral thật...', 'info')
      const res = await sendExtensionMessage('FETCH_REAL_VIRAL', {
        platform: 'both',
        fbCount: 10,
        tiktokCount: 10,
        fbMinLikes: 5000,
        tiktokMinLikes: 50000
      })

      if (res?.error === 'EXTENSION_NOT_DETECTED') {
        setShowExtensionHelp(true)
        throw new Error('Chưa kết nối Chrome Extension để mở 2 tab cào bài viral.')
      }

      const scrapedPosts = res?.data?.posts || []
      const fbCount = (res?.data?.facebookPosts || []).length
      const ttCount = (res?.data?.tiktokPosts || []).length

      if (scrapedPosts.length > 0) {
        const saved = await apiJson('/api/admin/social/viral/import-real', {
          method: 'POST',
          headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({ posts: scrapedPosts })
        })
        if (saved?.posts) setViralPosts(saved.posts)
        else {
          const resViral = await apiJson('/api/admin/social/viral')
          if (resViral?.posts) setViralPosts(resViral.posts)
        }
        showNotice(`🔥 Đã cào & lưu bài viral thật: Facebook ${fbCount}/10 bài (>=5K) • TikTok ${ttCount}/10 bài (>=50K)!`)
        setActiveSubTab('groups')
      } else {
        showNotice('Chưa lọc được bài đạt ngưỡng viral (>=5K FB / >=50K TikTok) trên lượt lướt này. Hãy đảm bảo đã đăng nhập Facebook & TikTok rồi thử lại.', 'error')
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi cào bài viral qua Extension.', 'error')
    } finally {
      setScrapingViralBusy(false)
    }
  }

  // Tự động lấy 5 link Hội nhóm Facebook thật qua Extension
  const handleAutoScrape5FacebookGroups = async () => {
    if (scrapingGroupsBusy) return
    try {
      setScrapingGroupsBusy(true)
      showNotice('👥 Extension đang mở Facebook tìm 5 hội nhóm thật có tương tác cao...', 'info')
      const res = await sendExtensionMessage('SCRAPE_FB_GROUPS', {
        count: 5,
        keyword: groupKeyword.trim(),
        excludeUrls: groups.map(g => g.groupUrl)
      })

      if (res?.error === 'EXTENSION_NOT_DETECTED') {
        setShowExtensionHelp(true)
        throw new Error('Chưa kết nối Chrome Extension.')
      }
      if (!res?.ok) throw new Error(getExtensionPostErrorMessage(res?.error || 'GROUP_SCRAPE_FAILED'))

      const scrapedGroups = res?.data?.groups || []
      if (!scrapedGroups.length) {
        showNotice('Không tìm thấy thêm nhóm Facebook mới nào. Hãy thử nhập từ khóa khác hoặc kiểm tra đăng nhập Facebook.', 'info')
        return
      }

      const saved = await apiJson('/api/admin/social/groups/import-real', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ groups: scrapedGroups })
      })
      if (saved?.groups) setGroups(saved.groups)
      showNotice(`✅ Đã lấy tự động và lưu ${saved?.addedCount ?? scrapedGroups.length} hội nhóm Facebook thật!`)
    } catch (err) {
      showNotice(err.message || 'Lỗi khi lấy 5 hội nhóm Facebook.', 'error')
    } finally {
      setScrapingGroupsBusy(false)
    }
  }

  // Xóa toàn bộ bài viral đã cào về
  const handleClearAllViralPosts = async () => {
    if (!viralPosts.length) return showNotice('Kho bài viral đang trống.', 'info')
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ ${viralPosts.length} bài viral đã cào về không?`)) return
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/viral/clear-all', {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        setViralPosts([])
        showNotice(`🗑️ Đã xóa sạch toàn bộ ${res.deletedCount ?? ''} bài viral đã cào!`)
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi xóa toàn bộ bài viral.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Xóa toàn bộ bài đăng trong nhật ký báo cáo
  const handleClearAllPostLogs = async () => {
    if (!posts.length) return showNotice('Nhật ký đăng bài đang trống.', 'info')
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ ${posts.length} bài trong Nhật ký báo cáo không?`)) return
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/posts/clear-all', {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        setPosts([])
        showNotice(`🗑️ Đã xóa sạch toàn bộ ${res.deletedCount ?? ''} bài trong nhật ký báo cáo!`)
        await loadAll()
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi xóa toàn bộ nhật ký.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi nhật ký đăng bài này?')) return
    try {
      const res = await apiJson(`/api/admin/social/posts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        showNotice('Đã xóa log bài đăng.')
        await loadAll()
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi xóa bài.', 'error')
    }
  }

  const handleAddGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.groupName || !newGroup.groupUrl) {
      return showNotice('Vui lòng điền tên và link nhóm Facebook.', 'error')
    }
    try {
      const res = await apiJson('/api/admin/social/groups', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify(newGroup)
      })
      if (res?.ok) {
        showNotice('Đã thêm nhóm Facebook mục tiêu thành công!')
        setNewGroup({ groupName: '', groupUrl: '', category: 'Đồ gia dụng & Gia đình', membersCount: 0, interactionRate: 'Cao', isAutoShare: true, notes: '' })
        const updated = await apiJson('/api/admin/social/groups')
        if (updated?.groups) setGroups(updated.groups)
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi thêm nhóm.', 'error')
    }
  }

  const handleToggleGroup = async (id, currentShare) => {
    try {
      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ isAutoShare: !currentShare })
      })
      if (res?.ok) {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, isAutoShare: !currentShare } : g))
        showNotice('Đã cập nhật trạng thái tự động chia sẻ vào nhóm.')
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi đổi trạng thái nhóm.', 'error')
    }
  }

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Xóa nhóm này khỏi danh sách mục tiêu?')) return
    try {
      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        setGroups(prev => prev.filter(g => g.id !== id))
        showNotice('Đã xóa nhóm mục tiêu.')
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi xóa nhóm.', 'error')
    }
  }

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (postFilterStatus !== 'all' && post.status !== postFilterStatus) return false
      if (postFilterPlatform !== 'all' && post.platform !== postFilterPlatform) return false
      return true
    })
  }, [posts, postFilterStatus, postFilterPlatform])

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups
    const q = groupSearch.toLowerCase()
    return groups.filter(g => g.groupName.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
  }, [groups, groupSearch])

  // Tách đôi bảng Viral: Tối đa 10 bài Facebook (trái) & 10 bài TikTok (phải)
  const facebookViralTop10 = useMemo(
    () => viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'facebook').slice(0, 10),
    [viralPosts]
  )
  const tiktokViralTop10 = useMemo(
    () => viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'tiktok').slice(0, 10),
    [viralPosts]
  )

  const formatTime = (isoString) => {
    if (!isoString) return 'Chưa ghi nhận'
    try {
      return new Date(isoString).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
      })
    } catch {
      return isoString
    }
  }

  const handleExportCsv = () => {
    if (!posts.length) return showNotice('Không có dữ liệu bài đăng để xuất file.', 'info')
    const headers = ['ID', 'Mã SP', 'Sản Phẩm', 'Giá', 'Kênh', 'Trạng Thái', 'Tiêu Đề', 'Nhóm', 'Thích', 'Chia Sẻ', 'Bình Luận', 'Kích Hoạt', 'Xuất Bản', 'Link']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filteredPosts.map(p => [
      esc(p.id), esc(p.productId), esc(p.productName), esc(p.productPrice), esc(p.platform),
      esc(p.status), esc(p.title), esc(p.targetGroup || 'Trang cá nhân'),
      esc(p.likesCount), esc(p.sharesCount), esc(p.commentsCount), esc(p.triggerTime), esc(p.publishedTime), esc(p.postUrl)
    ].join(','))
    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Bao_Cao_Dang_Bai_MXH_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showNotice('Đã xuất báo cáo lịch sử đăng bài thành công!')
  }

  return (
    <div className="admin-social-workspace admin-social-posting admin-social-automation" data-module="social-automation">
      {alertMessage && (
        <div className={`social-alert social-alert--${alertMessage.type || 'success'}`}>
          <span>{alertMessage.type === 'error' ? '⚠️' : alertMessage.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* KPI Banner */}
      <section className="social-kpi-banner">
        <div className="social-kpi-banner__head">
          <div className="social-kpi-title">
            <span style={{ fontSize: '24px' }}>📢</span>
            <div><h2>Hệ Thống Tự Động Hóa Đăng Bài Mạng Xã Hội 24/7</h2></div>
            <span className={'social-status-pill ' + (settings.isActive ? 'is-active' : 'is-paused')}>
              <span aria-hidden="true">{settings.isActive ? '●' : '○'}</span>
              {settings.isActive
                ? `Đang chạy (${currentIntervalKey === '2m' ? 'Mỗi 2 phút' : currentIntervalKey === '1' ? 'Mỗi 1 giờ' : 'Mỗi 4 giờ'})`
                : 'Đang tạm dừng'}
            </span>
          </div>

          <div className="social-kpi-actions">
            <button
              type="button"
              className="social-btn-trigger"
              onClick={handleTriggerCycle}
              disabled={loading || realPostingBusy || batchPosting}
            >
              ⚡ Đăng Thật 2 Bài: Facebook + TikTok
            </button>
            <button type="button" className="social-btn-secondary" onClick={loadAll} disabled={loading}>
              🔄 Làm Mới
            </button>
          </div>
        </div>

        <div className="social-kpi-grid">
          <div className="social-kpi-card"><small>Đã đăng xác minh</small><strong>{stats.publishedCount} bài</strong></div>
          <div className="social-kpi-card"><small>Chờ duyệt / Đang xử lý</small><strong>{stats.pendingCount} bài</strong></div>
          <div className="social-kpi-card"><small>Tổng Lượt Thích</small><strong>{stats.totalLikes.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card"><small>Tổng Lượt Chia Sẻ</small><strong>{stats.totalShares.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card"><small>Tổng Bình Luận</small><strong>{stats.totalComments.toLocaleString('vi-VN')}</strong></div>
          <div className="social-kpi-card">
            <small>Chu kỳ kế tiếp</small>
            <strong style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{stats.nextRunAt ? formatTime(stats.nextRunAt) : 'Chưa xếp lịch'}</strong>
          </div>
        </div>
      </section>

      {/* Extension Bridge Control Bar (Đa tài khoản) */}
      <section className="social-extension-bar" style={{
        margin: '12px 0 16px 0', padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(16, 42, 30, 0.95), rgba(24, 76, 52, 0.95))',
        border: '1px solid #28543a', borderRadius: '10px', color: '#edf7ef',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '26px' }}>👁️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '13px' }}>OmniVision Bridge v3.0 (Đa Tài Khoản • Online 24/7)</strong>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                background: extensionConnected ? '#10b981' : '#f59e0b', color: '#ffffff'
              }}>
                {extensionConnected ? '🟢 Đã kết nối 24/7' : '🟡 Đang chờ kết nối Chrome Extension'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>
              Tự nhận diện <strong>bất kỳ tài khoản Facebook & TikTok nào đang đăng nhập</strong> trên trình duyệt • Tự theo dõi duyệt bài TikTok 3–5 phút • Mở 2 Tab riêng cào bài Viral chính xác.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button" className="social-btn-trigger" style={{ fontSize: '12px', padding: '6px 12px' }}
            disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content}
            onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'facebook' })}
          >
            🚀 Đăng Thật FB
          </button>
          <button
            type="button" className="social-btn-trigger"
            style={{ fontSize: '12px', padding: '6px 12px', background: '#000', borderColor: '#fe2c55', color: '#fe2c55' }}
            disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content}
            onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'tiktok' })}
          >
            🚀 Đăng Thật TikTok
          </button>
          <button
            type="button" className="social-btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', background: '#0f172a', borderColor: '#334155', color: '#38bdf8' }}
            disabled={scrapingViralBusy}
            onClick={handleScrapeRealViralThroughExtension}
          >
            {scrapingViralBusy ? '⏳ Đang cào 2 Tab...' : '🔥 Cào 20 Bài Viral (2 Tab)'}
          </button>
          <button
            type="button" className="social-btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
            onClick={() => setShowExtensionHelp(true)}
          >
            📖 Hướng dẫn Extension
          </button>
        </div>
      </section>

      {/* Subnav */}
      <nav className="social-subnav" aria-label="Phân hệ tiếp thị MXH">
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'settings' ? 'is-active' : '')} onClick={() => setActiveSubTab('settings')}>
          ⚙️ Cấu Hình Tự Động Hóa
        </button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'studio' ? 'is-active' : '')} onClick={() => setActiveSubTab('studio')}>
          ✍️ AI Copywriting Studio (Soạn Thử)
        </button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'groups' ? 'is-active' : '')} onClick={() => setActiveSubTab('groups')}>
          👥 Hội Nhóm Facebook & Kho Bài Viral ({viralPosts.length})
        </button>
        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'logs' ? 'is-active' : '')} onClick={() => setActiveSubTab('logs')}>
          📋 Nhật Ký Đăng Bài & Báo Cáo ({posts.length})
        </button>
      </nav>

      {/* TAB 1: CẤU HÌNH */}
      {activeSubTab === 'settings' && (
        <section className="social-panel">
          <div className="social-panel__heading">
            <h3>⚙️ Thiết Lập Lịch Trình & Phong Cách Đăng Bài Tự Động</h3>
          </div>
          <div className="social-info-banner">
            <strong>ℹ️ Chế độ vận hành 24/7 đa tài khoản:</strong>
            Extension thao tác tự nhiên có nhịp trễ trên bất kỳ tài khoản Facebook và TikTok nào bạn đang đăng nhập, tự nhận biết lúc trang đang tải / mất mạng và tự theo dõi duyệt bài TikTok 3–5 phút để ghi đúng đường dẫn bài viết thật.
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="social-form-grid">
              <div className="social-field">
                <label htmlFor="cfg-status">Trạng thái tự động hóa</label>
                <select id="cfg-status" className="social-select" value={settings.isActive ? '1' : '0'} onChange={e => setSettings({ ...settings, isActive: e.target.value === '1' })}>
                  <option value="1">🟢 Bật - Tự động theo chu kỳ</option>
                  <option value="0">🔴 Tắt - Tạm dừng toàn bộ</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-mode">Chế độ vận hành</label>
                <select id="cfg-mode" className="social-select" value={settings.mode} onChange={e => setSettings({ ...settings, mode: e.target.value })}>
                  <option value="full_auto">🚀 Hoàn toàn tự động (Full-Auto)</option>
                  <option value="semi_auto">📝 Duyệt trước (Semi-Auto)</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-interval">Chu kỳ đăng bài</label>
                <select id="cfg-interval" className="social-select" value={currentIntervalKey} onChange={e => handleIntervalChange(e.target.value)}>
                  <option value="2m">⚡ Mỗi 2 phút (kiểm thử nhanh)</option>
                  <option value="1">🕐 Mỗi 1 giờ</option>
                  <option value="4">🕓 Mỗi 4 giờ</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-privacy">Quyền riêng tư áp dụng cho tất cả nền tảng</label>
                <select id="cfg-privacy" className="social-select" value={settings.privacy || 'only_me'} onChange={e => setSettings({ ...settings, privacy: e.target.value })}>
                  <option value="only_me">🔒 Chỉ mình tôi</option>
                  <option value="public">🌐 Công khai</option>
                </select>
                <small className="social-muted-text">Áp dụng đồng nhất cho tài khoản Facebook & TikTok đang đăng nhập.</small>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-channels">Kênh xuất bản</label>
                <select id="cfg-channels" className="social-select" value={settings.channels} onChange={e => setSettings({ ...settings, channels: e.target.value })}>
                  <option value="facebook,tiktok">Đa kênh: Facebook + TikTok</option>
                  <option value="facebook">Chỉ Facebook</option>
                  <option value="tiktok">Chỉ TikTok</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-category">Danh mục sản phẩm ưu tiên</label>
                <select id="cfg-category" className="social-select" value={settings.preferredCategory} onChange={e => setSettings({ ...settings, preferredCategory: e.target.value })}>
                  <option value="all">Tất cả sản phẩm</option>
                  <option value="Đồ gia dụng">Đồ gia dụng và tiện ích gia đình</option>
                  <option value="Thời trang">Thời trang và phụ kiện</option>
                  <option value="Công nghệ">Đồ công nghệ và thiết bị</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-tone">Phong cách văn chương</label>
                <select id="cfg-tone" className="social-select" value={settings.toneStyle} onChange={e => setSettings({ ...settings, toneStyle: e.target.value })}>
                  <option value="viral_engaging">Bắt trend và tương tác cao</option>
                  <option value="humorous">Hài hước, dí dỏm, duyên dáng</option>
                  <option value="fomo_sales">Kêu gọi chốt đơn gấp</option>
                  <option value="authentic_review">Review chân thực, đi sâu vào tiện ích</option>
                  <option value="storytelling">Kể chuyện nhẹ nhàng, truyền cảm hứng</option>
                </select>
              </div>
              <div className="social-field">
                <label htmlFor="cfg-hotline">Số Hotline liên hệ</label>
                <input id="cfg-hotline" type="text" className="social-input" value={settings.contactHotline} onChange={e => setSettings({ ...settings, contactHotline: e.target.value })} />
              </div>
              <div className="social-field">
                <label htmlFor="cfg-link">Mẫu liên kết đặt hàng</label>
                <input id="cfg-link" type="text" className="social-input" value={settings.orderLinkTemplate} onChange={e => setSettings({ ...settings, orderLinkTemplate: e.target.value })} />
              </div>
            </div>

            <div className="social-checkbox-group" style={{ marginBottom: '20px' }}>
              <span className="social-subhead">Các thành phần tự động đính kèm vào bài viết:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeEmojis} onChange={e => setSettings({ ...settings, includeEmojis: e.target.checked })} /><span>Tự động chèn Emoji sinh động</span></label>
                <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeHashtags} onChange={e => setSettings({ ...settings, includeHashtags: e.target.checked })} /><span>Chèn bộ Hashtag xu hướng</span></label>
                <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeCta} onChange={e => setSettings({ ...settings, includeCta: e.target.checked })} /><span>Lời kêu gọi mua hàng (CTA)</span></label>
                <label className="social-checkbox-label"><input type="checkbox" checked={settings.includeHotline} onChange={e => setSettings({ ...settings, includeHotline: e.target.checked })} /><span>Đính kèm Hotline CSKH</span></label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button type="submit" className="social-btn-trigger" style={{ padding: '12px 24px', fontSize: '13px' }} disabled={loading}>
                💾 Lưu Cấu Hình Tự Động Hóa
              </button>
              <span className="social-muted-text">Lần cập nhật cuối: {formatTime(settings.updatedAt)}</span>
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: AI COPYWRITING STUDIO */}
      {activeSubTab === 'studio' && (
        <section className="social-panel">
          <div className="social-panel__heading">
            <h3>✍️ Trình Sáng Tạo Nội Dung Bán Hàng Bằng Local Qwen AI</h3>
          </div>
          <div className="social-studio-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="social-field">
                <label>Kênh xuất bản</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className={'social-action-btn ' + (studioPlatform === 'facebook' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px' }} onClick={() => setStudioPlatform('facebook')}>🔵 Facebook</button>
                  <button type="button" className={'social-action-btn ' + (studioPlatform === 'tiktok' ? 'social-action-btn--primary' : '')} style={{ flex: 1, padding: '10px' }} onClick={() => setStudioPlatform('tiktok')}>🎵 TikTok</button>
                </div>
              </div>
              <div className="social-field">
                <label htmlFor="studio-tone">Phong cách bài viết</label>
                <select id="studio-tone" className="social-select" value={studioTone} onChange={e => setStudioTone(e.target.value)}>
                  <option value="viral_engaging">Bắt trend và tương tác cao</option>
                  <option value="humorous">Hài hước, dí dỏm, duyên dáng</option>
                  <option value="fomo_sales">Kêu gọi chốt đơn gấp</option>
                  <option value="authentic_review">Review chân thực 100%</option>
                  <option value="storytelling">Kể chuyện nhẹ nhàng truyền cảm hứng</option>
                </select>
              </div>
              {studioPlatform === 'facebook' && (
                <div className="social-field">
                  <label htmlFor="studio-target-group">Nhóm Facebook mục tiêu</label>
                  <select id="studio-target-group" className="social-select" value={studioTargetGroup} onChange={e => setStudioTargetGroup(e.target.value)}>
                    <option value="">Tự động chọn nhóm kích hoạt</option>
                    {groups.map(grp => <option key={grp.id} value={grp.groupName}>{grp.groupName} ({grp.category})</option>)}
                  </select>
                </div>
              )}
              <div className="social-field">
                <label htmlFor="studio-topic">Yêu cầu riêng và Chủ đề bổ sung</label>
                <input id="studio-topic" type="text" className="social-input" value={studioTopic} onChange={e => setStudioTopic(e.target.value)} placeholder="Ví dụ: Bảo hành 1 đổi 1, freeship..." />
              </div>
              <button type="button" className="social-btn-trigger" style={{ padding: '12px', fontSize: '13px', justifyContent: 'center' }} onClick={handleGenerateStudio} disabled={studioGenerating}>
                {studioGenerating ? '⏳ Qwen AI Đang Viết Bài...' : '⚡ Local Qwen AI Viết Bài Mới'}
              </button>
              <div className="social-field">
                <label htmlFor="studio-draft-content">Nội dung có thể chỉnh sửa trước khi đăng:</label>
                <textarea id="studio-draft-content" className="social-textarea" rows={8} value={studioDraft.content} onChange={e => setStudioDraft({ ...studioDraft, content: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="social-btn-trigger" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(true)} disabled={loading || realPostingBusy || batchPosting}>
                  🚀 Đăng Ngay Lên Mạng Xã Hội
                </button>
                <button type="button" className="social-action-btn" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(false)} disabled={loading || realPostingBusy || batchPosting}>
                  ⏳ Lưu Bản Nháp
                </button>
              </div>
            </div>

            <div className="social-preview-container">
              <span className="social-subhead" style={{ fontWeight: 800 }}>👁️ Live Preview ({studioPlatform === 'facebook' ? 'Facebook' : 'TikTok'}):</span>
              <div className={'social-preview-card ' + (studioPlatform === 'facebook' ? 'social-preview-card--facebook' : 'social-preview-card--tiktok')}>
                <div className="preview-header">
                  <div className="preview-avatar">O</div>
                  <div className="preview-author">
                    <strong>Tài khoản đang đăng nhập <span className="preview-badge-verified">✓</span></strong>
                    <small>Vừa xong · {settings.privacy === 'public' ? 'Công khai 🌐' : 'Chỉ mình tôi 🔒'}</small>
                  </div>
                </div>
                <div className="preview-content">{studioDraft.content}</div>
                <div className="preview-media">
                  <img src={studioDraft.productImage || '/products/headphones.svg'} alt={studioDraft.productName} onError={e => { e.currentTarget.src = '/products/bag.svg' }} />
                </div>
                <div className="preview-footer"><span>👍 Thích (0)</span><span>💬 Bình luận (0)</span><span>🔁 Chia sẻ (0)</span></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: HỘI NHÓM FACEBOOK (LẤY 5 NHÓM TỰ ĐỘNG) & KHO BÀI VIRAL CHIA ĐÔI 2 CỘT */}
      {activeSubTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PHẦN 1: HỘI NHÓM FACEBOOK */}
          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <h3>👥 Danh Sách Hội Nhóm Facebook Mục Tiêu</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  className="social-input"
                  style={{ width: '210px', padding: '7px 10px' }}
                  placeholder="Từ khóa tìm nhóm (tùy chọn)..."
                  value={groupKeyword}
                  onChange={e => setGroupKeyword(e.target.value)}
                />
                <button
                  type="button"
                  className="social-btn-trigger"
                  onClick={handleAutoScrape5FacebookGroups}
                  disabled={scrapingGroupsBusy}
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                >
                  {scrapingGroupsBusy ? '⏳ Đang tìm 5 hội nhóm...' : '🔍 Tự động lấy 5 hội nhóm Facebook'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', alignItems: 'center' }}>
              <input
                type="search"
                className="social-input"
                style={{ maxWidth: '340px' }}
                placeholder="🔍 Lọc nhóm đã lưu..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
              />
              <span className="social-muted-text">Tổng cộng {filteredGroups.length} nhóm mục tiêu</span>
            </div>

            <div className="social-table-shell" style={{ marginBottom: '20px' }}>
              <table className="social-table">
                <thead>
                  <tr>
                    <th>Tên Nhóm Facebook</th>
                    <th>Chủ đề</th>
                    <th>Thành viên</th>
                    <th>Tương tác</th>
                    <th>Tự động chia sẻ</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map(grp => (
                    <tr key={grp.id}>
                      <td>
                        <strong>{grp.groupName}</strong>
                        <div style={{ fontSize: '11px' }}>
                          <a href={grp.groupUrl} target="_blank" rel="noopener noreferrer" className="social-table-link">
                            {grp.groupUrl} ↗
                          </a>
                        </div>
                      </td>
                      <td>{grp.category}</td>
                      <td>{grp.membersCount.toLocaleString('vi-VN')}</td>
                      <td><span className="status-tag status-tag--published">{grp.interactionRate}</span></td>
                      <td>
                        <button type="button" className={'social-action-btn ' + (grp.isAutoShare ? 'social-action-btn--primary' : '')} onClick={() => handleToggleGroup(grp.id, grp.isAutoShare)}>
                          {grp.isAutoShare ? '✓ Đang bật' : '○ Đang tắt'}
                        </button>
                      </td>
                      <td className="social-muted-text" style={{ fontSize: '11px' }}>{grp.notes || '—'}</td>
                      <td>
                        <button type="button" className="social-action-btn social-action-btn--danger" onClick={() => handleDeleteGroup(grp.id)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                  {filteredGroups.length === 0 && (
                    <tr><td colSpan={7} className="social-table-empty">Chưa có hội nhóm Facebook nào. Bấm "Tự động lấy 5 hội nhóm Facebook" ở trên!</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleAddGroup} className="social-subform-card">
              <h4>➕ Thêm Nhóm Facebook Thủ Công:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                <input type="text" className="social-input" placeholder="Tên nhóm Facebook *" value={newGroup.groupName} onChange={e => setNewGroup({ ...newGroup, groupName: e.target.value })} />
                <input type="url" className="social-input" placeholder="https://www.facebook.com/groups/... *" value={newGroup.groupUrl} onChange={e => setNewGroup({ ...newGroup, groupUrl: e.target.value })} />
                <input type="text" className="social-input" placeholder="Chủ đề" value={newGroup.category} onChange={e => setNewGroup({ ...newGroup, category: e.target.value })} />
                <input type="number" className="social-input" placeholder="Số thành viên" value={newGroup.membersCount} onChange={e => setNewGroup({ ...newGroup, membersCount: Number(e.target.value) })} />
              </div>
              <button type="submit" className="social-btn-trigger">Thêm Nhóm</button>
            </form>
          </section>

          {/* PHẦN 2: KHO BÀI VIRAL THẬT CHIA ĐÔI 2 CỘT (10 FACEBOOK >= 5K | 10 TIKTOK >= 50K) */}
          <section className="social-panel">
            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3>🔥 Kho Bài Đăng Viral Thật (Chia Đôi: 10 Facebook ≥ 5K • 10 TikTok ≥ 50K)</h3>
                <p>Extension tự mở thêm 2 Tab riêng (Facebook & TikTok) để cào đúng bài ảnh/video/nhóm đạt chuẩn viral cùng đường dẫn chính xác.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="social-btn-trigger"
                  onClick={handleScrapeRealViralThroughExtension}
                  disabled={scrapingViralBusy || loading}
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                >
                  {scrapingViralBusy ? '⏳ Đang cào 2 Tab (FB + TikTok)...' : '⚡ Cào 20 Bài Viral Thật (2 Tab FB + TikTok)'}
                </button>
                <button
                  type="button"
                  className="social-action-btn social-action-btn--danger"
                  onClick={handleClearAllViralPosts}
                  disabled={loading || viralPosts.length === 0}
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                >
                  🗑️ Xóa toàn bộ bài viral ({viralPosts.length})
                </button>
              </div>
            </div>

            {/* BẢNG CHIA ĐÔI 2 CỘT */}
            <div className="social-viral-split-grid">
              {/* CỘT TRÁI: FACEBOOK VIRAL (>= 5K TƯƠNG TÁC • 10 BÀI) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--fb">
                  <span>📘 Facebook Viral (≥ 5.000 tương tác)</span>
                  <span className="social-viral-count">{facebookViralTop10.length} / 10 bài</span>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Bài đăng & Nội dung</th>
                        <th>Tương tác</th>
                        <th>Link chính xác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facebookViralTop10.map((v, idx) => (
                        <tr key={v.id}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>
                            <div style={{ fontWeight: 700, marginBottom: '3px' }}>{v.title}</div>
                            <div className="social-muted-text" style={{ fontSize: '11px' }}>{v.summary}</div>
                            <span className="channel-tag channel-tag--facebook" style={{ marginTop: '4px' }}>{v.category || 'Facebook Viral'}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                            <div>👍 <strong>{v.likesCount.toLocaleString('vi-VN')}</strong></div>
                            <div className="social-muted-text">💬 {v.commentsCount.toLocaleString('vi-VN')} · 🔁 {v.sharesCount.toLocaleString('vi-VN')}</div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">
                              Mở bài ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                      {facebookViralTop10.length === 0 && (
                        <tr><td colSpan={4} className="social-table-empty">Chưa có bài Facebook ≥ 5K tương tác. Bấm "Cào 20 Bài Viral Thật"!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT PHẢI: TIKTOK VIRAL (>= 50K TIM • 10 BÀI) */}
              <div className="social-viral-column">
                <div className="social-viral-column__head social-viral-column__head--tt">
                  <span>🎵 TikTok Viral (≥ 50.000 tim)</span>
                  <span className="social-viral-count">{tiktokViralTop10.length} / 10 bài</span>
                </div>
                <div className="social-table-shell social-table-shell--compact">
                  <table className="social-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Video / Ảnh Viral</th>
                        <th>Lượt Tim</th>
                        <th>Link chính xác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiktokViralTop10.map((v, idx) => (
                        <tr key={v.id}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>
                            <div style={{ fontWeight: 700, marginBottom: '3px' }}>{v.title}</div>
                            <div className="social-muted-text" style={{ fontSize: '11px' }}>{v.summary}</div>
                            <span className="channel-tag channel-tag--tiktok" style={{ marginTop: '4px' }}>{v.category || 'TikTok Viral'}</span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                            <div>❤️ <strong>{v.likesCount.toLocaleString('vi-VN')}</strong></div>
                            <div className="social-muted-text">💬 {v.commentsCount.toLocaleString('vi-VN')} · 🔁 {v.sharesCount.toLocaleString('vi-VN')}</div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">
                              Mở video ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                      {tiktokViralTop10.length === 0 && (
                        <tr><td colSpan={4} className="social-table-empty">Chưa có bài TikTok ≥ 50K tim. Bấm "Cào 20 Bài Viral Thật"!</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: NHẬT KÝ ĐĂNG BÀI & BÁO CÁO (CÓ NÚT XÓA TOÀN BỘ) */}
      {activeSubTab === 'logs' && (
        <section className="social-panel">
          <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h3>📋 Báo Cáo Chi Tiết & Lịch Sử Đăng Bài</h3>
            <button
              type="button"
              className="social-action-btn social-action-btn--danger"
              onClick={handleClearAllPostLogs}
              disabled={loading || posts.length === 0}
              style={{ fontSize: '12px', padding: '7px 14px' }}
            >
              🗑️ Xóa toàn bộ nhật ký đăng bài ({posts.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trạng thái:</span>
              <select className="social-select" style={{ width: '220px' }} value={postFilterStatus} onChange={e => setPostFilterStatus(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="published">🟢 Đã đăng (Có link thật)</option>
                <option value="pending_review">⏳ Chờ TikTok duyệt (3–5p)</option>
                <option value="internal_draft">📝 Bản Nháp</option>
                <option value="pending_approval">🟡 Chờ Admin duyệt</option>
                <option value="unverified">⚠️ Chưa xác minh</option>
                <option value="failed">🔴 Thất bại</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Nền tảng:</span>
              <select className="social-select" style={{ width: '160px' }} value={postFilterPlatform} onChange={e => setPostFilterPlatform(e.target.value)}>
                <option value="all">Tất cả kênh</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <button type="button" className="social-action-btn social-action-btn--primary" onClick={handleExportCsv}>
              📥 Xuất Báo Cáo CSV
            </button>
            <span className="social-muted-text" style={{ marginLeft: 'auto' }}>Hiển thị {filteredPosts.length} / {posts.length} bài đăng</span>
          </div>

          <div className="social-table-shell">
            <table className="social-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Kênh</th>
                  <th>Sản phẩm</th>
                  <th>Nội dung bài viết</th>
                  <th>Vị trí</th>
                  <th>Trạng thái</th>
                  <th>Tương tác</th>
                  <th>Link bài viết</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map(p => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700 }}>{formatTime(p.publishedTime || p.triggerTime)}</div>
                      <small className="social-muted-text">Kích hoạt: {formatTime(p.triggerTime)}</small>
                    </td>
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
                      <div style={{ maxWidth: '270px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.title}</div>
                      <button type="button" className="social-modal-open-btn" onClick={() => setSelectedPostModal(p)}>Xem toàn bộ nội dung ↗</button>
                    </td>
                    <td className="social-muted-text" style={{ fontSize: '11.5px' }}>{p.targetGroup || 'Trang cá nhân đang đăng nhập'}</td>
                    <td>
                      <span className={'status-tag status-tag--' + p.status} title={p.errorMessage || ''}>
                        {p.status === 'published' ? '🟢 Đã đăng' :
                          p.status === 'pending_review' ? '⏳ Chờ duyệt (3–5p)' :
                            p.status === 'unverified' ? '⚠️ Chưa xác minh' :
                              p.status === 'ready_for_publish' || p.status === 'ready_for_api' ? '⏳ Chờ xuất bản' :
                                p.status === 'internal_draft' ? '📝 Bản Nháp' :
                                  p.status === 'pending_approval' ? '🟡 Chờ duyệt' : '🔴 Lỗi'}
                      </span>
                    </td>
                    <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>👍 {p.likesCount} · 🔁 {p.sharesCount} · 💬 {p.commentsCount}</td>
                    <td>
                      {p.postUrl ? (
                        <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">
                          {p.platform === 'facebook' ? 'Bài Facebook ↗' : 'Bài TikTok ↗'}
                        </a>
                      ) : (
                        <span className="social-muted-text">
                          {p.status === 'pending_review' ? 'Extension đang đợi link thật...' : p.status === 'unverified' ? 'Chưa xác minh link' : 'Chưa đăng thật'}
                        </span>
                      )}
                      {p.errorMessage && (
                        <small className="social-muted-text" style={{ display: 'block', maxWidth: '185px', whiteSpace: 'normal' }}>{p.errorMessage}</small>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button type="button" className="social-action-btn" onClick={() => handleCopyPost(p)} style={{ fontSize: '11px' }}>
                          {copiedPostId === p.id ? '✓ Đã chép' : '📋 Chép'}
                        </button>
                        {p.status !== 'pending_review' && (
                          <button
                            type="button"
                            className="social-action-btn social-action-btn--primary"
                            onClick={() => handleRealAutoPostThroughExtension(p)}
                            style={{ fontSize: '11px' }}
                            disabled={realPostingBusy || batchPosting}
                          >
                            {p.platform === 'facebook' ? '🚀 Đăng FB' : '🚀 Đăng TikTok'}
                          </button>
                        )}
                        <button type="button" className="social-action-btn social-action-btn--danger" onClick={() => handleDeletePost(p.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPosts.length === 0 && (
                  <tr><td colSpan={9} className="social-table-empty">Chưa có bản ghi nhật ký đăng bài nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal chi tiết bài viết */}
      {selectedPostModal && (
        <div className="social-modal-overlay" onClick={() => setSelectedPostModal(null)}>
          <div className="social-modal-card" onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>📄 Chi Tiết Bài Đăng #{selectedPostModal.id}</h3>
              <button type="button" className="social-modal-close" onClick={() => setSelectedPostModal(null)}>✕</button>
            </div>
            <div>
              <strong style={{ fontSize: '15px' }}>{selectedPostModal.title}</strong>
              <div className="social-modal-body-content">{selectedPostModal.content}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="social-btn-trigger" onClick={() => handleCopyPost(selectedPostModal)}>📋 Sao Chép</button>
              {selectedPostModal.postUrl && (
                <a href={selectedPostModal.postUrl} target="_blank" rel="noopener noreferrer" className="social-btn-trigger" style={{ textDecoration: 'none' }}>Mở Bài Viết Thật ↗</a>
              )}
              <button type="button" className="social-action-btn" onClick={() => setSelectedPostModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hướng dẫn Extension */}
      {showExtensionHelp && (
        <div className="social-modal-overlay" onClick={() => setShowExtensionHelp(false)}>
          <div className="social-modal-card" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>👁️ Hướng Dẫn Cài Đặt OmniVision Bridge v3.0</h3>
              <button type="button" className="social-modal-close" onClick={() => setShowExtensionHelp(false)}>✕</button>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.65 }}>
              <ol style={{ paddingLeft: '20px', margin: '0 0 12px' }}>
                <li>Mở <code>chrome://extensions/</code> và bật <strong>Developer mode</strong>.</li>
                <li>Chọn <strong>Load unpacked</strong> trỏ vào thư mục <code>Store-Admin/extension</code> (hoặc bấm <strong>Reload ↻</strong> nếu đã cài).</li>
                <li>Đăng nhập <strong>bất kỳ tài khoản Facebook & TikTok nào</strong> trên cùng trình duyệt Chrome này — Extension sẽ tự nhận diện và hoạt động 24/7.</li>
              </ol>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="social-btn-trigger" onClick={() => setShowExtensionHelp(false)}>Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
