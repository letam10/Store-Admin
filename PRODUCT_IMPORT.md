# Danh mục 2.000 sản phẩm demo

- Nguồn dữ liệu mẫu: [Mock E-Commerce API](https://store.halukaksoy.dev/api/products), danh mục cố định có phân trang. Tên, ảnh và giá USD đầu vào được lấy qua API; dữ liệu này chỉ phục vụ dựng giao diện.
- Ảnh gốc: [Amazon Berkeley Objects](https://amazon-berkeley-objects.s3.amazonaws.com/index.html), giấy phép [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Store đã chọn lọc và tải bản ảnh nhỏ vào hai thư mục `public/products/imported/`; cần giữ ghi nhận nguồn khi hiển thị.
- Trang chi tiết có ảnh phụ thực từ cùng bộ dữ liệu cho các mục đã được enrichment trước đó; 1.000 mục nhập mới có ảnh chính từ nguồn và không giả ảnh phụ. Ảnh phụ nằm trong `Store/public/products/gallery/`, thông số và mô tả có trong bản tĩnh. Không dùng ảnh lặp để giả nhiều góc.
- Giá API là xu USD. Giá VND hiển thị được quy đổi theo **tỷ lệ minh họa cố định 25.000 ₫/USD**, làm tròn đến 1.000 ₫. Đây không phải báo giá hoặc tồn kho thực.
- Dữ liệu được lưu trong bảng `catalog_products` của PostgreSQL/PGlite theo cấu hình runtime. Bản xuất tĩnh cho Store nằm ở `../Store/src/data/imported-products.json`; snapshot có 1.996 mục nhập và 4 mục demo dùng chung, tổng API là 2.000 sản phẩm.
- Lệnh `npm run import:more-products` bổ sung đúng 1.000 mục mới từ API dữ liệu Amazon Berkeley Objects: 392 Điện tử, 300 Trang phục, 200 Trang sức (gộp phụ kiện), 8 Laptop và 100 Làm đẹp. Script lọc UUID/tên trùng, kiểm tra ảnh, đặt tồn kho mặc định 20 và dừng nếu không đủ số lượng.
- Các mục mới ghi nguồn `Amazon Berkeley Objects (CC BY 4.0)`, URL nguồn, loại sản phẩm, giá USD gốc và giá VND minh họa. Ảnh được tải bản nhỏ vào cả `Store/public/products/imported/` và `Store-Admin/server/public/products/imported/`.
- Chạy lại từ `Store-Admin/server`: `npm run import:demo-products`. Lệnh cập nhật các mục demo cùng mã; sau đó build và phát hành lại Store để cập nhật bản tĩnh. Không có tác vụ cập nhật giá theo thời gian thực.
- Lệnh cũ `npm run import:extra-products` chỉ dùng cho snapshot lịch sử 200 mục và không được chạy trên snapshot hiện tại. Với 1.000 mục mới, dùng `npm run import:more-products` đúng một lần trên branch đã kiểm tra.
- Nhóm `Thực phẩm` cũ đã được đổi nhãn thành `Tự Thiết Kế` và giữ toàn bộ 35 sản phẩm cũ; bốn sản phẩm demo nền cũng được xếp vào nhóm này. Bốn bản ghi `custom-design-*` thử nghiệm đã được loại khỏi snapshot để tổng dữ liệu còn 2.000 sản phẩm.
- Trong Admin → Hàng hóa, quản trị viên có thể đặt giảm giá 0–90% và tồn kho demo cho từng sản phẩm nhập. Để trống tồn kho nghĩa là chưa rõ, 0 nghĩa là hết hàng. Thay đổi lưu ngay trong SQLite và Store lấy qua `GET /api/storefront/catalog` khi mở trang, khi quay lại tab và mỗi 30 giây; không cần build lại Store cho riêng thay đổi ưu đãi/tồn kho.
- Mỗi lượt mở trang chi tiết ghi một lượt xem qua `POST /api/storefront/products/:id/view`; trang chủ xếp sản phẩm nổi bật theo số lượt xem. Đây là số liệu demo, không phải analytics chống gian lận. Tám sản phẩm nhập đầu tiên được khởi tạo giảm 15% để thử giao diện; admin có thể chỉnh về 0.

Các sản phẩm này chưa có quyền bán, kho hay thanh toán thật. Giỏ hàng và checkout trên Store vẫn là mô phỏng.
