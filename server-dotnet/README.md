# Store API bằng C# (cổng 5000)

Backend ASP.NET Core là backend chính để chạy và nghiệm thu Store cùng Store-Admin trên cổng 5000. Backend Node cũ chỉ được giữ để rollback, không phải nguồn catalog hoặc nguồn kiểm thử chính.

## Máy mới pull về chạy thế nào? (nhóm 3 người)

Chỉ cần **SQL Server đang Running**, còn lại API tự lo:

```powershell
# 1. Cài: .NET 8 SDK + SQL Server Express (kèm sqlcmd) + Node 24 nếu chạy frontend
# 2. Kiểm tra SQL Server:
Get-Service MSSQL*   # phải là Running, nếu Stopped thì: Start-Service MSSQLSERVER

# 3. Lần đầu (1-click dựng DB + tables + seed):
powershell ./scripts/setup-db.ps1
# Nếu dùng SQLEXPRESS:
# powershell ./scripts/setup-db.ps1 -SqlInstance "localhost\SQLEXPRESS"

# 4. Chạy API:
dotnet run --urls http://127.0.0.1:5000
# hoặc: dotnet watch run --urls http://127.0.0.1:5000

# 5. Kiểm tra:
# Swagger: http://127.0.0.1:5000/swagger
# Health:  http://127.0.0.1:5000/api/health
# DB:      http://127.0.0.1:5000/api/health/db   -> { ok:true } là đạt
```

Không cần tạo tay database `StoreDb`:
- `Program.cs` khởi động gọi `EnsureCreatedAsync()` + `StoreDb.EnsureDatabaseExists()` + `EnsureCustomerTables()` + `SeedDefaultProducts()` (idempotent, máy đã có DB không mất dữ liệu).
- `scripts/setup-db.ps1` tạo DB qua `master`, chạy `scripts/init-db.sql` (copy từ `../server/data/schema-mssql.sql`), rồi `dotnet restore`.
- Script dùng `sqlcmd -C` nên qua được lỗi chứng chỉ self-signed của driver ODBC 18 (`certificate chain was issued by an authority that is not trusted`).
- Connection string chuẩn đã thêm `Encrypt=False`: xem `appsettings.json` + `.env.example`.

Nếu `/api/health/db` báo `503 db_unavailable`: đọc `message` + `hint`, kiểm tra SQL Server đã Running chưa rồi chạy lại `scripts/setup-db.ps1`.

## Chạy bằng VS Code

```powershell
dotnet restore server-dotnet.csproj
dotnet watch run --urls http://127.0.0.1:5000
```

Swagger: `http://127.0.0.1:5000/swagger`.

Cài extension `C# Dev Kit`, đặt breakpoint trong `Controllers` hoặc `Data/StoreDb.cs`, rồi bấm `F5` trong VS Code.

## Cấu hình

Backend C# dùng **SQL Server**.
Cấu hình bằng connection string `StoreDb` trong `appsettings.json`, hoặc biến môi trường:

- `ConnectionStrings__StoreDb` (ưu tiên nhất, đặt trong `.env` local — **không commit**),
- hoặc `SQL_SERVER` / `SQL_DATABASE` (ví dụ `localhost\SQLEXPRESS` / `StoreDb`),
- hoặc `DATABASE_URL`.

Không ghi mật khẩu vào source hoặc commit; xem `.env.example`. File `.env` local đã được `.gitignore` ở gốc bỏ qua.

Các route C# chính gồm `/api/health`, `/api/health/db`, `/api/storefront/catalog`, `/api/storefront/appearance`, `/api/storefront/contact`, `/api/storefront/products/{id}/view`, `/api/customer/*`, `/api/admin/products`, `/api/admin/appearance`, `/api/support/status` và `/api/support/chat`. Catalog đọc từ `shared/catalog-manifest.json`, có đúng 1.000 ID dùng chung cho Store và Admin.

Để thử frontend với C# mà không đổi cấu hình mặc định, chạy Vite bằng:

```powershell
$env:VITE_API_TARGET = 'http://127.0.0.1:5000'
npm run dev
```

Khi kiểm thử C# cần đặt `VITE_API_TARGET=http://127.0.0.1:5000`; không dùng backend Node làm nguồn dữ liệu thay thế cho nghiệm thu catalog, appearance hoặc AI Local.

## AI Local chạy đúng

AI Local cần Ollama chạy riêng trên máy đang chạy API:

```powershell
ollama serve
ollama pull qwen3.5:4b
ollama list
```

Mặc định dự án dùng `AI_CONTEXT_SIZE=32768`, `AI_THINKING=off` và timeout 120 giây. Tắt `think` để qwen3.5:4b không dùng hết giới hạn sinh câu trả lời trong phần suy nghĩ; đây không phải một mức `high` riêng của Ollama. Chất lượng dữ liệu được giữ bằng RAG từ StoreDb, prompt có lịch sử hội thoại và giới hạn trả lời đầy đủ. Sau khi sửa `.env`, phải khởi động lại API.

Lịch sử chat được lưu theo tài khoản trong các bảng `conversations`, `messages` và `chat_turns`, nên việc Store làm mới phiên khách mỗi phút không còn xóa hội thoại. Backend chỉ đưa các lượt gần nhất vào prompt; dữ liệu sản phẩm, danh mục, giá và tồn kho vẫn được đọc lại trực tiếp từ `catalog_products` ở mỗi câu hỏi.
