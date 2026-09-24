# Store Admin
Ứng dụng quản trị riêng với React; backend Express/SQLite và AI local nằm trong dự án này. Không phụ thuộc đường dẫn sang Store.

## Chạy
Node 24.19.0, npm 11.17.0 như Store; không tự nâng runtime.
- Cài frontend: npm ci
- Cài backend: npm --prefix server ci
- Terminal 1: npm run dev:api (127.0.0.1:3001)
- Terminal 2: npm run dev (http://127.0.0.1:5174)
- Tạo tài khoản: npm --prefix server run create-admin -- ten_admin (nhập mật khẩu trong terminal tương tác); xem BACKEND.md.
- Kiểm tra: npm test, npm run lint, npm run build, npm run test:api.

## Ranh giới
- src/pages/Admin*: toàn bộ giao diện admin, không còn trong bundle Store.
- server/: backend, script, test, database local và dependency đã chuyển nguyên trạng.
- ai/: mã/config training; giữ nguyên quy tắc ignore model/dataset/checkpoint.
- shared/: hợp đồng dữ liệu mẫu độc lập để chạy backend. Store có bản dữ liệu mẫu riêng; đây chưa phải đồng bộ catalog live. Khi có CRUD production, backend/database phải là nguồn chuẩn.
- BACKEND.md: tài liệu backend trước khi tách, giữ nguyên cả ghi chú của người dùng.
- Các bảng nghiệp vụ hiện là demo; không giả vờ đã kết nối CRUD. Đăng nhập admin, chat và báo cáo giữ nguyên backend hiện có.
- Không commit server/data, .env, credential, model hoặc dữ liệu training nhạy cảm.
- Chưa khởi tạo remote/push dự án admin. Store sẽ ghi nhận file đã chuyển là deleted; commit cả hai repo chỉ khi chủ dự án kiểm tra và quyết định.

## Khách trên cloud, backend local
Store là frontend static. Ưu tiên reverse proxy HTTPS cùng origin: /api/support/* từ cloud tới backend local qua tunnel có kiểm soát. Chặn /api/admin/* ở cổng public; admin dùng mạng riêng. Không public cổng Ollama hoặc SQLite. Localhost trên trình duyệt khách là máy khách, không phải máy chủ của bạn.
Chưa mở tunnel, firewall, DNS hoặc deploy. Backend local phải bật thì tính năng gọi API mới hoạt động. Xem Store/DEPLOYMENT.md để chọn cấu hình cookie/CORS phù hợp.
