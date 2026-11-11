# Báo cáo và voucher

## Báo cáo

Mở **Thống kê**, chọn ngày bắt đầu/kết thúc. Các nút xuất chỉ bật khi màn hình đã tải xong đúng khoảng ngày này.

- **Xuất Excel** tải tệp `.xlsx` với hai sheet: Tổng hợp và Theo ngày. Số tiền là ô số để có thể tính tiếp trong Excel.
- **In / lưu PDF** mở bản in có bảng tổng hợp, bảng theo ngày, đơn vị VND và cách tính. Chọn Lưu dưới dạng PDF trong hộp thoại in của trình duyệt.
- Doanh thu gộp tính từ đơn `paid`, `completed`, `delivered`, `refunded`. Doanh thu ròng = doanh thu gộp − khoản hoàn tiền đã ghi nhận cho các đơn thuộc kỳ.
- Ngày thanh toán được quy đổi về Việt Nam (UTC+7). Dữ liệu cũ chỉ có ngày tạo dùng ngày tạo; bản ghi không đọc được ngày được báo riêng.
- Không cộng các bản ghi trong bảng cũ đã đánh dấu `is_demo`, không cộng hai lần một ID đã có ở bảng đơn khách hàng. Không thể tự suy ra một đơn lịch sử có phải giao dịch mô phỏng nếu dữ liệu cũ không lưu dấu này.
- Dữ liệu hoàn tiền của đơn khách lấy từ `customer_orders.refund_amount`. Việc đối soát và ghi nhận hoàn tiền thuộc luồng xử lý sau mua, không suy ra số tiền đã hoàn từ báo giá phí hoặc chỉ từ một ghi chú.

## Voucher

Trong **Voucher**, chọn Mọi khách có mã để cấp mã công khai. Mã mới gồm đúng 8 ký tự A–Z/0–9; có thể nhập mã muốn dùng hoặc để trống để hệ thống tạo. Mã trùng bị từ chối. Voucher cá nhân từ vòng quay trước đây vẫn dùng được.

Mỗi đơn áp dụng tối đa một voucher hàng hóa và một voucher vận chuyển. API chặn gửi lặp mã hoặc ghép hai mã cùng loại. Ở checkout, nhập mã sẽ kiểm tra quyền sở hữu và hạn trước khi chọn; mã mới cùng loại thay mã đã chọn. Mã sai không được đưa vào đơn và vẫn nằm trong ô để sửa.

Mã công khai tiếp tục dùng được cho nhiều khách; mã cá nhân chỉ dùng cho người được cấp. Hạn chỉ nhập ngày được hiểu là hết ngày tại Việt Nam. Đọc danh sách voucher không tự xóa dữ liệu hết hạn.
