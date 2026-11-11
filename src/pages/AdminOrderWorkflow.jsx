import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import './AdminCommerce.css'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa hẹn'
const mailStates = { sent: 'Đã gửi', queued: 'Đang chờ gửi / thử lại', not_sent: 'Chưa gửi' }
const statuses = { expired: 'Hết hạn QR', needs_review: 'Cần đối soát riêng', reported: 'Khách báo đã chuyển', pending: 'Chờ thanh toán', paid: 'Đã thanh toán', completed: 'Đã nhận hàng', cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền' }
const delivery = { processing: 'Đang chuẩn bị', ready: 'Sẵn sàng nhận', shipped: 'Đang giao', delivered: 'Đã giao / nhận', returned: 'Đã nhận hàng trả', cancelled: 'Đã dừng giao' }

function useData(path) {
  const [data, setData] = useState(null), [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    apiJson(path, { signal: controller.signal }).then(setData).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [path])
  async function reload() { const result = await apiJson(path); setData(result); setError(''); return result }
  return { data, error, reload }
}

export function AdminOrders({ csrfToken }) {
  const { data, error, reload } = useData('/api/admin/customer-orders')
  const [selected, setSelected] = useState(null), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [problem, setProblem] = useState('')
  const [receivedAt, setReceivedAt] = useState('')
  const [receivedAmount, setReceivedAmount] = useState('')
  const gate = useRef(false)
  const order = data?.orders.find(item => item.id === selected)
  async function act(suffix, body, method = 'POST') {
    if (gate.current || !order) return
    gate.current = true; setBusy(true); setProblem(''); setMessage('')
    try {
      await apiJson('/api/admin/customer-orders/' + order.id + suffix, { method, headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(body) })
      await reload(); setConfirmed(false); setMessage('Đã cập nhật đơn ' + order.id)
    } catch (failure) { setProblem(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }
  function select(item) { setReceivedAt(''); setReceivedAmount(String(item.total)); setSelected(item.id); setReference(item.paymentReference || ''); setConfirmed(false); setProblem(''); setMessage('') }
  return <section className="admin-module-card"><div className="admin-commerce-head"><div><p className="admin-eyebrow">Bán hàng & thanh toán</p><h2>Đơn hàng khách hàng</h2><p>Đối soát tiền thực nhận và theo dõi lịch giao / nhận.</p></div><button type="button" disabled={busy} onClick={() => reload().catch(failure => setProblem(failure.message))}>Làm mới</button></div>
    {(error || problem) && <p className="admin-error" role="alert">{problem || error}</p>}{message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Đang tải đơn…</p>}
    <div className="admin-table-scroll"><table className="admin-order-table"><thead><tr><th>Đơn / khách</th><th>Giá trị</th><th>Thanh toán</th><th>Giao / nhận</th><th>Lịch hẹn</th><th>Thao tác</th></tr></thead><tbody>{data?.orders.map(item => <tr key={item.id}><td><b>{item.id}</b><small>{item.username} · {item.recipient}</small></td><td>{money(item.total)}</td><td>{item.status === 'refunded' ? statuses.refunded : statuses[item.paymentState] || statuses[item.status]}<small>{item.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : item.paymentMethod === 'cash' ? 'Thu tại quầy' : 'Thu khi giao'}</small></td><td>{delivery[item.deliveryStatus] || item.deliveryStatus}</td><td>{date(item.scheduledAt)}</td><td><button type="button" onClick={() => select(item)} aria-pressed={selected === item.id}>Xử lý</button></td></tr>)}</tbody></table></div>
    {data && !data.orders.length && <p className="admin-empty">Chưa có đơn hàng.</p>}
    {order && <section className="admin-detail-panel admin-order-detail"><header><div><p className="admin-eyebrow">Chi tiết đơn</p><h3>{order.id}</h3></div><button type="button" onClick={() => setSelected(null)}>Đóng</button></header>
      <p>{order.recipient} · {order.phone}<br />{order.address || 'Nhận tại cửa hàng'}<br />Lịch hẹn: <b>{date(order.scheduledAt)}</b></p>
      <p>Email biên nhận khách: {mailStates[order.invoiceEmailStatus] || 'Chưa gửi'} · Thông báo admin: {mailStates[order.adminEmailStatus] || 'Chưa gửi'}</p>
      <ul>{order.items.map(item => <li key={item.id}>{item.name} × {item.quantity} — {money(item.price * item.quantity)}</li>)}</ul>
      <a href={'/api/admin/orders/' + order.id + '/receipt.html'} target="_blank" rel="noopener noreferrer">Mở biên nhận / in PDF ↗</a>
      {order.paymentState && !['paid','refunded_unmatched'].includes(order.paymentState) && <form onSubmit={event => { event.preventDefault(); act('/paid', { reference, receivedAmount: Number(receivedAmount), receivedAt: receivedAt ? new Date(receivedAt).toISOString() : null, counterConfirmed: confirmed, receivedConfirmed: confirmed }) }}><h4>{order.paymentMethod === 'cash' ? 'Xác nhận thu tiền trực tiếp tại quầy' : order.paymentMethod === 'cod' ? 'Xác nhận tiền đã thu khi giao' : 'Đối soát chuyển khoản'}</h4>
        {order.paymentMethod === 'bank_transfer' && <label>Mã giao dịch đã đối soát<input value={reference} onChange={event => setReference(event.target.value)} minLength="3" maxLength="100" required /></label>}
        <label>Số tiền thực nhận (đ)<input required type="number" min="0" step="1" value={receivedAmount} onChange={event => setReceivedAmount(event.target.value)} /></label>
        {order.paymentMethod === 'bank_transfer' && <label>Thời gian tiền vào ngân hàng<input required type="datetime-local" step="1" value={receivedAt} onChange={event => setReceivedAt(event.target.value)} /></label>}
        {order.expiresAt && <p>Hạn QR: {date(order.expiresAt)}. Chỉ xác nhận khi tiền vào trong hạn và đủ số tiền.</p>}
        {order.paymentReportedReference && <p>Khách khai mã: <code>{order.paymentReportedReference}</code> — đối chiếu sao kê trước khi xác nhận.</p>}
        <label className="admin-confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />Tôi xác nhận đã nhận đủ {money(order.total)}.</label><button type="submit" disabled={busy || !confirmed}>{busy ? 'Đang xác nhận…' : 'Xác nhận đã thu tiền'}</button>
      </form>}
      {['pending','paid'].includes(order.status) && <div className="admin-order-actions">{Object.entries(delivery).filter(([key]) => ['ready','shipped','delivered'].includes(key) && Object.keys(delivery).indexOf(key) > Object.keys(delivery).indexOf(order.deliveryStatus) && (key !== 'shipped' || (order.fulfillment === 'delivery' && (order.status === 'paid' || order.paymentMethod === 'cod'))) && (key !== 'delivered' || order.status === 'paid')).map(([key, label]) => <button type="button" key={key} disabled={busy} onClick={() => act('/fulfillment', { status: key }, 'PATCH')}>{label}</button>)}</div>}
    </section>}
    <details className="admin-module-card"><summary>Cấu hình ngân hàng nhận tiền</summary><AdminPaymentSettings csrfToken={csrfToken} /></details>
  </section>
}

export { default as AdminAfterSales } from './AdminAfterSales'

export function AdminPaymentSettings({ csrfToken }) {
  const { data, error } = useData('/api/admin/payment-settings')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [problem, setProblem] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const gate = useRef(false)
  const values = form || data?.settings
  async function save(event) {
    event.preventDefault()
    if (gate.current || !confirmed) return
    gate.current = true
    setBusy(true)
    setMessage('')
    setProblem('')
    try {
      const result = await apiJson('/api/admin/payment-settings', { method: 'PUT', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ ...values, mode: 'manual' }) })
      setForm(result.settings)
      setConfirmed(false)
      setMessage('Đã lưu tài khoản nhận tiền. Các phiên QR đang mở vẫn giữ tài khoản đã xác nhận khi tạo phiên.')
    } catch (failure) { setProblem(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }
  return <section><h2>Ngân hàng nhận chuyển khoản</h2><p>QR nhận tiền thật; admin kiểm tra sao kê trước khi xác nhận đơn.</p>
    {(error || problem) && <p className="admin-error" role="alert">{problem || error}</p>}
    {values && <form className="admin-payment-settings" onSubmit={save}>
      {[['bankName','Tên ngân hàng'],['bankBin','Mã BIN ngân hàng (6 số)'],['accountNumber','Số tài khoản'],['accountName','Tên chủ tài khoản']].map(([key,label]) => <label key={key}>{label}<input required value={values[key]} maxLength="100" onChange={event => { setForm({ ...values, [key]: event.target.value }); setConfirmed(false) }} /></label>)}
      <label className="admin-confirm-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Tôi đã kiểm tra đây là tài khoản nhận tiền đúng của cửa hàng.</label>
      <button type="submit" disabled={busy || !confirmed}>{busy ? 'Đang lưu…' : 'Lưu cấu hình thanh toán'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>
}
