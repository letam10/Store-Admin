import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api/chat'
import './AdminCommerce.css'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—'
const kinds = { cancel: 'Hủy trước giao', return: 'Trả hàng', exchange: 'Đổi sản phẩm', reschedule: 'Đổi lịch', merchant_fault: 'Giao sai / hàng lỗi' }
const statuses = {
  awaiting_confirmation: 'Chờ khách đồng ý bảng phí', pending: 'Chờ cửa hàng duyệt', awaiting_return: 'Chờ nhận hàng trả',
  awaiting_payment: 'Chờ thu khoản bù', awaiting_refund: 'Chờ xác nhận hoàn tiền', awaiting_exchange: 'Sẵn sàng giao hàng đổi',
  exchange_shipped: 'Đang giao hàng đổi', resolved: 'Đã xử lý', rejected: 'Đã từ chối', cancelled: 'Khách hủy yêu cầu',
}
const closed = ['resolved', 'rejected', 'cancelled']

function CaseActions({ request, role, busy, onAction }) {
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(String(request.status === 'awaiting_payment' ? request.quote.additionalDue : request.quote.refundAmount))
  const [occurredAt, setOccurredAt] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [restock, setRestock] = useState(false)
  const [acceptLatePayment, setAcceptLatePayment] = useState(false)
  const isAdmin = role === 'admin'
  const state = request.status
  const refund = state === 'awaiting_refund'
  const financial = refund || state === 'awaiting_payment'
  const requiresMoney = financial && (refund ? request.quote.refundAmount : request.quote.additionalDue) > 0
  const receiving = state === 'awaiting_return'
  const shipping = state === 'awaiting_exchange' && request.fulfillment === 'delivery'
  const completing = state === 'exchange_shipped' || (state === 'awaiting_exchange' && request.fulfillment === 'pickup')
  const action = state === 'pending' ? 'approve' : receiving ? 'receive_return' : refund ? 'complete_refund'
    : state === 'awaiting_payment' ? 'fee_paid' : shipping ? 'ship_exchange' : 'complete_exchange'
  const label = state === 'pending' ? 'Duyệt yêu cầu' : receiving ? 'Xác nhận đã nhận hàng trả' : refund ? 'Xác nhận hoàn tiền'
    : state === 'awaiting_payment' ? 'Xác nhận đã thu khoản bù' : shipping ? 'Xác nhận gửi hàng đổi' : 'Xác nhận khách nhận hàng đổi'
  if (request.legacyReviewRequired) return <p role="alert">Yêu cầu cũ cần kiểm tra riêng bảng phí và chứng từ trước khi xử lý.</p>
  if (closed.includes(state) || state === 'awaiting_confirmation') return null
  if (!isAdmin && (financial || (state === 'pending' && request.kind === 'cancel'))) return <p>Đang chờ quản trị viên xử lý khoản thu / hoàn tiền.</p>
  function submit(event) {
    event.preventDefault()
    const proof = requiresMoney ? (refund
      ? { refundAmount: Number(amount), refundReference: reference, refundedAt: new Date(occurredAt).toISOString(), refundConfirmed: confirmed }
      : { receivedAmount: Number(amount), reference, receivedAt: new Date(occurredAt).toISOString(), counterConfirmed: confirmed, acceptLatePayment }) : {}
    onAction(action, { note, ...proof, ...(receiving || completing ? { received: confirmed } : {}),
      ...(receiving && isAdmin ? { restock } : {}), ...(shipping ? { reference } : {}) })
  }
  return <form className="admin-after-actions" onSubmit={submit}>
    <fieldset disabled={busy}>
      <legend>{label}</legend>
      {requiresMoney && <>
        <label>{refund ? 'Số tiền đã hoàn thực tế (đ)' : 'Số tiền thực nhận (đ)'}<input required type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label>{refund ? 'Mã giao dịch / phiếu hoàn tiền' : 'Mã giao dịch / phiếu thu'}<input required minLength="3" maxLength="100" value={reference} onChange={event => setReference(event.target.value)} /></label>
        <label>{refund ? 'Thời điểm hoàn tiền' : 'Thời điểm nhận tiền'}<input required type="datetime-local" step="1" value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label>
        {request.feePaymentExpiresAt && !refund && <p>Hạn QR thu khoản bù: {date(request.feePaymentExpiresAt)}.</p>}
      </>}
      {shipping && <label>Mã vận đơn hàng đổi<input required minLength="3" maxLength="100" value={reference} onChange={event => setReference(event.target.value)} /></label>}
      {requiresMoney && !refund && request.paymentMethod === 'bank_transfer' && <label className="admin-confirm-check"><input type="checkbox" checked={acceptLatePayment} onChange={event => setAcceptLatePayment(event.target.checked)} />Đã đối soát khoản vào ngoài hạn QR và đồng ý tiếp tục đổi hàng (cần ghi rõ lý do).</label>}
      <label>Ghi chú xử lý<textarea value={note} required={acceptLatePayment} minLength={acceptLatePayment ? 5 : undefined} maxLength="1000" onChange={event => setNote(event.target.value)} /></label>
      {(requiresMoney || receiving || completing) && <label className="admin-confirm-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        {receiving ? 'Đã nhận và kiểm tra đủ hàng khách trả.' : completing ? 'Khách đã nhận đủ hàng thay thế.' : refund ? 'Đã hoàn tiền thực tế và kiểm tra chứng từ.' : 'Đã nhận tiền thực tế và kiểm tra chứng từ.'}
      </label>}
      {receiving && isAdmin && <label className="admin-confirm-check"><input type="checkbox" checked={restock} onChange={event => setRestock(event.target.checked)} />Hàng trả đủ điều kiện bán lại, nhập lại tồn kho.</label>}
      <div className="admin-order-actions"><button type="submit">{busy ? 'Đang xử lý…' : label}</button>
        {['pending', 'awaiting_return'].includes(state) && <button type="button" disabled={note.trim().length < 5} onClick={() => onAction('reject', { note })}>Từ chối kèm lý do</button>}
      </div>
    </fieldset>
  </form>
}

export default function AdminAfterSales({ csrfToken, role = 'admin' }) {
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const gate = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    apiJson('/api/admin/after-sales', { signal: controller.signal }).then(setData).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [])
  const request = data?.requests.find(item => item.id === selected)
  async function run(action, fields = {}) {
    if (gate.current) return
    gate.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (action && request) await apiJson('/api/admin/after-sales/' + encodeURIComponent(request.id) + '/action', {
        method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify({ action, ...fields }),
      })
      setData(await apiJson('/api/admin/after-sales'))
      if (action) setMessage('Đã cập nhật yêu cầu ' + request.id)
    } catch (failure) { setError(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }
  return <section className="admin-module-card admin-after-sales">
    <div className="admin-commerce-head"><div><p className="admin-eyebrow">Hỗ trợ sau mua</p><h2>Đổi / trả hàng & lịch hẹn</h2><p>Nhận hàng, đối soát tiền và giao hàng thay thế được xác nhận riêng.</p></div><button type="button" disabled={busy} onClick={() => run()}>Làm mới</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {data && <p className="admin-policy">Hủy trước giao: {data.policy.cancellationPercent}% tiền hàng, tối thiểu {money(data.policy.cancellationMinimum)}, khấu trừ vào tiền hoàn. Trả / đổi trong {data.policy.returnDays} ngày sau nhận hàng. Lịch mới tối đa {data.policy.rescheduleDays} ngày từ lịch cũ.</p>}
    {!data && !error && <p role="status">Đang tải yêu cầu…</p>}
    <div className="admin-commerce-list">{data?.requests.map(item => <article key={item.id} data-case-id={item.id}>
      <div><b>{kinds[item.kind]} · {item.orderId}</b><small>{item.username} · {statuses[item.status] || item.status}</small><p>{item.reason}</p></div>
      <span>Cần bù: {money(item.quote.additionalDue)} · Hoàn: {money(item.quote.refundAmount)}</span>
      <button type="button" disabled={busy} onClick={() => { setSelected(item.id); setError(''); setMessage('') }}>Chi tiết</button>
    </article>)}</div>
    {data && !data.requests.length && <p className="admin-empty">Chưa có yêu cầu sau mua.</p>}
    {request && <section className="admin-detail-panel admin-order-detail" aria-label="Chi tiết yêu cầu sau mua">
      <header><h3>{kinds[request.kind]} · {request.id}</h3><button type="button" disabled={busy} onClick={() => setSelected(null)}>Đóng</button></header>
      <p>{request.reason}</p><p>{statuses[request.status] || request.status}{request.scheduledAt && <> · Lịch mới: {date(request.scheduledAt)}</>}</p>
      <h4>Hàng khách trả</h4><ul>{request.originalItems.map(item => <li key={item.id}>{item.name} × {item.quantity}</li>)}</ul>
      {request.replacementItems.length > 0 && <><h4>Hàng thay thế</h4><ul>{request.replacementItems.map(item => <li key={item.id}>{item.name} × {item.quantity} — {money(item.price * item.quantity)}</li>)}</ul></>}
      <dl className="admin-fee-list">{request.quote.breakdown.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.amount == null ? 'Theo cước thực tế' : money(item.amount)}</dd></div>)}
        <div><dt>Cần thanh toán thêm</dt><dd>{money(request.quote.additionalDue)}</dd></div><div><dt>Hoàn cho khách</dt><dd>{money(request.quote.refundAmount)}</dd></div></dl>
      {request.feePaymentReportedReference && <p>Khách báo mã: <code>{request.feePaymentReportedReference}</code> — cần đối chiếu chứng từ thực tế.</p>}
      {request.feePaidAt && <p>Đã thu khoản bù: {date(request.feePaidAt)} · {request.feePaymentReference}</p>}
      {request.refundReference && <p>Đã hoàn: {date(request.refundedAt)} · {request.refundReference}</p>}
      {request.trackingReference && <p>Vận đơn hàng đổi: {request.trackingReference}</p>}
      {request.note && <p>Ghi chú: {request.note}</p>}
      <CaseActions key={request.id + ':' + request.status} request={request} role={role} busy={busy} onAction={run} />
      <details className="admin-after-history"><summary>Lịch sử xử lý</summary>{request.events.map((event, index) => <p key={index}><small>{date(event.createdAt)} · {event.actor}</small><br />{event.message}</p>)}</details>
    </section>}
  </section>
}
