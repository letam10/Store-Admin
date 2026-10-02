/**
 * @codex-vn-doc
 * Tệp: src/pages/AdminCommerce.jsx
 * Mục đích: Giao diện quản lý sản phẩm, voucher, đơn hàng, khách hàng và dữ liệu thương mại.
 * Thành phần chính: AdminCustomers, AdminVouchers, AdminFavorites, AdminReviews, AdminOrders.
 * Liên kết trực tiếp: react, ../api/chat.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import { useEffect, useMemo, useState } from 'react'
import { apiJson } from '../api/chat'
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
    // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
    <div className="admin-module-toolbar"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc email" /><label>Điểm tối thiểu <input type="number" min="0" value={minPoints} onChange={(event) => setMinPoints(event.target.value)} /></label></div>
    {error && <p role="alert">{error}</p>}{!data && !error && <p>Đang tải…</p>}
     {data && <div className="admin-table-wrap"><table><thead><tr><th>Khách</th><th>Điểm</th><th>Hạng</th><th>Tiền hàng đã thanh toán</th><th>Lượt quay</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="admin-clickable-row" onClick={() => setSelected(item)}><td><button className="admin-link-button" type="button" onClick={() => setSelected(item)}>{item.username}</button><small>{item.email}</small></td><td><b>{item.points.toLocaleString('vi-VN')}</b></td><td>{item.tier}</td><td>{money.format(item.paidGoodsTotal)}</td><td>{item.spinCredits}</td></tr>)}</tbody></table></div>}
     {selected && <section className="admin-detail-panel"><div><p className="admin-eyebrow">HỒ SƠ TÀI KHOẢN</p><h3>{selected.username}</h3></div><button type="button" onClick={() => setSelected(null)}>Đóng</button><dl><div><dt>ID</dt><dd>{selected.id}</dd></div><div><dt>Email đăng ký</dt><dd>{selected.email}</dd></div><div><dt>Tài khoản đăng nhập</dt><dd>{selected.username} hoặc {selected.email}</dd></div><div><dt>Ngày đăng ký</dt><dd>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('vi-VN') : '—'}</dd></div><div><dt>Mật khẩu</dt><dd>Không hiển thị · backend lưu dạng băm</dd></div><div><dt>Hạng / điểm</dt><dd>{selected.tier} · {selected.points.toLocaleString('vi-VN')} điểm</dd></div><div><dt>Trạng thái</dt><dd>Đang hoạt động</dd></div></dl></section>}
  </section>
}

// Chức năng AdminVouchers: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function AdminVouchers({ csrfToken }) {
  const { data, error, reload: reloadCustomers } = useReport('/api/admin/customers')
  const { data: voucherData, error: voucherError, reload: reloadVouchers } = useReport('/api/admin/vouchers')
  const [customerId, setCustomerId] = useState('')
  const [scope, setScope] = useState('goods')
  const [type, setType] = useState('amount')
  const [value, setValue] = useState(100000)
  const [days, setDays] = useState(30)
  const [created, setCreated] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)
  // Chức năng submit: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function submit(event) {
    event.preventDefault(); setBusy(true); setSubmitError(''); setCreated(null)
    try {
      const numericValue = Number(value)
      const numericDays = Number(days)
      const maxValue = type === 'amount' ? 10000000 : 100
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > maxValue) throw Object.assign(new Error(''), { code: 'INVALID_VOUCHER' })
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (!Number.isInteger(numericDays) || numericDays < 1 || numericDays > 365) throw Object.assign(new Error(''), { code: 'INVALID_VOUCHER' })
      const expiresAt = new Date(Date.now() + Number(days) * 86400000).toISOString()
      const payload = await apiJson('/api/admin/vouchers', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ customerId: Number(customerId), type, scope, value: numericValue, expiresAt }) })
      setCreated(payload.voucher); reloadCustomers(); reloadVouchers()
    } catch (failure) { setSubmitError(adminErrorMessage(failure, 'Khong tao duoc voucher.')) }
    finally { setBusy(false) }
  }
  // Chức năng remove: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function remove(voucher) {
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!window.confirm('Xoa voucher ' + voucher.code + '?')) return
    try { await apiJson('/api/admin/vouchers/' + encodeURIComponent(voucher.code), { method: 'DELETE', headers: { 'x-csrf-token': csrfToken } }); reloadVouchers() }
    // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn và giữ trạng thái nhất quán.
    catch (failure) { setSubmitError(adminErrorMessage(failure, 'Khong xoa duoc voucher.')) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">VOUCHER STORE</p><h2>Voucher</h2><p>Thêm voucher mới cho khách hàng. Mã 10 ký tự được tạo duy nhất trên máy chủ và không thể sửa.</p></div><span className="admin-preview-badge">{voucherData?.vouchers?.length || 0} voucher</span></div><div className="reward-policy-grid"><div><span className="reward-policy-icon">60%</span><b>Lần sau may mắn</b><small>Tỷ lệ hệ thống · không hiển thị cho khách</small></div><div><span className="reward-policy-icon">30%</span><b>Voucher 100K</b><small>Phần thưởng quay may mắn</small></div><div><span className="reward-policy-icon">10%</span><b>Voucher giảm 20%</b><small>Phần thưởng quay may mắn</small></div></div>
    {error && <p role="alert">{error}</p>}
    <form className="admin-commerce-form" onSubmit={submit}>
      <label>Khách hàng<select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Chọn khách</option>{data?.customers.map((item) => <option key={item.id} value={item.id}>{item.username} · {item.points} điểm</option>)}</select></label>
      <label>Áp dụng cho<select value={scope} onChange={(event) => setScope(event.target.value)}><option value="goods">Hàng hóa</option><option value="shipping">Phí vận chuyển</option></select></label>
      <label>Loại<select value={type} onChange={(event) => { setType(event.target.value); setValue(event.target.value === 'amount' ? 100000 : 20) }}><option value="amount">Giảm số tiền</option><option value="percent">Giảm phần trăm</option></select></label>
      <label>Giá trị<input type="number" min="1" max={type === 'amount' ? '10000000' : '100'} step="1" value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => setValue((current) => Math.min(type === 'amount' ? 10000000 : 100, Math.max(1, Number(current) || 1)))} required /></label>
      <label>Hạn dùng sau (ngày)<input type="number" min="1" max="365" step="1" value={days} onChange={(event) => setDays(event.target.value)} required /></label>
      <button type="submit" disabled={busy || !customerId}>{busy ? 'Đang cấp…' : 'Cấp voucher'}</button>
    </form>
    {submitError && <p role="alert">{submitError}</p>}{created && <p role="status">Đã cấp {created.label} · mã <code>{created.code}</code> · hết hạn {new Date(created.expiresAt).toLocaleDateString('vi-VN')}</p>}
    <div className="admin-voucher-list"><h3>Voucher đã tạo</h3>{voucherError && <p role="alert">{adminErrorMessage({ message: voucherError }, 'Khong tai duoc voucher.')}</p>}{voucherData?.vouchers?.length ? voucherData.vouchers.map((voucher) => <article key={voucher.code}><div><b>{voucher.label}</b><small>{voucher.username || '—'} · {voucher.type === 'amount' ? new Intl.NumberFormat('vi-VN').format(voucher.value) + ' ₫' : voucher.value + '%'}</small></div><code>{voucher.code}</code><span>Hết hạn {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</span><button type="button" className="table-action table-action--danger" onClick={() => remove(voucher)}>Xóa</button></article>) : <p className="admin-empty">Chưa có voucher.</p>}</div>
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
export function AdminOrders({ csrfToken }) {
  const { data, error, reload } = useReport('/api/admin/customer-orders')
  const [actionError, setActionError] = useState('')
  const orders = data?.orders || []
  const pendingOrders = orders.filter((item) => item.status === 'pending').length
  const paidOrders = orders.filter((item) => item.status === 'paid').length
  const orderValue = orders.reduce((sum, item) => sum + Number(item.total || 0), 0)
  // Chức năng markPaid: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  async function markPaid(id) {
    setActionError('')
    try {
      await apiJson('/api/admin/customer-orders/' + id + '/paid', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({}) })
      reload()
    } catch (failure) { setActionError(failure.message) }
  }
  return <section className="admin-module-card"><div className="admin-module-head"><div><p className="admin-eyebrow">ĐƠN KHÁCH HÀNG</p><h2>Ghi nhận thanh toán</h2><p>Chỉ bấm sau khi đã xác nhận tiền thực nhận. Điểm và lượt quay sẽ được cộng đúng một lần.</p></div></div><div className="admin-commerce-summary"><div><small>Tổng đơn</small><b>{orders.length}</b><span>Toàn bộ đơn hàng</span></div><div><small>Chờ thanh toán</small><b>{pendingOrders}</b><span>Cần xác nhận</span></div><div><small>Đã thanh toán</small><b>{paidOrders}</b><span>Đã ghi nhận</span></div><div><small>Giá trị đơn</small><b>{money.format(orderValue)}</b><span>Trước hoàn tiền</span></div></div>
    {error && <p role="alert">{error}</p>}{actionError && <p role="alert">{actionError}</p>}
    {!data && !error && <p>Đang tải…</p>}
    {data && <div className="admin-table-wrap"><table><thead><tr><th>Đơn</th><th>Khách / giao nhận</th><th>Tiền hàng sau giảm</th><th>Phí giao</th><th>Tổng</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.orders.map((item) => <tr key={item.id}><td>{item.id}</td><td>{item.username}<small>{item.recipient} · {item.phone}</small><small>{item.address || 'Nhận tại cửa hàng'} · {item.region}{item.region === 'far' ? ' · ' + item.distanceKm + ' km' : ''}</small></td><td>{money.format(item.goodsTotal)}</td><td>{money.format(item.shippingFee)}</td><td>{money.format(item.total)}</td><td>{item.status === 'paid' ? 'Đã thanh toán · +' + item.pointsEarned + ' điểm' : 'Chờ thanh toán'}</td><td>{item.status === 'pending' && <button type="button" onClick={() => markPaid(item.id)}>Ghi nhận đã thanh toán</button>}</td></tr>)}</tbody></table>{data.orders.length === 0 && <p>Chưa có đơn.</p>}</div>}
  </section>
}
