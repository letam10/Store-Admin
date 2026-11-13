const orderStates = {
  pending: 'Chờ thanh toán', paid: 'Đã thanh toán', completed: 'Đã nhận hàng', delivered: 'Đã giao hàng',
  cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền', expired: 'Hết hạn thanh toán', reported: 'Khách báo đã chuyển',
  needs_review: 'Cần đối soát', unmatched_received: 'Đã nhận khoản cần hoàn', refunded_unmatched: 'Đã hoàn khoản chuyển không khớp',
  processing: 'Đang chuẩn bị', ready: 'Sẵn sàng giao hoặc nhận', shipped: 'Đang giao', returned: 'Đã nhận hàng trả',
}
const workflowStates = {
  pending: 'Đang chờ xử lý', open: 'Mới tiếp nhận', new: 'Mới tiếp nhận', active: 'Đang hoạt động',
  draft: 'Bản nháp', approved: 'Đã duyệt', rejected: 'Đã từ chối', processing: 'Đang xử lý',
  resolved: 'Đã giải quyết', closed: 'Đã đóng', completed: 'Đã hoàn tất', cancelled: 'Đã hủy',
  awaiting_confirmation: 'Chờ khách xác nhận', awaiting_return: 'Chờ nhận hàng trả',
  awaiting_payment: 'Chờ thanh toán khoản bù', awaiting_refund: 'Chờ hoàn tiền',
  awaiting_exchange: 'Chờ giao hàng đổi', exchange_shipped: 'Đang giao hàng đổi',
}
const fields = {
  id: 'Mã', status: 'Trạng thái', createdAt: 'Ngày tạo', updatedAt: 'Cập nhật lần cuối',
  kind: 'Loại', product: 'Sản phẩm', warehouse: 'Kho', quantity: 'Số lượng', note: 'Ghi chú',
  customer: 'Khách hàng', customerId: 'Mã khách hàng', order: 'Mã đơn', orderId: 'Mã đơn',
  topic: 'Chủ đề', assignee: 'Người phụ trách', email: 'Thư điện tử', message: 'Nội dung',
  route: 'Tuyến vận chuyển', progress: 'Tiến độ', updated: 'Cập nhật', employee: 'Nhân viên',
  role: 'Vai trò', shift: 'Ca làm', baseSalary: 'Lương cơ bản', login: 'Tài khoản',
  date: 'Ngày', hours: 'Số giờ', hourlyRate: 'Đơn giá theo giờ', bonus: 'Tiền thưởng',
  priority: 'Mức ưu tiên', sla: 'Thời hạn xử lý', reason: 'Lý do', title: 'Tiêu đề',
}

export function statusLabel(value, workflow = false) {
  const text = String(value ?? '')
  return (workflow ? workflowStates : orderStates)[text] || (Array.from(text).some(letter => letter.codePointAt(0) > 127) ? text : 'Chưa xác định')
}

export function fieldLabel(key, schema) {
  return schema?.fields?.find(field => field.key === key)?.label || fields[key] || 'Thông tin bổ sung'
}

export function tierLabel(value) {
  return { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', diamond: 'Kim cương' }[String(value).toLowerCase()] || value
}

export function categoryLabel(value) {
  return value === 'Laptop' ? 'Máy tính xách tay' : value
}

export function dateLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export function dateOnlyLabel(value, short = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  return match ? match[3] + '/' + match[2] + (short ? '' : '/' + match[1]) : String(value || '—')
}

export function compactLabel(value) {
  return { not_needed: 'Chưa cần rút gọn', compacted: 'Đã rút gọn', pending: 'Đang chờ', running: 'Đang rút gọn', failed: 'Chưa rút gọn được' }[value] || 'Chưa có thông tin'
}

export function thinkingLabel(value) {
  return { off: 'Tắt', medium: 'Vừa', high: 'Cao' }[value] || 'Chưa xác định'
}

export function voucherLabel(value) {
  return String(value || '').replace(/\bVoucher\b/g, 'Mã giảm giá').replace(/\bvoucher\b/g, 'mã giảm giá')
    .replace(/\bship\b/gi, 'vận chuyển').replaceAll('Miễn vận chuyển', 'Miễn phí vận chuyển')
    .replaceAll('miễn vận chuyển', 'miễn phí vận chuyển')
}
