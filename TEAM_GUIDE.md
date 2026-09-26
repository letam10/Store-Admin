# Hướng Dẫn Dành Cho Thành Viên Nhóm (Team Setup Guide)

Tài liệu này hướng dẫn các thành viên trong nhóm thiết lập và kết nối vào dự án để cùng phát triển, sử dụng **chung 1 Cơ sở dữ liệu PostgreSQL (Neon Cloud)** theo thời gian thực.

---

## 1. Yêu Cầu Môi Trường
* **Node.js**: Phiên bản theo `.nvmrc` (`24.19.0` hoặc mới hơn)
* **npm**: Phiên bản `11.17.0` (hoặc mới hơn)
* **Git** đã cài đặt trên máy

---

## 2. Các Bước Thiết Lập Cho Thành Viên Mới (Từ A-Z)

### Bước 1: Kéo mã nguồn mới nhất về máy
```bash
git pull origin main
```

### Bước 2: Cài đặt dependencies (Frontend & Backend)
Tại thư mục gốc `Store-Admin`:
```bash
# Cài đặt thư viện frontend
npm ci

# Cài đặt thư viện backend
cd server && npm ci && cd ..
```

### Bước 3: Cấu hình kết nối Database Neon Cloud
1. Trong thư mục `Store-Admin/server/`, tạo file **`.env`** (nếu chưa có).
2. Dán cấu hình kết nối Database chung của nhóm vào:
```env
PORT=8787
DATABASE_URL=<DAN_DUONG_DAN_DATABASE_NEON_TRONG_FILE_ENV_LOCAL>
```

> ⚠️ **Lưu ý**: File `.env` chứa thông tin kết nối và đã được đưa vào `.gitignore` nên sẽ không bị push lên GitHub.

---

## 3. Khởi Chạy Dự Án

Mở 2 cửa sổ Terminal:

* **Terminal 1 - Khởi chạy Backend API**:
  ```bash
  npm run dev:api
  ```
  *(Backend sẽ chạy tại `http://127.0.0.1:8787` hoặc cổng cấu hình)*

* **Terminal 2 - Khởi chạy Frontend Quản Trị (Admin Portal)**:
  ```bash
  npm run dev
  ```
  *(Frontend sẽ chạy tại `http://127.0.0.1:5174`)*

---

## 4. Tạo Tài Khoản Admin Riêng Cho Từng Người
Mỗi thành viên có thể tự tạo tài khoản Admin riêng của mình trên Database chung bằng lệnh:
```bash
cd server
npm run create-admin -- <tên_đăng_nhập_của_bạn>
```
*(Hệ thống sẽ yêu cầu bạn nhập mật khẩu bí mật trong terminal)*.

---

## 5. Quy Định Khi Commit Mã Nguồn
* **100% Thông điệp Git Commit phải viết bằng Tiếng Việt** rõ ràng, dễ hiểu (Ví dụ: `thêm tính năng tìm kiếm`, `sửa lỗi hiển thị biểu đồ`).
* Cài đặt tên hiển thị Git trên máy của bạn:
  ```bash
  git config user.name "<tên_github_của_bạn>"
  git config user.email "<email_github_của_bạn>"
  ```

