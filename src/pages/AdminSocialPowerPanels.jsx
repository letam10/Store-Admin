/*
  FILE NOTE
  - Mục đích: Bộ 5 Panel Tự động hóa MXH v3.5.1 (AdminSocialPowerPanels).
  - Nâng cấp:
    1. Trong customViralCfg thêm ttSourceMode: 'explore' và dropdown Nguồn TikTok (Khám phá / Từ khóa).
    2. Trong surfCfg thêm ttSourceMode: 'explore', hiển thị tùy chọn Nguồn TikTok và ô tìm kiếm khi chọn search, thêm nút ⏹ Dừng lướt tức thì khi surfBusy.
  - Liên kết trực tiếp: src/pages/AdminSocialAutomation.jsx, src/pages/AdminSocialAutomation.css
  - Vùng ảnh hưởng khi sửa: Giao diện Panel Lấy bài Viral tùy chỉnh và Panel Lướt theo thời gian thực tế.
*/
import { useEffect, useState } from 'react'
import { apiJson } from '../api/chat'

const money = (v) => new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + 'đ'

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

export function AutomationSuitePanels({ csrfToken, sendExtensionMessage, viralPosts, onCustomViralScrape, onOpenSingleTab, showNotice }) {
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

  const [surfCfg, setSurfCfg] = useState({ platform: 'tiktok', fbMode: 'feed', ttSourceMode: 'explore', durationMinutes: 3, topic: '' })
  const [surfBusy, setSurfBusy] = useState(false)
  const [surfResult, setSurfResult] = useState(null)

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
    e.preventDefault()
    setSurfBusy(true)
    try {
      const surfed = await sendExtensionMessage('SURF_AND_COLLECT', surfCfg)
      if (!surfed?.ok) throw new Error(surfed?.error || 'Không lướt được feed.')
      const analyzed = await apiJson('/api/admin/social/ai/analyze-surf', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          platform: surfCfg.platform, targetTopic: surfCfg.topic || 'all',
          durationMinutes: Number(surfCfg.durationMinutes) || 3, posts: surfed.data?.posts || []
        })
      })
      setSurfResult(analyzed)
      showNotice(`✅ Lướt đủ ${surfCfg.durationMinutes} phút — lọc được ${analyzed.matchedCount} bài!`)
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
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(surfResult.topTopics || []).map((t, i) => (
                <span key={i} className="status-tag status-tag--published">#{i + 1} {t.topic} ({t.postCount})</span>
              ))}
            </div>
            <div className="social-table-shell social-table-shell--compact" style={{ maxHeight: '260px' }}>
              <table className="social-table">
                <thead><tr><th>Top</th><th>Bài nổi bật</th><th>Tương tác</th><th>Mở</th></tr></thead>
                <tbody>
                  {(surfResult.topPosts || []).map((p, i) => (
                    <tr key={p.id || i}>
                      <td><strong>#{i + 1}</strong></td>
                      <td><strong>{p.title}</strong></td>
                      <td style={{ whiteSpace: 'nowrap' }}>❤️ {Number(p.likesCount || 0).toLocaleString('vi-VN')} · 💬 {Number(p.commentsCount || 0).toLocaleString('vi-VN')}</td>
                      <td><button type="button" className="social-action-btn social-table-link" onClick={() => onOpenSingleTab(p.postUrl, p.platform)}>Mở ↗</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
