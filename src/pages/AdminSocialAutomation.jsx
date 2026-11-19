/*
  FILE NOTE
  - Mục đích: Module Quản trị Tự động hóa đăng bài Mạng Xã Hội (Facebook, TikTok), cấu hình chu kỳ linh hoạt (5m, 30m, 1h, 2h, 6h), tùy chọn quyền riêng tư Chỉ mình tôi / Công khai, hiển thị trung thực không số liệu ảo, hỗ trợ trực tiếp đăng bài lên Facebook và Dark Mode toàn diện.
  - Liên kết trực tiếp: Store-Admin/src/pages/Admin.jsx, Store-Admin/src/pages/AdminSocialAutomation.css, Store-Admin/src/api/chat.js, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs
  - Vùng ảnh hưởng khi sửa: Trải nghiệm người dùng quản trị khi chuyển qua tab Tự động đăng bài MXH, gửi nhận API mạng xã hội, quy trình đăng bài Facebook và cập nhật báo cáo tương tác.
*/

import { useEffect, useState, useMemo, useRef } from 'react'
import { apiJson } from '../api/chat'
import './AdminSocialAutomation.css'

export default function AdminSocialAutomation({ csrfToken, language = 'vi' }) {
  const [activeSubTab, setActiveSubTab] = useState('settings') // 'settings' | 'studio' | 'groups' | 'logs'
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

  // Settings State
  const [settings, setSettings] = useState({
    id: 1,
    isActive: true,
    mode: 'full_auto',
    intervalHours: 2,
    intervalMinutes: 120,
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

  // Posts / Logs State
  const [posts, setPosts] = useState([])
  const [postFilterStatus, setPostFilterStatus] = useState('all')
  const [postFilterPlatform, setPostFilterPlatform] = useState('all')
  const [selectedPostModal, setSelectedPostModal] = useState(null)
  const [copiedPostId, setCopiedPostId] = useState(null)

  const formatPostText = (post) => {
    if (!post) return ''
    let text = (post.content || '').trim()
    if (post.title && !text.includes(post.title)) {
      text = post.title + '\n\n' + text
    }
    if (post.hashtags && !text.includes(post.hashtags)) {
      text = text + '\n\n' + post.hashtags
    }
    return text
  }

  const handleCopyPost = (post) => {
    if (!post) return
    const fullText = formatPostText(post)
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      try { navigator.clipboard.writeText(fullText) } catch (_) {}
    }
    setCopiedPostId(post.id)
    setTimeout(() => setCopiedPostId(null), 2500)
  }

  // Groups State
  const [groups, setGroups] = useState([])
  const [groupSearch, setGroupSearch] = useState('')
  const [newGroup, setNewGroup] = useState({
    groupName: '',
    groupUrl: '',
    category: 'Đồ gia dụng & Gia đình',
    membersCount: 0,
    interactionRate: 'Cao',
    isAutoShare: true,
    notes: ''
  })

  // Viral Posts State
  const [viralPosts, setViralPosts] = useState([])
  const [newViral, setNewViral] = useState({
    title: '',
    platform: 'facebook',
    category: 'Đồ gia dụng',
    postUrl: '',
    summary: '',
    viralityScore: 95,
    likesCount: 0,
    sharesCount: 0,
    commentsCount: 0,
    trendingTopic: 'Tiện ích đời sống'
  })

  // Helper chuyển đổi mốc chu kỳ linh hoạt: 5m, 30m, 1h, 2h, 3h, 6h
  const handleIntervalChange = (val) => {
    let min = 120
    let hrs = 2
    if (val === '5m') { min = 5; hrs = 5 / 60 }
    else if (val === '30m') { min = 30; hrs = 0.5 }
    else if (val === '1') { min = 60; hrs = 1 }
    else if (val === '2') { min = 120; hrs = 2 }
    else if (val === '3') { min = 180; hrs = 3 }
    else if (val === '6') { min = 360; hrs = 6 }
    else {
      const parsed = Number(val) || 2
      min = parsed >= 5 ? parsed : parsed * 60
      hrs = min / 60
    }
    setSettings(prev => ({ ...prev, intervalMinutes: min, intervalHours: hrs }))
  }

  const currentIntervalKey = useMemo(() => {
    if (settings.intervalMinutes === 5) return '5m'
    if (settings.intervalMinutes === 30) return '30m'
    if (settings.intervalMinutes === 60) return '1'
    if (settings.intervalMinutes === 120) return '2'
    if (settings.intervalMinutes === 180) return '3'
    if (settings.intervalMinutes === 360) return '6'
    if (settings.intervalHours < 0.2) return '5m'
    if (Math.abs(settings.intervalHours - 0.5) < 0.1) return '30m'
    return String(Math.round(settings.intervalHours || 2))
  }, [settings.intervalMinutes, settings.intervalHours])

  // AI Studio State
  const [studioPlatform, setStudioPlatform] = useState('facebook')
  const [studioTone, setStudioTone] = useState('viral_engaging')
  const [studioTopic, setStudioTopic] = useState('')
  const [studioTargetGroup, setStudioTargetGroup] = useState('')
  const [studioGenerating, setStudioGenerating] = useState(false)
  const [studioDraft, setStudioDraft] = useState({
    productId: '1',
    title: '✨ BẬT MOOD NĂNG ĐỘNG CÙNG TAI NGHE OMIPRO CHỐNG ỒN',
    content: '🔥 DEAL XỊN MỖI NGÀY TẠI OMNICART 🔥\n\nBạn đang tìm kiếm chiếc tai nghe vừa êm ái, pin trâu lại chống ồn chủ động đỉnh chóp? OmiPro chính là chân ái!\n\n✨ Âm thanh vòm sống động, bass sâu sắc nét.\n✨ Thiết kế công thái học đeo cả ngày không cấn tai.\n✨ Thời lượng pin lên đến 36 giờ kèm hộp sạc nhanh.\n\n👉 Giá siêu ưu đãi: 890.000đ (Giá gốc 1.250.000đ)\n📞 Hotline tư vấn: 0901.234.567\n🛒 Đặt mua giao nhanh trong 2h: https://omnicart.vn/products/1\n\n#OmniCart #TaiNgheBluetooth #DealHot #GiaDungThongMinh #CongNghe2026',
    hashtags: '#OmniCart #TaiNgheBluetooth #DealHot #CongNghe2026',
    productName: 'Tai nghe Bluetooth Chống Ồn OmiPro',
    productPrice: 890000,
    productImage: '/products/headphones.svg',
    generatedBy: 'Local Qwen 4B'
  })

  // UI Alerts
  const [alertMessage, setAlertMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const noticeTimerRef = useRef(null)

  const showNotice = (text, type = 'success') => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    setAlertMessage({ text, type })
    noticeTimerRef.current = setTimeout(() => setAlertMessage(null), 4500)
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  // Load All Data
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
      if (resSettings?.settings) setSettings(resSettings.settings)
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

  // Save Settings
  const handleSaveSettings = async (e) => {
    e?.preventDefault()
    try {
      setLoading(true)
      const res = await apiJson('/api/admin/social/settings', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify(settings)
      })
      if (res?.settings) {
        setSettings(res.settings)
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

  // Trigger Immediate Cycle
  const handleTriggerCycle = async () => {
    try {
      setLoading(true)
      showNotice('Đang kích hoạt chu kỳ đăng bài tự động bằng Qwen AI...', 'info')
      const res = await apiJson('/api/admin/social/trigger-cycle?platform=facebook', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        showNotice('Đã chạy xong 1 chu kỳ đăng bài tự động cho Facebook và ghi nhận log!')
        await loadAll()
        setActiveSubTab('logs')
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi kích hoạt chu kỳ.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // AI Generate in Studio
  const handleGenerateStudio = async () => {
    try {
      setStudioGenerating(true)
      const res = await apiJson('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          platform: studioPlatform,
          toneStyle: studioTone,
          customTopic: studioTopic
        })
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

  // Publish from Studio
  const handlePublishStudio = async (immediate = true) => {
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
          privacy: settings.privacy || 'only_me',
          publishImmediately: immediate
        })
      })

      if (res?.ok) {
        if (immediate && studioPlatform === 'facebook') {
          const fullText = formatPostText(studioDraft)
          if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
            try { await navigator.clipboard.writeText(fullText) } catch (_) {}
          }
          const targetUrl = res.post?.postUrl || 'https://www.facebook.com/groups/feed/'
          if (typeof window !== 'undefined' && typeof window.open === 'function') {
            try { window.open(targetUrl, '_blank') } catch (_) {}
          }
          showNotice('Đã xuất bản bài viết lên Facebook! Đã sao chép nội dung và mở nhóm/trang Facebook.')
        } else {
          showNotice(immediate ? 'Đã tạo và đăng bài viết thành công!' : 'Đã lưu bài viết vào hàng đợi chờ duyệt!')
        }
        await loadAll()
        setActiveSubTab('logs')
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi lưu bài viết.', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Publish / Post Actions
  const handlePublishPost = async (post) => {
    try {
      setLoading(true)
      const res = await apiJson(`/api/admin/social/posts/${encodeURIComponent(post.id)}/publish`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        if ((post.platform || '').toLowerCase() === 'facebook') {
          const fullText = formatPostText(post)
          if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
            try { await navigator.clipboard.writeText(fullText) } catch (_) {}
          }
          const targetUrl = res.post?.postUrl || 'https://www.facebook.com/groups/feed/'
          if (typeof window !== 'undefined' && typeof window.open === 'function') {
            try { window.open(targetUrl, '_blank') } catch (_) {}
          }
          showNotice('Đã xuất bản bài viết lên Facebook! Đã sao chép nội dung và mở nhóm/trang Facebook.')
        } else {
          showNotice('Đã xuất bản bài viết thành công!')
        }
        await loadAll()
        if (selectedPostModal && selectedPostModal.id === post.id && res.post) {
          setSelectedPostModal(res.post)
        }
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi xuất bản bài.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprovePost = async (id) => {
    try {
      const res = await apiJson(`/api/admin/social/posts/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken }
      })
      if (res?.ok) {
        showNotice('Đã duyệt và đăng bài viết thành công!')
        await loadAll()
      }
    } catch (err) {
      showNotice(err.message || 'Lỗi khi duyệt bài.', 'error')
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

  // Groups Actions
  const handleAddGroup = async (e) => {
    e.preventDefault()
    if (!newGroup.groupName || !newGroup.groupUrl) {
      showNotice('Vui lòng điền tên và link nhóm Facebook.', 'error')
      return
    }
    try {
      const res = await apiJson('/api/admin/social/groups', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify(newGroup)
      })
      if (res?.ok) {
        showNotice('Đã thêm nhóm Facebook mục tiêu thành công!')
        setNewGroup({
          groupName: '',
          groupUrl: '',
          category: 'Đồ gia dụng & Gia đình',
          membersCount: 0,
          interactionRate: 'Cao',
          isAutoShare: true,
          notes: ''
        })
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

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      if (postFilterStatus !== 'all' && post.status !== postFilterStatus) return false
      if (postFilterPlatform !== 'all' && post.platform !== postFilterPlatform) return false
      return true
    })
  }, [posts, postFilterStatus, postFilterPlatform])

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return groups
    const q = groupSearch.toLowerCase()
    return groups.filter(g => g.groupName.toLowerCase().includes(q) || g.category.toLowerCase().includes(q))
  }, [groups, groupSearch])

  // Format Helper
  const formatTime = (isoString) => {
    if (!isoString) return 'Chưa ghi nhận'
    try {
      const date = new Date(isoString)
      return date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    } catch {
      return isoString
    }
  }

  // Xuất Báo Cáo Audit Logs dạng CSV
  const handleExportCsv = () => {
    if (!posts || posts.length === 0) {
      showNotice('Không có dữ liệu bài đăng để xuất file.', 'info')
      return
    }

    const headers = [
      'ID Bài Đăng',
      'Mã Sản Phẩm',
      'Tên Sản Phẩm',
      'Giá (VNĐ)',
      'Kênh Xuất Bản',
      'Trạng Thái',
      'Tiêu Đề Bài Viết',
      'Nhóm Mục Tiêu',
      'Lượt Thích',
      'Lượt Chia Sẻ',
      'Lượt Bình Luận',
      'Lượt Xem',
      'Thời Gian Kích Hoạt',
      'Thời Gian Xuất Bản',
      'Liên Kết Bài Viết'
    ]

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = filteredPosts.map(p => [
      escapeCsv(p.id),
      escapeCsv(p.productId || ''),
      escapeCsv(p.productName),
      escapeCsv(p.productPrice),
      escapeCsv(p.platform),
      escapeCsv(p.status === 'published' ? 'Đã xuất bản' : p.status === 'pending_approval' ? 'Chờ duyệt' : 'Lỗi'),
      escapeCsv(p.title),
      escapeCsv(p.targetGroup || 'Trang chính'),
      escapeCsv(p.likesCount),
      escapeCsv(p.sharesCount),
      escapeCsv(p.commentsCount),
      escapeCsv(p.viewsCount),
      escapeCsv(p.triggerTime),
      escapeCsv(p.publishedTime || ''),
      escapeCsv(p.postUrl || '')
    ].join(','))

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
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
      {/* Thông báo Alert */}
      {alertMessage && (
        <div className={`social-alert social-alert--${alertMessage.type || 'success'}`}>
          <span>{alertMessage.type === 'error' ? '⚠️' : alertMessage.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* Banner Tổng Quan & Chỉ Số KPI */}
      <section className="social-kpi-banner">
        <div className="social-kpi-banner__head">
          <div className="social-kpi-title">
            <span style={{ fontSize: '24px' }}>📢</span>
            <div>
              <h2>Hệ Thống Tự Động Hóa Đăng Bài Mạng Xã Hội</h2>
            </div>
            <span className={'social-status-pill ' + (settings.isActive ? 'is-active' : 'is-paused')}>
              <span aria-hidden="true">{settings.isActive ? '●' : '○'}</span>
              {settings.isActive
                ? `Đang chạy (${currentIntervalKey === '5m' ? 'Mỗi 5 phút' : currentIntervalKey === '30m' ? 'Mỗi 30 phút' : `Mỗi ${settings.intervalHours} giờ`})`
                : 'Đang tạm dừng'}
            </span>
          </div>

          <div className="social-kpi-actions">
            <button
              type="button"
              className="social-btn-trigger"
              onClick={handleTriggerCycle}
              disabled={loading}
              title="Kích hoạt ngay 1 chu kỳ đăng bài mà không cần chờ đến hẹn"
            >
              ⚡ Đăng Thử Ngay Bây Giờ
            </button>
            <button
              type="button"
              className="social-btn-secondary"
              onClick={loadAll}
              disabled={loading}
              title="Tải lại toàn bộ số liệu và trạng thái"
            >
              🔄 Làm Mới
            </button>
          </div>
        </div>

        {/* Lưới 6 thẻ KPI */}
        <div className="social-kpi-grid">
          <div className="social-kpi-card">
            <small>Đã đăng hôm nay</small>
            <strong>{stats.publishedCount} bài</strong>
          </div>
          <div className="social-kpi-card">
            <small>Chờ duyệt</small>
            <strong>{stats.pendingCount} bài</strong>
          </div>
          <div className="social-kpi-card">
            <small>Tổng Lượt Thích</small>
            <strong>{stats.totalLikes.toLocaleString('vi-VN')}</strong>
          </div>
          <div className="social-kpi-card">
            <small>Tổng Lượt Chia Sẻ</small>
            <strong>{stats.totalShares.toLocaleString('vi-VN')}</strong>
          </div>
          <div className="social-kpi-card">
            <small>Tổng Bình Luận</small>
            <strong>{stats.totalComments.toLocaleString('vi-VN')}</strong>
          </div>
          <div className="social-kpi-card">
            <small>Chu kỳ kế tiếp</small>
            <strong style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
              {stats.nextRunAt ? formatTime(stats.nextRunAt) : 'Chưa xếp lịch'}
            </strong>
          </div>
        </div>
      </section>

      {/* Điều hướng các tab con của Module */}
      <nav className="social-subnav" aria-label="Phân hệ tiếp thị MXH">
        <button
          type="button"
          className={'social-subnav-btn ' + (activeSubTab === 'settings' ? 'is-active' : '')}
          onClick={() => setActiveSubTab('settings')}
        >
          ⚙️ Cấu Hình Tự Động Hóa
        </button>
        <button
          type="button"
          className={'social-subnav-btn ' + (activeSubTab === 'studio' ? 'is-active' : '')}
          onClick={() => setActiveSubTab('studio')}
        >
          ✍️ AI Copywriting Studio (Soạn Thử)
        </button>
        <button
          type="button"
          className={'social-subnav-btn ' + (activeSubTab === 'groups' ? 'is-active' : '')}
          onClick={() => setActiveSubTab('groups')}
        >
          👥 Hội Nhóm Facebook & Bài Hot Viral
        </button>
        <button
          type="button"
          className={'social-subnav-btn ' + (activeSubTab === 'logs' ? 'is-active' : '')}
          onClick={() => setActiveSubTab('logs')}
        >
          📋 Nhật Ký Đăng Bài & Báo Cáo ({posts.length})
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: CẤU HÌNH TỰ ĐỘNG HÓA */}
      {/* ========================================================================= */}
      {activeSubTab === 'settings' && (
        <section className="social-panel">
          <div className="social-panel__heading">
            <h3>⚙️ Thiết Lập Lịch Trình & Phong Cách Đăng Bài Tự Động</h3>
          </div>

          <div className="social-info-banner">
            <strong>ℹ️ Lưu ý cơ chế vận hành ngầm & tính trung thực:</strong>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="social-form-grid">
              {/* Cột 1: Chế độ & Chu kỳ */}
              <div className="social-field">
                <label htmlFor="cfg-status">Trạng thái tự động hóa</label>
                <select
                  id="cfg-status"
                  className="social-select"
                  value={settings.isActive ? '1' : '0'}
                  onChange={e => setSettings({ ...settings, isActive: e.target.value === '1' })}
                >
                  <option value="1">🟢 Bật - Tự động theo chu kỳ</option>
                  <option value="0">🔴 Tắt - Tạm dừng toàn bộ</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-mode">Chế độ vận hành</label>
                <select
                  id="cfg-mode"
                  className="social-select"
                  value={settings.mode}
                  onChange={e => setSettings({ ...settings, mode: e.target.value })}
                >
                  <option value="full_auto">🚀 Hoàn toàn tự động (Full-Auto)</option>
                  <option value="semi_auto">📝 Duyệt trước (Semi-Auto)</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-interval">Chu kỳ đăng bài</label>
                <select
                  id="cfg-interval"
                  className="social-select"
                  value={currentIntervalKey}
                  onChange={e => handleIntervalChange(e.target.value)}
                >
                  <option value="5m">⚡ Mỗi 5 phút</option>
                  <option value="30m">🕐 Mỗi 30 phút</option>
                  <option value="1">🕐 Mỗi 1 giờ</option>
                  <option value="2">🕐 Mỗi 2 giờ</option>
                  <option value="3">🕐 Mỗi 3 giờ</option>
                  <option value="6">🕐 Mỗi 6 giờ</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-privacy">Quyền riêng tư đăng bài (Privacy Mode)</label>
                <select
                  id="cfg-privacy"
                  className="social-select"
                  value={settings.privacy || 'only_me'}
                  onChange={e => setSettings({ ...settings, privacy: e.target.value })}
                >
                  <option value="only_me">🔒 Chỉ mình tôi</option>
                  <option value="public">🌐 Công khai</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-channels">Kênh xuất bản</label>
                <select
                  id="cfg-channels"
                  className="social-select"
                  value={settings.channels}
                  onChange={e => setSettings({ ...settings, channels: e.target.value })}
                >
                  <option value="facebook,tiktok">Đa kênh: Facebook Fanpage + TikTok</option>
                  <option value="facebook">Chỉ xuất bản lên Facebook</option>
                  <option value="tiktok">Chỉ xuất bản lên TikTok</option>
                </select>
              </div>

              {/* Cột 2: Nội dung & Giọng văn */}
              <div className="social-field">
                <label htmlFor="cfg-category">Danh mục sản phẩm ưu tiên</label>
                <select
                  id="cfg-category"
                  className="social-select"
                  value={settings.preferredCategory}
                  onChange={e => setSettings({ ...settings, preferredCategory: e.target.value })}
                >
                  <option value="all">Tất cả sản phẩm</option>
                  <option value="Đồ gia dụng">Đồ gia dụng và tiện ích gia đình</option>
                  <option value="Thời trang">Thời trang và phụ kiện</option>
                  <option value="Công nghệ">Đồ công nghệ và thiết bị</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-tone">Phong cách văn chương</label>
                <select
                  id="cfg-tone"
                  className="social-select"
                  value={settings.toneStyle}
                  onChange={e => setSettings({ ...settings, toneStyle: e.target.value })}
                >
                  <option value="viral_engaging">Bắt trend và tương tác cao</option>
                  <option value="humorous">Hài hước, dí dỏm, duyên dáng</option>
                  <option value="fomo_sales">Kêu gọi chốt đơn gấp</option>
                  <option value="authentic_review">Review chân thực, đi sâu vào tiện ích</option>
                  <option value="storytelling">Kể chuyện nhẹ nhàng, truyền cảm hứng</option>
                </select>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-hotline">Số Hotline liên hệ</label>
                <input
                  id="cfg-hotline"
                  type="text"
                  className="social-input"
                  value={settings.contactHotline}
                  onChange={e => setSettings({ ...settings, contactHotline: e.target.value })}
                  placeholder="0901.234.567"
                />
                <small>Hotline sẽ được tự động đính kèm vào cuối mỗi bài viết.</small>
              </div>

              <div className="social-field">
                <label htmlFor="cfg-link">Mẫu liên kết đặt hàng (Order URL)</label>
                <input
                  id="cfg-link"
                  type="text"
                  className="social-input"
                  value={settings.orderLinkTemplate}
                  onChange={e => setSettings({ ...settings, orderLinkTemplate: e.target.value })}
                  placeholder="https://omnicart.vn/products/{id}"
                />
                <small>Khách hàng bấm vào link sẽ dẫn thẳng đến sản phẩm.</small>
              </div>
            </div>

            {/* Khối Tùy Chọn Tinh Chỉnh */}
            <div className="social-checkbox-group" style={{ marginBottom: '20px' }}>
              <span className="social-subhead">Các thành phần tự động đính kèm vào bài viết:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <label className="social-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.includeEmojis}
                    onChange={e => setSettings({ ...settings, includeEmojis: e.target.checked })}
                  />
                  <span>Tự động chèn Emoji sinh động</span>
                </label>
                <label className="social-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.includeHashtags}
                    onChange={e => setSettings({ ...settings, includeHashtags: e.target.checked })}
                  />
                  <span>Chèn bộ Hashtag xu hướng</span>
                </label>
                <label className="social-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.includeCta}
                    onChange={e => setSettings({ ...settings, includeCta: e.target.checked })}
                  />
                  <span>Lời kêu gọi mua hàng (CTA)</span>
                </label>
                <label className="social-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.includeHotline}
                    onChange={e => setSettings({ ...settings, includeHotline: e.target.checked })}
                  />
                  <span>Đính kèm Hotline CSKH</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                className="social-btn-trigger"
                style={{ padding: '12px 24px', fontSize: '13px' }}
                disabled={loading}
              >
                💾 Lưu Cấu Hình Tự Động Hóa
              </button>
              <span className="social-muted-text">
                Lần cập nhật cuối: {formatTime(settings.updatedAt)}
              </span>
            </div>
          </form>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AI COPYWRITING STUDIO (SOẠN & SÁNG TẠO BÀI VIẾT) */}
      {/* ========================================================================= */}
      {activeSubTab === 'studio' && (
        <section className="social-panel">
          <div className="social-panel__heading">
            <h3>✍️ Trình Sáng Tạo Nội Dung Bán Hàng Bằng Local Qwen AI</h3>
          </div>

          <div className="social-studio-grid">
            {/* Cột Trái: Bộ Điều Khiển Sáng Tạo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="social-field">
                <label>Kênh xuất bản</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className={'social-action-btn ' + (studioPlatform === 'facebook' ? 'social-action-btn--primary' : '')}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setStudioPlatform('facebook')}
                  >
                    🔵 Facebook Fanpage / Group
                  </button>
                  <button
                    type="button"
                    className={'social-action-btn ' + (studioPlatform === 'tiktok' ? 'social-action-btn--primary' : '')}
                    style={{ flex: 1, padding: '10px' }}
                    onClick={() => setStudioPlatform('tiktok')}
                  >
                    🎵 TikTok Video & Caption
                  </button>
                </div>
              </div>

              <div className="social-field">
                <label htmlFor="studio-tone">Phong cách bài viết</label>
                <select
                  id="studio-tone"
                  className="social-select"
                  value={studioTone}
                  onChange={e => setStudioTone(e.target.value)}
                >
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
                  <select
                    id="studio-target-group"
                    className="social-select"
                    value={studioTargetGroup}
                    onChange={e => setStudioTargetGroup(e.target.value)}
                  >
                    <option value="">Tự động chọn nhóm kích hoạt (Mặc định)</option>
                    {groups.map(grp => (
                      <option key={grp.id} value={grp.groupName}>
                        {grp.groupName} ({grp.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="social-field">
                <label htmlFor="studio-topic">Yêu cầu riêng và Chủ đề bổ sung</label>
                <input
                  id="studio-topic"
                  type="text"
                  className="social-input"
                  value={studioTopic}
                  onChange={e => setStudioTopic(e.target.value)}
                  placeholder="Ví dụ: Nhấn mạnh bảo hành 1 đổi 1 trong 30 ngày, tặng kèm quà..."
                />
              </div>

              <button
                type="button"
                className="social-btn-trigger"
                style={{ padding: '12px', fontSize: '13px', justifyContent: 'center' }}
                onClick={handleGenerateStudio}
                disabled={studioGenerating}
              >
                {studioGenerating ? '⏳ Qwen 4B Đang Viết Bài...' : '⚡ Local Qwen AI Viết Bài Mới'}
              </button>

              {/* Vùng chỉnh sửa nhanh nội dung draft */}
              <div className="social-field" style={{ marginTop: '8px' }}>
                <label htmlFor="studio-draft-content">Nội dung có thể chỉnh sửa trước khi đăng:</label>
                <textarea
                  id="studio-draft-content"
                  className="social-textarea"
                  rows={8}
                  value={studioDraft.content}
                  onChange={e => setStudioDraft({ ...studioDraft, content: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="social-btn-trigger"
                  style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                  onClick={() => handlePublishStudio(true)}
                  disabled={loading}
                >
                  🚀 Đăng Ngay Lên Mạng Xã Hội
                </button>
                <button
                  type="button"
                  className="social-action-btn"
                  style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                  onClick={() => handlePublishStudio(false)}
                  disabled={loading}
                >
                  ⏳ Lưu Chờ Duyệt (Semi-Auto)
                </button>
              </div>
            </div>

            {/* Cột Phải: Live Social Media Preview */}
            <div className="social-preview-container">
              <span className="social-subhead" style={{ fontWeight: 800 }}>
                👁️ Trực Quan Hóa (Live Preview) Trên {studioPlatform === 'facebook' ? 'Facebook' : 'TikTok'}:
              </span>

              <div className={'social-preview-card ' + (studioPlatform === 'facebook' ? 'social-preview-card--facebook' : 'social-preview-card--tiktok')}>
                {/* Header Card */}
                <div className="preview-header">
                  <div className="preview-avatar">
                    <svg viewBox="0 0 36 36" width="28" height="28" fill="none">
                      <rect x="1" y="1" width="34" height="34" rx="10" fill="#1b4d36" stroke="#4ea477" strokeWidth="1.2"/>
                      <circle cx="16" cy="16" r="6.2" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round"/>
                      <circle cx="24.5" cy="24.5" r="4.2" fill="#5fe39d" stroke="#fff" strokeWidth="1.2"/>
                    </svg>
                  </div>
                  <div className="preview-author">
                    <strong>
                      OmniCart - Everyday Essentials
                      <span className="preview-badge-verified">✓</span>
                    </strong>
                    <small>Vừa xong · {settings.privacy === 'only_me' ? 'Chỉ mình tôi 🔒' : 'Công khai 🌐'} · Sinh bởi {studioDraft.generatedBy}</small>
                  </div>
                </div>

                {/* Content */}
                <div className="preview-content">
                  {studioDraft.content}
                </div>

                {/* Product Media Image */}
                <div className="preview-media">
                  <img
                    src={studioDraft.productImage || '/products/headphones.svg'}
                    alt={studioDraft.productName}
                    onError={e => { e.currentTarget.src = '/products/bag.svg' }}
                  />
                </div>

                {/* Footer Reactions: Bắt đầu từ 0 thực tế */}
                <div className="preview-footer">
                  <span>👍 Thích (0)</span>
                  <span>💬 Bình luận (0)</span>
                  <span>🔁 Chia sẻ (0)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HỘI NHÓM FACEBOOK & BÀI ĐĂNG HOT VIRAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PHẦN 1: HỘI NHÓM FACEBOOK */}
          <section className="social-panel">
            <div className="social-panel__heading">
              <h3>👥 Danh Sách Hội Nhóm Facebook Mục Tiêu Đăng Bài</h3>
            </div>

            {/* Thanh Tìm Kiếm Nhóm */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
              <input
                type="search"
                className="social-input"
                style={{ maxWidth: '360px' }}
                placeholder="🔍 Tìm kiếm nhóm theo tên hoặc chủ đề..."
                value={groupSearch}
                onChange={e => setGroupSearch(e.target.value)}
              />
              <span style={{ fontSize: '12px', color: '#5c7767' }}>
                Tổng cộng {filteredGroups.length} nhóm mục tiêu
              </span>
            </div>

            {/* Bảng Danh Sách Nhóm */}
            <div className="social-table-shell" style={{ marginBottom: '24px' }}>
              <table className="social-table">
                <thead>
                  <tr>
                    <th>Tên Nhóm Facebook</th>
                    <th>Chủ đề / Ngành hàng</th>
                    <th>Thành viên</th>
                    <th>Tỉ lệ tương tác</th>
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
                      <td>
                        <span className="status-tag status-tag--published">
                          {grp.interactionRate}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={'social-action-btn ' + (grp.isAutoShare ? 'social-action-btn--primary' : '')}
                          onClick={() => handleToggleGroup(grp.id, grp.isAutoShare)}
                        >
                          {grp.isAutoShare ? '✓ Đang bật' : '○ Đang tắt'}
                        </button>
                      </td>
                      <td className="social-muted-text" style={{ fontSize: '11px' }}>{grp.notes || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="social-action-btn social-action-btn--danger"
                          onClick={() => handleDeleteGroup(grp.id)}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredGroups.length === 0 && (
                    <tr>
                      <td colSpan={7} className="social-table-empty">
                        Không tìm thấy nhóm Facebook nào phù hợp với từ khóa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Form Thêm Nhóm Mới */}
            <form onSubmit={handleAddGroup} className="social-subform-card">
              <h4>➕ Thêm Nhóm Facebook Mục Tiêu Mới:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <input
                  type="text"
                  className="social-input"
                  placeholder="Tên nhóm Facebook *"
                  value={newGroup.groupName}
                  onChange={e => setNewGroup({ ...newGroup, groupName: e.target.value })}
                />
                <input
                  type="url"
                  className="social-input"
                  placeholder="Đường dẫn https://facebook.com/groups/... *"
                  value={newGroup.groupUrl}
                  onChange={e => setNewGroup({ ...newGroup, groupUrl: e.target.value })}
                />
                <input
                  type="text"
                  className="social-input"
                  placeholder="Chủ đề (ví dụ: Mẹo vặt, Săn deal)"
                  value={newGroup.category}
                  onChange={e => setNewGroup({ ...newGroup, category: e.target.value })}
                />
                <input
                  type="number"
                  className="social-input"
                  placeholder="Số thành viên (ví dụ: 50000)"
                  value={newGroup.membersCount}
                  onChange={e => setNewGroup({ ...newGroup, membersCount: Number(e.target.value) })}
                />
              </div>
              <button type="submit" className="social-btn-trigger">
                Thêm Nhóm Vào Hệ Thống
              </button>
            </form>
          </section>

          {/* PHẦN 2: BÀI ĐĂNG HOT VIRAL */}
          <section className="social-panel">
            <div className="social-panel__heading">
              <h3>🔥 Kho Cảm Hứng & Quản Lý Bài Đăng Hot / Viral</h3>
            </div>

            <div className="social-table-shell">
              <table className="social-table">
                <thead>
                  <tr>
                    <th>Tiêu đề bài viết Hot</th>
                    <th>Nền tảng</th>
                    <th>Chủ đề xu hướng</th>
                    <th>Virality Score</th>
                    <th>Tương tác (Likes / Shares / Comments)</th>
                    <th>Liên kết</th>
                  </tr>
                </thead>
                <tbody>
                  {viralPosts.map(v => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.title}</strong>
                        <div className="social-muted-text" style={{ fontSize: '11px', marginTop: '2px' }}>{v.summary}</div>
                      </td>
                      <td>
                        <span className={'channel-tag channel-tag--' + v.platform}>
                          {v.platform}
                        </span>
                      </td>
                      <td>{v.trendingTopic}</td>
                      <td>
                        <strong style={{ color: '#dc2626' }}>🔥 {v.viralityScore}/100</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: '11.5px' }}>
                          👍 {v.likesCount.toLocaleString('vi-VN')} · 🔁 {v.sharesCount.toLocaleString('vi-VN')} · 💬 {v.commentsCount.toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td>
                        <a href={v.postUrl} target="_blank" rel="noopener noreferrer" className="social-action-btn social-table-link">
                          Xem bài gốc ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                  {viralPosts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="social-table-empty">
                        Chưa có bài viết mẫu tham khảo nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: NHẬT KÝ ĐĂNG BÀI & BÁO CÁO (POST LOGS & AUDIT REPORTS) */}
      {/* ========================================================================= */}
      {activeSubTab === 'logs' && (
        <section className="social-panel">
          <div className="social-panel__heading">
            <h3>📋 Báo Cáo chi tiết và lưu Lịch Sử Đăng Bài</h3>
          </div>

          {/* Bộ Lọc Nhật Ký */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Trạng thái:</span>
              <select
                className="social-select"
                style={{ width: '220px' }}
                value={postFilterStatus}
                onChange={e => setPostFilterStatus(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="published">🟢 Đã đăng</option>
                <option value="internal_draft">📝 Bản Nháp</option>
                <option value="ready_for_api">⏳ Chờ gửi API</option>
                <option value="pending_approval">🟡 Chờ Admin duyệt</option>
                <option value="failed">🔴 Thất bại</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Nền tảng:</span>
              <select
                className="social-select"
                style={{ width: '160px' }}
                value={postFilterPlatform}
                onChange={e => setPostFilterPlatform(e.target.value)}
              >
                <option value="all">Tất cả kênh</option>
                <option value="facebook">Facebook</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            <button
              type="button"
              className="social-action-btn social-action-btn--primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportCsv}
              title="Tải toàn bộ báo cáo lịch sử đăng bài dạng file CSV để đối soát"
            >
              📥 Xuất Báo Cáo CSV
            </button>

            <span className="social-muted-text" style={{ marginLeft: 'auto' }}>
              Hiển thị {filteredPosts.length} / {posts.length} bài đăng
            </span>
          </div>

          {/* Bảng Audit Logs */}
          <div className="social-table-shell">
            <table className="social-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Kênh</th>
                  <th>Sản phẩm</th>
                  <th>Nội dung bài viết</th>
                  <th>Nhóm / Vị trí</th>
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
                    <td>
                      <span className={'channel-tag channel-tag--' + p.platform}>
                        {p.platform}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                          src={p.productImage || '/products/bag.svg'}
                          alt={p.productName}
                          className="social-product-thumb"
                          onError={e => { e.currentTarget.src = '/products/bag.svg' }}
                        />
                        <div>
                          <strong>{p.productName}</strong>
                          <div style={{ fontSize: '11px', color: '#2e8658', fontWeight: 700 }}>
                            {Number(p.productPrice).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {p.title}
                      </div>
                      <button
                        type="button"
                        className="social-modal-open-btn"
                        onClick={() => setSelectedPostModal(p)}
                      >
                        Xem toàn bộ nội dung ↗
                      </button>
                    </td>
                    <td className="social-muted-text" style={{ fontSize: '11.5px' }}>
                      {p.targetGroup || 'Trang chính'}
                    </td>
                    <td>
                      <span className={'status-tag status-tag--' + p.status}>
                        {p.status === 'published' ? '🟢 Đã đăng' :
                         p.status === 'ready_for_api' ? '⏳ Chờ gửi API' :
                         p.status === 'internal_draft' ? '📝 Bản Nháp' :
                         p.status === 'pending_approval' ? '🟡 Chờ duyệt' : '🔴 Lỗi'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        👍 {p.likesCount} · 🔁 {p.sharesCount} · 💬 {p.commentsCount}
                      </div>
                    </td>
                    <td>
                      {p.postUrl ? (
                        <a
                          href={p.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="social-action-btn social-table-link"
                        >
                          Xem bài ↗
                        </a>
                      ) : (
                        <span className="social-muted-text">Bản nháp (Chưa đăng thật)</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="social-action-btn"
                          onClick={() => handleCopyPost(p)}
                          title="Sao chép nội dung bài viết để đăng"
                          style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          {copiedPostId === p.id ? '✓ Đã chép' : '📋 Chép'}
                        </button>
                        {p.status !== 'published' && (
                          <button
                            type="button"
                            className="social-action-btn social-action-btn--primary"
                            onClick={() => handlePublishPost(p)}
                            title={p.platform === 'facebook' ? 'Đăng ngay lên Facebook' : 'Đăng ngay'}
                            style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                          >
                            {p.platform === 'facebook' ? '🚀 Đăng FB' : '🚀 Đăng'}
                          </button>
                        )}
                        {p.status === 'pending_approval' && (
                          <button
                            type="button"
                            className="social-action-btn"
                            onClick={() => handleApprovePost(p.id)}
                            title="Duyệt bài và chuẩn bị gửi API thật"
                            style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                          >
                            ✓ Duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          className="social-action-btn social-action-btn--danger"
                          onClick={() => handleDeletePost(p.id)}
                          title="Xóa log này"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPosts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="social-table-empty">
                      Chưa có nhật ký bài đăng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* MODAL CHI TIẾT NỘI DUNG BÀI ĐĂNG */}
      {/* ========================================================================= */}
      {selectedPostModal && (
        <div className="social-modal-overlay" onClick={() => setSelectedPostModal(null)}>
          <div className="social-modal-card" onClick={e => e.stopPropagation()}>
            <div className="social-modal-head">
              <h3>📄 Chi Tiết Bài Đăng #{selectedPostModal.id}</h3>
              <button
                type="button"
                className="social-modal-close"
                onClick={() => setSelectedPostModal(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className={'channel-tag channel-tag--' + selectedPostModal.platform}>
                {selectedPostModal.platform}
              </span>
              <span className={'status-tag status-tag--' + selectedPostModal.status}>
                {selectedPostModal.status === 'published' ? '🟢 Đã đăng' :
                 selectedPostModal.status === 'ready_for_api' ? '⏳ Chờ gửi API' :
                 selectedPostModal.status === 'internal_draft' ? '📝 Bản Nháp' :
                 selectedPostModal.status === 'pending_approval' ? '🟡 Chờ duyệt' : '🔴 Lỗi'}
              </span>
              <span className="social-muted-text" style={{ marginLeft: 'auto' }}>
                {selectedPostModal.privacy === 'only_me' ? '🔒 Chỉ mình tôi' : '🌐 Công khai'} · Thời gian: {formatTime(selectedPostModal.publishedTime || selectedPostModal.triggerTime)}
              </span>
            </div>

            <div>
              <strong style={{ fontSize: '15px' }}>{selectedPostModal.title}</strong>
              <div className="social-modal-body-content">
                {selectedPostModal.content}
              </div>
            </div>

            <div className="social-modal-stat-bar">
              <span>👍 Lượt thích: <strong>{selectedPostModal.likesCount}</strong></span>
              <span>🔁 Lượt chia sẻ: <strong>{selectedPostModal.sharesCount}</strong></span>
              <span>💬 Bình luận: <strong>{selectedPostModal.commentsCount}</strong></span>
              <span>👁️ Lượt xem: <strong>{selectedPostModal.viewsCount}</strong></span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {selectedPostModal.status !== 'published' && (
                <button
                  type="button"
                  className="social-btn-trigger"
                  onClick={() => handlePublishPost(selectedPostModal)}
                  disabled={loading}
                >
                  🚀 {selectedPostModal.platform === 'facebook' ? 'Đăng Lên Facebook Ngay' : 'Xuất Bản Ngay'}
                </button>
              )}
              <button
                type="button"
                className="social-btn-trigger"
                onClick={() => handleCopyPost(selectedPostModal)}
                style={{ background: copiedPostId === selectedPostModal.id ? '#1e7047' : undefined }}
              >
                {copiedPostId === selectedPostModal.id ? '✓ Đã Sao Chép Vào Bộ Nhớ Tạm!' : '📋 Sao Chép Nội Dung Bài Viết'}
              </button>
              {selectedPostModal.postUrl && (
                <a
                  href={selectedPostModal.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn-trigger"
                  style={{ textDecoration: 'none' }}
                >
                  Mở Bài Viết Thực Tế ↗
                </a>
              )}
              <button
                type="button"
                className="social-action-btn"
                onClick={() => setSelectedPostModal(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
