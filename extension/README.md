# Hướng Dẫn Sử Dụng Chrome Extension: OmniCart Social Bridge (Manifest V3)

/*
  FILE NOTE
  - Mục đích: Hướng dẫn cài đặt và sử dụng Chrome Extension OmniCart Social Bridge tự động hóa đăng bài thật lên Facebook John Harper và TikTok @harutv666 không chiếm quyền điều khiển chuột bàn phím.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/src/pages/AdminSocialAutomation.jsx.
  - Vùng ảnh hưởng khi sửa: Tài liệu hướng dẫn sử dụng và kiểm thử thực tế cho người dùng và reviewer.
*/

## 1. Giới thiệu tổng quan
**OmniCart Social Bridge** là tiện ích mở rộng trình duyệt (Chrome Extension Manifest V3) được thiết kế đặc biệt để giải quyết triệt để 2 bài toán lớn trong tự động hóa tiếp thị mạng xã hội:
1. **Tránh vi phạm bảo mật từ Meta & TikTok**: Không gọi ngầm API token không chính thức (Graph API / TikTok API) gây checkpoint, khóa nick hoặc yêu cầu duyệt doanh nghiệp phức tạp. Tiện ích thao tác trực tiếp trên phiên đăng nhập cookie có sẵn của chính chủ trên trình duyệt.
2. **Không chiếm quyền điều khiển máy tính**: Hoàn toàn **không dùng thư viện di chuyển chuột máy tính vật lý (PyAutoGUI/RobotJS)**. Tiện ích chỉ điều phối đúng **2 hoặc 3 tab cần thiết** trong trình duyệt bằng DOM Events và Chrome Scripting API ngầm trong tab. Bạn vẫn có thể dùng chuột, gõ bàn phím và làm việc ở các phần mềm khác bình thường trong khi hệ thống đăng bài.

---

## 2. Thông tin tài khoản đích
- **Facebook cá nhân**: [John Harper (ID: 61580644871703)](https://www.facebook.com/profile.php?id=61580644871703)
- **TikTok cá nhân**: [@harutv666 (Tên: harutv)](https://www.tiktok.com/@harutv666)

---

## 3. Các bước cài đặt Extension vào Chrome / Edge trong 1 phút
1. Mở trình duyệt Chrome hoặc Microsoft Edge.
2. Truy cập vào đường dẫn: `chrome://extensions/` (hoặc `edge://extensions/`).
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải màn hình.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục tiện ích:
   ```text
   D:\Học Tập\Website_React\Store-Admin\extension
   ```
6. Tiện ích **OmniCart Social Auto-Poster & Inspiration Bridge** sẽ xuất hiện trên thanh công cụ với biểu tượng robot. Bấm ghim (Pin) để tiện theo dõi.

---

## 4. Cơ chế điều khiển 3 Tab thông minh
Hệ thống kết nối và kiểm soát duy nhất 3 tab trình duyệt:
- **Tab 1: Trang quản trị Store-Admin** (`http://localhost:5174/admin`)
  - Chạy giao diện quản trị tiếp thị, bộ lập lịch chu kỳ (30 giây, 30 phút, 1 giờ...).
  - Kết nối hai chiều với Extension qua `content-admin-bridge.js`.
- **Tab 2: Facebook cá nhân John Harper** (`https://www.facebook.com/profile.php?id=61580644871703`)
  - Tự động mở hộp thoại soạn thảo ("Bạn đang nghĩ gì, John?").
  - Điền tiêu đề, nội dung, mã sản phẩm và hashtags.
  - Tự động chọn quyền riêng tư: **Chỉ mình tôi (only_me)** hoặc **Công khai (public)** theo cấu hình quản trị.
  - Nhấp nút Đăng bài an toàn và trích xuất đường dẫn bài viết thật về Store-Admin.
- **Tab 3: TikTok Creator Studio / Upload** (`https://www.tiktok.com/creator-center/upload`)
  - Tự động nạp caption, kịch bản video và hashtags cho tài khoản `@harutv666`.

---

## 5. Hướng dẫn kiểm thử thực tế (Testing)
1. **Kiểm tra kết nối**:
   - Mở tab Quản trị `http://localhost:5174/admin` -> chọn mục **Local AI & MXH** -> **Tự động đăng bài Mạng Xã Hội**.
   - Tại banner trên cùng, bạn sẽ thấy huy hiệu xanh: `🟢 Tiện ích trình duyệt (Chrome Extension) Đã kết nối sẵn sàng`.
2. **Thử nghiệm Đăng bài thật không chiếm chuột**:
   - Bấm nút **🚀 Kích hoạt Đăng Thật qua Browser Tab** hoặc vào tab **AI Copywriting Studio** -> chọn sản phẩm -> bấm **Đăng Ngay Lên Mạng Xã Hội**.
   - Extension sẽ tự động kích hoạt tab Facebook John Harper, điền nội dung và đăng bài thật.
   - Bạn thử rê chuột hoặc gõ phím ở màn hình khác: chuột và bàn phím máy tính hoàn toàn tự do!
   - Sau khi hoàn thành, hệ thống ghi nhận link bài viết thật vào tab **Nhật Ký Đăng Bài**. Bấm vào link sẽ dẫn thẳng tới bài viết vừa đăng trên Facebook John Harper.
3. **Thử nghiệm Quét bài Viral thật**:
   - Chuyển sang tab **Hội Nhóm & Viral**.
   - Bấm nút **🔥 Cào dữ liệu bài Viral thật từ Facebook & TikTok**.
   - Extension sẽ quét trực tiếp bảng tin Facebook và mục xu hướng TikTok, lưu các bài viết có tương tác thật vào cơ sở dữ liệu để làm kho cảm hứng viết bài.
