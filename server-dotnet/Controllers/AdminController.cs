/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/AdminController.cs
 * Mục đích: Endpoint quản trị và kiểm tra quyền admin của API C#.
 * Thành phần chính: AdminController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc, StoreApi.Data, StoreApi.Models, StoreApi.Security.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin")]
// Vai trò kiểu AdminController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class AdminController(StoreDb db) : ControllerBase
{
    private const string Cookie = "store_admin_session";

    [HttpPost("login")]
    public IActionResult Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password)) return Unauthorized(new { error = "LOGIN_FAILED" });
        var admin = db.FindAdmin(request.Username);
        if (admin is null || !Tokens.VerifyPassword(request.Password, admin.Value.Salt, admin.Value.Hash)) return Unauthorized(new { error = "LOGIN_FAILED" });
        var adminId = db.AdminId(request.Username); if (adminId is null) return Unauthorized(new { error = "LOGIN_FAILED" });
        var raw = Tokens.RandomToken(); var expires = DateTimeOffset.UtcNow.AddHours(12); db.CreateAdminSession(Tokens.Sha256(raw), adminId.Value, expires); Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromHours(12), Path = "/" });
        return Ok(new { authenticated = true, username = request.Username.Trim(), csrfToken = Tokens.Sha256("csrf:" + raw), expiresAt = expires });
    }

    [HttpGet("session")]
    public IActionResult Session()
    {
        var raw = Request.Cookies[Cookie]; var admin = string.IsNullOrWhiteSpace(raw) ? null : db.FindAdminBySession(Tokens.Sha256(raw));
        return admin is null ? Unauthorized(new { authenticated = false }) : Ok(new { authenticated = true, username = admin.Value.Username, csrfToken = Tokens.Sha256("csrf:" + raw), expiresAt = DateTimeOffset.UtcNow.AddHours(12) });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var raw = Request.Cookies[Cookie]; if (!string.IsNullOrWhiteSpace(raw)) db.DeleteAdminSession(Tokens.Sha256(raw)); Response.Cookies.Delete(Cookie); return Ok(new { ok = true });
    }

    [HttpGet("overview")]
    // Chức năng Overview: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Overview() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { overview = new { products = db.ProductCount(), customers = db.CustomerCount(), orders = db.OrderCount(), totalViews = db.TotalViews(), favorites = 0, records = 0, revenue = 0, includedOrders = 0, revenueByDay = Array.Empty<object>(), orderStatus = Array.Empty<object>() } });

    [HttpGet("products")]
    // Chức năng Products: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Products() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { products = db.Catalog() });

    [HttpGet("product-views")]
    // Chức năng ProductViews: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult ProductViews() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { products = db.TopViews(), totalViews = db.TotalViews() });

    [HttpPatch("products/{id}/offer")]
    public IActionResult Offer(string id, OfferRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (!db.UpdateOffer(id, request.DiscountPercent, request.StockCount)) return BadRequest(new { error = "INVALID_PRODUCT_OFFER" });
        return Ok(new { offer = new { discountPercent = request.DiscountPercent, stockCount = request.StockCount } });
    }

    [HttpGet("settings")]
    // Chức năng Settings: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Settings() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { contextSize = 16384, allowedContextSizes = new[] { 8192, 16384, 32768, 65536 }, model = "csharp-api" });

    private (long Id, string Username)? RequireAdmin()
    {
        var raw = Request.Cookies[Cookie]; return string.IsNullOrWhiteSpace(raw) ? null : db.FindAdminBySession(Tokens.Sha256(raw));
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies[Cookie]; return !string.IsNullOrWhiteSpace(raw) && Request.Headers.TryGetValue("x-csrf-token", out var value) && value == Tokens.Sha256("csrf:" + raw);
    }
}
