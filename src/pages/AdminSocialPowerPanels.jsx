/*
  FILE NOTE
  - Mục đích: Bộ Panel AI & Tự Động Hóa Mở Rộng v3.5 cho Store-Admin:
    1. ViralSalesIdeasPanel: Biến kho Viral thành Ý tưởng bán hàng gắn sản phẩm thật (nằm ngay dưới bảng Viral).
    2. SmartProductVisionPanel: Đăng sản phẩm tự động từ ảnh (Vision qwen3.5:4b) + Gợi ý giảm giá/tồn kho theo ngữ cảnh thực.
    3. AutomationSuitePanels: 5 Panel cấu hình bên dưới Panel đăng bài tự động:
       - Xem video / bài viết N lần
       - Đọc & AI phân tích bình luận (top chủ đề, viết nhiều nhất, thả tim nhiều nhất)
       - Cấu hình lấy bài Viral tùy chỉnh (ngưỡng like/tim, số bài, chủ đề)
       - Lọc Kênh / Trang cá nhân theo chủ đề
       - Lướt Facebook / TikTok theo thời gian (phút) & lọc top bài nổi bật
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
    <section className="social-panel" style={{ marginTop: '18px' }}>
      <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3>💡 AI Phân Tích Kho Viral → Ý Tưởng Bán Hàng Tự Động</h3>
          <p>Model qwen3.5:4b đọc xu hướng từ {viralCount} bài Viral và ghép trực tiếp với sản phẩm thật trong kho Store.</p>
        </div>
        <button type="button" className="social-btn-trigger" disabled={busy || viralCount === 0} onClick={generateIdeas}>
          {busy ? '⏳ AI đang phân tích...' : '🤖 Tạo Ý Tưởng Bán Hàng'}
        </button>
      </div>
      {error && <p className="social-alert social-alert--error">{error}</p>}
      {result && (
        <div style={{ display: 'grid', gap: '12px' }}>
          <div className="social-info-banner" style={{ marginBottom: 0 }}>
            <strong>📊 Nhận định xu hướng ({result.generatedBy}):</strong>
            <span>{result.summary}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {(result.ideas || []).map((idea, idx) => (
              <article key={idx} className="social-subform-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <span className={'channel-tag channel-tag--' + (idea.platform === 'tiktok' ? 'tiktok' : 'facebook')}>{idea.platform || 'facebook'}</span>
                  <span className="status-tag status-tag--published">{idea.trendName}</span>
                </div>
                <strong>🛍️ {idea.productName}</strong>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#4ade80' }}>"{idea.hook}"</div>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>{idea.angle}</p>
                <small className="social-muted-text">{idea.hashtags}</small>
                <button type="button" className="social-action-btn social-action-btn--primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={() => onUseIdea(idea)}>
                  ✍️ Đưa sang Soạn bài AI →
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
        setNotice(`✅ ${res.generatedBy} đã nhận diện xong ảnh sản phẩm!`)
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
        setNotice(`✅ Đã thêm sản phẩm "${res.product.name}" vào kho hàng!`)
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
      setNotice(`✅ Đã áp giảm ${item.suggestedDiscount || 15}% cho "${item.name}".`)
      const refreshed = await apiJson('/api/admin/social/ai/inventory-recommendations')
      setInvAdvice(refreshed)
    } catch (e) { setNotice('⚠️ ' + e.message) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', marginTop: '18px' }}>
      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>📸 Đăng Sản Phẩm Tự Động Từ Ảnh (Vision AI)</h3>
          <p>Tải 1 tấm ảnh lên → qwen3.5:4b nhìn ảnh tự điền Tên, Danh mục, Giá, Mô tả & lưu thẳng vào kho.</p>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          <input type="file" accept="image/*" onChange={handleFile} className="social-input" />
          <input type="text" className="social-input" placeholder="Gợi ý thêm cho AI (VD: chất liệu, dung tích...)" value={hint} onChange={e => setHint(e.target.value)} />
          {imageData && <img src={imageData} alt="Xem trước" style={{ maxHeight: '140px', objectFit: 'contain', borderRadius: '8px', background: '#091610', padding: '6px' }} />}
          <button type="button" className="social-btn-trigger" disabled={busy || !imageData} onClick={analyzeImage}>
            {busy ? '⏳ Vision AI đang nhìn ảnh...' : '👁️ AI Phân Tích Ảnh Sản Phẩm'}
          </button>
          {draft && (
            <div className="social-subform-card" style={{ display: 'grid', gap: '8px' }}>
              <input className="social-input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Tên sản phẩm" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <input className="social-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Danh mục" />
                <input className="social-input" type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="Giá (đ)" />
                <input className="social-input" type="number" value={draft.stockCount} onChange={e => setDraft({ ...draft, stockCount: e.target.value })} placeholder="Tồn kho" />
              </div>
              <textarea className="social-textarea" rows={3} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="social-btn-trigger" disabled={busy} onClick={() => saveNewProduct(false)}>💾 Lưu vào Kho</button>
                <button type="button" className="social-action-btn social-action-btn--primary" disabled={busy} onClick={() => saveNewProduct(true)}>🚀 Lưu & Soạn Bài Đăng</button>
              </div>
            </div>
          )}
          {notice && <small style={{ fontWeight: 700, color: '#4ade80' }}>{notice}</small>}
        </div>
      </section>

      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>📦 Quản Lý Kho, Giá & Khuyến Mãi Theo Ngữ Cảnh Thực</h3>
          <p>Gợi ý trực tiếp từ dữ liệu tồn kho & lịch sử mua SQL Server.</p>
        </div>
        {invAdvice ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div>
              <strong style={{ fontSize: '12.5px' }}>🔥 Tồn cao nên kích cầu giảm giá:</strong>
              {(invAdvice.highStockNeedPromo || []).slice(0, 4).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(134,239,172,0.12)' }}>
                  <div style={{ fontSize: '12px' }}>
                    <strong>{p.name}</strong>
                    <div className="social-muted-text">{money(p.price)} · Tồn {p.stockCount}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" className="social-action-btn" onClick={() => applyQuickDiscount(p)}>-{p.suggestedDiscount}%</button>
                    <button type="button" className="social-action-btn social-action-btn--primary" onClick={() => onSelectForPost?.(p)}>Đăng bài</button>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <strong style={{ fontSize: '12.5px', color: '#fbbf24' }}>⚠️ Cảnh báo sắp hết / hết tồn kho:</strong>
              {(invAdvice.lowStockAlert || []).slice(0, 4).map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '5px 0' }}>
                  <span>{p.name}</span>
                  <strong style={{ color: p.stockCount === 0 ? '#f87171' : '#fbbf24' }}>Còn {p.stockCount}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : <p className="social-muted-text">Đang tải phân tích kho…</p>}
      </section>
    </div>
  )
}

export function AutomationSuitePanels({ csrfToken, sendExtensionMessage, viralPosts, onCustomViralScrape, onOpenSingleTab, showNotice }) {
  // 1. Xem video / bài viết N lần
  const [watchCfg, setWatchCfg] = useState({ platform: 'tiktok', url: '', repeatCount: 5, dwellSeconds: 8 })
  const [watchBusy, setWatchBusy] = useState(false)

  // 2. Đọc & AI phân tích bình luận
  const [cmtCfg, setCmtCfg] = useState({ postUrl: '', maxComments: 40 })
  const [cmtBusy, setCmtBusy] = useState(false)
  const [cmtResult, setCmtResult] = useState(null)

  // 3. Cấu hình lấy bài Viral tùy chỉnh (ngưỡng like/tim, số bài, chủ đề)
  const [customViralCfg, setCustomViralCfg] = useState({
    platform: 'both', fbSourceMode: 'both', fbFeedMinLikes: 1000, fbReelMinLikes: 10000,
    tiktokMinLikes: 1000000, fbCount: 10, tiktokCount: 10, topic: 'all', customTopic: ''
  })

  // 4. Lọc Kênh / Trang cá nhân theo chủ đề
  const [channelUrlsText, setChannelUrlsText] = useState('')
  const [channelTargetTopic, setChannelTargetTopic] = useState('Anime')
  const [channelBusy, setChannelBusy] = useState(false)
  const [channelResults, setChannelResults] = useState(null)

  // 5. Lướt FB / TikTok theo thời gian (phút) & lọc top xu hướng
  const [surfCfg, setSurfCfg] = useState({ platform: 'tiktok', fbMode: 'feed', durationMinutes: 2, topic: '' })
  const [surfBusy, setSurfBusy] = useState(false)
  const [surfResult, setSurfResult] = useState(null)

  async function handleRunWatch(e) {
    e.preventDefault()
    setWatchBusy(true)
    try {
      const res = await sendExtensionMessage('AUTO_WATCH_TASK', watchCfg)
      if (!res?.ok) throw new Error(res?.error || 'Không thực hiện được tác vụ xem.')
      showNotice(`✅ Đã xem xong ${res.data?.watched || watchCfg.repeatCount} lượt trên ${watchCfg.platform.toUpperCase()}!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setWatchBusy(false) }
  }

  async function handleAnalyzeComments(e) {
    e.preventDefault()
    if (!cmtCfg.postUrl.trim()) return showNotice('Nhập link bài Facebook hoặc TikTok cần đọc bình luận.', 'error')
    setCmtBusy(true)
    try {
      const scraped = await sendExtensionMessage('SCRAPE_POST_COMMENTS', cmtCfg)
      if (!scraped?.ok) throw new Error(scraped?.error || 'Extension chưa đọc được bình luận.')
      const analyzed = await apiJson('/api/admin/social/ai/analyze-comments', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({
          platform: scraped.data?.platform || 'tiktok',
          postUrl: cmtCfg.postUrl,
          postTitle: scraped.data?.postTitle || '',
          comments: scraped.data?.comments || []
        })
      })
      setCmtResult(analyzed)
      showNotice(`✅ AI đã phân tích xong ${analyzed.totalComments || 0} bình luận!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setCmtBusy(false) }
  }

  function fillChannelsFromViral() {
    const urls = Array.from(new Set((viralPosts || []).map((v) => v.authorUrl).filter(Boolean))).slice(0, 10)
    if (!urls.length) return showNotice('Chưa có link kênh trong kho bài Viral — hãy cào bài trước hoặc tự dán link kênh.', 'info')
    setChannelUrlsText(urls.join('\n'))
  }

  async function handleFilterChannels(e) {
    e.preventDefault()
    const channelUrls = channelUrlsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    if (!channelUrls.length) return showNotice('Nhập ít nhất 1 link kênh TikTok hoặc trang Facebook.', 'error')
    setChannelBusy(true)
    try {
      const scraped = await sendExtensionMessage('SCRAPE_CHANNEL_PROFILES', { channelUrls })
      if (!scraped?.ok) throw new Error(scraped?.error || 'Chưa quét được hồ sơ kênh.')
      const analyzed = await apiJson('/api/admin/social/ai/classify-channels', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify({ targetTopic: channelTargetTopic, channels: scraped.data?.channels || [] })
      })
      setChannelResults(analyzed)
      showNotice(`✅ AI đã phân loại xong ${(analyzed.channels || []).length} kênh theo chủ đề "${channelTargetTopic}"!`)
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
          platform: surfCfg.platform,
          targetTopic: surfCfg.topic || 'all',
          durationMinutes: Number(surfCfg.durationMinutes) || 2,
          posts: surfed.data?.posts || []
        })
      })
      setSurfResult(analyzed)
      showNotice(`✅ Lướt xong ${surfCfg.durationMinutes} phút — lọc được ${analyzed.matchedCount} bài nổi bật!`)
    } catch (err) { showNotice(err.message, 'error') }
    finally { setSurfBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gap: '18px', marginTop: '18px' }}>
      {/* PANEL 1: XEM VIDEO / BÀI VIẾT TỰ ĐỘNG N LẦN */}
      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>👁️ Cấu Hình Xem Video / Bài Viết Tự Động</h3>
          <p>Cho Extension chạy ngầm xem tự động số lần tùy chọn (giúp nuôi tương tác tài khoản hoặc theo dõi bài viết).</p>
        </div>
        <form onSubmit={handleRunWatch} className="social-form-grid" style={{ marginBottom: 0, alignItems: 'end' }}>
          <div className="social-field"><label>Nền tảng</label><select className="social-select" value={watchCfg.platform} onChange={e => setWatchCfg({ ...watchCfg, platform: e.target.value })}><option value="tiktok">TikTok</option><option value="facebook">Facebook</option></select></div>
          <div className="social-field"><label>Link bài / video (để trống = lướt đề xuất)</label><input className="social-input" value={watchCfg.url} onChange={e => setWatchCfg({ ...watchCfg, url: e.target.value })} placeholder="https://www.tiktok.com/..." /></div>
          <div className="social-field"><label>Số lần xem</label><input type="number" min="1" max="50" className="social-input" value={watchCfg.repeatCount} onChange={e => setWatchCfg({ ...watchCfg, repeatCount: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Dừng mỗi lượt (giây)</label><input type="number" min="3" max="120" className="social-input" value={watchCfg.dwellSeconds} onChange={e => setWatchCfg({ ...watchCfg, dwellSeconds: Number(e.target.value) })} /></div>
          <button type="submit" className="social-btn-trigger" disabled={watchBusy}>{watchBusy ? '⏳ Đang xem...' : '▶ Chạy Xem Tự Động'}</button>
        </form>
      </section>

      {/* PANEL 2: ĐỌC & AI PHÂN TÍCH BÌNH LUẬN */}
      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>💬 Cấu Hình Đọc & Phân Tích Bình Luận (AI Local)</h3>
          <p>Đọc bình luận bài Facebook / TikTok → AI lọc ra Top chủ đề thảo luận, bình luận viết lặp lại nhiều nhất & bình luận thả tim cao nhất.</p>
        </div>
        <form onSubmit={handleAnalyzeComments} className="social-form-grid" style={{ marginBottom: '12px', alignItems: 'end' }}>
          <div className="social-field" style={{ gridColumn: 'span 2' }}><label>Link bài đăng Facebook hoặc TikTok *</label><input className="social-input" value={cmtCfg.postUrl} onChange={e => setCmtCfg({ ...cmtCfg, postUrl: e.target.value })} placeholder="Dán link video TikTok hoặc bài viết Facebook..." /></div>
          <div className="social-field"><label>Số bình luận cần đọc</label><input type="number" min="10" max="120" className="social-input" value={cmtCfg.maxComments} onChange={e => setCmtCfg({ ...cmtCfg, maxComments: Number(e.target.value) })} /></div>
          <button type="submit" className="social-btn-trigger" disabled={cmtBusy}>{cmtBusy ? '⏳ Đang đọc & phân tích...' : '🧠 Đọc & Phân Tích Bình Luận'}</button>
        </form>
        {cmtResult && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div className="social-info-banner" style={{ marginBottom: 0 }}>
              <strong>📌 Tổng quan ({cmtResult.totalComments} bình luận · Cảm xúc: {cmtResult.sentiment}):</strong>
              <div>{cmtResult.summary}</div>
              {cmtResult.salesHook && <div style={{ marginTop: '4px', color: '#4ade80' }}>💡 Gợi ý bán hàng: {cmtResult.salesHook}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div className="social-subform-card">
                <h4>🔥 Top Chủ Đề Đang Thảo Luận</h4>
                {(cmtResult.topics || []).map((t, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>{i + 1}. {t.topic}</strong> ({t.interestLevel})<div className="social-muted-text">"{t.sampleQuote}"</div></div>)}
              </div>
              <div className="social-subform-card">
                <h4>🔁 Bình Luận Viết Nhiều Nhất</h4>
                {(cmtResult.mostRepeated || []).slice(0, 6).map((r, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>×{r.count}</strong> · {r.text}</div>)}
              </div>
              <div className="social-subform-card">
                <h4>❤️ Bình Luận Được Thả Tim Nhiều Nhất</h4>
                {(cmtResult.topLiked || []).slice(0, 6).map((c, i) => <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(134,239,172,0.12)', fontSize: '12px' }}><strong>❤️ {Number(c.likes || 0).toLocaleString('vi-VN')}</strong> · <b>{c.author}</b>: {c.text}</div>)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* PANEL 3: CẤU HÌNH LẤY BÀI VIRAL TÙY CHỈNH NGƯỠNG LIKE / TIM / SỐ BÀI */}
      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>🎯 Cấu Hình Lấy Bài Viral Tùy Chỉnh (Ngưỡng Like / Tim & Số Bài)</h3>
          <p>Tự chọn ngưỡng tối thiểu (mặc định FB Bài viết ≥ 1.000, FB Thước phim ≥ 10.000, TikTok ≥ 1.000.000), số bài và chủ đề muốn lấy.</p>
        </div>
        <div className="social-form-grid" style={{ marginBottom: '10px' }}>
          <div className="social-field"><label>Nền tảng</label><select className="social-select" value={customViralCfg.platform} onChange={e => setCustomViralCfg({ ...customViralCfg, platform: e.target.value })}><option value="both">Cả Facebook & TikTok</option><option value="facebook">Chỉ Facebook</option><option value="tiktok">Chỉ TikTok</option></select></div>
          <div className="social-field"><label>FB Bài viết tối thiểu (Like)</label><input type="number" min="100" className="social-input" value={customViralCfg.fbFeedMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, fbFeedMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>FB Thước phim tối thiểu (Like)</label><input type="number" min="500" className="social-input" value={customViralCfg.fbReelMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, fbReelMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>TikTok tối thiểu (Tim)</label><input type="number" min="1000" className="social-input" value={customViralCfg.tiktokMinLikes} onChange={e => setCustomViralCfg({ ...customViralCfg, tiktokMinLikes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Số bài mỗi kênh</label><input type="number" min="1" max="40" className="social-input" value={customViralCfg.fbCount} onChange={e => setCustomViralCfg({ ...customViralCfg, fbCount: Number(e.target.value), tiktokCount: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Chủ đề / Từ khóa tùy nhập</label><input className="social-input" value={customViralCfg.customTopic} onChange={e => setCustomViralCfg({ ...customViralCfg, customTopic: e.target.value, topic: e.target.value.trim() ? 'custom' : 'all' })} placeholder="Để trống = Tất cả xu hướng..." /></div>
        </div>
        <button type="button" className="social-btn-trigger" onClick={() => onCustomViralScrape(customViralCfg)}>🚀 Chạy Cào Viral Theo Cấu Hình Này</button>
      </section>

      {/* PANEL 4: LỌC KÊNH / TRANG CÁ NHÂN THEO CHỦ ĐỀ */}
      <section className="social-panel">
        <div className="social-panel__heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3>🕵️ Lọc Kênh TikTok / Trang Facebook Theo Chủ Đề</h3>
            <p>Quét tiểu sử & danh sách video/bài đăng của từng kênh → AI Local xác định kênh thiên về chủ đề gì & chấm điểm phù hợp.</p>
          </div>
          <button type="button" className="social-action-btn" onClick={fillChannelsFromViral}>📥 Nạp nhanh link kênh từ kho Viral</button>
        </div>
        <form onSubmit={handleFilterChannels} style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'end' }}>
            <div className="social-field"><label>Chủ đề cần lọc</label><input className="social-input" value={channelTargetTopic} onChange={e => setChannelTargetTopic(e.target.value)} placeholder="VD: Anime, Review đồ công nghệ, Âm nhạc..." /></div>
            <div className="social-field"><label>Danh sách link kênh (mỗi dòng 1 link)</label><textarea rows={3} className="social-textarea" value={channelUrlsText} onChange={e => setChannelUrlsText(e.target.value)} placeholder={'https://www.tiktok.com/@c0kin33\nhttps://www.facebook.com/...'} /></div>
            <button type="submit" className="social-btn-trigger" disabled={channelBusy}>{channelBusy ? '⏳ Đang soi kênh...' : '🔍 Lọc Kênh Bằng AI'}</button>
          </div>
        </form>
        {channelResults?.channels && (
          <div className="social-table-shell" style={{ marginTop: '12px' }}>
            <table className="social-table">
              <thead><tr><th>Kênh / Trang</th><th>Chủ đề chính (AI)</th><th>Độ khớp</th><th>Follower</th><th>Nhận định AI</th><th>Mở</th></tr></thead>
              <tbody>
                {channelResults.channels.map((c, idx) => (
                  <tr key={idx}>
                    <td><strong>{c.channelName || c.handle}</strong><div className="social-muted-text">{c.handle}</div></td>
                    <td><span className="channel-tag channel-tag--facebook">{c.mainTopic}</span></td>
                    <td><span className={'status-tag ' + (c.isMatch ? 'status-tag--published' : 'status-tag--unverified')}>{c.matchScore}% {c.isMatch ? '✓ Khớp' : 'Lệch'}</span></td>
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

      {/* PANEL 5: LƯỚT FACEBOOK / TIKTOK THEO THỜI GIAN & XẾP HẠNG TOP XU HƯỚNG */}
      <section className="social-panel">
        <div className="social-panel__heading">
          <h3>🧭 Lướt Facebook / TikTok Theo Thời Gian & Lọc Bài Đứng Top</h3>
          <p>Extension tự lướt liên tục trong X phút rồi đưa toàn bộ bài đã gặp cho AI gom nhóm chủ đề hot nhất & xếp hạng bài đứng đầu.</p>
        </div>
        <form onSubmit={handleSurfAndRank} className="social-form-grid" style={{ marginBottom: '12px', alignItems: 'end' }}>
          <div className="social-field"><label>Nền tảng</label><select className="social-select" value={surfCfg.platform} onChange={e => setSurfCfg({ ...surfCfg, platform: e.target.value })}><option value="tiktok">TikTok</option><option value="facebook">Facebook</option></select></div>
          {surfCfg.platform === 'facebook' && (
            <div className="social-field"><label>Khu vực lướt FB</label><select className="social-select" value={surfCfg.fbMode} onChange={e => setSurfCfg({ ...surfCfg, fbMode: e.target.value })}><option value="feed">Trang chủ (Bài viết)</option><option value="reels">Thước phim (Reels)</option></select></div>
          )}
          <div className="social-field"><label>Thời gian lướt (phút)</label><input type="number" min="1" max="30" className="social-input" value={surfCfg.durationMinutes} onChange={e => setSurfCfg({ ...surfCfg, durationMinutes: Number(e.target.value) })} /></div>
          <div className="social-field"><label>Lọc chủ đề (để trống = tìm mọi top)</label><input className="social-input" value={surfCfg.topic} onChange={e => setSurfCfg({ ...surfCfg, topic: e.target.value })} placeholder="VD: Anime, Gia dụng..." /></div>
          <button type="submit" className="social-btn-trigger" disabled={surfBusy}>{surfBusy ? `⏳ Đang lướt ${surfCfg.durationMinutes} phút...` : '🧭 Bắt Đầu Lướt & Xếp Hạng'}</button>
        </form>
        {surfResult && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(surfResult.topTopics || []).map((t, i) => (
                <div key={i} className="social-subform-card" style={{ padding: '8px 12px', fontSize: '12px' }}>
                  <strong>#{i + 1} {t.topic}</strong> · {t.postCount} bài · 👍 {Number(t.totalLikes || 0).toLocaleString('vi-VN')}
                </div>
              ))}
            </div>
            <div className="social-table-shell social-table-shell--compact">
              <table className="social-table">
                <thead><tr><th>Top</th><th>Bài đăng nổi bật</th><th>Chủ đề</th><th>Tương tác</th><th>Mở</th></tr></thead>
                <tbody>
                  {(surfResult.topPosts || []).map((p, i) => (
                    <tr key={p.id || i}>
                      <td><strong>#{i + 1}</strong></td>
                      <td><strong>{p.title}</strong></td>
                      <td><span className="channel-tag channel-tag--tiktok">{p.category}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>❤️ <strong>{Number(p.likesCount || 0).toLocaleString('vi-VN')}</strong> · 💬 {Number(p.commentsCount || 0).toLocaleString('vi-VN')}</td>
                      <td><button type="button" className="social-action-btn social-table-link" onClick={() => onOpenSingleTab(p.postUrl, p.platform)}>Mở ↗</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
