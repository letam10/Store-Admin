# Quy Chuẩn Dành Cho AI Agent (Antigravity, Codex, Claude, Cursor, Copilot, ...)

Tài liệu này là quy tắc bắt buộc áp dụng cho mọi AI coding agent khi làm việc trong dự án này.

---

## 1. Quy Định Bắt Buộc Về Git Commit & Push
* **Bao gồm đầy đủ tất cả tệp đã chỉnh sửa & sửa lỗi**:
  * Khi thực hiện commit, phải stage và gom toàn bộ tất cả các file đã chỉnh sửa, tạo mới hoặc sửa lỗi (`git add -A` hoặc các tệp liên quan), tuyệt đối không để sót file chưa commit.
* **100% Thông điệp Git Commit (Commit Message) phải viết bằng Tiếng Việt**:
  * Tuyệt đối **KHÔNG** sử dụng tiếng Anh cho commit message (trừ tên biến, tên hàm, tên bảng đặc thù).
  * Commit message phải rõ ràng, ngắn gọn, mô tả đúng bản chất công việc vừa làm.
* **Cấu trúc gợi ý**:
  * Thêm tính năng: `thêm tính năng <mô tả>` (Ví dụ: `thêm bộ lọc tìm kiếm sản phẩm theo giá`)
  * Sửa lỗi: `sửa lỗi <mô tả>` (Ví dụ: `sửa lỗi hiển thị biểu đồ doanh thu`)
  * Tối ưu/Cải tiến: `tối ưu <mô tả>` (Ví dụ: `tối ưu tốc độ truy vấn cơ sở dữ liệu`)
  * Cập nhật giao diện: `cập nhật giao diện <mô tả>` (Ví dụ: `cập nhật giao diện trang quản trị đơn hàng`)
  * Cấu hình/Hạ tầng: `cấu hình <mô tả>` (Ví dụ: `cấu hình kết nối cơ sở dữ liệu postgresql`)

---

## 2. Quy Định Về Giao Tiếp & Giải Thích
* Khi tương tác, trả lời hoặc tổng hợp kết quả cho người dùng, AI Agent phải sử dụng **Tiếng Việt** tự nhiên, dễ hiểu, tránh dùng thuật ngữ tiếng Anh không cần thiết.
