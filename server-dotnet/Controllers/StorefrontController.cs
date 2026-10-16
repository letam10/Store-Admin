/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/StorefrontController.cs
 * Mục đích: Endpoint catalog/view storefront của API C#.
 * Thành phần chính: StorefrontController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc, StoreApi.Data.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/storefront")]
// Vai trò kiểu StorefrontController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class StorefrontController(StoreDb db) : ControllerBase
{
    private const string Cookie = "store_customer_session";

    [HttpGet("catalog")]
    // Chức năng Catalog: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Catalog() => Ok(new { products = db.Catalog() });

    [HttpGet("appearance")]
    // Chức năng Appearance: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Appearance() => Ok(new { appearance = db.Appearance() });

    [HttpPost("products/{id}/view")]
    // Chức năng ViewProduct: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult ViewProduct(string id) => Ok(new { id, viewCount = db.IncrementView(id) });

    [HttpPost("contact")]
    public IActionResult Contact(StorefrontContactRequest request)
    {
        var name = (request.Name ?? "").Trim();
        var email = (request.Email ?? "").Trim();
        var topic = (request.Topic ?? "Hỗ trợ mua hàng").Trim();
        var message = (request.Message ?? "").Trim();

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(message))
        {
            return BadRequest(new { error = "INVALID_CONTACT" });
        }

        var requestId = "CS-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var data = new Dictionary<string, object?>
        {
            ["customer"] = name,
            ["topic"] = topic,
            ["email"] = email,
            ["message"] = message,
            ["assignee"] = "Chưa phân công"
        };
        var dataJson = JsonSerializer.Serialize(data);
        db.CreateAdminRecord("support", $"#{requestId} - {name} ({topic})", "Chờ duyệt", dataJson);

        return Ok(new { success = true, requestId });
    }

    [HttpGet("products/{id}/reviews")]
    public IActionResult GetProductReviews(string id)
    {
        var reviews = db.ListProductReviews(id);
        return Ok(new { reviews });
    }

    [HttpPost("products/{id}/reviews")]
    public IActionResult SubmitProductReview(string id, ProductReviewRequest request)
    {
        var raw = Request.Cookies[Cookie];
        if (string.IsNullOrWhiteSpace(raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var customer = db.FindCustomerBySession(Tokens.Sha256(raw));
        if (customer is null) return Unauthorized(new { error = "LOGIN_REQUIRED" });

        if (!Request.Headers.TryGetValue("x-csrf-token", out var csrf) || csrf != Tokens.Sha256("customer-csrf:" + raw))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        }

        if (request.Rating < 1 || request.Rating > 5 || string.IsNullOrWhiteSpace(request.Comment))
        {
            return BadRequest(new { error = "INVALID_REVIEW" });
        }

        db.UpsertProductReview(id, customer.Value.Id, customer.Value.Username, request.Rating, request.Comment.Trim());
        return StatusCode(StatusCodes.Status201Created, new { success = true });
    }
}
