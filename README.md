# Store Admin — React và backend C#

Dự án nằm tại `D:\Học Tập\Website_React\Store-Admin`. Đây là một repo Git riêng với Store; cả hai giữ nguyên vị trí.

Backend chính hiện tại là **ASP.NET Core net8.0 + SQL Server**, mã trong `server-dotnet/`, cổng **5000**. Bản Node/PGlite ở `C:\Users\TAM\source\repos\Store-Admin` và các ghi chú Node trong `BACKEND.md` thuộc lịch sử trước đó.

## Chạy local

Frontend dùng Node 24.19.0/npm 11.17.0 theo các file runtime của dự án. Dùng `npm ci` khi máy chưa có dependency.

```powershell
# Terminal 1, tại Store-Admin: API 5000
npm run dev:api

# Terminal 2, tại Store-Admin: giao diện quản trị 5174
npm run dev

# Terminal 3, tại ../Store: giao diện khách 5173
npm run dev
```

Vite hai frontend proxy `/api` đến `http://127.0.0.1:5000`, có thể ghi đè bằng `VITE_API_TARGET`.

Backend cần SQL Server hoặc LocalDB đang chạy và connection string đúng. Cấu hình riêng Google/SMTP được nạp từ `server-dotnet/.env` (Git bỏ qua); máy mới sao chép `.env.example` và điền giá trị riêng. Không ghi khóa vào `appsettings.json`. Xem `server-dotnet/README.md` trước khi cài máy mới. Không chạy lại script setup/seed/import trên dữ liệu đang dùng chỉ để thử giao diện. API có bước chuẩn bị dữ liệu khi khởi động.

Health: `http://127.0.0.1:5000/api/health`; kiểm tra DB: `/api/health/db`; Swagger: `/swagger`. AI local cần Ollama riêng, cấu hình và prompt nằm trong backend C#.

Mở `../Store-Development.code-workspace` để quản lý Store/Admin và handoff trong một cửa sổ VS Code.

## Vị trí chức năng

| Thư mục | Trách nhiệm |
| --- | --- |
| `src/api/` | Client HTTP/chat quản trị, điều phối request |
| `src/assets/` | Asset import qua bundler |
| `src/components/ui/` | Thành phần dùng chung |
| `src/pages/Admin.jsx` | Session, sidebar, dashboard và điều phối module |
| `src/pages/AdminModules.jsx` | Hàng hóa, thống kê và các module vận hành |
| `src/pages/AdminCommerce.jsx`, `AdminOrderWorkflow.jsx` | Khách hàng, voucher, đơn, thanh toán và hậu mãi |
| `src/pages/ThemeEditor.jsx` | Chỉnh giao diện/theme |
| `src/data/adminModuleData.js` | Metadata menu quản trị |
| `src/services/` | Helper state, tìm kiếm và phục hồi hội thoại |
| `shared/` | Theme/chính sách nền và manifest catalog |
| `public/` | Ảnh và asset public của Admin |
| `server-dotnet/Controllers/` | API khách hàng, admin, storefront, health, hỗ trợ |
| `server-dotnet/Data/` | SQL Server, catalog, session, đơn, voucher và menu console |
| `server-dotnet/Models/` | Hợp đồng dữ liệu C# |
| `server-dotnet/Services/` | AI local, email và email đơn hàng |
| `server-dotnet/Security/` | Token và TOTP/2FA |
| `server-dotnet/scripts/` | Setup/schema/seed và kiểm tra manifest |
| `test/` | Kiểm thử frontend |
| `ai/`, `work/`, `BACKEND.md` | Cấu hình/ghi chép lịch sử; đối chiếu trước khi dùng lệnh cũ |

Không tách `server-dotnet` ra repo khác trong đợt tổ chức này. Thư mục `services` ở frontend chứa logic phía trình duyệt, khác `server-dotnet/Services` chứa logic server.

## Catalog và công việc đang dở

Manifest có **500 ID** dùng chung với Store. Các thay đổi chưa commit trước ngày rà soát gồm phân trang 40 sản phẩm/lần, tải thêm khi cuộn, bố cục cuộn và đồng bộ seed 500 sản phẩm. Đã giữ nguyên các thay đổi đó khi sắp xếp.

Không dùng các lệnh `npm --prefix server ...` trong tài liệu Node cũ cho backend hiện hành; repo hiện không có package backend Node tại vị trí đó. `npm run test:api` cũng không được định nghĩa trong package hiện tại.

## Kiểm tra

```powershell
npm run lint
npm run build
node --test --test-concurrency=1 test/*.test.js
npm run build:api
node server-dotnet/scripts/validate-catalog-manifest.mjs
```

Build C# không khởi động API hoặc chứng minh kết nối DB thành công. Kiểm thử nghiệp vụ thật cần dữ liệu thử phù hợp và phải phân biệt với database đang dùng.

## Git và bàn giao

Không commit credential, database, dependency hoặc model. Tài liệu giao việc và tình trạng trước/sau nằm tại `D:\Học Tập\RaSoat_React_20261107\handoff\HANDOFF.md`. Chỉ stage/commit/push theo yêu cầu của chủ dự án; không tự deploy.
