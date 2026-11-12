# Đổi / trả hàng và đối soát

## Khách hàng

Mở **Tài khoản → Đơn hàng → Chi tiết / thanh toán**. Các dịch vụ áp dụng cho đơn đã được xác nhận thanh toán bằng chuyển khoản, tại quầy hoặc khi giao.

- Hủy trước khi giao: phí 1% tiền hàng, tối thiểu 1.000đ, không vượt tiền đã thanh toán. Phí chỉ khấu trừ trong tiền hoàn, không yêu cầu khách đóng thêm lần nữa.
- Trả / đổi: gửi yêu cầu trong 7 ngày tính từ ngày nhận hàng được ghi nhận. Khách xem bảng phí trước khi đồng ý gửi yêu cầu.
- Trả hàng thông thường: hoàn giá trị tiền hàng hiện có, không hoàn phí giao ban đầu. Cước khách gửi trả do đơn vị vận chuyển thu theo thực tế.
- Đổi hàng: chọn một hoặc nhiều sản phẩm thay thế cho toàn bộ hàng của đơn. Khoản chênh lệch = giá hàng thay thế + phí giao lại − giá trị hàng cũ đã thanh toán. Giá trị dương cần bù; giá trị âm được hoàn. Nhận tại quầy không có phí giao lại. Cước giao lại giữ mức cước của đơn hiện tại; không phát sinh mức phí xử lý mới.
- Lỗi cửa hàng: miễn phí, hoàn số tiền cửa hàng còn giữ của đơn sau khi nhận hàng trả.
- Đổi lịch: lịch mới phải ở tương lai, tối đa 3 ngày sau lịch cũ, trước khi giao hàng.

Backend hiện không cộng một khoản thuế riêng vào các phép tính này; thay đổi chỉ sửa cách ghi nhận, không tự thêm thuế suất. Một đơn chỉ có một yêu cầu đang mở. Sau đổi thành công, lần đổi/trả tiếp theo dựa trên hàng thay thế và ngày nhận hàng mới, còn hóa đơn gốc được giữ nguyên.

## Quản trị và nhân viên

Trong **Đổi / trả hàng**, mỗi bước có nút và điều kiện riêng:

1. Khách đồng ý bảng phí → cửa hàng duyệt. Hàng thay thế được giữ tồn kho khi duyệt; nếu không còn đủ hàng, yêu cầu chưa được duyệt.
2. Cửa hàng nhận và kiểm tra hàng trả. Admin và nhân viên được xác nhận đã nhận hàng và chọn nhập lại tồn kho khi hàng đủ điều kiện bán.
3. Quản trị viên xác nhận khoản bù hoặc hoàn tiền bằng số tiền, thời gian, mã giao dịch/phiếu thu hoàn và xác nhận đã đối chiếu thực tế. Việc nhận hàng không tự xác nhận tiền.
4. Giao hàng đổi: nhập mã vận đơn nếu giao tận nơi, sau đó xác nhận khách nhận đủ hàng. Nhận tại quầy được xác nhận bàn giao trực tiếp.

Theo quyền người dùng chốt 12/11/2026, nhân viên được duyệt/từ chối, nhận/nhập lại hàng, xác nhận thu bù/hoàn tiền và giao/hoàn tất đổi hàng, kể cả yêu cầu hủy có phí. API kiểm tra quyền như giao diện. Khi yêu cầu đã được gửi xử lý, đơn không được đồng thời chuyển sang bước giao hàng thông thường.

## QR khoản bù

Hạn QR 2 phút được lưu trên server; tải lại không tự gia hạn. Nếu chưa chuyển tiền và QR hết hạn, khách có thể chủ động mở phiên mới. Mọi hạn cũ được giữ để giao dịch thực nhận trong hạn cũ vẫn đối soát được. Khách đã báo chuyển tiền không được tự mở phiên mới.

Nút **Tôi đã chuyển khoản** chỉ ghi nhận thông báo. Khoản bù chỉ được cộng vào đơn khi admin hoặc nhân viên xác nhận chứng từ. Giao dịch khoản bù vào ngoài các hạn QR cần người phụ trách chọn rõ chấp nhận xử lý ngoài hạn và ghi lý do; không có xác nhận ngân hàng tự động.

## Dữ liệu và kiểm tra

- Trạng thái, giữ/trả kho, sổ thu/hoàn và thưởng cập nhật trong giao dịch SQL có khóa chung với checkout. Gửi lại cùng hành động không thu/hoàn/trừ kho lần hai.
- Mã giao dịch thu tiền không được dùng cho hai đơn/yêu cầu; mã hoàn tiền không được dùng lại.
- Báo cáo tính tiền gốc + khoản bù đã thu − khoản hoàn đã xác nhận. Biên nhận hiển thị riêng ba khoản này.
- Không xóa sản phẩm còn dùng cho đơn đang giao, thời hạn đổi/trả hoặc một yêu cầu đang mở; tránh làm hỏng việc trả lại tồn kho.
- Bản ghi cũ thiếu ngày nhận hàng hoặc phiên bản bảng phí cần kiểm tra riêng, không tự suy ra ngày hoặc xác nhận tài chính.

Kiểm chứng cục bộ: 173 kiểm tra HTTP chính + 5 yêu cầu hoàn đồng thời; 51 ca QR/chứng từ/báo cáo; 25 ca giữ kho + 2 lượt duyệt tranh một sản phẩm. Đã thao tác web khách/admin/staff với đổi bù tại quầy, trả lại hàng thay thế, QR phí hết hạn/mở mới/báo chuyển/chờ admin. Test chạy trên `StoreCheckoutQA20261111`, SMTP giả; không chuyển tiền thật. Chứng cứ và script nằm ngoài repo trong thư mục tác vụ `Store_Development_20261111/phase-04`.

Quyền nhân viên đã mở rộng sau kiểm chứng đợt4; các bằng chứng cũ về việc ẩn thao tác tài chính là lịch sử. Kiểm chứng quyền hiện tại được lưu trong đợt7.
