import { useEffect, useRef, useState } from 'react'
import { apiJson } from '../api/chat'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
const date = value => new Date(value).toLocaleString('vi-VN')

function RefundForm({ payment, submit, busy }) {
  return <form onSubmit={event => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    submit(`/${payment.id}/refund`, { reference: fields.get('reference'), amount: Number(fields.get('amount')),
      refundedAt: new Date(fields.get('refundedAt')).toISOString(), refundedConfirmed: fields.get('confirmed') === 'on' })
  }}>
    <h4>Ghi nhận hoàn {money(payment.amount)}</h4>
    <label>Số tiền đã hoàn (đ)<input name="amount" required type="number" min="1" step="1" defaultValue={payment.amount} /></label>
    <label>Mã giao dịch hoàn tiền<input name="reference" required minLength="3" maxLength="100" /></label>
    <label>Thời điểm hoàn tiền<input name="refundedAt" required type="datetime-local" step="1" /></label>
    <label className="admin-confirm-check"><input name="confirmed" type="checkbox" required />Tôi đã hoàn đủ khoản tiền này và kiểm tra chứng từ.</label>
    <button type="submit" disabled={busy}>Lưu xác nhận hoàn tiền</button>
  </form>
}

export default function AdminUnmatchedPayments({ order, csrfToken, onChanged }) {
  const [payments, setPayments] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const gate = useRef(false)
  const receiptKey = useRef(null)
  const base = `/api/admin/customer-orders/${encodeURIComponent(order.id)}/unmatched-payments`
  useEffect(() => {
    const controller = new AbortController()
    apiJson(base, { signal: controller.signal }).then(data => setPayments(data.payments))
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
    return () => controller.abort()
  }, [base, version])

  async function submit(suffix, proof) {
    if (gate.current) return
    gate.current = true
    setBusy(true)
    setError('')
    try {
      const result = await apiJson(base + suffix, { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: JSON.stringify(proof) })
      setPayments(result.payments)
      setVersion(current => current + 1)
      await onChanged?.()
    } catch (failure) { setError(failure.message) }
    finally { gate.current = false; setBusy(false) }
  }

  if (order.paymentMethod !== 'bank_transfer') return null
  return <section className="admin-module-card" aria-label="Đối soát khoản chuyển không khớp">
    <h3>Tiền chuyển không khớp / chuyển trùng</h3>
    <p>Dùng cho khoản vào sai số tiền, sau hạn QR, không thể giao hàng hoặc chuyển lặp. Chỉ lưu sau khi đối chiếu tiền thực nhận; các khoản này cần hoàn đầy đủ và không tính vào doanh thu bán hàng.</p>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {payments.length > 0 && <p>Còn cần hoàn: <b>{money(payments.filter(item => item.status !== 'refunded').reduce((sum, item) => sum + item.amount, 0))}</b></p>}
    {payments.map(payment => <article className="admin-module-card" key={payment.id} data-unmatched-id={payment.id}>
      <h4>{money(payment.amount)} · {payment.status === 'refunded' ? 'Đã hoàn đầy đủ' : 'Chờ hoàn tiền'}</h4>
      <p>Tiền vào: {date(payment.receivedAt)} · Mã: <code>{payment.reference}</code></p><p>{payment.reason}</p>
      {payment.refundedAt ? <p>Đã hoàn: {date(payment.refundedAt)} · Chứng từ: <code>{payment.refundReference}</code></p>
        : <RefundForm payment={payment} submit={submit} busy={busy} />}
    </article>)}
    <details key={order.id + ':' + payments.length}><summary>Ghi nhận thêm khoản tiền thực nhận cần hoàn</summary>
      <form onSubmit={event => {
        event.preventDefault()
        const fields = new FormData(event.currentTarget)
        const proof = { reference: fields.get('reference'), receivedAmount: Number(fields.get('amount')),
          receivedAt: new Date(fields.get('receivedAt')).toISOString(), reason: fields.get('reason'), receivedConfirmed: fields.get('confirmed') === 'on' }
        const fingerprint = JSON.stringify(proof)
        if (receiptKey.current?.fingerprint !== fingerprint) receiptKey.current = { fingerprint, id: crypto.randomUUID() }
        submit('', { ...proof, requestId: receiptKey.current.id })
      }}>
        <label>Số tiền thực nhận cần hoàn (đ)<input name="amount" type="number" min="1" step="1" required /></label>
        <label>Mã giao dịch nhận tiền<input name="reference" minLength="3" maxLength="100" required /></label>
        <label>Thời điểm tiền vào<input name="receivedAt" type="datetime-local" step="1" required /></label>
        <label>Lý do cần hoàn (khách xem được)<textarea name="reason" minLength="5" maxLength="1000" required /></label>
        <label className="admin-confirm-check"><input name="confirmed" type="checkbox" required />Tôi đã đối chiếu sao kê và xác nhận khoản tiền này cần hoàn.</label>
        <button type="submit" disabled={busy}>Lưu khoản tiền cần hoàn</button>
      </form>
    </details>
  </section>
}
