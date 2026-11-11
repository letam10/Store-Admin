# Thanh toán và thông báo email

## Nhận chuyển khoản

Trong **Đơn thanh toán → Cấu hình ngân hàng nhận tiền**, lưu ngân hàng/BIN, số tài khoản và tên người nhận đã kiểm tra. Khi chưa cấu hình, API từ chối tạo QR. Hệ thống dùng VietQR để tạo ảnh chứa số tiền và mã phiên; không có webhook ngân hàng tự động.

Phiên QR có hạn 2 phút được lưu ở server. Tải lại trang không gia hạn. Mỗi phiên giữ nguyên tài khoản nhận tiền đã cấu hình lúc tạo; thay ngân hàng sau đó chỉ áp dụng cho phiên mới.

Khách bấm **Tôi đã chuyển khoản** chỉ gửi thông tin để đối soát. Admin cần kiểm tra sao kê, nhập mã giao dịch, số tiền và thời điểm thực nhận. Số tiền phải khớp; thời điểm nhận phải trong hạn QR. API không dùng lời khai của khách để đánh dấu đã thanh toán.

Khi xác nhận tiền, trạng thái thanh toán, điểm, tổng tiền hàng, lượt quay, voucher và hai nhóm email được ghi cùng giao dịch SQL. Gửi lại cùng yêu cầu hoặc bấm xác nhận nhiều lần không cộng thêm điểm/trừ kho/gửi thêm hóa đơn. Một mã giao dịch ngân hàng không dùng để xác nhận hai đơn.

Đơn chưa xác nhận tiền không xuất hiện trong lịch sử mua ở tài khoản. Khách theo dõi riêng trong **Phiên đặt hàng gần đây** tại checkout. QR đã hết hạn sẽ ẩn; nếu đã chuyển theo QR cũ, thông tin báo chuyển vẫn được giữ để cửa hàng kiểm tra. Website không thể ngăn ứng dụng ngân hàng chuyển tiền từ một QR khách đã lưu.

Kho trong catalog thể hiện số lượng còn có thể đặt. Phiên mới giữ hàng và voucher cá nhân; hủy hoặc hết hạn khi chưa báo tiền sẽ giải phóng phần giữ. Khách đã báo tiền không được tự xóa phiên. Khi thanh toán thành công mới sử dụng voucher cá nhân và cộng thưởng.

## Thanh toán tại quầy / khi giao

Đặt hàng bằng cash/COD chưa phải thanh toán. Admin xác nhận số tiền đã thu tại quầy hoặc lúc giao. Trạng thái giao hàng tách khỏi trạng thái tiền; chuẩn bị/giao hàng không làm mất dấu đã thanh toán. Không thể hủy một đơn đã thu tiền bằng API hủy phiên chưa trả tiền.

Bản ghi cũ không có dữ liệu phiên đối soát được giữ lại, cần kiểm tra riêng; không tự biến thành giao dịch tiền thật.

## Email

Cấu hình trong `server-dotnet/.env` (không commit): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. `ADMIN_NOTIFICATION_EMAILS` nhận nhiều địa chỉ, cách nhau bằng dấu phẩy hoặc chấm phẩy. Nếu không đặt danh sách này, hệ thống dùng `SUPPORT_EMAIL`, rồi đến `SMTP_USER`.

- Đăng ký: thư chào mừng khách và thông báo riêng cho mỗi quản trị viên.
- Quên mật khẩu: liên kết dùng một lần gửi cho khách; admin chỉ nhận thông báo sự kiện, không nhận token đặt lại mật khẩu.
- Thanh toán được xác nhận: biên nhận gửi cho khách, thông báo gửi riêng từng admin.
- Liên hệ hỗ trợ: khách nhận xác nhận tiếp nhận; mỗi admin nhận nội dung yêu cầu.

Mỗi người nhận có một công việc gửi riêng trong `notification_outbox`. SMTP lỗi không làm mất đơn hoặc thư, công việc được thử lại; khởi động lại API tiếp tục hàng đợi. Trạng thái “đang chờ gửi” không có nghĩa đã gửi thành công. Sau khi thay `.env`, khởi động lại backend để nạp cấu hình mới.

Không bỏ qua xác minh chứng chỉ TLS. SMTP chấp nhận thư không bảo đảm thư sẽ vào Inbox thay vì Spam. Hàng đợi dùng Message-ID ổn định để giảm thư lặp khi thử lại; nếu tiến trình dừng đúng sau khi SMTP nhận thư nhưng trước khi ghi trạng thái thành công, giao thức SMTP không cung cấp bảo đảm gửi đúng một lần tuyệt đối.

## Dữ liệu và phát triển

Khởi động thường chỉ nạp catalog mẫu khi DB rỗng. Đồng bộ/xóa theo manifest phải được yêu cầu rõ với `force`; tránh ghi đè giá hay sản phẩm người dùng đã sửa khi khởi động lại.

Biên nhận HTML mã hóa các trường tên/địa chỉ/sản phẩm, không dựng HTML từ dữ liệu khách bằng JavaScript. Checkout lấy lại báo giá nếu giá thay đổi và chờ khách xác nhận tổng mới.

Luồng xử lý đổi/trả, hoàn tiền sau bán hàng và các chính sách phí cần được kiểm tra cùng bước đối soát của tác vụ triển khai; không coi việc sinh được QR là bằng chứng ngân hàng đã nhận tiền.
