const messages = {
  "AI_PROVIDER_ERROR": "AI cục bộ gặp lỗi khi tạo câu trả lời. Vui lòng thử lại.",
  "AI_EMPTY_RESPONSE": "AI chưa tạo được câu trả lời. Vui lòng thử lại.",
  "AI_OUTPUT_LIMIT": "Câu trả lời chưa hoàn tất do đạt giới hạn xử lý. Bạn có thể hỏi ngắn hơn hoặc thử lại.",
  "AI_TIMEOUT": "AI xử lý quá thời gian chờ. Vui lòng thử lại.",
  "CHAT_FAILED": "Chưa thể hoàn tất hoặc lưu câu trả lời. Vui lòng thử lại.",
  "CHAT_STOPPED": "Cuộc trò chuyện đã dừng. Bạn có thể thử lại.",
  "INVALID_CHAT_REQUEST": "Nhập câu hỏi từ 1 đến 2.000 ký tự.",
  "LOGIN_REQUIRED": "Vui lòng đăng nhập để tiếp tục.",
  "UNAUTHENTICATED": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  "UNAUTHORIZED": "Bạn không có quyền thực hiện thao tác này.",
  "INVALID_CREDENTIALS": "Tên đăng nhập hoặc mật khẩu không đúng.",
  "ACCOUNT_EXISTS": "Tên đăng nhập hoặc email đã được sử dụng.",
  "INVALID_REGISTRATION": "Kiểm tra tên, email và mật khẩu ít nhất 8 ký tự.",
  "CSRF_INVALID": "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.",
  "INVALID_2FA_CODE": "Mã xác thực 2 lớp (OTP) không chính xác hoặc đã hết hạn.",
  "TWO_FACTOR_ALREADY_ENABLED": "Tài khoản của bạn đã kích hoạt xác thực 2 lớp.",
  "TWO_FACTOR_SETUP_REQUIRED": "Vui lòng thiết lập lại mã xác thực 2 lớp.",
  "CHALLENGE_EXPIRED": "Phiên đăng nhập 2 lớp đã hết hạn. Vui lòng thử lại.",
  "CUSTOMER_NOT_FOUND": "Không tìm thấy tài khoản.",
  "INVALID_VOUCHER": "Thông tin mã giảm giá không hợp lệ.",
  "DUPLICATE_VOUCHER": "Một mã giảm giá chỉ được áp dụng một lần trong đơn.",
  "VOUCHER_SCOPE_LIMIT": "Mỗi đơn dùng tối đa một mã hàng hóa và một mã vận chuyển.",
  "VOUCHER_NOT_FOUND": "Không tìm thấy mã giảm giá.",
  "VOUCHER_CODE_EXHAUSTED": "Chưa thể cấp mã giảm giá. Vui lòng thử lại sau.",
  "PRODUCT_UNAVAILABLE": "Sản phẩm đã hết hàng hoặc không đủ tồn kho.",
  "PRODUCT_NOT_FOUND": "Không tìm thấy sản phẩm.",
  "INVALID_DELIVERY_REGION": "Vui lòng chọn địa chỉ và khoảng cách giao hàng hợp lệ.",
  "INVALID_ORDER": "Thông tin đơn hàng chưa hợp lệ. Vui lòng kiểm tra lại.",
  "INVALID_CHECKOUT_KEY": "Vui lòng tải lại trang thanh toán rồi thử lại.",
  "CHECKOUT_BUSY": "Cửa hàng đang cập nhật giao dịch. Vui lòng thử lại sau vài giây.",
  "CHECKOUT_ALREADY_OPEN": "Bạn đang có phiên chuyển khoản chờ xử lý. Mở lại trong danh sách phiên bên dưới hoặc hủy phiên chưa chuyển tiền.",
  "ORDER_TOTAL_TOO_LARGE": "Giá trị đơn quá lớn. Vui lòng chia thành các đơn nhỏ hơn.",
  "INVALID_PAYMENT_METHOD": "Phương thức thanh toán không phù hợp cách nhận hàng.",
  "VOUCHER_RESERVED": "Mã giảm giá đang được giữ cho một phiên thanh toán. Chờ xử lý phiên trước khi thu hồi.",
  "PAYMENT_CONFIRMATION_REQUIRED": "Cần xác nhận đã đối chiếu tiền thực nhận.",
  "PAYMENT_REFERENCE_USED": "Mã giao dịch đã được ghi nhận cho đơn khác.",
  "INVALID_PAYMENT_TIME": "Giờ tiền vào ngân hàng phải từ lúc tạo phiên đến hiện tại.",
  "LEGACY_ORDER_REVIEW_REQUIRED": "Đơn cũ thiếu dữ liệu đối soát. Kiểm tra riêng trước khi xử lý.",
  "INVALID_REVIEW": "Vui lòng chọn từ 1 đến 5 sao và viết nhận xét tối đa 2.000 ký tự.",
  "INVALID_REPLY": "Nội dung trả lời phải có từ 1 đến 2.000 ký tự.",
  "REVIEW_NOT_FOUND": "Không tìm thấy đánh giá.",
  "INVALID_WHEEL": "Vòng quay đã chọn không hợp lệ. Vui lòng chọn lại.",
  "NO_SPIN_CREDITS": "Bạn chưa có lượt quay. Mỗi 100.000 đ tiền hàng đã thanh toán nhận một lượt.",
  "ORDER_NOT_FOUND": "Không tìm thấy đơn hàng.",
  "PAYMENT_SESSION_NOT_FOUND": "Không tìm thấy phiên thanh toán. Vui lòng mở lại mã QR.",
  "PAYMENT_SESSION_CANCELLED": "Bạn đã thoát phiên thanh toán. Vui lòng mở lại mã QR nếu cần.",
  "PAYMENT_SESSION_EXPIRED": "Tiền vào sau hạn QR. Cần xử lý hoàn tiền hoặc liên hệ khách, không xác nhận đơn này.",
  "CASE_NOT_FOUND": "Không tìm thấy yêu cầu hỗ trợ đơn hàng.",
  "INVALID_SCHEDULE": "Vui lòng chọn thời gian giao hoặc nhận hàng hợp lệ trong tương lai.",
  "QUOTE_CHANGED": "Giá đơn hàng đã thay đổi. Vui lòng kiểm tra lại tổng tiền.",
  "CATALOG_OUT_OF_SYNC": "Danh mục sản phẩm đã thay đổi. Vui lòng kiểm tra lại giỏ hàng trước khi thanh toán.",
  "PAYMENT_REQUIRED": "Đơn hàng cần được xác nhận thanh toán trước.",
  "PAYMENT_REFERENCE_REQUIRED": "Nhập mã giao dịch thực tế từ sao kê.",
  "ACTION_NOT_ALLOWED": "Trạng thái hiện tại không cho phép thao tác này.",
  "DEMO_ONLY": "Chức năng này chỉ dành cho thanh toán mô phỏng.",
  "ONLINE_PAYMENT_REQUIRED": "Đơn thanh toán trực tiếp cần được xử lý tại cửa hàng.",
  "RETURN_WINDOW_EXPIRED": "Yêu cầu nằm ngoài thời hạn đổi/trả 7 ngày.",
  "DELIVERY_REQUIRED": "Bạn chỉ có thể yêu cầu trả hàng sau khi nhận hàng.",
  "ALREADY_SHIPPED": "Đơn hàng đã được chuyển giao nên không thể hủy theo diện chưa giao.",
  "CASE_ALREADY_OPEN": "Đơn hàng đang có một yêu cầu cần xử lý.",
  "RESCHEDULE_WINDOW_EXPIRED": "Lịch mới phải ở tương lai và tối đa 3 ngày từ lịch cũ.",
  "AFTER_SALES_ALREADY_OPEN": "Đơn đang có yêu cầu sau mua. Xử lý yêu cầu đó trước khi chuyển bước giao hàng.",
  "AFTER_SALES_NOT_FOUND": "Không tìm thấy yêu cầu đổi/trả.",
  "INVALID_AFTER_SALES": "Kiểm tra loại yêu cầu, lý do và ghi chú xử lý.",
  "INVALID_REPLACEMENT": "Danh sách hàng thay thế hoặc số lượng chưa hợp lệ.",
  "DELIVERY_DATE_REQUIRED": "Đơn cũ chưa có ngày nhận hàng được xác minh.",
  "LEGACY_AFTER_SALES_REVIEW_REQUIRED": "Yêu cầu cũ cần đối chiếu bảng phí và chứng từ riêng.",
  "INVALID_REASON": "Vui lòng nhập lý do từ 5 đến 1.000 ký tự.",
  "RETURN_NOT_RECEIVED": "Cần xác nhận đã nhận lại hàng trước khi hoàn tiền.",
  "REFUND_REFERENCE_REQUIRED": "Nhập mã giao dịch hoặc phiếu hoàn tiền thực tế.",
  "CASE_PENDING": "Đơn hàng đang có yêu cầu sau bán hàng cần xử lý.",
  "COUNTER_CONFIRMATION_REQUIRED": "Cần xác nhận đã thu tiền trực tiếp tại quầy.",
  "DELIVERY_PAYMENT_CONFIRMATION_REQUIRED": "Cần xác nhận đã thu tiền khi giao hàng.",
  "INVALID_PAYMENT_SETTINGS": "Kiểm tra tên ngân hàng, BIN 6 số, số tài khoản và tên người nhận.",
  "WEBHOOK_NOT_CONFIGURED": "Dịch vụ xác nhận thanh toán chưa sẵn sàng. Vui lòng liên hệ cửa hàng.",
  "INVALID_PAYMENT_AMOUNT": "Số tiền thực nhận chưa khớp giá trị đơn. Cần đối soát hoặc hoàn lại, không xác nhận thành công.",
  "INVALID_CONTACT": "Vui lòng kiểm tra tên, email và nội dung từ 10 đến 2.000 ký tự.",
  "BAD_REQUEST": "Thông tin gửi đi chưa hợp lệ. Vui lòng kiểm tra lại.",
  "RATE_LIMITED": "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
  "IDEMPOTENCY_CONFLICT": "Yêu cầu này đã được sử dụng. Vui lòng gửi một tin nhắn mới.",
  "TURN_IN_PROGRESS": "Tin nhắn trước vẫn đang được xử lý. Vui lòng chờ.",
  "RETRY_SUPERSEDED": "Đã có lượt trò chuyện mới hơn. Vui lòng gửi lại bằng tin nhắn mới.",
  "CONVERSATION_NOT_FOUND": "Không tìm thấy cuộc trò chuyện. Vui lòng mở cuộc trò chuyện mới.",
  "CONVERSATION_BUSY": "Cuộc trò chuyện đang được xử lý. Vui lòng chờ một lát.",
  "QUEUE_FULL": "Trợ lý đang bận. Vui lòng thử lại sau ít phút.",
  "QUEUE_TIMEOUT": "Thời gian chờ trợ lý đã hết. Vui lòng thử lại.",
  "MODEL_NOT_FOUND": "Trợ lý chưa sẵn sàng. Vui lòng thử lại sau.",
  "OLLAMA_TIMEOUT": "Trợ lý phản hồi quá chậm. Vui lòng thử lại.",
  "OLLAMA_EARLY_EOF": "Kết nối bị ngắt trước khi trả lời xong. Vui lòng thử lại.",
  "OUTPUT_LIMIT": "Câu trả lời quá dài và chưa hoàn tất. Vui lòng đặt câu hỏi ngắn hơn.",
  "OLLAMA_INCOMPLETE": "Câu trả lời chưa hoàn tất. Vui lòng thử lại.",
  "CONTEXT_TOO_LARGE": "Cuộc trò chuyện quá dài. Vui lòng mở cuộc trò chuyện mới.",
  "AI_UNAVAILABLE": "Chưa thể nhận câu trả lời từ trợ lý. Vui lòng thử lại sau.",
  "BAD_STREAM_EVENT": "Dữ liệu trả lời không hợp lệ. Vui lòng thử lại.",
  "BAD_STREAM": "Dữ liệu trả lời bị lỗi. Vui lòng thử lại.",
  "NO_STREAM": "Không nhận được câu trả lời. Vui lòng thử lại.",
  "INCOMPLETE_STREAM": "Kết nối bị ngắt trước khi trả lời xong. Vui lòng thử lại.",
  "NOT_FOUND": "Không tìm thấy nội dung được yêu cầu.",
  "REQUEST_TOO_LARGE": "Nội dung gửi đi quá lớn. Vui lòng rút ngắn rồi thử lại.",
  "INVALID_JSON": "Dữ liệu gửi đi chưa hợp lệ. Vui lòng tải lại trang rồi thử lại.",
  "INVALID_RESPONSE": "Dữ liệu phản hồi chưa hợp lệ. Vui lòng thử lại.",
  "INTERNAL_ERROR": "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.",
  "NETWORK_ERROR": "Không thể kết nối đến cửa hàng. Vui lòng kiểm tra mạng rồi thử lại.",
  "TIMEOUT": "Yêu cầu đã quá thời gian chờ. Vui lòng thử lại.",
  "ABORTED": "Yêu cầu đã được hủy.",
  "UNMATCHED_REASON_REQUIRED": "Nhập lý do cần hoàn từ 5 đến 1.000 ký tự; khách có thể xem nội dung này.",
  "UNMATCHED_PAYMENT_NOT_FOUND": "Không tìm thấy khoản chuyển cần đối soát của đơn này.",
  "BANK_TRANSFER_REQUIRED": "Chức năng này dành cho khoản chuyển vào phiên thanh toán ngân hàng.",
  "FEATURED_PRODUCT_PROTECTED": "Sản phẩm nổi bật đang dùng trên trang chủ được bảo vệ khỏi xóa; bạn vẫn có thể sửa thông tin.",
  "EXPORT_MODULE_NOT_FOUND": "Mục dữ liệu này chưa hỗ trợ xuất file.",
  "RETURN_RECEIVED_REQUIRED": "Cần xác nhận đã nhận và kiểm tra hàng khách trả.",
  "REJECTION_REASON_REQUIRED": "Nhập lý do từ chối ít nhất 5 ký tự.",
  "REFUND_CONFIRMATION_REQUIRED": "Cần xác nhận đã hoàn tiền thực tế.",
  "INVALID_REFUND_AMOUNT": "Số tiền hoàn chưa khớp bảng phí đã được khách đồng ý.",
  "REFUND_REFERENCE_USED": "Chứng từ này đã được ghi nhận. Kiểm tra lại để tránh hoàn trùng.",
  "INVALID_REFUND_TIME": "Thời gian hoàn tiền phải từ lúc tạo yêu cầu đến hiện tại.",
  "TRACKING_REFERENCE_REQUIRED": "Nhập mã vận đơn hàng thay thế.",
  "EXCHANGE_RECEIVED_REQUIRED": "Cần xác nhận khách đã nhận đủ hàng thay thế.",
  "PRODUCT_IN_USE": "Sản phẩm còn liên quan đến đơn đang giao hoặc yêu cầu đổi/trả. Hoàn tất xử lý trước khi xóa.",
  "FORBIDDEN": "Tài khoản không có quyền sử dụng chức năng này.",
  "INVALID_PRODUCT": "Dữ liệu sản phẩm không hợp lệ.",
  "INVALID_PRODUCT_OFFER": "Giá trị giảm giá hoặc tồn kho không hợp lệ.",
  "RECORD_NOT_FOUND": "Không tìm thấy bản ghi.",
  "INVALID_VOUCHER_CODE": "Mã mới phải gồm đúng 8 chữ cái hoặc chữ số.",
  "VOUCHER_EXISTS": "Mã giảm giá đã tồn tại. Hãy chọn mã khác.",
  "CUSTOMER_EXISTS": "Tên đăng nhập hoặc thư điện tử đã được sử dụng.",
  "INVALID_CUSTOMER": "Thông tin khách hàng không hợp lệ.",
  "INVALID_ADMIN_ACCOUNT": "Thông tin tài khoản nhân viên không hợp lệ.",
  "ADMIN_EXISTS": "Tên tài khoản nhân viên đã được sử dụng.",
  "ADMIN_NOT_FOUND": "Không tìm thấy tài khoản nhân viên.",
  "LAST_ADMIN_REQUIRED": "Phải giữ ít nhất một quản trị viên đang hoạt động.",
  "INVALID_PASSWORD": "Mật khẩu phải dài từ 8 đến 128 ký tự.",
  "INVALID_CONTEXT_SIZE": "Giới hạn ngữ cảnh đã chọn không được hỗ trợ.",
  "INVALID_REPORT_RANGE": "Khoảng ngày báo cáo không hợp lệ.",
  "LOGIN_FAILED": "Tên tài khoản hoặc mật khẩu không đúng."
}

const fallbackMessage = 'Không thể hoàn tất thao tác.'

function knownMessage(code) {
  return typeof code === 'string' && Object.hasOwn(messages, code) ? messages[code] : ''
}

export function apiErrorMessage(payload = {}, status = 0) {
  const known = knownMessage(payload?.error) || knownMessage(payload?.code)
  if (known) return known
  // Chỉ dùng bảng dịch; thông báo máy chủ có thể chứa tiếng Anh hoặc chi tiết nội bộ.
  if (status === 401) return messages.UNAUTHENTICATED
  if (status === 403) return messages.UNAUTHORIZED
  if (status === 404) return messages.NOT_FOUND
  if (status === 408 || status === 504) return messages.TIMEOUT
  if (status === 413) return messages.REQUEST_TOO_LARGE
  if (status === 429) return messages.RATE_LIMITED
  if (status >= 500) return messages.INTERNAL_ERROR
  if (status >= 400) return messages.BAD_REQUEST
  return fallbackMessage
}

function isVietnameseMessage(value) {
  return typeof value === 'string'
    && /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(value)
    && !/[A-Z]{2,}_[A-Z_]+|\b(?:Error|TypeError|SyntaxError|HTTP|fetch|JSON|undefined|stack)\b|https?:\/\//.test(value)
}

export function userMessage(error, fallback = fallbackMessage) {
  const message = typeof error === 'string' ? error : error?.message
  const known = knownMessage(error?.code) || knownMessage(message)
  if (known) return known
  if (error?.name === 'AbortError') return messages.ABORTED
  if (error?.name === 'TimeoutError' || /timeout|timed out/i.test(message || '')) return messages.TIMEOUT
  if (/fetch|network|load failed|connection|ECONN|ENOTFOUND/i.test(message || '')) return messages.NETWORK_ERROR
  if (error?.name === 'SyntaxError' || /JSON|unexpected token|unexpected end/i.test(message || '')) {
    return messages.INVALID_RESPONSE
  }
  if (isVietnameseMessage(message)) return message.trim()
  return isVietnameseMessage(fallback) ? fallback.trim() : fallbackMessage
}
