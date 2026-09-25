import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
import './AdminCommerce.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

function useReport(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const reload = () => apiJson(path).then(setData).catch((failure) => setError(failure.message))
  useEffect(() => {
    const controller = new AbortController()
    apiJson(path, { signal: controller.signal }).then(setData)
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [path])
  return { data, error, reload }
}

export function AdminCustomers() {
  const { data, error } = useReport('/api/admin/customers')
  const [query, setQuery] = useState('')
  const [minPoints, setMinPoints] = useState(0)
  const [selected, setSelected] = useState(null)
  const rows = useMemo(() => (data?.customers || []).filter((item) =>
    item.points >= Number(minPoints || 0) && (item.username.toLowerCase().includes(query.toLowerCase()) || item.email.toLowerCase().includes(query.toLowerCase()))),
  [data, minPoints, query])
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">KHÁCH HÀNG THỰC</p><h2>Điểm và hạng thành viên</h2><p>Sắp xếp theo điểm giảm dần. Điểm chỉ cộng khi đơn được ghi nhận thanh toán.</p></div><span className="admin-preview-badge">{data?.customers.length || 0} khách</span></div>
    <div className="admin-module-toolbar"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email" /><label>Điểm tối thiểu <input type="number" min="0" value={minPoints} onChange={(event) => setMinPoints(event.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p>Đang tải…</p>}
     {data && <div className="admin-table-wrap"><table><thead><tr><th>Khách</th><th>Điểm</th><th>Hạng</th><th>Tiền hàng đã thanh toán</th><th>Lượt quay</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="admin-clickable-row" onClick={() => setSelected(item)}><td><button className="admin-link-button" type="button" onClick={() => setSelected(item)}>{item.username}</button><small>{item.email}</small></td><td><b>{item.points.toLocaleString('vi-VN')}</b></td><td>{item.tier}</td><td>{money.format(item.paidGoodsTotal)}</td><td>{item.spinCredits}</td></tr>)}</tbody></table></div>}
     {selected && <section className="admin-detail-panel"><div><p className="admin-eyebrow">HỒ SƠ TÀI KHOẢN</p><h3>{selected.username}</h3></div><button type="button" onClick={() => setSelected(null)}>Đóng</button><dl><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Email đăng ký</dt><dd>{selected.email}</dd></div><div><dt>Tài khoản đăng nhập</dt><dd>{selected.username} hoặc {selected.email}</dd></div><div><dt>Ngày đăng ký</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</dd></div><div><dt>Mật khẩu</dt><dd>Không hiển thị · backend lưu dạng băm</dd></div><div><dt>Hạng / điểm</dt><dd>{selected.tier} · {selected.points.toLocaleString('vi-VN')} điểm</dd></div><div><dt>Trạng thái</dt><dd>Đang hoạt động</dd></div></dl></section>}
  </section>
}

export function AdminVouchers({ csrfToken }) {
  const { data, error, reload } = useReport('/api/admin/customers')
  const [customerId, setCustomerId] = useState('')
  const [type, setType] = useState('amount')
  const [value, setValue] = useState(100000)
  const [days, setDays] = useState(30)
  const [created, setCreated] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setSubmitError(''); setCreated(null)
    try {
      const expiresAt = new Date(Date.now() + Number(days) * 86400000).toISOString()
      const payload = await apiJson('/api/admin/customers/' + customerId + '/vouchers', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ type, value: Number(value), expiresAt }) })
      setCreated(payload.voucher); reload()
    } catch (failure) { setSubmitError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">ƯU ĐÃI CỦA KHÁCH</p><h2>Cấp voucher</h2><p>Mã gồm 10 ký tự được tạo duy nhất trên máy chủ, không chỉnh sửa. Voucher hết hạn hoặc đã dùng sẽ biến mất khỏi tài khoản.</p></div></div>
    {error && <p role="alert">{error}</p>}
    <form className="admin-commerce-form" onSubmit={submit}>
      <label>Khách hàng<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Chọn khách</option>{data?.customers.map((item) => <option key={item.id} value={item.id}>{item.username} · {item.points} điểm</option>)}</select></label>
      <label>Loại<select value={type} onChange={(event) => { setType(event.target.value); setValue(event.target.value === 'amount' ? 100000 : 20) }}><option value="amount">Giảm số tiền</option><option value="percent">Giảm phần trăm</option></select></label>
      <label>Giá trị<input type="number" min="1" max={type === 'amount' ? '10000000' : '100'} value={value} onChange={(event) => setValue(event.target.value)} required /></label>
      <label>Hạn dùng sau (ngày)<input type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} required /></label>
      <button type="submit" disabled={busy || !customerId}>{busy ? 'Đang cấp…' : 'Cấp voucher'}</button>
    </form>
    {submitError && <p role="alert">{submitError}</p>}{created && <p role="status">Đã cấp {created.label} · mã <code>{created.code}</code> · hết hạn {new Date(created.expiresAt).toLocaleDateString('vi-VN')}</p>}
  </section>
}

export function AdminFavorites() {
  const { data, error } = useReport('/api/admin/favorites')
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">SỞ THÍCH KHÁCH HÀNG</p><h2>Sản phẩm được yêu thích nhất</h2></div></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p>Đang tải…</p>}
    {data && <div className="admin-view-list">{data.favorites.length ? data.favorites.map((item, index) => <article key={item.id}><b className="admin-view-rank">{index + 1}</b><div><strong>{item.name}</strong><small>{item.id}</small></div><b>{item.count} lượt yêu thích</b></article>) : <p>Chưa có sản phẩm yêu thích.</p>}</div>}
  </section>
}

export function AdminReviews({ csrfToken }) {
  const { data, error, reload } = useReport('/api/admin/reviews')
  const [drafts, setDrafts] = useState({})
  const [saveError, setSaveError] = useState('')
  async function reply(id) {
    setSaveError('')
    try {
      await apiJson('/api/admin/reviews/' + id + '/reply', { method: 'PATCH', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ reply: drafts[id] }) })
      reload()
    } catch (failure) { setSaveError(failure.message) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">PHẢN HỒI KHÁCH HÀNG</p><h2>Đánh giá và bình luận</h2></div><span className="admin-preview-badge">{data?.reviews.length || 0} đánh giá</span></div>
    {error && <p role="alert">{error}</p>}{saveError && <p role="alert">{saveError}</p>}
    {!data && !error && <p>Đang tải…</p>}
    <div className="admin-commerce-list">{data?.reviews.map((item) => <article key={item.id}><h3>{item.productName}</h3><p>{item.username} · {'★'.repeat(item.rating)} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</p><blockquote>{item.comment}</blockquote>{item.adminReply && <p><b>Store trả lời:</b> {item.adminReply}</p>}<label>Trả lời khách<textarea rows="2" maxLength="2000" value={drafts[item.id] ?? item.adminReply} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" disabled={!(drafts[item.id] || '').trim()} onClick={() => reply(item.id)}>Gửi trả lời</button></article>)}</div>
    {data?.reviews.length === 0 && <p>Chưa có đánh giá.</p>}
  </section>
}

export function AdminOrders({ csrfToken }) {
  const { data, error, reload } = useReport('/api/admin/customer-orders')
  const [actionError, setActionError] = useState('')
  async function markPaid(id) {
    setActionError('')
    try {
      await apiJson('/api/admin/customer-orders/' + id + '/paid', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({}) })
      reload()
    } catch (failure) { setActionError(failure.message) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">ĐƠN KHÁCH HÀNG</p><h2>Ghi nhận thanh toán</h2><p>Chỉ bấm sau khi đã xác nhận tiền thực nhận. Điểm và lượt quay sẽ được cộng đúng một lần.</p></div></div>
    {error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}
    {!data && !error && <p>Đang tải…</p>}
    {data && <div className="admin-table-wrap"><table><thead><tr><th>Đơn</th><th>Khách / giao nhận</th><th>Tiền hàng sau giảm</th><th>Phí giao</th><th>Tổng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.orders.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.username}<small>{item.recipient} · {item.phone}</small><small>{item.address || 'Nhận tại cửa hàng'} · {item.region}{item.region === 'far' ? ' · ' + item.distanceKm + ' km' : ''}</small></td><td>{money.format(item.goodsTotal)}</td><td>{money.format(item.shippingFee)}</td><td>{money.format(item.total)}</td><td>{item.status === 'paid' ? 'Đã thanh toán · +' + item.pointsEarned + ' điểm' : 'Chờ thanh toán'}</td><td>{item.status === 'pending' && <button type="button" onClick={() => markPaid(item.id)}>Ghi nhận đã thanh toán</button>}</td></tr>)}</tbody></table>{data.orders.length === 0 && <p>Chưa có đơn.</p>}</div>}
  </section>
}
