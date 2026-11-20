# Hướng Dẫn Sử Dụng Chrome Extension: OmniCart Social Bridge (Manifest V3)

/*
  FILE NOTE
  - Mục đích: Hướng dẫn cài đặt và sử dụng Chrome Extension OmniCart Social Bridge tự động đăng bài có ảnh lên Facebook Hoàng Thái HT và TikTok @harutv666.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/src/pages/AdminSocialAutomation.jsx.
  - Vùng ảnh hưởng khi sửa: Tài liệu hướng dẫn sử dụng và kiểm thử thực tế cho người dùng và reviewer.
*/

# OmniCart Social Bridge v2.0 — OmniVision Engine (Manifest V3)

## 1. Điểm nâng cấp nổi bật ở v2.0.0
1. **Lõi thị giác 2 tầng (`vision-engine.js`)**:
   - **Tầng 1 — Mắt Hình Học & Ngữ Nghĩa (luôn bật, chạy ngầm 100%)**: Không còn phụ thuộc class CSS dễ hỏng. Nhận diện nút và ô nhập liệu dựa trên vị trí tương đối với nhãn hiển thị (ví dụ tìm nhãn *"Người có thể nhìn thấy bài đăng này"* rồi chọn dropdown ngay bên dưới; phân biệt chính xác ô Tiêu đề `0/90` và Mô tả `0/4000`; loại trừ tuyệt đối ảnh avatar và thanh header).
   - **Tầng 2 — Mắt AI Đa Phương Thức (Set-of-Mark Vision AI)**: Hỗ trợ **Ollama Local** (`qwen2.5vl:7b` / `llama3.2-vision`), **Google Gemini** (`gemini-2.5-flash`) hoặc **OpenAI / LM Studio** để tự xử lý khi Facebook/TikTok thay đổi giao diện đột xuất.
2. **Sửa triệt để luồng đăng Facebook Hoàng Thái HT (`100037782653708`)**:
   - Định vị chuẩn khung *"Bạn đang nghĩ gì?"* trong cột chính (kèm phương án dự phòng *"Ảnh/video"*).
   - Nhập liệu đa chiến lược tương thích **Lexical Editor** cả trong tab nền.
   - Đổi & xác nhận đầy đủ quyền riêng tư (**Công khai** / **Chỉ mình tôi**), kể cả bấm *"Xem thêm"* và bấm *"Xong/Lưu"*.
3. **Sửa triệt để luồng đăng TikTok Studio Photo Mode (`@harutv666`)**:
   - Tự chuyển từ tab **Video** sang tab **Ảnh**; tự dọn bản nháp cũ nếu còn sót.
   - Đợi màn hình thực sự chuyển sang biểu mẫu **Chi tiết** có **Ảnh bìa** (không nhận nhầm avatar góc trên phải).
   - Điền đủ cả **Tiêu đề (0/90)** lẫn **Mô tả & Hashtag (0/4000)** và tự kiểm chứng bộ đếm ký tự.
   - Tự cuộn chọn đúng **Người có thể nhìn thấy bài đăng này**, bấm nút **Đăng** chính xác và xử lý popup *"Tiếp tục đăng?"*.
4. **Cầu nối Store-Admin thời gian thực**:
   - Dùng **Persistent Port** chống ngủ Service Worker giữa chừng và tự bơm lại cầu nối khi reload extension.
   - Hiển thị **OmniVision Live Dock** gọn nhẹ ở góc phải dưới trang `http://localhost:5174` để theo dõi từng bước đăng bài theo thời gian thực.

---

## 2. Cài đặt / Cập nhật nhanh trong 1 phút
Vào `chrome://extensions/` → Bấm biểu tượng **Tải lại (Reload ↻)** ở tiện ích **OmniCart Social Auto-Poster & OmniVision Bridge**.
Quay lại tab `http://localhost:5174` — cầu nối sẽ tự kết nối lại và hiện huy hiệu xanh **👁️ OmniVision v2.0.0 • Kết nối tốt** ở góc phải dưới màn hình.

---

## 3. Kiểm thử nhanh trước khi bấm Đăng thật
1. Mở sẵn 2 tab (hoặc để extension tự mở):
   - Facebook: `https://www.facebook.com/profile.php?id=100037782653708` (đã đăng nhập **Hoàng Thái HT**).
   - TikTok Studio: `https://www.tiktok.com/tiktokstudio/upload` (đã đăng nhập **@harutv666**).
2. Bấm vào icon Extension trên thanh công cụ Chrome → Bấm thử **👁️ Soi Tab FB** và **👁️ Soi Tab TikTok** để xác nhận "mắt" của extension đã nhìn thấy đúng từng nút và ô nhập liệu.
3. *(Tùy chọn)* Chuyển sang tab **🧠 Cấu hình Mắt AI** trong Popup:
   - Nếu máy đã cài Ollama Local: chạy `ollama pull qwen2.5vl:7b` rồi bấm **🧪 Kiểm tra mắt AI**.
   - Hoặc chọn **Google Gemini** (`gemini-2.5-flash`) và dán API key nếu muốn dùng Vision AI chụp màn hình thật khi gặp lỗi.
   - Nếu không bật Vision AI, chế độ **OmniVision Hình học** vẫn hoạt động độc lập 100%.
```

---

### 4. Lưu ý nhỏ để kiểm thử trơn tru ngay lần đầu
1. **Nhớ thêm file mới `vision-engine.js`** vào đúng thư mục `Store-Admin/extension/` trước khi bấm **Reload** trong `chrome://extensions/`.
2. **Nếu trước đó bạn đã chạy thử TikTok và bị kẹt lại ở màn hình Ảnh 3**, bản v2.0 đã có sẵn cơ chế tự phát hiện bản nháp cũ đang mở và tự bấm **Hủy bỏ** để làm mới trước khi đăng bài tiếp theo.
3. **Quan sát trực tiếp qua góc phải dưới trang Store-Admin**: Khi bấm **Đăng Thật FB** hoặc **Đăng Thật TikTok**, khung **👁️ OmniVision Live Telemetry** sẽ tự mở ra ghi lại rõ từng bước (nạp ảnh, xác nhận ảnh bìa, điền tiêu đề, điền mô tả, kiểm tra quyền riêng tư, bấm đăng, kiểm chứng kết quả) — nếu sau này Facebook hay TikTok có đổi giao diện nào bất ngờ, bạn chỉ cần gửi lại dòng log đó hoặc bật thêm **Ollama / Gemini Vision** trong Popup là xử lý ngay được.