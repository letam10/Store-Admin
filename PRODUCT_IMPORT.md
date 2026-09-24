# Danh mục 500 sản phẩm demo

- Nguồn dữ liệu mẫu: [Mock E-Commerce API](https://store.halukaksoy.dev/api/products), danh mục cố định có phân trang. Tên, ảnh và giá USD đầu vào được lấy qua API; dữ liệu này chỉ phục vụ dựng giao diện.
- Ảnh gốc: [Amazon Berkeley Objects](https://amazon-berkeley-objects.s3.amazonaws.com/index.html), giấy phép [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Store đã chọn lọc và tải bản ảnh nhỏ vào hai thư mục `public/products/imported/`; cần giữ ghi nhận nguồn khi hiển thị.
- Giá API là xu USD. Giá VND hiển thị được quy đổi theo **tỷ lệ minh họa cố định 25.000 ₫/USD**, làm tròn đến 1.000 ₫. Đây không phải báo giá hoặc tồn kho thực.
- Dữ liệu được lưu trong bảng `catalog_products` của SQLite theo `DB_PATH` (mặc định `server/data/store.sqlite`). Bản xuất tĩnh cho Store nằm ở `../Store/src/data/imported-products.json`; trang Store hiện hiển thị 500 mục nhập và 4 mục demo có sẵn.
- Ngày 24/09/2026 bổ sung 300 mục: 65 điện tử (ưu tiên máy tính, laptop và linh kiện), 150 sản phẩm nhóm Home và 85 đồ gia dụng chọn từ nhóm Lifestyle. Mã nguồn và ảnh được kiểm tra riêng; không ghi đè 200 mục trước đó.
- Chạy lại từ `Store-Admin/server`: `npm run import:demo-products`. Lệnh cập nhật các mục demo cùng mã; sau đó build và phát hành lại Store để cập nhật bản tĩnh. Không có tác vụ cập nhật giá theo thời gian thực.
- Lệnh bổ sung `npm run import:extra-products` chỉ dùng khi bản tĩnh vẫn có đúng 200 mục. Sau khi bổ sung, không chạy lại lệnh này; kết quả 300 mục đã được cố định trong repository.
- Trong Admin → Hàng hóa, quản trị viên có thể đặt giảm giá 0–90% và tồn kho demo cho từng sản phẩm nhập. Để trống tồn kho nghĩa là chưa rõ, 0 nghĩa là hết hàng. Thay đổi lưu ngay trong SQLite và Store lấy qua `GET /api/storefront/catalog` khi mở trang, khi quay lại tab và mỗi 30 giây; không cần build lại Store cho riêng thay đổi ưu đãi/tồn kho.
- Mỗi lượt mở trang chi tiết ghi một lượt xem qua `POST /api/storefront/products/:id/view`; trang chủ xếp sản phẩm nổi bật theo số lượt xem. Đây là số liệu demo, không phải analytics chống gian lận. Tám sản phẩm nhập đầu tiên được khởi tạo giảm 15% để thử giao diện; admin có thể chỉnh về 0.

Các sản phẩm này chưa có quyền bán, kho hay thanh toán thật. Giỏ hàng và checkout trên Store vẫn là mô phỏng.
