import { useEffect, useState } from 'react'
import { apiJson } from '../api/chat'

const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
const reasons = {
  SEPAY_AUTH_FAILED: 'Khóa API không hợp lệ hoặc đã bị thu hồi.',
  SEPAY_ACCOUNT_NOT_LINKED: 'Chưa tìm thấy tài khoản MB đang hoạt động trên SePay khớp tài khoản nhận tiền.',
  SEPAY_MB_REQUIRED: 'Kết nối này dành cho tài khoản MB.',
  SEPAY_RATE_LIMIT: 'SePay đang giới hạn lượt truy vấn; hệ thống sẽ tự thử lại.',
  SEPAY_BATCH_LIMIT: 'Lượng giao dịch vượt giới hạn trả về của API; cần đối soát bổ sung trước khi tiếp tục.',
  SEPAY_TRANSACTION_CONFLICT: 'SePay trả nội dung khác cho một mã giao dịch đã lưu; cần kiểm tra.',
  INVALID_PAYMENT_AMOUNT: 'Số tiền không khớp đơn.',
  PAYMENT_SESSION_EXPIRED: 'Tiền vào sau hạn thanh toán.',
  INVALID_PAYMENT_TIME: 'Thời gian tiền vào không hợp lệ cho phiên này.',
  ORDER_CANCELLED: 'Đơn đã bị hủy trước khi đối soát.',
  ORDER_NOT_FOUND: 'Chưa tìm thấy đơn tương ứng.',
  AFTER_SALES_NOT_FOUND: 'Chưa tìm thấy yêu cầu đổi hàng tương ứng.',
  AMBIGUOUS_PAYMENT_CODE: 'Nội dung chứa nhiều mã thanh toán.',
  PAYMENT_ACCOUNT_MISMATCH: 'Tài khoản nhận không khớp tài khoản của phiên.',
  IDEMPOTENCY_CONFLICT: 'Đơn đã nhận một giao dịch khác.',
  PAYMENT_REFERENCE_USED: 'Mã giao dịch đã được ghi nhận.',
  PRODUCT_UNAVAILABLE: 'Tiền vào đúng hạn nhưng hiện không đủ hàng để khôi phục đơn.',
  INVALID_VOUCHER: 'Cần kiểm tra voucher của phiên đã giải phóng.',
  VOUCHER_RESERVED: 'Voucher đang được giữ cho một phiên khác.',
}

export default function AdminSePay({ onSelectPayment }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    async function refresh() {
      if (pending) return
      pending = true
      try {
        const result = await apiJson('/api/admin/sepay', { signal: controller.signal })
        if (!controller.signal.aborted) { setData(result); setError('') }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message)
      } finally { pending = false }
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [])
  const connection = data?.connection
  return <section className="admin-module-card" aria-label="Xác nhận tự động SePay">
    <h3>Xác nhận tự động qua SePay · MB</h3>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {connection && <p role="status">{!connection.configured ? 'Chưa bật kết nối SePay. Đơn chuyển khoản hiện cần cửa hàng đối soát.'
      : connection.healthy ? 'Đang tự kiểm tra tiền vào mỗi 10 giây.' : 'Đối soát tự động chưa sẵn sàng. Các khoản chuyển chưa xác nhận vẫn được giữ để xử lý.'}</p>}
    {connection?.error && <p className="admin-error">{reasons[connection.error] || 'Chưa đồng bộ được giao dịch; hệ thống sẽ tự thử lại.'}</p>}
    {connection?.lastSyncAt && <p>Đồng bộ gần nhất: {new Date(connection.lastSyncAt).toLocaleString('vi-VN')}</p>}
    {!connection?.configured && <p>Liên kết MB trên <a href="https://my.sepay.vn" target="_blank" rel="noopener noreferrer">SePay</a>, sau đó cấu hình khóa API cho máy chủ. <a href="https://docs.sepay.vn/ket-noi-mb-api.html" target="_blank" rel="noopener noreferrer">Hướng dẫn liên kết MB</a>.</p>}
    {Boolean(data?.transactions?.length) && <div className="admin-table-scroll"><table className="admin-order-table">
      <thead><tr><th>Đơn / mã giao dịch</th><th>Tiền vào</th><th>Thời điểm nhận</th><th>Kết quả</th></tr></thead>
      <tbody>{data.transactions.map(item => <tr key={item.id}>
        <td>{item.paymentId?.startsWith('ST') ? <button type="button" onClick={() => onSelectPayment(item)}>{item.paymentId}</button> : item.paymentId || 'Chưa khớp mã đơn'}<small>{item.reference}</small></td>
        <td>{money(item.amount)}</td><td>{new Date(item.receivedAt).toLocaleString('vi-VN')}</td>
        <td>{item.state === 'paid' ? 'Đã xác nhận tự động' : item.state === 'resolved' ? 'Đã được cửa hàng ghi nhận' : 'Cần kiểm tra'}
          {item.state === 'review' && <small>{reasons[item.reason] || 'Cần đối soát chứng từ trước khi xử lý.'}</small>}
          <details><summary>Nội dung chuyển khoản</summary>{item.content}</details>
        </td>
      </tr>)}</tbody>
    </table><p>Hiển thị tối đa 100 giao dịch gần nhất. Khoản cần kiểm tra có thể đối soát hoặc ghi nhận hoàn trong chi tiết đơn.</p></div>}
  </section>
}
