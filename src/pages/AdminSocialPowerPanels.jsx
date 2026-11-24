/*
  FILE NOTE
  - Mục đích: Bộ 5 Panel Tự động hóa MXH v3.5.6 (AdminSocialPowerPanels), hỗ trợ thông báo đồng bộ catalog khi tạo sản phẩm hoặc áp dụng giảm giá.
  - Nâng cấp:
    1. Nhận state surfResult, surfBusy, surfCfg và onSurfAndRank từ component cha (AdminSocialAutomation) để bảo toàn 100% dữ liệu và quá trình lướt khi chuyển qua lại giữa các tab.
    2. Hàm normalizeSurfResult giải mã an toàn JSON string / object, chuẩn hóa hai chiều camelCase lẫn PascalCase từ C# backend/localStorage.
    3. Hỗ trợ hiển thị trạng thái đã lưu vào Kho Viral cho từng bài lướt feed.
    4. Tích hợp notifyCatalogChange phát tín hiệu đồng bộ realtime sang Storefront khách hàng.
  - Liên kết trực tiếp: src/pages/AdminSocialAutomation.jsx, src/pages/AdminSocialAutomation.css, src/services/catalogSync.js
  - Vùng ảnh hưởng khi sửa: Giao diện Panel Lấy bài Viral tùy chỉnh và Panel Lướt theo thời gian thực tế, đồng bộ danh mục.
*/
import { useEffect, useState } from 'react'
import { apiJson } from '../api/chat'
import { notifyCatalogChange } from '../services/catalogSync'

const money = (v) => new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + 'đ'

export function normalizeSurfResult(result) {
  if (!result) return null
  if (typeof result === 'string') {
    try { result = JSON.parse(result) } catch (_) { return null }
  }
  if (!result || typeof result !== 'object') return null
  const rawPosts = Array.isArray(result.topPosts)
    ? result.topPosts
    : (Array.isArray(result.TopPosts) ? result.TopPosts : (Array.isArray(result.posts) ? result.posts : []))
  const topPosts = rawPosts.map((p, idx) => ({
    id: p.id || p.Id || `surf-${Date.now()}-${idx}`,
    title: p.title || p.Title || 'Bài viết lướt feed',
    platform: String(p.platform || p.Platform || result.platform || result.Platform || 'tiktok').toLowerCase(),
    category: p.category || p.Category || result.topic || result.Topic || 'Xu hướng lướt',
    postUrl: p.postUrl || p.PostUrl || '',
    summary: p.summary || p.Summary || p.title || p.Title || '',
    likesCount: Number(p.likesCount ?? p.LikesCount ?? 0),
    commentsCount: Number(p.commentsCount ?? p.CommentsCount ?? 0),
    sharesCount: Number(p.sharesCount ?? p.SharesCount ?? 0),
    trendingTopic: p.trendingTopic || p.TrendingTopic || '',
    thumbnailUrl: p.thumbnailUrl || p.ThumbnailUrl || '',
    authorName: p.authorName || p.AuthorName || '',
    authorUrl: p.authorUrl || p.AuthorUrl || '',
    createdAt: p.createdAt || p.CreatedAt || new Date().toISOString()
  }))
  const rawTopics = Array.isArray(result.topTopics)
    ? result.topTopics
    : (Array.isArray(result.TopTopics) ? result.TopTopics : [])
  const topTopics = rawTopics.map((t) => ({
    topic: t.topic || t.Topic || 'Chung',
    postCount: Number(t.postCount ?? t.PostCount ?? 0),
    totalLikes: Number(t.totalLikes ?? t.TotalLikes ?? 0),
    topPostTitle: t.topPostTitle || t.TopPostTitle || ''
  }))
  return {
    ...result,
    ok: true,
    platform: String(result.platform || result.Platform || 'tiktok').toLowerCase(),
    topic: result.topic || result.Topic || 'Tất cả',
    durationMinutes: Number(result.durationMinutes ?? result.DurationMinutes ?? 3),
    scannedCount: Number(result.scannedCount ?? result.ScannedCount ?? topPosts.length),
    matchedCount: Number(result.matchedCount ?? result.MatchedCount ?? topPosts.length),
    topTopics,
    topPosts,
    generatedBy: result.generatedBy || result.GeneratedBy || 'OmniVision Extension'
  }
}

export function ViralSalesIdeasPanel({ csrfToken, viralCount, onUseIdea }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function generateIdeas() {
    setBusy(true); setError('')
    try {
      const res = await apiJson('/api/admin/social/ai/viral-sales-ideas', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ count: 4 })
      })
      setResult(res)
    } catch (e) { setError(e.message || 'Không tạo được ý tưởng.') }
    finally { setBusy(false) }
  }

  return (
    <section className="social-panel">
      <div className="social-panel__head-row">
        <h3>💡 Ý tưởng bán hàng từ kho Viral</h3>
        <button type="button" className="social-btn-trigger" disabled={busy || viralCount === 0} onClick={generateIdeas}>
          {busy ? '⏳ Đang tạo...' : '🤖 Tạo ý tưởng'}
        </button>
      </div>
      {error && <p className="social-alert social-alert--error">{error}</p>}
      {result && (
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          <div className="social-info-banner" style={{ marginBottom: 0 }}>
            <strong>📊 {result.generatedBy}:</strong>
            <span>{result.summary}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {(result.ideas || []).map((idea, idx) => (
              <article key={idx} className="social-subform-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                  <span className={'channel-tag channel-tag--' + (idea.platform === 'tiktok' ? 'tiktok' : 'facebook')}>{idea.platform || 'facebook'}</span>
                  <span className="status-tag status-tag--published">{idea.trendName}</span>
                </div>
                <strong>🛍️ {idea.productName}</strong>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4ade80' }}>"{idea.hook}"</div>
                <small className="social-muted-text">{idea.hashtags}</small>
                <button type="button" className="social-action-btn social-action-btn--primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={() => onUseIdea(idea)}>
                  ✍️ Soạn bài này →
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function SmartProductVisionPanel({ csrfToken, onProductCreated, onSelectForPost }) {
  const [imageData, setImageData] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  const [notice, setNotice] = useState('')
  const [invAdvice, setInvAdvice] = useState(null)

  useEffect(() => {
    apiJson('/api/admin/social/ai/inventory-recommendations').then(setInvAdvice).catch(() => {})
  }, [])

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageData(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function analyzeImage() {
    if (!imageData) return
    setBusy(true); setNotice('')
    try {
      const res = await apiJson('/api/admin/social/ai/product-from-image', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ imageBase64: imageData, hint })
      })
      if (res?.product) {
        setDraft({ ...res.product, stockCount: 20 })
        setNotice(`✅ ${res.generatedBy} đã nhận diện xong!`)
      }
    } catch (e) { setNotice('⚠️ ' + (e.message || 'Lỗi nhận diện ảnh.')) }
    finally { setBusy(false) }
  }

  async function saveNewProduct(andCreatePost = false) {
    if (!draft?.name) return
    setBusy(true); setNotice('')
    try {
      const res = await apiJson('/api/admin/products', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          name: draft.name, category: draft.category, price: Number(draft.price) || 199000,
          description: draft.description, image: imageData, features: draft.features || [],
          stockCount: Number(draft.stockCount) || 20, label: draft.label || 'Mới'
        })
      })
      if (res?.product) {
        setNotice(`✅ Đã thêm "${res.product.name}" vào kho!`)
        notifyCatalogChange()
        onProductCreated?.(res.product)
        if (andCreatePost) onSelectForPost?.(res.product)
      }
    } catch (e) { setNotice('⚠️ ' + (e.message || 'Không lưu được sản phẩm.')) }
    finally { setBusy(false) }
  }

  async function applyQuickDiscount(item) {
    try {
      await apiJson(`/api/admin/products/${encodeURIComponent(item.id)}/offer`, {
        method: 'PATCH', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ discountPercent: item.suggestedDiscount || 15 })
      })
      setNotice(`✅ Đã giảm ${item.suggestedDiscount || 15}% cho "${item.name}".`)
      notifyCatalogChange()
      const refreshed = await apiJson('/api/admin/social/ai/inventory-recommendations')
      setInvAdvice(refreshed)
    } catch (e) { setNotice('⚠️ ' + e.message) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
      <section className="social-panel">
        <div className="social-panel__head-row"><h3>📸 Tạo sản phẩm từ ảnh</h3></div>
        <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
          <input type="file" accept="image/*" onChange={handleFile} className="social-input" />
          <input type="text" className="social-input" placeholder="Gợi ý thêm (tùy chọn)..." value={hint} onChange={e => setHint(e.target.value)} />
          {imageData && <img src={imageData} alt="Xem trước" style={{ maxHeight: '130px', objectFit: 'contain', borderRadius: '8px', background: '#091610', padding: '6px' }} />}
          <button type="button" className="social-btn-trigger" disabled={busy || !imageData} onClick={analyzeImage}>
            {busy ? '⏳ Đang phân tích...' : '👁️ AI đọc ảnh sản phẩm'}
          </button>
          {draft && (
            <div className="social-subform-card" style={{ display: 'grid', gap: '8px' }}>
              <input className="social-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Tên sản phẩm" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <input className="social-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Danh mục" />
                <input className="social-input" type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="Giá" />
                <input className="social-input" type="number" value={draft.stockCount} onChange={e => setDraft({ ...draft, stockCount: e.target.value })} placeholder="Tồn" />
              </div>
              <textarea className="social-textarea" rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="social-btn-trigger" disabled={busy} onClick={() => saveNewProduct(false)}>💾 Lưu kho</button>
                <button type="button" className="social-action-btn social-action-btn--primary" disabled={busy} onClick={() => saveNewProduct(true)}>🚀 Lưu & Soạn bài</button>
              </div>
            </div>
          )}
          {notice && <small style={{ fontWeight: 700, color: '#4ade80' }}>{notice}</small>}
        </div>
      </section>

      <section className="social-panel">
        <div className="social-panel__head-row"><h3>📦 Gợi ý kho & khuyến mãi</h3></div>
        {invAdvice ? (
          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <div>
              <strong style={{ fontSize: '12px' }}>🔥 Tồn cao nên giảm giá:</strong>
              {(invAdvice.highStockNeedPromo || []).slice(0, 4).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(134,239,172,0.12)' }}>
                  <div style={{ fontSize: '12px' }}><strong>{p.name}</strong><div className="social-muted-text">{money(p.price)} · Tồn {p.stockCount}</div></div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" className="social-action-btn" onClick={() => applyQuickDiscount(p)}>-{p.suggestedDiscount}%</button>
                    <button type="button" className="social-action-btn social-action-btn--primary" onClick={() => onSelectForPost?.(p)}>Đăng</button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: '12px', color: '#fbbf24' }}>⚠️ Sắp hết hàng:</strong>
              {(invAdvice.lowStockAlert || []).slice(0, 4).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0' }}>
                  <span>{p.name}</span>
                  <strong style={{ color: p.stockCount === 0 ? '#f87171' : '#fbbf24' }}>Còn {p.stockCount}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="social-muted-text" style={{ marginTop: '10px' }}>Đang tải…</p>}
      </section>
    </div>
  )
}

export function AutomationSuitePanels({
  csrfToken, sendExtensionMessage, viralPosts, onCustomViralScrape, onOpenSingleTab, showNotice, onSurfSaved,
  surfResult: propSurfResult, setSurfResult: propSetSurfResult,
  surfBusy: propSurfBusy, setSurfBusy: propSetSurfBusy,
  surfCfg: propSurfCfg, setSurfCfg: propSetSurfCfg,
  onSurfAndRank
}) {
  const [watchCfg, setWatchCfg] = useState({ platform: 'tiktok', url: '', repeatCount: 5, dwellSeconds: 8 })
  const [watchBusy, setWatchBusy] = useState(false)

  const [cmtCfg, setCmtCfg] = useState({ postUrl: '', maxComments: 40 })
  const [cmtBusy, setCmtBusy] = useState(false)
  const [cmtResult, setCmtResult] = useState(null)

  const [customViralCfg, setCustomViralCfg] = useState({
    platform: 'both', fbSourceMode: 'both', ttSourceMode: 'explore', fbFeedMinLikes: 1000, fbReelMinLikes: 5000,
    tiktokMinLikes: 1000000, fbCount: 10, tiktokCount: 10, topic: 'all', customTopic: ''
  })

  const [channelUrlsText, setChannelUrlsText] = useState('')
  const [channelTargetTopic, setChannelTargetTopic] = useState('Anime')
  const [channelBusy, setChannelBusy] = useState(false)
  const [channelResults, setChannelResults] = useState(null)

  const [savedSurfPostUrls, setSavedSurfPostUrls] = useState(() => new Set())

  const [localSurfCfg, setLocalSurfCfg] = useState({ platform: 'tiktok', fbMode: 'feed', ttSourceMode: 'explore', durationMinutes: 3, topic: '' })
  const surfCfg = propSurfCfg !== undefined ? propSurfCfg : localSurfCfg
  const setSurfCfg = propSetSurfCfg || setLocalSurfCfg

  const [localSurfBusy, setLocalSurfBusy] = useState(false)
  const surfBusy = propSurfBusy !== undefined ? propSurfBusy : localSurfBusy
  const setSurfBusy = propSetSurfBusy || setLocalSurfBusy

  const [localSurfResult, setLocalSurfResult] = useState(() => {
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('omnicart_last_surf_result') : null
      return cached ? normalizeSurfResult(cached) : null
    } catch (_) { return null }
  })
  const rawSurfResult = propSurfResult !== undefined ? propSurfResult : localSurfResult
  const surfResult = normalizeSurfResult(rawSurfResult)
  const setSurfResult = (val) => {
    const norm = normalizeSurfResult(val)
    if (propSetSurfResult) propSetSurfResult(norm)
    else setLocalSurfResult(norm)
  }

  async function handleSaveSurfPostToViral(post) {
    if (!post) return
    const postUrl = post.postUrl || post.PostUrl || ''
    try {
      const title = post.title || post.Title || 'Bài lướt feed'
      const postToSave = {
        ...post,
        id: post.id || post.Id || `surf-viral-${Date.now()}`,
        title,
        postUrl,
        platform: String(post.platform || post.Platform || surfCfg.platform).toLowerCase(),
        category: post.category || post.Category || surfCfg.topic || 'Xu hướng lướt',
        thumbnailUrl: post.thumbnailUrl || post.ThumbnailUrl || '',
        authorName: post.authorName || post.AuthorName || '',
        authorUrl: post.authorUrl || post.AuthorUrl || '',
        likesCount: Math.min(200000000, Math.max(0, Math.round(Number(post.likesCount ?? post.LikesCount) || 0))),
        commentsCount: Math.min(200000000, Math.max(0, Math.round(Number(post.commentsCount ?? post.CommentsCount) || 0))),
        sharesCount: Math.min(200000000, Math.max(0, Math.round(Number(post.sharesCount ?? post.SharesCount) || 0)))
      }
      await apiJson('/api/admin/social/viral/import-real', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ posts: [postToSave] })
      })
      if (postUrl) setSavedSurfPostUrls(prev => new Set([...prev, postUrl.toLowerCase()]))
      onSurfSaved?.()
      showNotice(`✅ Đã lưu bài "${title.slice(0, 32)}..." vào Kho bài Viral!`)
    } catch (err) { showNotice(err.message || 'Lỗi lưu bài vào Kho Viral.', 'error') }
  }

  async function handleSaveAllSurfToViral() {
    const list = surfResult?.topPosts || []
    if (!list.length) return
    try {
      const postsToSave = list.map((p, idx) => ({
        ...p,
        id: p.id || p.Id || `surf-viral-${Date.now()}-${idx}`,
        title: p.title || p.Title || 'Bài lướt feed',
        postUrl: p.postUrl || p.PostUrl || '',
        platform: String(p.platform || p.Platform || surfCfg.platform).toLowerCase(),
        category: p.category || p.Category || surfCfg.topic || 'Xu hướng lướt',
        thumbnailUrl: p.thumbnailUrl || p.ThumbnailUrl || '',
        authorName: p.authorName || p.AuthorName || '',
        authorUrl: p.authorUrl || p.AuthorUrl || '',
        likesCount: Math.min(200000000, Math.max(0, Math.round(Number(p.likesCount ?? p.LikesCount) || 0))),
        commentsCount: Math.min(200000000, Math.max(0, Math.round(Number(p.commentsCount ?? p.CommentsCount) || 0))),
        sharesCount: Math.min(200000000, Math.max(0, Math.round(Number(p.sharesCount ?? p.SharesCount) || 0)))
      })).filter(p => p.postUrl && p.title)
      await apiJson('/api/admin/social/viral/import-real', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ posts: postsToSave })
      })
      const savedUrls = postsToSave.map(p => p.postUrl.toLowerCase())
      setSavedSurfPostUrls(prev => new Set([...prev, ...savedUrls]))
      onSurfSaved?.()
      showNotice(`✅ Đã lưu toàn bộ ${postsToSave.length} bài lướt vào Kho bài Viral!`)
    } catch (err) { showNotice(err.message || 'Lỗi lưu tất cả vào Kho Viral.', 'error') }
  }

  function handleClearSurfResult() {
    setSurfResult(null)
    try { localStorage.removeItem('omnicart_last_surf_result') } catch (_) {}
  }

  async function handleRunWatch(e) {
    e.preventDefault()
    setWatchBusy(true)
    try {
      const res = await sendExtensionMessage('AUTO_WATCH_TASK', watchCfg)
      if (!res?.ok) throw new Error(res?.error || 'Không chạy được tác vụ xem.')
      showNotice(`✅ Đã xem xong ${res.data?.watched || watchCfg.repeatCount} lượt trên ${watchCfg.platform.toUpperCase()}!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setWatchBusy(false) }
  }

  async function handleAnalyzeComments(e) {
    e.preventDefault()
    if (!cmtCfg.postUrl.trim()) return showNotice('Dán link bài Facebook hoặc TikTok cần đọc bình luận.', 'error')
    setCmtBusy(true)
    try {
      const scraped = await sendExtensionMessage('SCRAPE_POST_COMMENTS', cmtCfg)
      if (!scraped?.ok) throw new Error(scraped?.error || 'Chưa đọc được bình luận.')
      const analyzed = await apiJson('/api/admin/social/ai/analyze-comments', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          platform: scraped.data?.platform || 'tiktok',
          postUrl: cmtCfg.postUrl, postTitle: scraped.data?.postTitle || '',
          comments: scraped.data?.comments || []
        })
      })
      setCmtResult(analyzed)
      showNotice(`✅ Đã phân tích ${analyzed.totalComments || 0} bình luận!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setCmtBusy(false) }
  }

  function fillChannelsFromViral() {
    const urls = Array.from(new Set((viralPosts || []).map((v) => v.authorUrl).filter(Boolean))).slice(0, 10)
    if (!urls.length) return showNotice('Chưa có link kênh trong kho Viral.', 'info')
    setChannelUrlsText(urls.join('\n'))
  }

  async function handleFilterChannels(e) {
    e.preventDefault()
    const channelUrls = channelUrlsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (!channelUrls.length) return showNotice('Nhập ít nhất 1 link kênh.', 'error')
    setChannelBusy(true)
    try {
      const scraped = await sendExtensionMessage('SCRAPE_CHANNEL_PROFILES', { channelUrls })
      if (!scraped?.ok) throw new Error(scraped?.error || 'Chưa quét được kênh.')
      const analyzed = await apiJson('/api/admin/social/ai/classify-channels', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ targetTopic: channelTargetTopic, channels: scraped.data?.channels || [] })
      })
      setChannelResults(analyzed)
      showNotice(`✅ Đã lọc xong ${(analyzed.channels || []).length} kênh!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setChannelBusy(false) }
  }

  async function handleSurfAndRank(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (typeof onSurfAndRank === 'function') {
      return onSurfAndRank(surfCfg)
    }
    setSurfBusy(true)
    try {
      const surfed = await sendExtensionMessage('SURF_AND_COLLECT', surfCfg)
      if (!surfed?.ok) throw new Error(surfed?.error || 'Không lướt được feed.')
      const rawPosts = surfed?.data?.posts || surfed?.posts || []

      let analyzed = null
      try {
        analyzed = await apiJson('/api/admin/social/ai/analyze-surf', {
          method: 'POST', headers: { 'x-csrf-token': csrfToken },
          body: JSON.stringify({
            platform: surfCfg.platform, targetTopic: surfCfg.topic || 'all',
            durationMinutes: Number(surfCfg.durationMinutes) || 3, posts: rawPosts
          })
        })
      } catch (aiErr) {
        console.warn('AI analyze-surf failed or timed out, falling back to raw posts:', aiErr)
      }

      const postList = Array.isArray(analyzed?.topPosts) && analyzed.topPosts.length > 0
        ? analyzed.topPosts
        : rawPosts
      const finalResult = normalizeSurfResult({
        ok: true,
        platform: surfCfg.platform,
        topic: surfCfg.topic || 'Tất cả',
        durationMinutes: Number(surfCfg.durationMinutes) || 3,
        scannedCount: rawPosts.length,
        matchedCount: postList.length,
        topTopics: analyzed?.topTopics || [{ topic: surfCfg.topic || 'Xu hướng lướt', postCount: postList.length }],
        topPosts: postList,
        generatedBy: analyzed?.generatedBy || 'OmniVision Extension'
      })
      setSurfResult(finalResult)
      try { localStorage.setItem('omnicart_last_surf_result', JSON.stringify(finalResult)) } catch (_) {}
      onSurfSaved?.()
      showNotice(`✅ Lướt đủ ${surfCfg.durationMinutes} phút — thu thập được ${finalResult?.topPosts?.length || 0} bài!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setSurfBusy(false) }
  }

  return (
    <div className="automation-suite-grid">
      {/* 1. XEM VIDEO TỰ ĐỘNG */}
      <section className="social-panel auto-card">
        <div className="social-panel__head-row">
          <h3>👁️ Xem video tự động</h3>
          <div className="auto-pills">
            {[['tiktok', '🎵 TikTok'], ['facebook', '🔵 Facebook']].map(([id, label]) => (
              <button key={id} type="button" className={'auto-pill ' + (watchCfg.platform === id ? 'is-active' : '')} onClick={() => setWatchCfg({ ...watchCfg, platform: id })}>{label}</button>
            ))}
          </div>
        </div>
        <form onSubmit={handleRunWatch} className="auto-form-grid">
          <div className="social-field auto-span-2">
            <label>Link bài / video (để trống = lướt đề xuất)</label>
            <input className="social-input" value={watchCfg.url} onChange={e => setWatchCfg({ ...watchCfg, url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="social-field">
            <label>Số lượt xem</label>
            <div className="auto-input-chips">
              <input type="number" min="1" max="50" className="social-input" value={watchCfg.repeatCount} onChange={e => setWatchCfg({ ...watchCfg, repeatCount: Number(e.target.value) })} />
              {[5, 10, 20].map((n) => <button key={n} type="button" className={'auto-chip ' + (watchCfg.repeatCount === n ? 'is-on' : '')} onClick={() => setWatchCfg({ ...watchCfg, repeatCount: n })}>{n}</button>)}
            </div>
          </div>
          <div className="social-field">
            <label>Mỗi lượt (~giây ngẫu nhiên)</label>
            <div className="auto-input-chips">
              <input type="number" min="3" max="120" className="social-input" value={watchCfg.dwellSeconds} onChange={e => setWatchCfg({ ...watchCfg, dwellSeconds: Number(e.target.value) })} />
              {[8, 15, 30].map((s) => <button key={s} type="button" className={'auto-chip ' + (watchCfg.dwellSeconds === s ? 'is-on' : '')} onClick={() => setWatchCfg({ ...watchCfg, dwellSeconds: s })}>{s}s</button>)}
            </div>
          </div>
          <div className="auto-actions auto-span-2">
            <button type="submit" className="social-btn-trigger" disabled={watchBusy}>{watchBusy ? '⏳ Đang chạy...' : '▶ Bắt đầu xem'}</button>
          </div>
        </form>
      </section>

      {/* 2. LƯỚT THEO THỜI GIAN */}
      <section className="social-panel auto-card">
        <div className="social-panel__head-row">
          <h3>🧭 Lướt theo thời gian</h3>
          <div className="auto-pills">
            {[['tiktok', '🎵 TikTok'], ['facebook', '🔵 Facebook']].map(([id, label]) => (
              <button key={id} type="button" className={'auto-pill ' + (surfCfg.platform === id ? 'is-active' : '')} onClick={() => setSurfCfg({ ...surfCfg, platform: id })}>{label}</button>
            ))}
          </div>
        </div>
        <form onSubmit={handleSurfAndRank} className="auto-form-grid">
          <div className="social-field">
            <label>Thời gian (phút)</label>
            <div className="auto-input-chips">
              <input type="number" min="1" max="30" className="social-input" value={surfCfg.durationMinutes} onChange={e => setSurfCfg({ ...surfCfg, durationMinutes: Number(e.target.value) })} />
              {[2, 5, 10].map((m) => <button key={m} type="button" className={'auto-chip ' + (surfCfg.durationMinutes === m ? 'is-on' : '')} onClick={() => setSurfCfg({ ...surfCfg, durationMinutes: m })}>{m}p</button>)}
            </div>
          </div>
          <div className="social-field">
            <label>{surfCfg.platform === 'facebook' ? 'Khu vực FB' : 'Chủ đề lọc'}</label>
            {surfCfg.platform === 'facebook'
              ? <select className="social-select" value={surfCfg.fbMode} onChange={e => setSurfCfg({ ...surfCfg, fbMode: e.target.value })}><option value="feed">Trang chủ (Bài viết)</option><option value="reels">Thước phim (Reels)</option></select>
              : <input className="social-input" value={surfCfg.topic} onChange={e => setSurfCfg({ ...surfCfg, topic: e.target.value })} placeholder="Trống = mọi top..." />}
          </div>
          {surfCfg.platform === 'tiktok' && (
            <div className="social-field">
              <label>Nguồn TikTok</label>
              <select className="social-select" value={surfCfg.ttSourceMode} onChange={e => setSurfCfg({ ...surfCfg, ttSourceMode: e.target.value })}>
                <option value="explore">🧭 Mục Khám phá</option>
                <option value="search">🔎 Tìm theo từ khóa</option>
              </select>
            </div>
          )}
          {surfCfg.platform === 'facebook' && (
            <div className="social-field auto-span-2">
              <label>Chủ đề lọc</label>
              <input className="social-input" value={surfCfg.topic} onChange={e => setSurfCfg({ ...surfCfg, topic: e.target.value })} placeholder="Trống = mọi top..." />
            </div>
          )}
          <div className="auto-actions auto-span-2" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" className="social-btn-trigger" disabled={surfBusy}>{surfBusy ? `⏳ Đang lướt ${surfCfg.durationMinutes} phút...` : '🧭 Bắt đầu lướt'}</button>
            {surfBusy && (
              <button type="button" className="social-action-btn social-action-btn--danger" onClick={() => sendExtensionMessage('STOP_SURF', { platform: surfCfg.platform })}>⏹ Dừng lướt</button>
            )}
          </div>
        </form>
        {surfResult && (
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                  🧭 {surfResult.platform === 'facebook' ? 'Facebook' : 'TikTok'} · {surfResult.topPosts?.length || 0} bài đã lưu
                </span>
                {(surfResult.topTopics || []).map((t, i) => (
                  <span key={i} className="status-tag status-tag--published">#{i + 1} {t.topic} ({t.postCount})</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="social-action-btn social-action-btn--primary"
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                  onClick={handleSaveAllSurfToViral}
                  disabled={!surfResult.topPosts?.length}
                  title="Lưu toàn bộ bài trong bảng này vào Kho bài Viral"
                >
                  📥 Lưu vào Kho Viral ({surfResult.topPosts?.length || 0})
                </button>
                <button
                  type="button"
                  className="social-action-btn social-action-btn--danger"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={handleClearSurfResult}
                  title="Xóa bảng kết quả lướt hiện tại"
                >
                  ✕ Đóng
                </button>
              </div>
            </div>
            <div className="social-table-shell social-table-shell--compact" style={{ maxHeight: '280px' }}>
              <table className="social-table">
                <thead><tr><th>#</th><th>Bài nổi bật</th><th>Tương tác</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {(surfResult.topPosts || []).map((p, i) => {
                    const postTitle = p.title || p.Title || 'Bài viết lướt feed'
                    const postUrl = p.postUrl || p.PostUrl || ''
                    const postThumb = p.thumbnailUrl || p.ThumbnailUrl || ''
                    const postAuthor = p.authorName || p.AuthorName || ''
                    const postPlat = String(p.platform || p.Platform || surfResult.platform || 'tiktok').toLowerCase()
                    const postLikes = Number(p.likesCount ?? p.LikesCount ?? 0)
                    const postComments = Number(p.commentsCount ?? p.CommentsCount ?? 0)
                    const isAlreadySaved = Boolean(postUrl && (savedSurfPostUrls.has(postUrl.toLowerCase()) || (viralPosts || []).some(v => String(v.postUrl || '').toLowerCase() === postUrl.toLowerCase())))
                    return (
                      <tr key={p.id || p.Id || postUrl || i}>
                        <td><strong>#{i + 1}</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {postThumb
                              ? <img src={postThumb} alt="" referrerPolicy="no-referrer" style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} onError={e => { e.currentTarget.style.display = 'none' }} />
                              : <span style={{ fontSize: '16px' }}>{postPlat === 'facebook' ? '📘' : '🎵'}</span>}
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>{postTitle}</div>
                              {postAuthor && <div style={{ fontSize: '11px', color: '#64748b' }}>👤 {postAuthor}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>❤️ {postLikes.toLocaleString('vi-VN')} · 💬 {postComments.toLocaleString('vi-VN')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className={'social-action-btn' + (isAlreadySaved ? ' is-saved' : '')}
                              title={isAlreadySaved ? 'Bài này đã có trong Kho Viral' : 'Lưu bài này vào Kho bài Viral'}
                              disabled={isAlreadySaved}
                              style={isAlreadySaved ? { opacity: 0.65, cursor: 'default' } : undefined}
                              onClick={() => handleSaveSurfPostToViral(p)}
                            >
                              {isAlreadySaved ? '✅ Đã lưu' : '📥 Lưu'}
                            </button>
                            {postUrl && <button type="button" className="social-action-btn social-table-link" onClick={() => onOpenSingleTab(postUrl, postPlat)}>Mở ↗</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {(!surfResult.topPosts || surfResult.topPosts.length === 0) && (
                    <tr><td colSpan={4} className="social-table-empty">Chưa có bài viết nào trong phiên lướt. Hãy thử tăng thời gian lướt hoặc kiểm tra từ khóa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!surfResult && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
            ℹ️ Bấm &quot;🧭 Bắt đầu lướt&quot; để tự động lướt và thu thập bài theo thời gian &amp; chủ đề. Dữ liệu sẽ được lưu tự động và không bị mất khi chuyển tab.
          </div>
        )}
      </section>

      {/* 3. LẤY BÀI VIRAL TÙY CHỈNH */}
      <section className="social-panel auto-card auto-card--wide">
        <div className="social-panel__head-row">
          <h3>🎯 Lấy bài Viral tùy chỉnh</h3>
          <div className="auto-pills">
            {[['both', '🌐 Cả 2'], ['facebook', '🔵 Facebook'], ['tiktok', '🎵 TikTok']].map(([id, label]) => (
              <button key={id} type="button" className={'auto-pill ' + (customViralCfg.platform === id ? 'is-active' : '')} onClick={() => setCustomViralCfg({ ...customViralCfg, platform: id })}>{label}</button>
            ))}
          </div>
        </div>
        <div className="auto-viral-grid">
          <div className="social-field"><label>FB Bài viết (≥ Like)</label><input type="number" min="100" className="social-input" value={customViralCfg.fbFeedMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, fbFeedMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>FB Thước phim (≥ Like)</label><input type="number" min="500" className="social-input" value={customViralCfg.fbReelMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, fbReelMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>TikTok (≥ Tim)</label><input type="number" min="1000" className="social-input" value={customViralCfg.tiktokMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, tiktokMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Nguồn TikTok</label><select className="social-select" value={customViralCfg.ttSourceMode} onChange={e => setCustomViralCfg({ ...customViralCfg, ttSourceMode: e.target.value })}><option value="explore">🧭 Khám phá</option><option value="search">🔎 Từ khóa</option></select></div>
          <div className="social-field"><label>Số bài / kênh</label><input type="number" min="1" max="40" className="social-input" value={customViralCfg.fbCount} onChange={e => setCustomViralCfg({ ...customViralCfg, fbCount: Number(e.target.value), tiktokCount: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Chủ đề / Từ khóa</label><input className="social-input" value={customViralCfg.customTopic} onChange={e => setCustomViralCfg({ ...customViralCfg, customTopic: e.target.value, topic: e.target.value.trim() ? 'custom' : 'all' })} placeholder="Trống = tất cả..." /></div>
          <div className="auto-actions" style={{ alignSelf: 'end' }}>
            <button type="button" className="social-btn-trigger" style={{ width: '100%', justifyContent: 'center', height: '40px' }} onClick={() => onCustomViralScrape(customViralCfg)}>🚀 Chạy cào ngay</button>
          </div>
        </div>
      </section>

      {/* 4. PHÂN TÍCH BÌNH LUẬN */}
      <section className="social-panel auto-card auto-card--wide">
        <div className="social-panel__head-row"><h3>💬 Phân tích bình luận</h3></div>
        <form onSubmit={handleAnalyzeComments} className="auto-inline-form">
          <input className="social-input" style={{ flex: 1 }} value={cmtCfg.postUrl} onChange={e => setCmtCfg({ ...cmtCfg, postUrl: e.target.value })} placeholder="Dán link bài viết Facebook hoặc video TikTok..." />
          <input type="number" min="10" max="120" className="social-input" style={{ width: '110px' }} value={cmtCfg.maxComments} onChange={e => setCmtCfg({ ...cmtCfg, maxComments: Number(e.target.value) })} title="Số bình luận" />
          <button type="submit" className="social-btn-trigger" disabled={cmtBusy}>{cmtBusy ? '⏳ Đang đọc...' : '🧠 Phân tích'}</button>
        </form>
        {cmtResult && (
          <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
            <div className="social-info-banner" style={{ marginBottom: 0 }}>
              <strong>📌 {cmtResult.totalComments} bình luận · {cmtResult.sentiment}</strong>
              <div>{cmtResult.summary}</div>
              {cmtResult.salesHook && <div style={{ marginTop: '4px', color: '#4ade80' }}>💡 {cmtResult.salesHook}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
              <div className="social-subform-card">
                <h4>🔥 Chủ đề nổi bật</h4>
                {(cmtResult.topics || []).map((t, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>{i + 1}. {t.topic}</strong><div className="social-muted-text">"{t.sampleQuote}"</div></div>)}
              </div>
              <div className="social-subform-card">
                <h4>🔁 Viết nhiều nhất</h4>
                {(cmtResult.mostRepeated || []).slice(0, 6).map((r, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>×{r.count}</strong> · {r.text}</div>)}
              </div>
              <div className="social-subform-card">
                <h4>❤️ Nhiều tim nhất</h4>
                {(cmtResult.topLiked || []).slice(0, 6).map((c, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>❤️ {Number(c.likes || 0).toLocaleString('vi-VN')}</strong> · <b>{c.author}</b>: {c.text}</div>)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. LỌC KÊNH THEO CHỦ ĐỀ */}
      <section className="social-panel auto-card auto-card--wide">
        <div className="social-panel__head-row">
          <h3>🕵️ Lọc kênh theo chủ đề</h3>
          <button type="button" className="social-action-btn" onClick={fillChannelsFromViral}>📥 Nạp từ kho Viral</button>
        </div>
        <form onSubmit={handleFilterChannels} className="auto-channel-grid">
          <div className="social-field"><label>Chủ đề</label><input className="social-input" value={channelTargetTopic} onChange={e => setChannelTargetTopic(e.target.value)} placeholder="Anime, Xe cộ, Công nghệ..." /></div>
          <div className="social-field"><label>Danh sách link kênh (mỗi dòng 1 link)</label><textarea rows={2} className="social-textarea" value={channelUrlsText} onChange={e => setChannelUrlsText(e.target.value)} placeholder={'https://www.tiktok.com/@...\nhttps://www.facebook.com/...'} /></div>
          <button type="submit" className="social-btn-trigger" style={{ height: '42px', alignSelf: 'end' }} disabled={channelBusy}>{channelBusy ? '⏳ Đang soi...' : '🔍 Lọc kênh'}</button>
        </form>
        {channelResults?.channels && (
          <div className="social-table-shell" style={{ marginTop: '12px' }}>
            <table className="social-table">
              <thead><tr><th>Kênh / Trang</th><th>Xu hướng (AI)</th><th>Độ khớp</th><th>Follower</th><th>Nhận định</th><th>Mở</th></tr></thead>
              <tbody>
                {channelResults.channels.map((c, idx) => (
                  <tr key={idx}>
                    <td><strong>{c.channelName || c.handle}</strong><div className="social-muted-text">{c.handle}</div></td>
                    <td><span className="channel-tag channel-tag--facebook">{c.mainTopic}</span></td>
                    <td><span className={'status-tag ' + (c.isMatch ? 'status-tag--published' : 'status-tag--unverified')}>{c.matchScore}%</span></td>
                    <td><strong>{Number(c.followersCount || 0).toLocaleString('vi-VN')}</strong></td>
                    <td style={{ fontSize: '12px' }}>{c.reason}</td>
                    <td><button type="button" className="social-action-btn social-table-link" onClick={() => onOpenSingleTab(c.channelUrl, c.platform)}>Mở ↗</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
