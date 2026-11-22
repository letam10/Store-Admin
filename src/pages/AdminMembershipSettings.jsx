/*
  FILE NOTE
  - Mục đích: Form cấu hình Thẻ Thành Viên (Đồng, Bạc, Vàng, Kim Cương) — tùy chỉnh mốc điểm, chiết khấu %, hệ số tích điểm, quyền lợi hiển thị và xem trước đồng bộ với trang Store.
  - Liên kết trực tiếp: server-dotnet/Controllers/AdminMembershipController.cs, src/pages/AdminModules.jsx, src/pages/AdminMembershipSettings.css
*/
import { useEffect, useState } from 'react'
import { apiJson } from '../api/chat'
import './AdminMembershipSettings.css'

const TIER_ICONS = { bronze: '🏆', silver: '☆', gold: '👑', diamond: '💎' }
const num = (v) => new Intl.NumberFormat('vi-VN').format(Number(v || 0))

export default function AdminMembershipSettings({ csrfToken }) {
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiJson('/api/admin/membership-settings', { signal: controller.signal })
      .then((res) => { if (!controller.signal.aborted) setPolicy(res.policy) })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message || 'Không tải được cài đặt thẻ thành viên.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  function updateTier(id, patch) {
    setPolicy((cur) => ({
      ...cur,
      tiers: cur.tiers.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier))
    }))
  }

  function updateBenefit(tierId, idx, text) {
    setPolicy((cur) => ({
      ...cur,
      tiers: cur.tiers.map((tier) => tier.id === tierId
        ? { ...tier, benefits: tier.benefits.map((b, i) => (i === idx ? text : b)) }
        : tier)
    }))
  }

  function addBenefit(tierId) {
    setPolicy((cur) => ({
      ...cur,
      tiers: cur.tiers.map((tier) => tier.id === tierId
        ? { ...tier, benefits: [...tier.benefits, 'Quyền lợi mới cho hạng ' + tier.name] }
        : tier)
    }))
  }

  function removeBenefit(tierId, idx) {
    setPolicy((cur) => ({
      ...cur,
      tiers: cur.tiers.map((tier) => tier.id === tierId && tier.benefits.length > 1
        ? { ...tier, benefits: tier.benefits.filter((_, i) => i !== idx) }
        : tier)
    }))
  }

  function syncTierTextFromNumbers(tier) {
    const nextSubtitle = tier.id === 'bronze'
      ? 'Hạng mặc định, miễn phí.'
      : `Mở khóa khi tích đủ ${num(tier.minPoints)} điểm.`
    const nextBenefits = tier.benefits.map((line) => {
      if (/giảm thêm\s+\d+%/i.test(line)) return `Tự động giảm thêm ${tier.discountPercent}% khi thanh toán`
      if (/tích điểm\s*x[\d.,]+/i.test(line)) return `Tích điểm x${String(tier.multiplier).replace('.', ',')}`
      if (/mỗi\s+[\d.]+\s*đ\s+hàng hóa/i.test(line)) return `Tích 1 điểm cho mỗi ${num(policy.goodsPerBasePoint)} đ hàng hóa đã thanh toán`
      if (/nhận 1 lượt quay/i.test(line)) return `Mỗi ${num(policy.goodsPerSpin)} đ đã thanh toán nhận 1 lượt quay`
      return line
    })
    updateTier(tier.id, { subtitle: nextSubtitle, benefits: nextBenefits })
  }

  async function save(e) {
    e.preventDefault()
    if (!policy) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        ...policy,
        goodsPerBasePoint: Number(policy.goodsPerBasePoint),
        goodsPerSpin: Number(policy.goodsPerSpin),
        tiers: policy.tiers.map((t) => ({
          ...t,
          minPoints: t.id === 'bronze' ? 0 : Number(t.minPoints),
          discountPercent: Number(t.discountPercent),
          multiplier: Number(t.multiplier),
          benefits: t.benefits.map((b) => b.trim()).filter(Boolean)
        }))
      }
      const res = await apiJson('/api/admin/membership-settings', {
        method: 'PUT',
        headers: { 'x-csrf-token': csrfToken },
        body: JSON.stringify(payload)
      })
      setPolicy(res.policy)
      setNotice('✅ Đã lưu cài đặt Thẻ Thành Viên! Chiết khấu, tích điểm và hiển thị trên trang Store sẽ tự động cập nhật theo cấu hình này.')
    } catch (err) {
      const msg = err.code === 'INVALID_MEMBERSHIP_THRESHOLDS'
        ? 'Mốc điểm phải tăng dần chặt: Đồng (0) < Bạc < Vàng < Kim Cương.'
        : (err.message || 'Không lưu được cấu hình thẻ thành viên.')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function resetDefaults() {
    if (!window.confirm('Khôi phục toàn bộ mốc điểm, chiết khấu và quyền lợi thẻ thành viên về mặc định?')) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res = await apiJson('/api/admin/membership-settings/reset', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken }
      })
      setPolicy(res.policy)
      setNotice('Đã khôi phục cấu hình Thẻ Thành Viên về mặc định.')
    } catch (err) {
      setError(err.message || 'Không khôi phục được mặc định.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-module-card">
      <div className="admin-module-head">
        <div>
          <p className="admin-eyebrow">CHÍNH SÁCH THÀNH VIÊN</p>
          <h2>Cài đặt Thẻ Thành Viên & Chiết Khấu</h2>
          <p>Điều chỉnh mốc điểm, % chiết khấu tự động khi thanh toán, hệ số tích điểm và danh sách quyền lợi hiển thị đồng bộ trên trang Store.</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="button-secondary" disabled={saving || !policy} onClick={resetDefaults}>↻ Mặc định</button>
        </div>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p role="status" style={{ fontWeight: 700, marginBottom: '12px' }}>{notice}</p>}
      {loading && <p>Đang tải cấu hình thẻ thành viên…</p>}

      {policy && (
        <form onSubmit={save}>
          {/* Quy tắc tích điểm & lượt quay chung */}
          <div className="membership-global-grid">
            <label>
              Tiền hàng cho 1 điểm cơ bản (₫)
              <input
                type="number"
                min="100"
                max="1000000"
                step="100"
                required
                value={policy.goodsPerBasePoint}
                onChange={(e) => setPolicy({ ...policy, goodsPerBasePoint: Number(e.target.value) })}
              />
            </label>
            <label>
              Tiền hàng nhận 1 lượt quay may mắn (₫)
              <input
                type="number"
                min="10000"
                max="100000000"
                step="10000"
                required
                value={policy.goodsPerSpin}
                onChange={(e) => setPolicy({ ...policy, goodsPerSpin: Number(e.target.value) })}
              />
            </label>
            <label className="membership-wide">
              Ghi chú quy tắc hiển thị bên dưới 4 thẻ thành viên trên Store
              <textarea
                rows="2"
                maxLength="600"
                value={policy.footerNote}
                onChange={(e) => setPolicy({ ...policy, footerNote: e.target.value })}
              />
            </label>
          </div>

          {/* Chỉnh sửa chi tiết 4 hạng thành viên */}
          <div className="membership-tiers-grid">
            {policy.tiers.map((tier) => (
              <article key={tier.id} className={`membership-tier-editor membership-tier-editor--${tier.id}`}>
                <div className="membership-tier-head">
                  <div className="membership-tier-badge">
                    <span className="membership-tier-icon" aria-hidden="true">{TIER_ICONS[tier.id] || '★'}</span>
                    <span>{tier.name} ({tier.englishLabel})</span>
                  </div>
                  <button type="button" className="table-action" onClick={() => syncTierTextFromNumbers(tier)} title="Tự cập nhật câu chữ mô tả theo số vừa sửa">
                    ↻ Khớp chữ theo số
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label>
                    Tên hạng (Tiếng Việt)
                    <input required maxLength="60" value={tier.name} onChange={(e) => updateTier(tier.id, { name: e.target.value })} />
                  </label>
                  <label>
                    Nhãn phụ (Tiếng Anh)
                    <input required maxLength="30" value={tier.englishLabel} onChange={(e) => updateTier(tier.id, { englishLabel: e.target.value.toUpperCase() })} />
                  </label>
                </div>

                <div className="membership-tier-metrics">
                  <label>
                    Mốc điểm mở khóa
                    <input
                      type="number"
                      min="0"
                      max="100000000"
                      step="1"
                      disabled={tier.id === 'bronze'}
                      value={tier.id === 'bronze' ? 0 : tier.minPoints}
                      onChange={(e) => updateTier(tier.id, { minPoints: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Chiết khấu tự động (%)
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="1"
                      required
                      value={tier.discountPercent}
                      onChange={(e) => updateTier(tier.id, { discountPercent: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Hệ số tích điểm (x)
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="0.1"
                      required
                      value={tier.multiplier}
                      onChange={(e) => updateTier(tier.id, { multiplier: Number(e.target.value) })}
                    />
                  </label>
                </div>

                <label>
                  Mô tả ngắn dưới tên hạng
                  <input required maxLength="200" value={tier.subtitle} onChange={(e) => updateTier(tier.id, { subtitle: e.target.value })} />
                </label>

                <div className="membership-benefits-list">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>Danh sách quyền lợi hiển thị trên thẻ</span>
                    <button type="button" className="table-action" onClick={() => addBenefit(tier.id)}>+ Thêm dòng</button>
                  </div>
                  {tier.benefits.map((benefit, idx) => (
                    <div key={idx} className="membership-benefit-row">
                      <input
                        maxLength="220"
                        value={benefit}
                        onChange={(e) => updateBenefit(tier.id, idx, e.target.value)}
                        aria-label={`Quyền lợi ${idx + 1} hạng ${tier.name}`}
                      />
                      <button
                        type="button"
                        className="table-action table-action--danger"
                        disabled={tier.benefits.length <= 1}
                        onClick={() => removeBenefit(tier.id, idx)}
                        title="Xóa dòng quyền lợi"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="admin-editor-actions">
            <button type="submit" disabled={saving}>{saving ? 'Đang lưu cài đặt…' : '💾 Lưu cài đặt Thẻ Thành Viên'}</button>
            <button type="button" className="button-secondary" disabled={saving} onClick={resetDefaults}>Khôi phục mặc định</button>
          </div>

          {/* Khung xem trước trực tiếp 4 thẻ giống hệt trang Store */}
          <div className="membership-store-preview" aria-label="Xem trước thẻ thành viên trên Store">
            <div className="membership-store-preview__head">
              <h3>👁️ Xem trước trực tiếp giao diện trang Thành viên (Store)</h3>
              <span style={{ fontSize: '11.5px', color: '#86efac' }}>Đồng bộ qua /api/storefront/membership</span>
            </div>
            <div className="membership-store-preview__cards">
              {policy.tiers.map((tier) => (
                <div key={tier.id} className={`membership-preview-card membership-preview-card--${tier.id}`}>
                  <small>{tier.englishLabel}</small>
                  <h4>{tier.name}</h4>
                  <p>{tier.subtitle}</p>
                  <span className="membership-preview-pill">
                    {tier.minPoints === 0 ? 'Miễn phí' : `${num(tier.minPoints)} điểm`}
                    {tier.discountPercent > 0 ? ` · -${tier.discountPercent}%` : ''}
                  </span>
                  <ul>
                    {tier.benefits.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <p className="membership-preview-note">ⓘ {policy.footerNote}</p>
          </div>
        </form>
      )}
    </section>
  )
}
