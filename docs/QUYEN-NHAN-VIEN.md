# Tài khoản nhân viên

Đăng nhập quản trị → **Nhân viên → Thêm nhân viên** để cấp tài khoản đăng nhập thực. Bảng hồ sơ nhân sự cũ vẫn được giữ bên dưới; hồ sơ cũ không tự trở thành tài khoản đăng nhập.

| Chức năng | Admin | Nhân viên |
|---|---|---|
| Sản phẩm, giá, tồn kho | Xem và sửa | Xem |
| Thông tin khách hàng | Xem, sửa, đổi mật khẩu | Xem |
| Ticket CSKH, trả lời đánh giá | Quản lý | Xem, tạo/sửa ticket, trả lời đánh giá |
| Yêu cầu sau mua | Quản lý | Xem, duyệt trả hàng, từ chối kèm lý do |
| Xác nhận thu phí, hoàn tiền | Có | Không |
| Doanh thu, voucher, cấu hình, AI quản trị, nhân sự | Có | Không |

Quyền được kiểm tra ở API, không chỉ ẩn nút. Các API chưa nằm trong danh sách cho phép của nhân viên đều bị từ chối. Không thể sửa bản ghi của module khác bằng cách thay ID trong đường dẫn CSKH.

Admin có thể sửa tên đăng nhập, họ tên, email, mật khẩu hoặc khóa tài khoản nhân viên. Mật khẩu mới từ 8–128 ký tự. Để trống mật khẩu khi sửa nhân viên thì giữ mật khẩu hiện tại. Mỗi lần sửa tài khoản nhân viên sẽ thu hồi phiên cũ để nhân viên đăng nhập lại.

Trong **Khách hàng**, chọn hồ sơ để sửa thông tin hoặc đổi mật khẩu. Đổi mật khẩu sẽ thu hồi phiên đăng nhập, link đặt lại mật khẩu và thử thách đăng nhập 2FA cũ; không tắt cấu hình 2FA của khách.

Khi backend khởi động, schema bổ sung `role`, `display_name`, `email`, `active` vào `admins`. Tài khoản quản trị hiện có được giữ quyền `admin` và dữ liệu cũ. Mật khẩu chỉ lưu dạng băm; API không trả mật khẩu hay hash.
