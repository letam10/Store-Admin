/*

  FILE NOTE

  - Mục đích: Giao diện Quản trị Tự động hóa đăng bài MXH v3.1 (Đa tài khoản • 24/7).

  - Nâng cấp v3.1.0:

    1. Bộ sắp xếp nhỏ cho Hội nhóm Facebook (Tên A-Z / Z-A, Thành viên Cao-Thấp / Thấp-Cao).

    2. Bộ sắp xếp nhỏ độc lập cho cả 2 cột Bài Viral Facebook và TikTok (Tương tác/Tim Cao-Thấp / Thấp-Cao, Tên A-Z / Z-A).

    3. Xuất báo cáo dạng file Excel (.xlsx) thật thay cho CSV qua /api/admin/social/posts/export.

    4. Truyền toàn bộ excludeUrls & excludeNames sang Extension để lần cào 2, 3 KHÔNG BAO GIỜ TRÙNG; tự gia hạn timeout khi Extension đang chạy bộ đếm trượt 5 phút!

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

      const textarea = document.createElement('textarea')

      textarea.value = text

      textarea.style.position = 'fixed'

      textarea.style.left = '-9999px'

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

  const [groupSort, setGroupSort] = useState('members_desc') // members_desc | members_asc | name_asc | name_desc

  const [groupKeyword, setGroupKeyword] = useState('')

  const [scrapingGroupsBusy, setScrapingGroupsBusy] = useState(false)

  const [newGroup, setNewGroup] = useState({

    groupName: '', groupUrl: '', category: 'Đồ gia dụng & Gia đình',

    membersCount: 0, interactionRate: 'Cao', isAutoShare: true, notes: ''

  })



  const [viralPosts, setViralPosts] = useState([])

  const [fbViralSort, setFbViralSort] = useState('likes_desc') // likes_desc | likes_asc | name_asc | name_desc

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

    if (post.productId && !text.includes('omnicart.vn/products/')) text += `\n\n🛒 Đặt hàng online chính hãng: ${orderLink}`

    if (post.hashtags && !text.includes(post.hashtags)) text += '\n\n' + post.hashtags

    return text

  }



  const handleCopyPost = async (post) => {

    if (!post) return

    await copyPostToClipboard(formatPostText(post))

    markCopiedPost(post.id)

  }



  // Hỗ trợ gia hạn tự động timeout khi nhận tiến độ từ Extension (tương thích hoàn hảo bộ đếm trượt 5 phút!)

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

        action === 'FETCH_REAL_VIRAL' ? 360000 // 6 phút không có tiến độ (bộ đếm 5 phút bên trong sẽ tự kết thúc trước!)

          : action === 'SCRAPE_FB_GROUPS' ? 150000

            : action === 'AUTO_POST' ? 160000

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

        // Mỗi khi Extension báo tiến độ mới -> gia hạn đồng hồ chờ!

        if (event.data?.source === 'OMNICART_EXTENSION_PROGRESS' && action === 'FETCH_REAL_VIRAL') {

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

        setSettings(cur => ({ ...cur, ...resSettings.settings, privacy: resSettings.settings.privacy === 'public' ? 'public' : 'only_me' }))

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



  useEffect(() => { loadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps



  useEffect(() => {

    if (typeof window === 'undefined') return

    let disposed = false

    const pingExtension = async () => {

      if (disposed || extensionPingInFlightRef.current) return

      extensionPingInFlightRef.current = true

      try {

        const response = await sendExtensionMessage('PING')

        if (!disposed) setExtensionConnected(response?.ok === true && response?.data?.ok === true)

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

          showNotice(`🎉 TikTok đã duyệt bài #${payload.postId} thành công! Link thật: ${payload.postUrl}`)

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

        showNotice('Đã lưu cấu hình tự động hóa thành công!')

        const resStats = await apiJson('/api/admin/social/stats')

        if (resStats?.stats) setStats(resStats.stats)

      }

    } catch (err) { showNotice(err.message || 'Lỗi khi lưu cấu hình.', 'error') }

    finally { setLoading(false) }

  }



  const handleTriggerCycle = async () => {

    if (batchPosting || realPostingBusy) return

    try {

      setBatchPosting(true); setLoading(true)

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

            method: 'POST', headers: { 'x-csrf-token': csrfToken }

          })

          if (!res?.ok || !res.post) { results.push({ platform, ok: false, error: 'Máy chủ chưa tạo được bài AI.' }); continue }

          const result = await handleRealAutoPostThroughExtension(res.post)

          results.push({ platform, ...result })

        } catch (err) { results.push({ platform, ok: false, error: err.message }) }

      }

      const okCount = results.filter(r => r.ok).length

      const summary = results.map(r => r.ok

        ? (r.pendingReview ? `${r.platform}: đang theo dõi duyệt (~2-5p)` : `${r.platform}: ${r.postUrl}`)

        : `${r.platform}: lỗi (${r.error})`

      ).join(' | ')

      showNotice(`Hoàn tất ${okCount}/${platforms.length} kênh. ${summary}`, okCount === platforms.length ? 'success' : 'error')

      await loadAll()

      setActiveSubTab('logs')

    } catch (err) { showNotice(err.message || 'Lỗi kích hoạt chu kỳ.', 'error') }

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

        showNotice(`AI ${res.generated.generatedBy} đã tạo xong nội dung!`)

      }

    } catch (err) { showNotice(err.message || 'Không thể tạo nội dung từ AI.', 'error') }

    finally { setStudioGenerating(false) }

  }



  const handlePublishStudio = async (immediate = true) => {

    const targetPrivacy = privacyForSocialPlatform(studioPlatform, settings.privacy)

    if (!targetPrivacy) return showNotice('Kênh đăng bài không được hỗ trợ.', 'error')

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

      if (!res?.ok || !res.post?.id) throw new Error('Máy chủ chưa xác nhận lưu bản nháp.')

      showNotice('Đã lưu bản nháp chờ đăng.')

      await loadAll()

      setActiveSubTab('logs')

    } catch (err) { showNotice(err.message || 'Lỗi khi lưu bài viết.', 'error') }

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

          method: 'POST', headers: { 'x-csrf-token': csrfToken },

          body: JSON.stringify({

            productId: post.productId || '1', productName: post.productName || 'Sản phẩm OmniCart',

            productPrice: post.productPrice || 0, productImage, platform,

            title: post.title || '', content: post.content || '', hashtags: post.hashtags || '',

            privacy: targetPrivacy, publishImmediately: false

          })

        })

        if (!created?.ok || !created.post?.id) throw new Error('Máy chủ chưa lưu được bản nháp.')

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

        throw new Error('Chưa phát hiện Chrome Extension. Bản nháp đã lưu, bài chưa đăng.')

      }



      const result = reply?.data

      if (reply?.ok === true && result?.ok === true && result.pendingReview === true) {

        await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/pending-review`, {

          method: 'POST', headers: { 'x-csrf-token': csrfToken },

          body: JSON.stringify({

            platform, privacy: result.privacy || targetPrivacy,

            message: result.message || 'TikTok đang duyệt bài (~2–5 phút). Extension đang tự soi mỗi 30 giây để lấy link thật.'

          })

        })

        showNotice('⏳ TikTok đã nhận bài & đang duyệt (~2–5 phút). Extension sẽ tự lấy link thật và cập nhật thành công!', 'info')

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



      const confirmedPrivacy = result.privacy || targetPrivacy

      const saved = await apiJson(`/api/admin/social/posts/${encodeURIComponent(postId)}/publish-real`, {

        method: 'POST', headers: { 'x-csrf-token': csrfToken },

        body: JSON.stringify({

          postUrl: result.postUrl, publishedTime: result.publishedTime,

          platform, realPostId: result.realPostId, privacy: confirmedPrivacy

        })

      })

      if (!saved?.ok || saved.post?.status !== 'published') throw new Error('Chưa lưu được trạng thái đã đăng vào lịch sử.')



      showNotice(`✅ Đã đăng ${platform === 'facebook' ? 'Facebook' : 'TikTok'} thành công: ${result.postUrl}`)

      await loadAll()

      setActiveSubTab('logs')

      return { ok: true, platform, postUrl: result.postUrl }

    } catch (err) {

      const errorMessage = err.message || 'Lỗi khi đăng bài qua Extension'

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

    EXTENSION_CONTEXT_INVALIDATED: 'Extension vừa tải lại. Nhấn F5 để nối lại cầu nối.',

    PRODUCT_IMAGE_REQUIRED: 'Thiếu ảnh sản phẩm; bài chưa được đăng.',

    FACEBOOK_LOGIN_REQUIRED: 'Trình duyệt chưa đăng nhập Facebook.',

    TIKTOK_LOGIN_REQUIRED: 'Trình duyệt chưa đăng nhập TikTok.',

    FACEBOOK_NETWORK_OFFLINE: 'Tab Facebook đang mất mạng.',

    TIKTOK_NETWORK_OFFLINE: 'Tab TikTok đang mất mạng.',

    TIKTOK_DESCRIPTION_NOT_INSERTED: 'Không điền được Mô tả & Hashtag TikTok; đã dừng an toàn.',

    FACEBOOK_PUBLIC_NOT_CONFIRMED: 'Facebook chưa xác nhận đối tượng Công khai; đã dừng trước khi đăng.',

    FACEBOOK_ONLY_ME_NOT_CONFIRMED: 'Facebook chưa xác nhận đối tượng Chỉ mình tôi; đã dừng trước khi đăng.'

  }[code] || `Extension chưa xác nhận đăng thành công (${code}).`)



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



  // Cào 20 bài Viral thật (2 Tab FB >= 5K & TikTok >= 50K • Bộ đếm trượt 5 phút • Loại trừ bài đã có tránh trùng!)

  const handleScrapeRealViralThroughExtension = async () => {

    if (scrapingViralBusy) return

    try {

      setScrapingViralBusy(true)

      showNotice('🔥 Đang mở 2 Tab cào bài Viral thật (FB >=5K & TikTok >=50K • mỗi bài có 5 phút chờ & tự loại trừ bài đã có)...', 'info')

      const res = await sendExtensionMessage('FETCH_REAL_VIRAL', {

        platform: 'both',

        fbCount: 10,

        tiktokCount: 10,

        fbMinLikes: 5000,

        tiktokMinLikes: 50000,

        excludeUrls: viralPosts.map(v => v.postUrl).filter(Boolean)

      })

      if (res?.error === 'EXTENSION_NOT_DETECTED') {

        setShowExtensionHelp(true)

        throw new Error('Chưa kết nối Chrome Extension.')

      }



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

        showNotice(`🔥 Đã cào thêm bài viral mới không trùng: Facebook +${fbCount} bài (>=5K) • TikTok +${ttCount} bài (>=50K)!`)

        setActiveSubTab('groups')

      } else {

        showNotice('Sau 5 phút không cào được thêm bài viral mới nào đạt chuẩn (>=5K FB / >=50K TikTok).', 'error')

      }

    } catch (err) {

      showNotice(err.message || 'Lỗi khi cào bài viral qua Extension.', 'error')

    } finally { setScrapingViralBusy(false) }

  }



  // Tự động lấy 5 Hội nhóm Facebook mới (không trùng URL & tên, bắt buộc có số thành viên)

  const handleAutoScrape5FacebookGroups = async () => {

    if (scrapingGroupsBusy) return

    try {

      setScrapingGroupsBusy(true)

      showNotice('👥 Extension đang tìm 5 hội nhóm Facebook mới (có đủ số thành viên, không trùng)...', 'info')

      const res = await sendExtensionMessage('SCRAPE_FB_GROUPS', {

        count: 5,

        keyword: groupKeyword.trim(),

        excludeUrls: groups.map(g => g.groupUrl).filter(Boolean),

        excludeNames: groups.map(g => g.groupName).filter(Boolean)

      })

      if (res?.error === 'EXTENSION_NOT_DETECTED') { setShowExtensionHelp(true); throw new Error('Chưa kết nối Chrome Extension.') }

      if (!res?.ok) throw new Error(getExtensionPostErrorMessage(res?.error || 'GROUP_SCRAPE_FAILED'))



      const scrapedGroups = res?.data?.groups || []

      if (!scrapedGroups.length) {

        showNotice('Không tìm thấy thêm nhóm Facebook mới nào đủ thông tin thành viên. Thử nhập từ khóa khác rồi bấm lại.', 'info')

        return

      }

      const saved = await apiJson('/api/admin/social/groups/import-real', {

        method: 'POST', headers: { 'x-csrf-token': csrfToken },

        body: JSON.stringify({ groups: scrapedGroups })

      })

      if (saved?.groups) setGroups(saved.groups)

      showNotice(`✅ Đã lấy tự động & lưu ${saved?.addedCount ?? scrapedGroups.length} hội nhóm Facebook mới (đủ số thành viên)!`)

    } catch (err) { showNotice(err.message || 'Lỗi khi lấy 5 hội nhóm Facebook.', 'error') }

    finally { setScrapingGroupsBusy(false) }

  }



  const handleClearAllViralPosts = async () => {

    if (!viralPosts.length) return showNotice('Kho bài viral đang trống.', 'info')

    if (!window.confirm(`Xóa toàn bộ ${viralPosts.length} bài viral đã cào về?`)) return

    try {

      setLoading(true)

      const res = await apiJson('/api/admin/social/viral/clear-all', { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })

      if (res?.ok) { setViralPosts([]); showNotice('🗑️ Đã xóa sạch toàn bộ bài viral!') }

    } catch (err) { showNotice(err.message || 'Lỗi khi xóa bài viral.', 'error') }

    finally { setLoading(false) }

  }



  const handleClearAllPostLogs = async () => {

    if (!posts.length) return showNotice('Nhật ký đang trống.', 'info')

    if (!window.confirm(`Xóa toàn bộ ${posts.length} bản ghi trong Nhật ký báo cáo?`)) return

    try {

      setLoading(true)

      const res = await apiJson('/api/admin/social/posts/clear-all', { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })

      if (res?.ok) { setPosts([]); showNotice('🗑️ Đã xóa sạch toàn bộ nhật ký đăng bài!'); await loadAll() }

    } catch (err) { showNotice(err.message || 'Lỗi khi xóa nhật ký.', 'error') }

    finally { setLoading(false) }

  }



  const handleDeletePost = async (id) => {

    if (!window.confirm('Xóa bản ghi nhật ký này?')) return

    try {

      const res = await apiJson(`/api/admin/social/posts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })

      if (res?.ok) { showNotice('Đã xóa log bài đăng.'); await loadAll() }

    } catch (err) { showNotice(err.message || 'Lỗi khi xóa bài.', 'error') }

  }



  const handleAddGroup = async (e) => {

    e.preventDefault()

    if (!newGroup.groupName || !newGroup.groupUrl) return showNotice('Vui lòng điền tên và link nhóm Facebook.', 'error')

    try {

      const res = await apiJson('/api/admin/social/groups', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(newGroup) })

      if (res?.ok) {

        showNotice('Đã thêm nhóm Facebook!')

        setNewGroup({ groupName: '', groupUrl: '', category: 'Đồ gia dụng & Gia đình', membersCount: 0, interactionRate: 'Cao', isAutoShare: true, notes: '' })

        const updated = await apiJson('/api/admin/social/groups')

        if (updated?.groups) setGroups(updated.groups)

      }

    } catch (err) { showNotice(err.message || 'Lỗi khi thêm nhóm.', 'error') }

  }



  const handleToggleGroup = async (id, currentShare) => {

    try {

      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}/toggle`, {

        method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ isAutoShare: !currentShare })

      })

      if (res?.ok) { setGroups(prev => prev.map(g => g.id === id ? { ...g, isAutoShare: !currentShare } : g)); showNotice('Đã cập nhật trạng thái chia sẻ nhóm.') }

    } catch (err) { showNotice(err.message || 'Lỗi khi đổi trạng thái nhóm.', 'error') }

  }



  const handleDeleteGroup = async (id) => {

    if (!window.confirm('Xóa nhóm này?')) return

    try {

      const res = await apiJson(`/api/admin/social/groups/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })

      if (res?.ok) { setGroups(prev => prev.filter(g => g.id !== id)); showNotice('Đã xóa nhóm mục tiêu.') }

    } catch (err) { showNotice(err.message || 'Lỗi khi xóa nhóm.', 'error') }

  }



  // Xuất báo cáo định dạng file Excel (.xlsx) chuẩn từ Backend C#

  const handleExportExcel = () => {

    if (!posts.length) return showNotice('Không có dữ liệu bài đăng để xuất file Excel.', 'info')

    const params = new URLSearchParams()

    if (postFilterStatus !== 'all') params.set('status', postFilterStatus)

    if (postFilterPlatform !== 'all') params.set('platform', postFilterPlatform)

    const exportUrl = '/api/admin/social/posts/export' + (params.toString() ? `?${params.toString()}` : '')

    const link = document.createElement('a')

    link.href = exportUrl

    link.download = `Bao_Cao_Dang_Bai_MXH_${new Date().toISOString().slice(0, 10)}.xlsx`

    document.body.appendChild(link)

    link.click()

    document.body.removeChild(link)

    showNotice('📊 Đang tải xuống báo cáo file Excel (.xlsx)...')

  }



  const filteredPosts = useMemo(() => posts.filter(post =>

    (postFilterStatus === 'all' || post.status === postFilterStatus) &&

    (postFilterPlatform === 'all' || post.platform === postFilterPlatform)

  ), [posts, postFilterStatus, postFilterPlatform])



  // Lọc & Sắp xếp Hội nhóm Facebook theo Tên hoặc Số lượng thành viên

  const filteredAndSortedGroups = useMemo(() => {

    const q = groupSearch.trim().toLowerCase()

    const list = q

      ? groups.filter(g => g.groupName.toLowerCase().includes(q) || (g.category || '').toLowerCase().includes(q))

      : [...groups]



    return list.sort((a, b) => {

      if (groupSort === 'name_asc') return String(a.groupName || '').localeCompare(String(b.groupName || ''), 'vi')

      if (groupSort === 'name_desc') return String(b.groupName || '').localeCompare(String(a.groupName || ''), 'vi')

      if (groupSort === 'members_asc') return Number(a.membersCount || 0) - Number(b.membersCount || 0)

      return Number(b.membersCount || 0) - Number(a.membersCount || 0)

    })

  }, [groups, groupSearch, groupSort])



  // Sắp xếp độc lập 2 cột Bài Viral (Facebook & TikTok) theo Tên hoặc Lượt tương tác/tim

  const sortViralList = (list, sortMode) => {

    return [...list].sort((a, b) => {

      if (sortMode === 'name_asc') return String(a.title || '').localeCompare(String(b.title || ''), 'vi')

      if (sortMode === 'name_desc') return String(b.title || '').localeCompare(String(a.title || ''), 'vi')

      if (sortMode === 'likes_asc') return Number(a.likesCount || 0) - Number(b.likesCount || 0)

      return Number(b.likesCount || 0) - Number(a.likesCount || 0)

    })

  }



  const facebookViralTop10 = useMemo(

    () => sortViralList(viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'facebook'), fbViralSort).slice(0, 10),

    [viralPosts, fbViralSort]

  )

  const tiktokViralTop10 = useMemo(

    () => sortViralList(viralPosts.filter(v => String(v.platform || '').toLowerCase() === 'tiktok'), ttViralSort).slice(0, 10),

    [viralPosts, ttViralSort]

  )



  const formatTime = (isoString) => {

    if (!isoString) return 'Chưa ghi nhận'

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

            <button type="button" className="social-btn-trigger" onClick={handleTriggerCycle} disabled={loading || realPostingBusy || batchPosting}>

              ⚡ Đăng Thật 2 Bài: Facebook + TikTok

            </button>

            <button type="button" className="social-btn-secondary" onClick={loadAll} disabled={loading}>🔄 Làm Mới</button>

          </div>

        </div>

        <div className="social-kpi-grid">

          <div className="social-kpi-card"><small>Đã đăng xác minh</small><strong>{stats.publishedCount} bài</strong></div>

          <div className="social-kpi-card"><small>Chờ duyệt / Đang xử lý</small><strong>{stats.pendingCount} bài</strong></div>

          <div className="social-kpi-card"><small>Tổng Lượt Thích</small><strong>{stats.totalLikes.toLocaleString('vi-VN')}</strong></div>

          <div className="social-kpi-card"><small>Tổng Lượt Chia Sẻ</small><strong>{stats.totalShares.toLocaleString('vi-VN')}</strong></div>

          <div className="social-kpi-card"><small>Tổng Bình Luận</small><strong>{stats.totalComments.toLocaleString('vi-VN')}</strong></div>

          <div className="social-kpi-card"><small>Chu kỳ kế tiếp</small><strong style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{stats.nextRunAt ? formatTime(stats.nextRunAt) : 'Chưa xếp lịch'}</strong></div>

        </div>

      </section>



      {/* Extension Bridge Bar */}

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

              <strong style={{ fontSize: '13px' }}>OmniVision Bridge v3.1 (Đa Tài Khoản • Online 24/7)</strong>

              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: extensionConnected ? '#10b981' : '#f59e0b', color: '#fff' }}>

                {extensionConnected ? '🟢 Đã kết nối 24/7' : '🟡 Đang chờ Chrome Extension'}

              </span>

            </div>

            <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.9 }}>

              Hoạt động với <strong>bất kỳ tài khoản Facebook & TikTok nào đang đăng nhập</strong> • Tự theo dõi duyệt bài TikTok (~2–5p) • Cào Viral bộ đếm trượt 5 phút chống trùng.

            </p>

          </div>

        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

          <button type="button" className="social-btn-trigger" style={{ fontSize: '12px', padding: '6px 12px' }} disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content} onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'facebook' })}>🚀 Đăng Thật FB</button>

          <button type="button" className="social-btn-trigger" style={{ fontSize: '12px', padding: '6px 12px', background: '#000', borderColor: '#fe2c55', color: '#fe2c55' }} disabled={realPostingBusy || batchPosting || !studioDraft.productImage || !studioDraft.content} onClick={() => handleRealAutoPostThroughExtension({ ...studioDraft, platform: 'tiktok' })}>🚀 Đăng Thật TikTok</button>

          <button type="button" className="social-btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', background: '#0f172a', borderColor: '#334155', color: '#38bdf8' }} disabled={scrapingViralBusy} onClick={handleScrapeRealViralThroughExtension}>

            {scrapingViralBusy ? '⏳ Đang cào 2 Tab...' : '🔥 Cào 20 Bài Viral (2 Tab)'}

          </button>

          <button type="button" className="social-btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#fff' }} onClick={() => setShowExtensionHelp(true)}>📖 Hướng dẫn</button>

        </div>

      </section>



      {/* Subnav */}

      <nav className="social-subnav" aria-label="Phân hệ tiếp thị MXH">

        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'settings' ? 'is-active' : '')} onClick={() => setActiveSubTab('settings')}>⚙️ Cấu Hình Tự Động Hóa</button>

        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'studio' ? 'is-active' : '')} onClick={() => setActiveSubTab('studio')}>✍️ AI Copywriting Studio</button>

        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'groups' ? 'is-active' : '')} onClick={() => setActiveSubTab('groups')}>👥 Hội Nhóm Facebook & Bài Viral ({viralPosts.length})</button>

        <button type="button" className={'social-subnav-btn ' + (activeSubTab === 'logs' ? 'is-active' : '')} onClick={() => setActiveSubTab('logs')}>📋 Nhật Ký Đăng Bài & Báo Cáo ({posts.length})</button>

      </nav>



      {/* TAB 1: CẤU HÌNH */}

      {activeSubTab === 'settings' && (

        <section className="social-panel">

          <div className="social-panel__heading"><h3>⚙️ Thiết Lập Lịch Trình & Phong Cách Đăng Bài Tự Động</h3></div>

          <div className="social-info-banner">

            <strong>ℹ️ Chế độ vận hành 24/7 đa tài khoản:</strong>

            Tự nhận diện nick Facebook & TikTok đang đăng nhập, tự về trang cá nhân / tự cuộn lên đầu trang khi cần, tự theo dõi bài TikTok vừa đăng đến khi duyệt xong để lấy link thật.

          </div>

          <form onSubmit={handleSaveSettings}>

            <div className="social-form-grid">

              <div className="social-field"><label htmlFor="cfg-status">Trạng thái tự động hóa</label><select id="cfg-status" className="social-select" value={settings.isActive ? '1' : '0'} onChange={e => setSettings({ ...settings, isActive: e.target.value === '1' })}><option value="1">🟢 Bật - Tự động theo chu kỳ</option><option value="0">🔴 Tắt - Tạm dừng toàn bộ</option></select></div>

              <div className="social-field"><label htmlFor="cfg-mode">Chế độ vận hành</label><select id="cfg-mode" className="social-select" value={settings.mode} onChange={e => setSettings({ ...settings, mode: e.target.value })}><option value="full_auto">🚀 Hoàn toàn tự động (Full-Auto)</option><option value="semi_auto">📝 Duyệt trước (Semi-Auto)</option></select></div>

              <div className="social-field"><label htmlFor="cfg-interval">Chu kỳ đăng bài</label><select id="cfg-interval" className="social-select" value={currentIntervalKey} onChange={e => handleIntervalChange(e.target.value)}><option value="2m">⚡ Mỗi 2 phút (kiểm thử nhanh)</option><option value="1">🕐 Mỗi 1 giờ</option><option value="4">🕓 Mỗi 4 giờ</option></select></div>

              <div className="social-field"><label htmlFor="cfg-privacy">Quyền riêng tư áp dụng cho tất cả nền tảng</label><select id="cfg-privacy" className="social-select" value={settings.privacy || 'only_me'} onChange={e => setSettings({ ...settings, privacy: e.target.value })}><option value="only_me">🔒 Chỉ mình tôi</option><option value="public">🌐 Công khai</option></select></div>

              <div className="social-field"><label htmlFor="cfg-channels">Kênh xuất bản</label><select id="cfg-channels" className="social-select" value={settings.channels} onChange={e => setSettings({ ...settings, channels: e.target.value })}><option value="facebook,tiktok">Đa kênh: Facebook + TikTok</option><option value="facebook">Chỉ Facebook</option><option value="tiktok">Chỉ TikTok</option></select></div>

              <div className="social-field"><label htmlFor="cfg-category">Danh mục sản phẩm ưu tiên</label><select id="cfg-category" className="social-select" value={settings.preferredCategory} onChange={e => setSettings({ ...settings, preferredCategory: e.target.value })}><option value="all">Tất cả sản phẩm</option><option value="Đồ gia dụng">Đồ gia dụng</option><option value="Thời trang">Thời trang</option><option value="Công nghệ">Công nghệ</option></select></div>

              <div className="social-field"><label htmlFor="cfg-tone">Phong cách văn chương</label><select id="cfg-tone" className="social-select" value={settings.toneStyle} onChange={e => setSettings({ ...settings, toneStyle: e.target.value })}><option value="viral_engaging">Bắt trend và tương tác cao</option><option value="humorous">Hài hước, dí dỏm</option><option value="fomo_sales">Kêu gọi chốt đơn gấp</option><option value="authentic_review">Review chân thực</option><option value="storytelling">Kể chuyện truyền cảm hứng</option></select></div>

              <div className="social-field"><label htmlFor="cfg-hotline">Số Hotline liên hệ</label><input id="cfg-hotline" type="text" className="social-input" value={settings.contactHotline} onChange={e => setSettings({ ...settings, contactHotline: e.target.value })} /></div>

              <div className="social-field"><label htmlFor="cfg-link">Mẫu liên kết đặt hàng</label><input id="cfg-link" type="text" className="social-input" value={settings.orderLinkTemplate} onChange={e => setSettings({ ...settings, orderLinkTemplate: e.target.value })} /></div>

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

              <button type="submit" className="social-btn-trigger" style={{ padding: '12px 24px', fontSize: '13px' }} disabled={loading}>💾 Lưu Cấu Hình Tự Động Hóa</button>

              <span className="social-muted-text">Lần cập nhật cuối: {formatTime(settings.updatedAt)}</span>

            </div>

          </form>

        </section>

      )}



      {/* TAB 2: STUDIO */}

      {activeSubTab === 'studio' && (

        <section className="social-panel">

          <div className="social-panel__heading"><h3>✍️ Trình Sáng Tạo Nội Dung Bán Hàng Bằng Local Qwen AI</h3></div>

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

                  <option value="humorous">Hài hước, dí dỏm</option>

                  <option value="fomo_sales">Kêu gọi chốt đơn gấp</option>

                  <option value="authentic_review">Review chân thực 100%</option>

                  <option value="storytelling">Kể chuyện truyền cảm hứng</option>

                </select>

              </div>

              {studioPlatform === 'facebook' && (

                <div className="social-field">

                  <label htmlFor="studio-target-group">Nhóm Facebook mục tiêu</label>

                  <select id="studio-target-group" className="social-select" value={studioTargetGroup} onChange={e => setStudioTargetGroup(e.target.value)}>

                    <option value="">Tự động chọn nhóm kích hoạt</option>

                    {groups.map(grp => <option key={grp.id} value={grp.groupName}>{grp.groupName} ({grp.membersCount.toLocaleString('vi-VN')} tv)</option>)}

                  </select>

                </div>

              )}

              <div className="social-field">

                <label htmlFor="studio-topic">Yêu cầu riêng và Chủ đề bổ sung</label>

                <input id="studio-topic" type="text" className="social-input" value={studioTopic} onChange={e => setStudioTopic(e.target.value)} placeholder="Ví dụ: Bảo hành 1 đổi 1, tặng quà..." />

              </div>

              <button type="button" className="social-btn-trigger" style={{ padding: '12px', fontSize: '13px', justifyContent: 'center' }} onClick={handleGenerateStudio} disabled={studioGenerating}>

                {studioGenerating ? '⏳ Qwen AI Đang Viết Bài...' : '⚡ Local Qwen AI Viết Bài Mới'}

              </button>

              <div className="social-field">

                <label htmlFor="studio-draft-content">Nội dung có thể chỉnh sửa trước khi đăng:</label>

                <textarea id="studio-draft-content" className="social-textarea" rows={8} value={studioDraft.content} onChange={e => setStudioDraft({ ...studioDraft, content: e.target.value })} />

              </div>

              <div style={{ display: 'flex', gap: '10px' }}>

                <button type="button" className="social-btn-trigger" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(true)} disabled={loading || realPostingBusy || batchPosting}>🚀 Đăng Ngay</button>

                <button type="button" className="social-action-btn" style={{ flex: 1, padding: '10px', justifyContent: 'center' }} onClick={() => handlePublishStudio(false)} disabled={loading || realPostingBusy || batchPosting}>⏳ Lưu Bản Nháp</button>

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

                <div className="preview-media"><img src={studioDraft.productImage || '/products/headphones.svg'} alt={studioDraft.productName} onError={e => { e.currentTarget.src = '/products/bag.svg' }} /></div>

                <div className="preview-footer"><span>👍 Thích (0)</span><span>💬 Bình luận (0)</span><span>🔁 Chia sẻ (0)</span></div>

              </div>

            </div>

          </div>

        </section>

      )}



      {/* TAB 3: HỘI NHÓM (CÓ BỘ SẮP XẾP) & KHO VIRAL CHIA ĐÔI (CÓ BỘ SẮP XẾP ĐỘC LẬP TỪNG BÊN) */}

      {activeSubTab === 'groups' && (

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* PHẦN 1: HỘI NHÓM FACEBOOK */}

          <section className="social-panel">

            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

              <h3>👥 Danh Sách Hội Nhóm Facebook Mục Tiêu</h3>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

                <input

                  type="text" className="social-input" style={{ width: '210px', padding: '7px 10px' }}

                  placeholder="Từ khóa tìm nhóm (tùy chọn)..."

                  value={groupKeyword} onChange={e => setGroupKeyword(e.target.value)}

                />

                <button type="button" className="social-btn-trigger" onClick={handleAutoScrape5FacebookGroups} disabled={scrapingGroupsBusy} style={{ fontSize: '12px', padding: '8px 14px' }}>

                  {scrapingGroupsBusy ? '⏳ Đang tìm 5 nhóm mới...' : '🔍 Tự động lấy 5 hội nhóm Facebook'}

                </button>

              </div>

            </div>



            {/* Thanh tìm kiếm + Bộ sắp xếp nhỏ cho Hội nhóm */}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>

              <input

                type="search" className="social-input" style={{ maxWidth: '300px' }}

                placeholder="🔍 Lọc nhóm đã lưu..."

                value={groupSearch} onChange={e => setGroupSearch(e.target.value)}

              />

              <div className="social-sort-bar">

                <label htmlFor="sort-groups">Sắp xếp:</label>

                <select id="sort-groups" className="social-sort-select" value={groupSort} onChange={e => setGroupSort(e.target.value)}>

                  <option value="members_desc">👥 Thành viên (Nhiều → Ít)</option>

                  <option value="members_asc">👥 Thành viên (Ít → Nhiều)</option>

                  <option value="name_asc">🔤 Tên nhóm (A → Z)</option>

                  <option value="name_desc">🔤 Tên nhóm (Z → A)</option>

                </select>

              </div>

              <span className="social-muted-text" style={{ marginLeft: 'auto' }}>Tổng cộng {filteredAndSortedGroups.length} nhóm</span>

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

                          {grp.isAutoShare ? '✓ Đang bật' : '○ Đang tắt'}

                        </button>

                      </td>

                      <td className="social-muted-text" style={{ fontSize: '11px' }}>{grp.notes || '—'}</td>

                      <td><button type="button" className="social-action-btn social-action-btn--danger" onClick={() => handleDeleteGroup(grp.id)}>Xóa</button></td>

                    </tr>

                  ))}

                  {filteredAndSortedGroups.length === 0 && (

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



          {/* PHẦN 2: KHO BÀI VIRAL CHIA ĐÔI 2 CỘT + BỘ SẮP XẾP NHỎ CHO CẢ 2 BÊN */}

          <section className="social-panel">

            <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

              <div>

                <h3>🔥 Kho Bài Đăng Viral Thật (Chia Đôi: 10 Facebook ≥ 5K • 10 TikTok ≥ 50K)</h3>

                <p>Mỗi lần bấm cào có bộ đếm trượt 5 phút (cào được 1 bài tự reset lại 5 phút) • Mở 2 Tab riêng • Tự lọc bài trùng.</p>

              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>

                <button type="button" className="social-btn-trigger" onClick={handleScrapeRealViralThroughExtension} disabled={scrapingViralBusy || loading} style={{ fontSize: '12px', padding: '8px 14px' }}>

                  {scrapingViralBusy ? '⏳ Đang cào 2 Tab (5p trượt)...' : '⚡ Cào 20 Bài Viral Thật (2 Tab FB + TikTok)'}

                </button>

                <button type="button" className="social-action-btn social-action-btn--danger" onClick={handleClearAllViralPosts} disabled={loading || viralPosts.length === 0} style={{ fontSize: '12px', padding: '8px 14px' }}>

                  🗑️ Xóa toàn bộ bài viral ({viralPosts.length})

                </button>

              </div>

            </div>



            <div className="social-viral-split-grid">

              {/* CỘT TRÁI: FACEBOOK VIRAL + BỘ SẮP XẾP */}

              <div className="social-viral-column">

                <div className="social-viral-column__head social-viral-column__head--fb">

                  <span>📘 Facebook Viral (≥ 5.000 tương tác)</span>

                  <div className="social-viral-head-tools">

                    <select aria-label="Sắp xếp bài viral Facebook" className="social-sort-select social-sort-select--mini" value={fbViralSort} onChange={e => setFbViralSort(e.target.value)}>

                      <option value="likes_desc">👍 Cảm xúc (Cao → Thấp)</option>

                      <option value="likes_asc">👍 Cảm xúc (Thấp → Cao)</option>

                      <option value="name_asc">🔤 Tên bài (A → Z)</option>

                      <option value="name_desc">🔤 Tên bài (Z → A)</option>

                    </select>

                    <span className="social-viral-count">{facebookViralTop10.length} / 10 bài</span>

                  </div>

                </div>

                <div className="social-table-shell social-table-shell--compact">

                  <table className="social-table">

                    <thead><tr><th>#</th><th>Bài đăng & Nội dung</th><th>Tương tác</th><th>Link</th></tr></thead>

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

                            <div>👍 <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></div>

                            <div className="social-muted-text">💬 {Number(v.commentsCount || 0).toLocaleString('vi-VN')} · 🔁 {Number(v.sharesCount || 0).toLocaleString('vi-VN')}</div>

                          </td>

                          <td style={{ whiteSpace: 'nowrap' }}>

                            <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">Mở bài ↗</a>

                          </td>

                        </tr>

                      ))}

                      {facebookViralTop10.length === 0 && (

                        <tr><td colSpan={4} className="social-table-empty">Chưa có bài Facebook ≥ 5K tương tác.</td></tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </div>



              {/* CỘT PHẢI: TIKTOK VIRAL + BỘ SẮP XẾP */}

              <div className="social-viral-column">

                <div className="social-viral-column__head social-viral-column__head--tt">

                  <span>🎵 TikTok Viral (≥ 50.000 tim)</span>

                  <div className="social-viral-head-tools">

                    <select aria-label="Sắp xếp bài viral TikTok" className="social-sort-select social-sort-select--mini" value={ttViralSort} onChange={e => setTtViralSort(e.target.value)}>

                      <option value="likes_desc">❤️ Tim (Cao → Thấp)</option>

                      <option value="likes_asc">❤️ Tim (Thấp → Cao)</option>

                      <option value="name_asc">🔤 Tên bài (A → Z)</option>

                      <option value="name_desc">🔤 Tên bài (Z → A)</option>

                    </select>

                    <span className="social-viral-count">{tiktokViralTop10.length} / 10 bài</span>

                  </div>

                </div>

                <div className="social-table-shell social-table-shell--compact">

                  <table className="social-table">

                    <thead><tr><th>#</th><th>Video / Ảnh Viral</th><th>Lượt Tim</th><th>Link</th></tr></thead>

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

                            <div>❤️ <strong>{Number(v.likesCount || 0).toLocaleString('vi-VN')}</strong></div>

                            <div className="social-muted-text">💬 {Number(v.commentsCount || 0).toLocaleString('vi-VN')} · 🔁 {Number(v.sharesCount || 0).toLocaleString('vi-VN')}</div>

                          </td>

                          <td style={{ whiteSpace: 'nowrap' }}>

                            <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">Mở video ↗</a>

                          </td>

                        </tr>

                      ))}

                      {tiktokViralTop10.length === 0 && (

                        <tr><td colSpan={4} className="social-table-empty">Chưa có bài TikTok ≥ 50K tim.</td></tr>

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            </div>

          </section>

        </div>

      )}



      {/* TAB 4: NHẬT KÝ ĐĂNG BÀI & XUẤT EXCEL (.XLSX) + XÓA TOÀN BỘ */}

      {activeSubTab === 'logs' && (

        <section className="social-panel">

          <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

            <h3>📋 Báo Cáo Chi Tiết & Lịch Sử Đăng Bài</h3>

            <button type="button" className="social-action-btn social-action-btn--danger" onClick={handleClearAllPostLogs} disabled={loading || posts.length === 0} style={{ fontSize: '12px', padding: '7px 14px' }}>

              🗑️ Xóa toàn bộ nhật ký đăng bài ({posts.length})

            </button>

          </div>



          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>

              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trạng thái:</span>

              <select className="social-select" style={{ width: '220px' }} value={postFilterStatus} onChange={e => setPostFilterStatus(e.target.value)}>

                <option value="all">Tất cả trạng thái</option>

                <option value="published">🟢 Đã đăng (Có link thật)</option>

                <option value="pending_review">⏳ Chờ TikTok duyệt (2–5p)</option>

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

            <button type="button" className="social-action-btn social-action-btn--primary" onClick={handleExportExcel} title="Tải xuống báo cáo lịch sử đăng bài định dạng Microsoft Excel (.xlsx)">

              📊 Xuất Báo Cáo Excel (.xlsx)

            </button>

            <span className="social-muted-text" style={{ marginLeft: 'auto' }}>Hiển thị {filteredPosts.length} / {posts.length} bài đăng</span>

          </div>



          <div className="social-table-shell">

            <table className="social-table">

              <thead>

                <tr>

                  <th>Thời gian</th><th>Kênh</th><th>Sản phẩm</th><th>Nội dung bài viết</th><th>Vị trí</th>

                  <th>Trạng thái</th><th>Tương tác</th><th>Link bài viết</th><th>Hành động</th>

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

                      <div style={{ maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{p.title}</div>

                      <button type="button" className="social-modal-open-btn" onClick={() => setSelectedPostModal(p)}>Xem toàn bộ nội dung ↗</button>

                    </td>

                    <td className="social-muted-text" style={{ fontSize: '11.5px' }}>{p.targetGroup || 'Trang cá nhân đang đăng nhập'}</td>

                    <td>

                      <span className={'status-tag status-tag--' + p.status} title={p.errorMessage || ''}>

                        {p.status === 'published' ? '🟢 Đã đăng'

                          : p.status === 'pending_review' ? '⏳ Chờ duyệt (2–5p)'

                            : p.status === 'unverified' ? '⚠️ Chưa xác minh'

                              : p.status === 'ready_for_publish' || p.status === 'ready_for_api' ? '⏳ Chờ xuất bản'

                                : p.status === 'internal_draft' ? '📝 Bản Nháp'

                                  : p.status === 'pending_approval' ? '🟡 Chờ duyệt' : '🔴 Lỗi'}

                      </span>

                    </td>

                    <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>👍 {p.likesCount} · 🔁 {p.sharesCount} · 💬 {p.commentsCount}</td>

                    <td>

                      {p.postUrl ? (

                        <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">

                          {p.platform === 'facebook' ? 'Bài Facebook ↗' : 'Bài TikTok ↗'}

                        </a>

                      ) : (

                        <span className="social-muted-text">{p.status === 'pending_review' ? 'Đang soi duyệt...' : 'Chưa đăng thật'}</span>

                      )}

                      {p.errorMessage && <small className="social-muted-text" style={{ display: 'block', maxWidth: '185px', whiteSpace: 'normal' }}>{p.errorMessage}</small>}

                    </td>

                    <td>

                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>

                        <button type="button" className="social-action-btn" onClick={() => handleCopyPost(p)} style={{ fontSize: '11px' }}>{copiedPostId === p.id ? '✓ Đã chép' : '📋 Chép'}</button>

                        {p.status !== 'pending_review' && (

                          <button type="button" className="social-action-btn social-action-btn--primary" onClick={() => handleRealAutoPostThroughExtension(p)} style={{ fontSize: '11px' }} disabled={realPostingBusy || batchPosting}>

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

              {selectedPostModal.postUrl && <a href={selectedPostModal.postUrl} target="_blank" rel="noopener noreferrer" className="social-btn-trigger" style={{ textDecoration: 'none' }}>Mở Bài Viết Thật ↗</a>}

              <button type="button" className="social-action-btn" onClick={() => setSelectedPostModal(null)}>Đóng</button>

            </div>

          </div>

        </div>

      )}



      {/* Modal Hướng dẫn */}

      {showExtensionHelp && (

        <div className="social-modal-overlay" onClick={() => setShowExtensionHelp(false)}>

          <div className="social-modal-card" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>

            <div className="social-modal-head">

              <h3>👁️ Hướng Dẫn Cài Đặt OmniVision Bridge v3.1</h3>

              <button type="button" className="social-modal-close" onClick={() => setShowExtensionHelp(false)}>✕</button>

            </div>

            <div style={{ fontSize: '13px', lineHeight: 1.65 }}>

              <ol style={{ paddingLeft: '20px', margin: '0 0 12px' }}>

                <li>Mở <code>chrome://extensions/</code> và bật <strong>Developer mode</strong>.</li>

                <li>Chọn <strong>Load unpacked</strong> vào thư mục <code>Store-Admin/extension</code> (hoặc bấm <strong>Reload ↻</strong> lên bản <strong>3.1.0</strong>).</li>

                <li>Đăng nhập bất kỳ tài khoản Facebook & TikTok nào trên cùng trình duyệt Chrome này.</li>

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
