/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/HealthController.cs
 * Mục đích: Endpoint health kiểm tra API C# còn hoạt động.
 * Thành phần chính: HealthController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using Microsoft.AspNetCore.Mvc;

namespace StoreApi.Controllers;

[ApiController]
// Vai trò kiểu HealthController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class HealthController : ControllerBase
{
    [HttpGet("/api/health")]
    // Chức năng Get: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Get() => Ok(new { ok = true, status = "ok", runtime = "aspnetcore-csharp" });
}
