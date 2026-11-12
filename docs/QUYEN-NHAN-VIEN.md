# Tài khoản nhân viên

Đăng nhập quản trị → **Nhân viên → Thêm nhân viên** để cấp tài khoản đăng nhập thực. Bảng hồ sơ nhân sự cũ vẫn được giữ bên dưới; hồ sơ cũ không tự trở thành tài khoản đăng nhập.

| Chức năng | Admin | Nhân viên |
|---|---|---|
| Sản phẩm, giá, giảm giá, tồn khả dụng | Thêm/sửa/xóa theo điều kiện | Thêm/sửa/xóa theo điều kiện |
| Phiếu xuất nhập kho | Quản lý | Xem/thêm/sửa/xóa |
| Thông tin khách hàng | Xem, sửa, đổi mật khẩu | Xem và xuất danh sách |
| Ticket CSKH, trả lời đánh giá | Quản lý | Xem, tạo/sửa ticket, trả lời đánh giá |
| Đơn hàng, giao nhận, biên nhận/PDF | Quản lý | Xem, xác nhận thu tiền, cập nhật giao nhận, xuất biên nhận |
| Yêu cầu sau mua | Quản lý | Duyệt/từ chối, nhận/nhập lại hàng, thu bù/hoàn tiền, giao và hoàn tất đổi hàng |
| Khoản chuyển không khớp / chuyển trùng | Đối soát và hoàn có chứng từ | Đối soát và hoàn có chứng từ |
| Excel dữ liệu vận hành | Có | Hàng hóa, khách, đơn hàng, kho, CSKH, đổi/trả, đánh giá |
| Báo cáo tài chính tổng, voucher, cấu hình, AI quản trị, nhân sự | Có | Không |

Quyền được kiểm tra ở API, không chỉ ẩn nút. Các API chưa nằm trong danh sách cho phép của nhân viên đều bị từ chối. Không thể sửa bản ghi của module khác bằng cách thay ID trong đường dẫn CSKH.

Quyền này áp dụng theo phạm vi người dùng chốt ngày 12/11/2026. Nhân viên không được sửa thông tin/mật khẩu khách, tài khoản nhân viên, cấu hình ngân hàng hoặc phân quyền. Xuất Excel lấy toàn bộ dữ liệu của mục được phép, không phải báo cáo tài chính tổng; không chứa mật khẩu, hash, salt hoặc token. Hóa đơn/biên nhận được mở từ chi tiết đơn để in/lưu PDF.

Thu/hoàn tiền luôn cần số tiền, thời điểm, mã chứng từ và xác nhận đã đối chiếu; quyền nhân viên không bỏ qua hạn QR, bảng phí, trạng thái hoặc chặn trùng. Chỉ nhập lại hàng trả khi đã kiểm tra đủ điều kiện bán. Sản phẩm đang liên quan đơn/đổi trả hoặc sản phẩm nổi bật được bảo vệ khỏi xóa. Phiếu kho là bản ghi nghiệp vụ; chỉnh lượng khả dụng trực tiếp ở Hàng hóa. Sửa giá/mô tả không ghi đè lượng hàng đang giữ cho checkout.

Admin có thể sửa tên đăng nhập, họ tên, email, mật khẩu hoặc khóa tài khoản nhân viên. Mật khẩu mới từ 8–128 ký tự. Để trống mật khẩu khi sửa nhân viên thì giữ mật khẩu hiện tại. Mỗi lần sửa tài khoản nhân viên sẽ thu hồi phiên cũ để nhân viên đăng nhập lại.

Trong **Khách hàng**, chọn hồ sơ để sửa thông tin hoặc đổi mật khẩu. Đổi mật khẩu sẽ thu hồi phiên đăng nhập, link đặt lại mật khẩu và thử thách đăng nhập 2FA cũ; không tắt cấu hình 2FA của khách.

Khi backend khởi động, schema bổ sung `role`, `display_name`, `email`, `active` vào `admins`. Tài khoản quản trị hiện có được giữ quyền `admin` và dữ liệu cũ. Mật khẩu chỉ lưu dạng băm; API không trả mật khẩu hay hash.
