/**
 * @codex-vn-doc
 * Tệp: src/api/chat.js
 * Mục đích: Client gọi chat hỗ trợ và đọc luồng NDJSON, xử lý done/error/abort.
 * Thành phần chính: ApiStreamError, apiJson, streamChat.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
export class ApiStreamError extends Error {
  constructor(message, code = 'API_ERROR', extra = {}) {
    super(message)
    this.name = 'ApiStreamError'
    this.code = code
    Object.assign(this, extra)
  }
}

// Chức năng readError: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
async function readError(response) {
  const fallbackByCode = {
    INVALID_PAYMENT_AMOUNT: 'Số tiền thực nhận chưa khớp giá trị đơn. Cần đối soát hoặc hoàn lại, không xác nhận thành công.',
    INVALID_PAYMENT_TIME: 'Giờ tiền vào ngân hàng phải từ lúc tạo phiên đến hiện tại.',
    PAYMENT_SESSION_EXPIRED: 'Tiền vào sau hạn QR. Cần xử lý hoàn tiền hoặc liên hệ khách, không xác nhận đơn này.',
    PAYMENT_REFERENCE_USED: 'Mã giao dịch đã được ghi nhận cho đơn khác.',
    PAYMENT_CONFIRMATION_REQUIRED: 'Cần xác nhận đã đối chiếu tiền thực nhận.',
    PAYMENT_REFERENCE_REQUIRED: 'Nhập mã giao dịch thực tế từ sao kê.',
    LEGACY_ORDER_REVIEW_REQUIRED: 'Đơn cũ thiếu dữ liệu đối soát. Kiểm tra riêng trước khi xử lý.',
    AFTER_SALES_ALREADY_OPEN: 'Đơn đang có yêu cầu sau mua. Xử lý yêu cầu đó trước khi chuyển bước giao hàng.',
    AFTER_SALES_NOT_FOUND: 'Không tìm thấy yêu cầu đổi/trả.',
    LEGACY_AFTER_SALES_REVIEW_REQUIRED: 'Yêu cầu cũ cần đối chiếu bảng phí và chứng từ riêng.',
    INVALID_AFTER_SALES: 'Kiểm tra loại yêu cầu, lý do và ghi chú xử lý.',
    INVALID_REPLACEMENT: 'Danh sách hàng thay thế hoặc số lượng chưa hợp lệ.',
    DELIVERY_DATE_REQUIRED: 'Đơn cũ chưa có ngày nhận hàng được xác minh.',
    RETURN_WINDOW_EXPIRED: 'Yêu cầu nằm ngoài thời hạn đổi/trả 7 ngày.',
    RESCHEDULE_WINDOW_EXPIRED: 'Lịch mới phải ở tương lai và tối đa 3 ngày từ lịch cũ.',
    RETURN_RECEIVED_REQUIRED: 'Cần xác nhận đã nhận và kiểm tra hàng khách trả.',
    REJECTION_REASON_REQUIRED: 'Nhập lý do từ chối ít nhất 5 ký tự.',
    REFUND_CONFIRMATION_REQUIRED: 'Cần xác nhận đã hoàn tiền thực tế.',
    INVALID_REFUND_AMOUNT: 'Số tiền hoàn chưa khớp bảng phí đã được khách đồng ý.',
    REFUND_REFERENCE_REQUIRED: 'Nhập mã giao dịch hoặc phiếu hoàn tiền thực tế.',
    REFUND_REFERENCE_USED: 'Chứng từ này đã được ghi nhận. Kiểm tra lại để tránh hoàn trùng.',
    INVALID_REFUND_TIME: 'Thời gian hoàn tiền phải từ lúc tạo yêu cầu đến hiện tại.',
    TRACKING_REFERENCE_REQUIRED: 'Nhập mã vận đơn hàng thay thế.',
    EXCHANGE_RECEIVED_REQUIRED: 'Cần xác nhận khách đã nhận đủ hàng thay thế.',
    INVALID_PAYMENT_SETTINGS: 'Kiểm tra tên ngân hàng, BIN 6 số, số tài khoản và tên người nhận.',
    VOUCHER_RESERVED: 'Voucher đang được giữ cho một phiên thanh toán. Chờ xử lý phiên trước khi thu hồi.',
    ACTION_NOT_ALLOWED: 'Trạng thái hiện tại không cho phép thao tác này.',
    PRODUCT_IN_USE: 'Sản phẩm còn liên quan đến đơn đang giao hoặc yêu cầu đổi/trả. Hoàn tất xử lý trước khi xóa.',
    FORBIDDEN: 'Tài khoản không có quyền sử dụng chức năng này.',
    INVALID_PRODUCT: 'Du lieu san pham khong hop le.', INVALID_PRODUCT_OFFER: 'Gia tri giam gia hoac ton kho khong hop le.',
    INVALID_VOUCHER: 'Thong tin voucher khong hop le.', PRODUCT_UNAVAILABLE: 'San pham da het hang hoac khong du ton kho.',
    UNAUTHENTICATED: 'Phien dang nhap da het, vui long dang nhap lai.', CSRF_INVALID: 'Phien bao mat khong hop le, vui long tai lai trang.',
    RATE_LIMITED: 'Ban thao tac qua nhanh, vui long thu lai sau.', RECORD_NOT_FOUND: 'Khong tim thay ban ghi.',
  }
  try {
    const body = await response.json()
    const code = body.error || 'API_ERROR'
    return new ApiStreamError(fallbackByCode[code] || (body.message && !/^[A-Z0-9_ -]+$/.test(String(body.message)) ? body.message : 'Yeu cau API that bai.'), code)
  } catch {
    return new ApiStreamError('Yeu cau API that bai voi HTTP ' + response.status, 'HTTP_' + response.status)
  }
}

// Chức năng apiJson: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export async function apiJson(url, options = {}) {
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (!response.ok) throw await readError(response)
  return response.json()
}

// Chức năng validateEvent: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') {
    throw new ApiStreamError('Backend trả về event không hợp lệ.', 'BAD_STREAM_EVENT')
  }
  if (event.type === 'delta' && typeof event.content !== 'string') {
    throw new ApiStreamError('Event delta thiếu content hợp lệ.', 'BAD_STREAM_EVENT')
  }
  if (event.type === 'done' && typeof event.conversationId !== 'string') {
    throw new ApiStreamError('Event done thiếu conversationId.', 'BAD_STREAM_EVENT')
  }
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (event.type === 'error' && typeof event.code !== 'string') {
    throw new ApiStreamError('Event error thiếu code.', 'BAD_STREAM_EVENT')
  }
  return event
}

// Chức năng streamChat: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export async function streamChat({
  endpoint,
  message,
  conversationId,
  requestId,
  csrfToken,
  signal,
  onEvent,
}) {
  // Lệnh tích hợp: gọi mạng hoặc dữ liệu bên ngoài; cần xử lý timeout, lỗi và dữ liệu rỗng.
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({
      message,
      requestId,
      ...(conversationId ? { conversationId } : {}),
    }),
  })

  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (!response.ok) throw await readError(response)
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (!response.body) throw new ApiStreamError('Trình duyệt không nhận được stream.', 'NO_STREAM')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminalReceived = false
  let cleanEof = false

  // Chức năng consume: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const consume = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let event
    try { event = validateEvent(JSON.parse(trimmed)) }
    // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn và giữ trạng thái nhất quán.
    catch (error) {
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (error instanceof ApiStreamError) throw error
      throw new ApiStreamError('Backend trả về stream JSON không hợp lệ.', 'BAD_STREAM')
    }
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (terminalReceived) throw new ApiStreamError('Backend gửi event sau done.', 'BAD_STREAM')
    onEvent?.(event)
    if (event.type === 'done') terminalReceived = true
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (event.type === 'error') {
      const localError = { UNAUTHENTICATED: 'Phien dang nhap da het, vui long dang nhap lai.', RATE_LIMITED: 'Ban thao tac qua nhanh, vui long thu lai sau.', INCOMPLETE_STREAM: 'Ket noi ket thuc som, vui long thu lai.' }
      throw new ApiStreamError(localError[event.code] || (event.message && !/^[A-Z0-9_ -]+$/.test(String(event.message)) ? event.message : 'AI local khong the tra loi.'), event.code, {
        incomplete: Boolean(event.incomplete || event.partial),
      })
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) consume(buffer)
    cleanEof = true
    if (!terminalReceived) {
      throw new ApiStreamError('Kết nối kết thúc trước event done.', 'INCOMPLETE_STREAM', { incomplete: true })
    }
  } finally {
    // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
    if (!cleanEof || !terminalReceived || signal?.aborted) {
      try { await reader.cancel() } catch { /* best effort */ }
    }
    try { reader.releaseLock() } catch { /* already released */ }
  }
}
