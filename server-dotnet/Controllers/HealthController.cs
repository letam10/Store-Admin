/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/HealthController.cs
 * Mục đích: Endpoint health kiểm tra API C# còn hoạt động.
 * Thành phần chính: HealthController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;

namespace StoreApi.Controllers;

[ApiController]
// Vai trò kiểu HealthController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class HealthController(StoreDb db) : ControllerBase
{
    [HttpGet("/api/health")]
    // Chức năng Get: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Get() => Ok(new { ok = true, status = "ok", runtime = "aspnetcore-csharp" });

    [HttpGet("/api/health/db")]
    // Kiểm tra kết nối StoreDb cho máy mới pull về: frontend hiện thông báo thân thiện thay vì 500 trắng trang.
    public IActionResult Db()
    {
        var (ok, message) = db.TryCheckHealth();
        if (ok)
        {
            return Ok(new { ok = true, status = "ok", database = db.DatabaseName, message });
        }
        return StatusCode(503, new
        {
            ok = false,
            status = "db_unavailable",
            database = db.DatabaseName,
            message,
            hint = "Chưa có database. Chạy: powershell ./scripts/setup-db.ps1 trong thư mục server-dotnet, rồi chạy lại API."
        });
    }
}
