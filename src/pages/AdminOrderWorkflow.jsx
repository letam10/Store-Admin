import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import DropdownMenu from '../components/ui/DropdownMenu'
import './AdminCommerce.css'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa hẹn'
const statuses = { pending: 'Chờ thanh toán', paid: 'Đã thanh toán', completed: 'Đã nhận hàng', cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền' }
const delivery = { processing: 'Đang chuẩn bị', ready: 'Sẵn sàng nhận', shipped: 'Đang giao', delivered: 'Đã giao / nhận' }
const kinds = { cancel: 'Hủy trước giao', return: 'Trả hàng', reschedule: 'Hoãn / lỡ lịch', merchant_fault: 'Giao sai / hàng lỗi' }
const caseStatuses = { awaiting_confirmation: 'Chờ khách đồng ý phí', pending: 'Chờ cửa hàng duyệt', awaiting_payment: 'Chờ thu phí', awaiting_return: 'Chờ nhận hàng trả', resolved: 'Đã xử lý', rejected: 'Đã từ chối', cancelled: 'Khách hủy yêu cầu' }

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
  function select(item) { setSelected(item.id); setReference(item.paymentReference || ''); setConfirmed(false); setProblem(''); setMessage('') }
  return <section className="admin-module-card"><div className="admin-commerce-head"><div><p className="admin-eyebrow">Bán hàng & thanh toán</p><h2>Đơn hàng khách hàng</h2><p>Đối soát tiền thực nhận và theo dõi lịch giao / nhận.</p></div><button type="button" disabled={busy} onClick={() => reload().catch(failure => setProblem(failure.message))}>Làm mới</button></div>
    {(error || problem) && <p className="admin-error" role="alert">{problem || error}</p>}{message && <p role="status">{message}</p>}
    {!data && !error && <p role="status">Đang tải đơn…</p>}
    <div className="admin-table-scroll"><table className="admin-order-table"><thead><tr><th>Đơn / khách</th><th>Giá trị</th><th>Thanh toán</th><th>Giao / nhận</th><th>Lịch hẹn</th><th>Thao tác</th></tr></thead><tbody>{data?.orders.map(item => <tr key={item.id}><td><b>{item.id}</b><small>{item.username} · {item.recipient}</small></td><td>{money(item.total)}</td><td>{statuses[item.status]}<small>{item.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : item.paymentMethod === 'cash' ? 'Thu tại quầy' : 'Thu khi giao'}</small></td><td>{delivery[item.deliveryStatus] || item.deliveryStatus}</td><td>{date(item.scheduledAt)}</td><td><button type="button" onClick={() => select(item)} aria-pressed={selected === item.id}>Xử lý</button></td></tr>)}</tbody></table></div>
    {data && !data.orders.length && <p className="admin-empty">Chưa có đơn hàng.</p>}
    {order && <section className="admin-detail-panel admin-order-detail"><header><div><p className="admin-eyebrow">Chi tiết đơn</p><h3>{order.id}</h3></div><button type="button" onClick={() => setSelected(null)}>Đóng</button></header>
      <p>{order.recipient} · {order.phone}<br />{order.address || 'Nhận tại cửa hàng'}<br />Lịch hẹn: <b>{date(order.scheduledAt)}</b></p>
      <ul>{order.items.map(item => <li key={item.id}>{item.name} × {item.quantity} — {money(item.price * item.quantity)}</li>)}</ul>
      <a href={'/api/admin/orders/' + order.id + '/receipt.html'} target="_blank" rel="noopener noreferrer">Mở biên nhận / in PDF ↗</a>
      {order.status === 'pending' && <form onSubmit={event => { event.preventDefault(); act('/paid', { reference, counterConfirmed: confirmed, receivedConfirmed: confirmed }) }}><h4>{order.paymentMethod === 'cash' ? 'Xác nhận thu tiền trực tiếp tại quầy' : order.paymentMethod === 'cod' ? 'Xác nhận tiền đã thu khi giao' : 'Đối soát chuyển khoản'}</h4>
        {order.paymentMethod === 'bank_transfer' && <label>Mã giao dịch đã đối soát<input value={reference} onChange={event => setReference(event.target.value)} minLength={order.paymentMode === 'demo' ? undefined : 3} maxLength="100" required={order.paymentMode !== 'demo'} /></label>}
        <label className="admin-confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />Tôi xác nhận đã nhận đủ {money(order.total)}.</label><button type="submit" disabled={busy || !confirmed}>{busy ? 'Đang xác nhận…' : 'Xác nhận đã thu tiền'}</button>
      </form>}
      {['pending','paid'].includes(order.status) && <div className="admin-order-actions">{Object.entries(delivery).filter(([key]) => Object.keys(delivery).indexOf(key) > Object.keys(delivery).indexOf(order.deliveryStatus) && (key !== 'shipped' || (order.fulfillment === 'delivery' && (order.status === 'paid' || order.paymentMethod === 'cod'))) && (key !== 'delivered' || order.status === 'paid')).map(([key, label]) => <button type="button" key={key} disabled={busy} onClick={() => act('/fulfillment', { status: key }, 'PATCH')}>{label}</button>)}</div>}
    </section>}
  </section>
}

export function AdminAfterSales({ csrfToken }) {
  const { data, error, reload } = useData('/api/admin/after-sales')
  const [selected, setSelected] = useState(null), [note, setNote] = useState(''), [reference, setReference] = useState(''), [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false), [problem, setProblem] = useState(''), [message, setMessage] = useState('')
  const gate = useRef(false), request = data?.requests.find(item => item.id === selected)
  async function action(kind) {
    if (gate.current || !request) return
    gate.current = true; setBusy(true); setProblem(''); setMessage('')
    try {
      await apiJson('/api/admin/after-sales/' + request.id + '/action', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ action: kind, note, reference, received: confirmed, counterConfirmed: confirmed, refundConfirmed: confirmed, refundReference: reference }) })
      await reload(); setConfirmed(false); setMessage('Đã xử lý yêu cầu ' + request.id)
    } catch (failure) { setProblem(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }
  return <section className="admin-module-card"><div className="admin-commerce-head"><div><p className="admin-eyebrow">Hỗ trợ sau mua</p><h2>Hủy, trả hàng & lịch hẹn</h2><p>Khách đồng ý bảng phí trước khi cửa hàng duyệt; chỉ hoàn tiền sau khi kiểm tra hàng trả.</p></div><button type="button" disabled={busy} onClick={() => reload().catch(failure => setProblem(failure.message))}>Làm mới</button></div>
    {(error || problem) && <p className="admin-error" role="alert">{problem || error}</p>}{message && <p role="status">{message}</p>}
    <p className="admin-policy">Hủy trước giao: {data?.policy.cancellationPercent || 1}% tiền hàng. Trả hàng trong {data?.policy.returnDays || 7} ngày. Lịch mới trong {data?.policy.rescheduleDays || 7} ngày so với lịch cũ. Chi phí từng yêu cầu hiển thị dưới đây.</p>
    <div className="admin-commerce-list">{data?.requests.map(item => <article key={item.id}><div><b>{kinds[item.kind]} · {item.orderId}</b><small>{item.username} · {caseStatuses[item.status]}</small><p>{item.reason}</p></div><span>Phí: {money(item.quote.feeAmount)}<br />Hoàn: {money(item.quote.refundAmount)}</span><button type="button" onClick={() => { setSelected(item.id); setNote(''); setReference(''); setConfirmed(false); setProblem(''); setMessage('') }}>Chi tiết</button></article>)}</div>
    {data && !data.requests.length && <p className="admin-empty">Chưa có yêu cầu sau mua.</p>}
    {request && <section className="admin-detail-panel admin-order-detail"><header><h3>{kinds[request.kind]} · {request.id}</h3><button type="button" onClick={() => setSelected(null)}>Đóng</button></header><p>{request.reason}</p><p>{caseStatuses[request.status]} · Lịch mới: {date(request.scheduledAt)}</p><dl className="admin-fee-list">{request.quote.breakdown.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{money(item.amount)}</dd></div>)}<div><dt>Cần thanh toán thêm</dt><dd>{money(request.quote.additionalDue)}</dd></div><div><dt>Hoàn cho khách</dt><dd>{money(request.quote.refundAmount)}</dd></div></dl>
      {request.note && <p>{request.note}</p>}{request.refundReference && <p>Mã hoàn tiền: {request.refundReference}</p>}
      {['pending','awaiting_payment','awaiting_return'].includes(request.status) && <><label>Mã thu phí / hoàn tiền đã đối soát<input maxLength="100" value={reference} onChange={event => setReference(event.target.value)} /></label><label>Ghi chú xử lý<textarea value={note} maxLength="1000" onChange={event => setNote(event.target.value)} /></label><label className="admin-confirm-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{request.status === 'awaiting_return' ? 'Đã nhận và kiểm tra hàng trả; đã hoàn tiền (nếu có).' : 'Đã đối soát khoản thu / hoàn tiền thực tế (nếu có).'}</label>
      <div className="admin-order-actions">{request.status === 'pending' && <button type="button" disabled={busy || (request.kind === 'cancel' && !confirmed)} onClick={() => action('approve')}>Duyệt yêu cầu</button>}{request.status === 'awaiting_payment' && <button type="button" disabled={busy || !confirmed} onClick={() => action('fee_paid')}>Xác nhận đã thu phí</button>}{request.status === 'awaiting_return' && <button type="button" disabled={busy || !confirmed} onClick={() => action('complete_return')}>Hoàn tất nhận trả & hoàn tiền</button>}{['pending','awaiting_payment'].includes(request.status) && <button type="button" disabled={busy || note.trim().length < 5} onClick={() => action('reject')}>Từ chối kèm lý do</button>}</div></>}
    </section>}
  </section>
}

export function AdminPaymentSettings({ csrfToken }) {
  const { data, error } = useData('/api/admin/payment-settings')
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [problem, setProblem] = useState('')
  const gate = useRef(false), values = form || data?.settings
  async function save(event) {
    event.preventDefault(); if (gate.current) return
    gate.current = true; setBusy(true); setMessage(''); setProblem('')
    try { const result = await apiJson('/api/admin/payment-settings', { method: 'PUT', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(values) }); setForm(result.settings); setMessage('Đã lưu ngân hàng nhận chuyển khoản.') }
    catch (failure) { setProblem(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }
  return <section className="admin-module-card"><p className="admin-eyebrow">Thanh toán</p><h2>Ngân hàng nhận chuyển khoản</h2><p>QR chứa đúng giá trị đơn và nội dung chuyển khoản. Nhân viên đối soát trước khi xác nhận tiền đã nhận.</p>{(error || problem) && <p className="admin-error" role="alert">{problem || error}</p>}{values && <form className="admin-payment-settings" onSubmit={save}><label>Chế độ<DropdownMenu value={values.mode} options={[['demo', 'Kiểm thử quy trình · không chuyển tiền thật'], ['manual', 'Nhận tiền thật · đối soát thủ công']]} onChange={mode => setForm({ ...values, mode })} ariaLabel="Chế độ thanh toán" /></label>{values.mode === 'manual' && [['bankName','Tên ngân hàng'],['bankBin','Mã BIN ngân hàng (6 số)'],['accountNumber','Số tài khoản'],['accountName','Tên chủ tài khoản']].map(([key, label]) => <label key={key}>{label}<input required value={values[key]} maxLength="100" onChange={event => setForm({ ...values, [key]: event.target.value })} /></label>)}<button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu cấu hình thanh toán'}</button></form>}{message && <p role="status">{message}</p>}</section>
}
