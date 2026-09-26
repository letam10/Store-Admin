# Store API bằng C#

Backend ASP.NET Core chạy song song trong giai đoạn chuyển đổi. Backend Node cũ trong `../server` được giữ nguyên để rollback; Vite proxy chỉ đổi sau khi toàn bộ API contract được port và kiểm thử end-to-end.

## Chạy bằng VS Code

```powershell
dotnet restore
dotnet watch run --urls http://127.0.0.1:5000
```

Swagger: `http://127.0.0.1:5000/swagger`.

Cài extension `C# Dev Kit`, đặt breakpoint trong `Controllers` hoặc `Data/StoreDb.cs`, rồi bấm `F5` trong VS Code.

Mặc định API đọc SQLite hiện tại ở `../server/data/store.sqlite`. Đổi đường dẫn bằng biến môi trường `ConnectionStrings__StoreDb`.

Các route C# đầu tiên giữ nguyên contract `/api/health`, `/api/storefront/catalog`, `/api/storefront/appearance`, `/api/storefront/products/{id}/view`, `/api/customer/*` cơ bản và `/api/admin/login`. Backend Node cũ vẫn là đường chạy chính cho đến khi các route còn lại được port và kiểm thử.
