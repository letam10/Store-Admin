/**
 * @codex-vn-doc
 * Tệp: src/pages/AdminCommerce.jsx
 * Mục đích: Giao diện quản lý sản phẩm, voucher, đơn hàng, khách hàng và dữ liệu thương mại.
 * Thành phần chính: AdminCustomers, AdminVouchers, AdminFavorites, AdminReviews, AdminOrders.
 * Liên kết trực tiếp: react, ../api/chat.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import { AdminOrders as OrderManager } from './AdminOrderWorkflow'
import DropdownMenu from '../components/ui/DropdownMenu'
import './AdminCommerce.css'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

// Chức năng adminErrorMessage: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function adminErrorMessage(failure, fallback = 'Co loi xay ra, vui long thu lai.') {
  const code = String(failure?.code || '').toUpperCase()
  const known = { INVALID_PRODUCT: 'Du lieu san pham khong hop le.', INVALID_PRODUCT_OFFER: 'Gia tri giam gia hoac ton kho khong hop le.', INVALID_VOUCHER: 'Thong tin voucher khong hop le.', CUSTOMER_NOT_FOUND: 'Khong tim thay khach hang.', UNAUTHENTICATED: 'Phien dang nhap da het, vui long dang nhap lai.' }
  return known[code] || (failure?.message && !/^[A-Z0-9_ -]+$/.test(String(failure.message)) ? failure.message : fallback)
}

// Chức năng useReport: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function useReport(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  // Chức năng reload: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const reload = () => apiJson(path).then(setData).catch((failure) => setError(failure.message))
  useEffect(() => {
    const controller = new AbortController()
    apiJson(path, { signal: controller.signal }).then(setData)
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [path])
  return { data, error, reload }
}

// Chức năng AdminCustomers: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminCustomers() {
  const { data, error } = useReport('/api/admin/customers')
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  const [query, setQuery] = useState('')
  const [minPoints, setMinPoints] = useState(0)
  const [selected, setSelected] = useState(null)
  const rows = useMemo(() => (data?.customers || []).filter((item) =>
    // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
    item.points >= Number(minPoints || 0) && (item.username.toLowerCase().includes(query.toLowerCase()) || item.email.toLowerCase().includes(query.toLowerCase()))),
  [data, minPoints, query])
  const customers = data?.customers || []
  const totalPoints = customers.reduce((sum, item) => sum + Number(item.points || 0), 0)
  const topCustomer = [...customers].sort((a, b) => Number(b.points || 0) - Number(a.points || 0))[0]
  const activeSpinCredits = customers.reduce((sum, item) => sum + Number(item.spinCredits || 0), 0)
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">KHÁCH HÀNG THỰC</p><h2>Điểm và hạng thành viên</h2><p>Sắp xếp theo điểm giảm dần. Điểm chỉ cộng khi đơn được ghi nhận thanh toán.</p></div><span className="admin-preview-badge">{data?.customers?.length || 0} khách</span></div>
    <div className="admin-commerce-summary"><div><small>Tổng khách</small><b>{customers.length}</b><span>Đang theo dõi</span></div><div><small>Tổng điểm</small><b>{totalPoints.toLocaleString('vi-VN')}</b><span>Điểm tích lũy</span></div><div><small>Người dẫn đầu</small><b>{topCustomer?.username || '—'}</b><span>{topCustomer ? topCustomer.points.toLocaleString('vi-VN') + ' điểm' : 'Chưa có dữ liệu'}</span></div><div><small>Lượt quay còn lại</small><b>{activeSpinCredits}</b><span>Toàn hệ thống</span></div></div>

    <div className="admin-module-toolbar"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email" /><label>Điểm tối thiểu <input type="number" min="0" value={minPoints} onChange={(event) => setMinPoints(event.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p>Đang tải…</p>}
     {data && <div className="admin-table-wrap"><table><thead><tr><th>Khách</th><th>Điểm</th><th>Hạng</th><th>Tiền hàng đã thanh toán</th><th>Lượt quay</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="admin-clickable-row" onClick={() => setSelected(item)}><td><button className="admin-link-button" type="button" onClick={() => setSelected(item)}>{item.username}</button><small>{item.email}</small></td><td><b>{item.points.toLocaleString('vi-VN')}</b></td><td>{item.tier}</td><td>{money.format(item.paidGoodsTotal)}</td><td>{item.spinCredits}</td></tr>)}</tbody></table></div>}
     {selected && <section className="admin-detail-panel"><div><p className="admin-eyebrow">HỒ SƠ TÀI KHOẢN</p><h3>{selected.username}</h3></div><button type="button" onClick={() => setSelected(null)}>Đóng</button><dl><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Email đăng ký</dt><dd>{selected.email}</dd></div><div><dt>Tài khoản đăng nhập</dt><dd>{selected.username} hoặc {selected.email}</dd></div><div><dt>Ngày đăng ký</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</dd></div><div><dt>Mật khẩu</dt><dd>Không hiển thị · backend lưu dạng băm</dd></div><div><dt>Hạng / điểm</dt><dd>{selected.tier} · {selected.points.toLocaleString('vi-VN')} điểm</dd></div><div><dt>Trạng thái</dt><dd>Đang hoạt động</dd></div></dl></section>}
  </section>
}

// Chức năng AdminVouchers: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminVouchers({ csrfToken }) {
  const { data, error } = useReport('/api/admin/customers')
  const { data: voucherData, error: voucherError, reload } = useReport('/api/admin/vouchers')
  const dateInput = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  const [customerId, setCustomerId] = useState('')
  const [scope, setScope] = useState('goods')
  const [type, setType] = useState('amount')
  const [value, setValue] = useState(100000)
  const [today] = useState(() => dateInput(Date.now()))
  const [expiresOn, setExpiresOn] = useState(() => dateInput(Date.now() + 30 * 86400000))
  const [editing, setEditing] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const mutationGate = useRef(false)
  const [filter, setFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  const vouchers = voucherData?.vouchers || []
  const visible = vouchers.filter(voucher => filter === 'all' || voucher.scope === filter)

  function edit(voucher) {
    setPendingDelete(null)
    setEditing(voucher.code); setCustomerId(String(voucher.customerId))
    setScope(voucher.scope || 'goods')
    setType(voucher.scope === 'shipping' && voucher.type === 'percent' && Number(voucher.value) === 100 ? 'free' : voucher.type)
    setValue(Number(voucher.value)); setExpiresOn(dateInput(voucher.expiresAt))
    setNotice(''); setSubmitError('')
    document.getElementById('voucher-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function submit(event) {
    event.preventDefault(); if (mutationGate.current) return
    mutationGate.current = true; setBusy(true); setSubmitError(''); setNotice('')
    try {
      const voucherType = type === 'free' ? 'percent' : type
      const numericValue = type === 'free' ? 100 : Number(value)
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > (voucherType === 'amount' ? 10000000 : 100)) throw new Error('Giá trị voucher không hợp lệ.')
      const body = { customerId: Number(customerId), type: voucherType, scope, value: numericValue, expiresAt: new Date(expiresOn + 'T23:59:59+07:00').toISOString() }
      const payload = await apiJson('/api/admin/vouchers' + (editing ? '/' + encodeURIComponent(editing) : ''), {
        method: editing ? 'PATCH' : 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(body),
      })
      setNotice((editing ? 'Đã cập nhật ' : 'Đã cấp ') + payload.voucher.label + ' · ' + payload.voucher.code)
      setEditing(null); setCustomerId(''); await reload()
    } catch (failure) { setSubmitError(adminErrorMessage(failure, 'Không lưu được voucher.')) }
    finally { mutationGate.current = false; setBusy(false) }
  }

  async function remove(voucher) {
    if (mutationGate.current) return
    mutationGate.current = true; setBusy(true); setSubmitError('')
    try {
      await apiJson('/api/admin/vouchers/' + encodeURIComponent(voucher.code), { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } })
      if (editing === voucher.code) { setEditing(null); setCustomerId('') }
      setNotice('Đã xóa voucher ' + voucher.code); setPendingDelete(null); await reload()
    } catch (failure) { setSubmitError(adminErrorMessage(failure, 'Không xóa được voucher.')) }
    finally { mutationGate.current = false; setBusy(false) }
  }

  return <section className="admin-module-card voucher-management">
    <div className="admin-module-head"><div><p className="admin-eyebrow">ƯU ĐÃI KHÁCH HÀNG</p><h2>Voucher hàng hóa & phí ship</h2><p>Thêm, sửa hoặc thu hồi voucher chưa dùng. Mã và người sở hữu được giữ nguyên khi sửa.</p></div><span className="admin-preview-badge">{vouchers.length} voucher</span></div>
    <div className="reward-policy-grid"><div><span className="reward-policy-icon">60%</span><b>Lần sau may mắn</b><small>Cả hai vòng dùng chung lượt</small></div><div><span className="reward-policy-icon">30%</span><b>100K / giảm 50% ship</b><small>Theo vòng khách lựa chọn</small></div><div><span className="reward-policy-icon">10%</span><b>Giảm 20% / miễn ship</b><small>Theo vòng khách lựa chọn</small></div></div>
    {error && <p role="alert">{error}</p>}
    <div className="voucher-editor-head"><h3>{editing ? 'Sửa voucher ' + editing : 'Cấp voucher mới'}</h3><div><button type="button" disabled={busy} onClick={() => { setScope('shipping'); setType('percent'); setValue(50) }}>Giảm 50% ship</button><button type="button" disabled={busy} onClick={() => { setScope('shipping'); setType('free'); setValue(100) }}>Miễn phí ship</button></div></div>
    <form id="voucher-editor" className="admin-commerce-form" onSubmit={submit}>
      <label>Khách hàng<DropdownMenu value={customerId} options={[['', 'Chọn khách'], ...(data?.customers || []).map(item => [String(item.id), item.username])]} onChange={setCustomerId} ariaLabel="Khách hàng" disabled={Boolean(editing) || busy} /></label>
      <label>Áp dụng cho<DropdownMenu value={scope} options={[['goods', 'Hàng hóa'], ['shipping', 'Phí vận chuyển']]} onChange={value => { setScope(value); if (type === 'free') { setType('percent'); setValue(20) } }} ariaLabel="Áp dụng cho" disabled={busy} /></label>
      <label>Loại ưu đãi<DropdownMenu value={type} options={[['amount', 'Giảm số tiền'], ['percent', 'Giảm phần trăm'], ...(scope === 'shipping' ? [['free', 'Miễn phí ship']] : [])]} onChange={value => { setType(value); setValue(value === 'amount' ? 30000 : value === 'free' ? 100 : 50) }} ariaLabel="Loại ưu đãi" disabled={busy} /></label>
      {type !== 'free' && <label>Giá trị {type === 'percent' ? '(%)' : '(₫)'}<input disabled={busy} type="number" min="1" max={type === 'amount' ? '10000000' : '100'} step="1" value={value} onChange={event => setValue(event.target.value)} required /></label>}
      <label>Hạn sử dụng<input disabled={busy} type="date" value={expiresOn} min={today} onChange={event => setExpiresOn(event.target.value)} required /></label>
      <div className="voucher-editor-actions"><button type="submit" disabled={busy || !customerId}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Cấp voucher'}</button>{editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setCustomerId('') }}>Hủy sửa</button>}</div>
    </form>
    {submitError && <p role="alert">{submitError}</p>}{notice && <p role="status">{notice}</p>}
    {pendingDelete && <div className="admin-detail-panel" role="group" aria-label="Xác nhận xóa voucher"><p>Xóa voucher <b>{pendingDelete.code}</b> của {pendingDelete.username}?</p><div className="voucher-editor-actions"><button type="button" disabled={busy} onClick={() => remove(pendingDelete)}>Xác nhận xóa</button><button type="button" disabled={busy} onClick={() => setPendingDelete(null)}>Giữ voucher</button></div></div>}
    <div className="admin-voucher-filters" aria-label="Lọc voucher">{[['all','Tất cả'],['goods','Hàng hóa'],['shipping','Giảm / miễn ship']].map(([key,label]) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{vouchers.filter(voucher => key === 'all' || voucher.scope === key).length}</span></button>)}</div>
    <div className="admin-voucher-list">{voucherError && <p role="alert">{voucherError}</p>}{visible.length ? visible.map(voucher => <article key={voucher.code}><div><b>{voucher.label}</b><small>{voucher.username || '—'} · {voucher.scope === 'shipping' ? 'Vận chuyển' : 'Hàng hóa'}</small></div><code>{voucher.code}</code><span>Hạn {dateInput(voucher.expiresAt)}</span><div className="voucher-editor-actions"><button disabled={busy} type="button" className="table-action" aria-label={'Sửa voucher ' + voucher.code} onClick={() => edit(voucher)}>Sửa</button><button disabled={busy} type="button" className="table-action table-action--danger" aria-label={'Xóa voucher ' + voucher.code} onClick={() => setPendingDelete(voucher)}>Xóa</button></div></article>) : <p className="admin-empty">Chưa có voucher trong nhóm này.</p>}</div>
  </section>
}

// Chức năng AdminFavorites: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminFavorites() {
  const { data, error } = useReport('/api/admin/favorites')
  const highest = data?.favorites?.[0]?.count || 1
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">SỞ THÍCH KHÁCH HÀNG</p><h2>Sản phẩm được yêu thích nhất</h2></div></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p>Đang tải…</p>}
    {data && <div className="admin-view-list">{data.favorites?.length ? data.favorites.map((item, index) => <article key={item.id}><b className="admin-view-rank">{index + 1}</b>{item.image ? <img src={item.image} alt="" width="48" height="48" loading="lazy" /> : <span className="admin-view-symbol" aria-hidden="true">{item.symbol}</span>}<div><strong title={item.name}>{item.name}</strong><small>{item.id}</small><span className="admin-view-bar" style={{ '--view-width': `${item.count / highest * 100}%` }} /></div><b>{item.count} lượt yêu thích</b></article>) : <p>Chưa có sản phẩm yêu thích.</p>}</div>}
  </section>
}

// Chức năng AdminReviews: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminReviews({ csrfToken }) {
  const { data, error, reload } = useReport('/api/admin/reviews')
  const [drafts, setDrafts] = useState({})
  const [saveError, setSaveError] = useState('')
  const reviews = data?.reviews || []
  const averageRating = reviews.length ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1) : '—'
  const unanswered = reviews.filter((item) => !item.adminReply).length
  // Chức năng reply: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function reply(id) {
    setSaveError('')
    try {
      await apiJson('/api/admin/reviews/' + id + '/reply', { method: 'PATCH', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ reply: drafts[id] }) })
      reload()
    } catch (failure) { setSaveError(failure.message) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">PHẢN HỒI KHÁCH HÀNG</p><h2>Đánh giá và bình luận</h2></div><span className="admin-preview-badge">{data?.reviews.length || 0} đánh giá</span></div><div className="admin-commerce-summary admin-commerce-summary--three"><div><small>Tổng đánh giá</small><b>{reviews.length}</b><span>Đã nhận</span></div><div><small>Điểm trung bình</small><b>★ {averageRating}</b><span>Trên thang 5</span></div><div><small>Chưa trả lời</small><b>{unanswered}</b><span>Cần xử lý</span></div></div>
    {error && <p role="alert">{error}</p>}{saveError && <p role="alert">{saveError}</p>}
    {!data && !error && <p>Đang tải…</p>}
    <div className="admin-commerce-list">{data?.reviews.map((item) => <article key={item.id}><h3>{item.productName}</h3><p>{item.username} · {'★'.repeat(item.rating)} · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</p><blockquote>{item.comment}</blockquote>{item.adminReply && <p><b>Store trả lời:</b> {item.adminReply}</p>}<label>Trả lời khách<textarea rows="2" maxLength="2000" value={drafts[item.id] ?? item.adminReply} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button type="button" disabled={!(drafts[item.id] || '').trim()} onClick={() => reply(item.id)}>Gửi trả lời</button></article>)}</div>
    {data?.reviews.length === 0 && <p>Chưa có đánh giá.</p>}
  </section>
}

// Chức năng AdminOrders: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminOrders({ csrfToken }) { return <OrderManager csrfToken={csrfToken} /> }
