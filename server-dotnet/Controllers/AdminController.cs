/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/AdminController.cs
 * Mục đích: Endpoint quản trị và kiểm tra quyền admin của API C#.
 * Thành phần chính: AdminController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc, StoreApi.Data, StoreApi.Models, StoreApi.Security.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Text.Json;
using System.Text;

using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin")]
// Vai trò kiểu AdminController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class AdminController(StoreDb db, AiChatService aiChatService, OrderEmailService orderEmailService) : ControllerBase
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
    public IActionResult Overview() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { overview = db.GetAdminOverview() });

    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var overview = db.GetAdminOverview();
        return Ok(new { dashboard = overview, overview });
    }

    [HttpGet("products")]
    public IActionResult Products() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { products = db.Catalog(), total = db.Catalog().Count });

    [HttpPost("products")]
    public IActionResult CreateProduct(AdminProductRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.Name) || request.Price is null or < 0) return BadRequest(new { error = "INVALID_PRODUCT" });

        var id = string.IsNullOrWhiteSpace(request.Id) ? "manual-" + Guid.NewGuid().ToString("N")[..8] : request.Id.Trim();
        var category = string.IsNullOrWhiteSpace(request.Category) ? "Đồ gia dụng" : request.Category.Trim();
        var description = request.Description ?? "";
        var image = string.IsNullOrWhiteSpace(request.Image) ? "/products/bag.svg" : request.Image.Trim();
        var features = request.Features ?? [];
        var symbol = string.IsNullOrWhiteSpace(request.Symbol) ? "✦" : request.Symbol.Trim();
        var label = string.IsNullOrWhiteSpace(request.Label) ? (string.IsNullOrWhiteSpace(request.Badge) ? "Mới" : request.Badge.Trim()) : request.Label.Trim();
        var stockCount = request.StockCount ?? 20;

        var product = db.CreateCatalogProduct(id, request.Name.Trim(), category, request.Price.Value, description, image, features, "green", symbol, label, stockCount);
        return StatusCode(StatusCodes.Status201Created, new { product });
    }

    [HttpPatch("products/{id}")]
    [HttpPut("products/{id}")]
    public IActionResult UpdateProduct(string id, AdminProductRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var updated = db.UpdateCatalogProduct(id, request.Name, request.Category, request.Price, request.Description, request.Image, request.Label ?? request.Badge, request.StockCount, request.Symbol);
        return updated is null ? NotFound(new { error = "PRODUCT_NOT_FOUND" }) : Ok(new { product = updated });
    }

    [HttpDelete("products/{id}")]
    public IActionResult DeleteProduct(string id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (id is "1" or "2" or "3" or "4") return BadRequest(new { error = "FEATURED_PRODUCT_PROTECTED" });

        return db.DeleteCatalogProduct(id) ? Ok(new { ok = true, id }) : NotFound(new { error = "PRODUCT_NOT_FOUND" });
    }

    [HttpGet("product-views")]
    public IActionResult ProductViews() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { products = db.TopViews(), totalViews = db.TotalViews() });

    [HttpPatch("products/{id}/offer")]
    public IActionResult Offer(string id, OfferRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (!db.UpdateOffer(id, request.DiscountPercent, request.StockCount)) return BadRequest(new { error = "INVALID_PRODUCT_OFFER" });
        return Ok(new { offer = new { discountPercent = request.DiscountPercent, stockCount = request.StockCount } });
    }

    [HttpGet("appearance")]
    public IActionResult Appearance() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { appearance = db.Appearance(), theme = db.Theme(), adminTheme = db.AdminTheme() });

    [HttpPut("appearance")]
    public IActionResult UpdateAppearance([FromBody] JsonElement request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var source = request;
        var wrappedAppearance = Property(source, "appearance");
        if (wrappedAppearance.ValueKind == JsonValueKind.Object) source = wrappedAppearance;

        var legacy = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        JsonElement? theme = null;
        JsonElement? adminTheme = null;
        var hasThemeShape = false;
        if (source.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in source.EnumerateObject())
            {
                if (property.Name.Equals("theme", StringComparison.OrdinalIgnoreCase))
                {
                    theme = property.Value.Clone();
                    continue;
                }
                if (property.Name.Equals("adminTheme", StringComparison.OrdinalIgnoreCase))
                {
                    adminTheme = property.Value.Clone();
                    continue;
                }
                if (property.Name is "schemaVersion" or "defaultMode" or "presetId" or "light" or "dark") hasThemeShape = true;
                if (property.Value.ValueKind == JsonValueKind.String) legacy[property.Name] = property.Value.GetString() ?? "";
            }
            if (!theme.HasValue && hasThemeShape) theme = source.Clone();
        }

        var topLevelTheme = Property(request, "theme");
        if (topLevelTheme.ValueKind == JsonValueKind.Object) theme = topLevelTheme.Clone();
        var topLevelAdminTheme = Property(request, "adminTheme");
        if (topLevelAdminTheme.ValueKind == JsonValueKind.Object) adminTheme = topLevelAdminTheme.Clone();

        db.SaveAppearance(legacy, theme, adminTheme);
        return Ok(new { appearance = db.Appearance(), theme = db.Theme(), adminTheme = db.AdminTheme() });
    }

    [HttpGet("records")]
    [HttpGet("records/{module}")]
    public IActionResult Records(string? module = null)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var records = db.ListAdminRecords(module);
        return Ok(new { module = module ?? "all", records });
    }

    [HttpPost("records/{module}")]
    public IActionResult CreateRecord(string module, RecordRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest(new { error = "INVALID_RECORD" });

        var json = JsonSerializer.Serialize(request.Data ?? []);
        var record = db.CreateAdminRecord(module, request.Title.Trim(), request.Status ?? "Đang dùng", json);
        return StatusCode(StatusCodes.Status201Created, new { record });
    }

    [HttpPatch("records/{module}/{id:int}")]
    [HttpPut("records/{module}/{id:int}")]
    public IActionResult UpdateRecord(string module, int id, RecordRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var json = JsonSerializer.Serialize(request.Data ?? []);
        var record = db.UpdateAdminRecord(id, module, request.Title ?? "", request.Status ?? "Đang dùng", json);
        return record is null ? NotFound(new { error = "RECORD_NOT_FOUND" }) : Ok(new { record });
    }

    [HttpDelete("records/{module}/{id:int}")]
    public IActionResult DeleteRecord(string module, int id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        return db.DeleteAdminRecord(id) ? Ok(new { ok = true, id }) : NotFound(new { error = "RECORD_NOT_FOUND" });
    }

    [HttpGet("orders")]
    [HttpGet("customer-orders")]
    public IActionResult Orders() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { orders = db.ListAllAdminOrders() });

    [HttpPost("customer-orders/{id}/paid")]
    [HttpPatch("orders/{id}/status")]
    public IActionResult OrderPaid(string id, OrderPaidRequest? request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var updated = db.MarkAdminOrderPaid(id, request?.Reference);
        if (updated) orderEmailService.QueueInvoice(id);
        return updated ? Ok(new { success = true, orderId = id }) : NotFound(new { error = "ORDER_NOT_FOUND" });
    }

    [HttpPatch("customer-orders/{id}/fulfillment")]
    public IActionResult OrderFulfillment(string id, OrderFulfillmentRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        return db.UpdateAdminOrderFulfillment(id, request.Status ?? "ready") ? Ok(new { success = true, orderId = id }) : NotFound(new { error = "ORDER_NOT_FOUND" });
    }

    [HttpPatch("orders/{id}/cancel")]
    public IActionResult OrderCancel(string id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        return db.CancelAdminOrder(id) ? Ok(new { cancelled = true }) : NotFound(new { error = "ORDER_NOT_FOUND" });
    }

    [HttpGet("orders/{id}/receipt")]
    [HttpGet("orders/{id}/receipt.html")]
    [HttpGet("customer-orders/{id}/receipt.html")]
    public IActionResult OrderReceipt(string id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var order = db.FindCustomerOrder(id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });

        if (Request.Path.Value?.EndsWith(".html") == true || Request.Query["format"] == "html")
        {
            return Content(RenderReceiptHtml(order), "text/html; charset=utf-8");
        }
        return Ok(new { order, afterSales = Array.Empty<object>(), events = Array.Empty<object>(), store = new { name = "Store Mini Mart", address = "TP. Hồ Chí Minh", demo = true } });
    }

    [HttpGet("customers")]
    public IActionResult Customers() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { customers = db.ListAdminCustomers() });

    [HttpPatch("customers/{id:long}")]
    public IActionResult UpdateCustomer(long id, AdminCustomerUpdateRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        try
        {
            var customer = db.UpdateAdminCustomer(id, request.Username, request.Email, request.Points, request.SpinCredits);
            return customer is null ? NotFound(new { error = "CUSTOMER_NOT_FOUND" }) : Ok(new { customer });
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("customers/{id:long}/vouchers")]
    public IActionResult CreateCustomerVoucher(long id, AdminVoucherRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var code = string.IsNullOrWhiteSpace(request.Code) ? Guid.NewGuid().ToString("N")[..10].ToUpperInvariant() : request.Code.Trim().ToUpperInvariant();
        var label = string.IsNullOrWhiteSpace(request.Label) ? "Ưu đãi thành viên" : request.Label.Trim();
        var type = string.IsNullOrWhiteSpace(request.Type) ? "percent" : request.Type.Trim();
        var scope = string.IsNullOrWhiteSpace(request.Scope) ? "goods" : request.Scope.Trim();
        var expiresAt = string.IsNullOrWhiteSpace(request.ExpiresAt) ? DateTimeOffset.UtcNow.AddDays(30).ToString("yyyy-MM-dd") : request.ExpiresAt.Trim();
        var voucher = db.CreateAdminVoucher(code, id, label, type, request.Value ?? 10, scope, expiresAt, "admin");
        return StatusCode(StatusCodes.Status201Created, new { voucher });
    }

    [HttpGet("vouchers")]
    public IActionResult Vouchers() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { vouchers = db.ListAdminVouchers() });

    [HttpPost("vouchers")]
    public IActionResult CreateVoucher(AdminVoucherRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var code = string.IsNullOrWhiteSpace(request.Code) ? Guid.NewGuid().ToString("N")[..10].ToUpperInvariant() : request.Code.Trim().ToUpperInvariant();
        var label = string.IsNullOrWhiteSpace(request.Label) ? "Ưu đãi Store" : request.Label.Trim();
        var type = string.IsNullOrWhiteSpace(request.Type) ? "percent" : request.Type.Trim();
        var scope = string.IsNullOrWhiteSpace(request.Scope) ? "goods" : request.Scope.Trim();
        var expiresAt = string.IsNullOrWhiteSpace(request.ExpiresAt) ? DateTimeOffset.UtcNow.AddDays(30).ToString("yyyy-MM-dd") : request.ExpiresAt.Trim();
        var voucher = db.CreateAdminVoucher(code, request.CustomerId is > 0 ? request.CustomerId : null, label, type, request.Value ?? 10, scope, expiresAt, "admin");
        return StatusCode(StatusCodes.Status201Created, new { voucher });
    }

    [HttpPatch("vouchers/{code}")]
    public IActionResult UpdateVoucher(string code, AdminVoucherRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        return db.UpdateAdminVoucher(code.ToUpperInvariant(), request.Label, request.Type, request.Value, request.Scope, request.ExpiresAt) ? Ok(new { ok = true, code }) : NotFound(new { error = "VOUCHER_NOT_FOUND" });
    }

    [HttpDelete("vouchers/{code}")]
    public IActionResult DeleteVoucher(string code)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        return db.DeleteAdminVoucher(code.ToUpperInvariant()) ? Ok(new { ok = true, code }) : NotFound(new { error = "VOUCHER_NOT_FOUND" });
    }

    [HttpGet("favorites")]
    public IActionResult Favorites() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { favorites = db.ListAdminFavorites() });

    [HttpGet("reviews")]
    public IActionResult Reviews() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { reviews = db.ListAdminReviews() });

    [HttpPatch("reviews/{id:long}/reply")]
    public IActionResult ReplyReview(long id, ReviewReplyRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.Reply)) return BadRequest(new { error = "INVALID_REPLY" });
        return db.ReplyAdminReview(id, request.Reply.Trim()) ? Ok(new { ok = true, reply = request.Reply.Trim() }) : NotFound(new { error = "REVIEW_NOT_FOUND" });
    }

    [HttpGet("settings")]
    public IActionResult Settings() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { contextSize = aiChatService.ContextSize, allowedContextSizes = aiChatService.AllowedContextSizes, model = aiChatService.ModelName });

    [HttpPut("settings")]
    public IActionResult UpdateSettings(AdminSettingsRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var requested = request.ContextSize ?? aiChatService.ContextSize;
        var contextSize = aiChatService.AllowedContextSizes.Contains(requested) ? requested : aiChatService.ContextSize;
        return Ok(new { contextSize, allowedContextSizes = aiChatService.AllowedContextSizes, model = aiChatService.ModelName });
    }

    [HttpGet("payment-settings")]
    public IActionResult PaymentSettings()
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        return Ok(new { settings = db.GetPaymentSettings(), policy = new { cancellationPercent = 1, returnDays = 7, rescheduleDays = 3 } });
    }

    [HttpPut("payment-settings")]
    public IActionResult UpdatePaymentSettings(PaymentSettingsRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var settings = db.SavePaymentSettings(request.Mode ?? "demo", request.BankName, request.BankBin, request.AccountNumber, request.AccountName);
        return Ok(new { settings });
    }

    [HttpGet("stats")]
    public IActionResult Stats([FromQuery] string? from, [FromQuery] string? to)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var fromDate = string.IsNullOrWhiteSpace(from) ? DateTimeOffset.UtcNow.AddDays(-30).ToString("yyyy-MM-dd") : from.Trim();
        var toDate = string.IsNullOrWhiteSpace(to) ? DateTimeOffset.UtcNow.ToString("yyyy-MM-dd") : to.Trim();
        var report = db.CalculateAdminRevenue(fromDate, toDate);
        return Ok(new { report, source = aiChatService.ModelName });
    }

    [HttpGet("stats/export")]
    public IActionResult ExportStats([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? format)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var fromDate = string.IsNullOrWhiteSpace(from) ? DateTimeOffset.UtcNow.AddDays(-30).ToString("yyyy-MM-dd") : from.Trim();
        var toDate = string.IsNullOrWhiteSpace(to) ? DateTimeOffset.UtcNow.ToString("yyyy-MM-dd") : to.Trim();
        var report = db.CalculateAdminRevenue(fromDate, toDate);
        if (string.Equals(format, "html", StringComparison.OrdinalIgnoreCase))
        {
            var json = JsonSerializer.Serialize(report);
            return Content($"<!doctype html><html lang='vi'><head><meta charset='utf-8'><title>Báo cáo Store</title><style>body{{font-family:Arial,sans-serif;padding:32px;color:#17382c}}table{{border-collapse:collapse;width:100%;max-width:760px}}td,th{{border:1px solid #cbd8ce;padding:10px;text-align:left}}@media print{{button{{display:none}}}}</style></head><body><button onclick='print()'>In / Lưu PDF</button><h1>Báo cáo Store</h1><p>{fromDate} → {toDate}</p><pre>{System.Net.WebUtility.HtmlEncode(json)}</pre></body></html>", "text/html; charset=utf-8");
        }

        using var document = JsonDocument.Parse(JsonSerializer.Serialize(report));
        var root = document.RootElement;
        var rows = new[]
        {
            "Chỉ tiêu,Giá trị",
            $"Từ ngày,{fromDate}",
            $"Đến ngày,{toDate}",
            $"Tổng đơn,{root.GetProperty("allOrders").GetInt64()}",
            $"Đơn được tính,{root.GetProperty("includedOrders").GetInt64()}",
            $"Doanh thu gộp,{root.GetProperty("grossRevenue").GetInt64()}",
            $"Hoàn tiền,{root.GetProperty("refunds").GetInt64()}",
            $"Doanh thu ròng,{root.GetProperty("netRevenue").GetInt64()}",
            $"Chế độ dữ liệu,{root.GetProperty("dataMode").GetString()}"
        };
        var csv = string.Join("\r\n", rows) + "\r\n";
        return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray(), "text/csv; charset=utf-8", $"store-statistics-{fromDate}-{toDate}.csv");
    }

    [HttpGet("after-sales")]
    public IActionResult AfterSales()
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var requests = db.ListAdminRecords("after-sales").Select(ParseAfterSales).Where(item => item is not null).Select(item => item!).ToArray();
        return Ok(new { requests, policy = new { cancellationPercent = 1, returnDays = 7, rescheduleDays = 3 } });
    }

    [HttpPost("after-sales/{id}/action")]
    public IActionResult AfterSalesAction(string id, AfterSalesActionRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var record = db.ListAdminRecords("after-sales").Select(ParseAfterSalesRecord).FirstOrDefault(item => item is not null && string.Equals(ReadDataString(item.Data, "id"), id, StringComparison.OrdinalIgnoreCase));
        if (record is null) return NotFound(new { error = "AFTER_SALES_NOT_FOUND" });
        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        var status = action switch
        {
            "approve" => ReadDataInt(record.Data, "quote", "feeAmount") > 0 ? "awaiting_payment" : ReadDataString(record.Data, "kind") == "return" ? "awaiting_return" : "resolved",
            "fee_paid" => "awaiting_return",
            "complete_return" => "resolved",
            "reject" => "rejected",
            _ => record.Status
        };
        record.Data["status"] = status;
        record.Data["note"] = request.Note ?? ReadDataString(record.Data, "note");
        if (!string.IsNullOrWhiteSpace(request.Reference)) record.Data["refundReference"] = request.Reference.Trim();
        db.UpdateAdminRecord(record.Id, "after-sales", record.Title, AfterSalesStatusLabel(status), JsonSerializer.Serialize(record.Data));
        return Ok(new { updated = true, id, status });
    }

    [HttpGet("events/stream")]
    public async Task EventsStream(CancellationToken cancellationToken)
    {
        if (RequireAdmin() is null)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        Response.Headers.ContentType = "text/event-stream; charset=utf-8";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        await Response.WriteAsync("event: connected\ndata: {\"status\":\"connected\"}\n\n", cancellationToken);
        await Response.Body.FlushAsync(cancellationToken);

        while (!cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(25000, cancellationToken);
            await Response.WriteAsync(": keepalive\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);
        }
    }

    [HttpPost("chat")]
    public async Task Chat(ChatStreamRequest request, CancellationToken cancellationToken)
    {
        if (RequireAdmin() is null)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            Response.ContentType = "application/json";
            await Response.WriteAsync("{\"error\":\"UNAUTHENTICATED\"}", cancellationToken);
            return;
        }

        if (!CsrfValid())
        {
            Response.StatusCode = StatusCodes.Status403Forbidden;
            Response.ContentType = "application/json";
            await Response.WriteAsync("{\"error\":\"CSRF_INVALID\"}", cancellationToken);
            return;
        }

        var message = (request.Message ?? "").Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            Response.ContentType = "application/json";
            await Response.WriteAsync("{\"error\":\"EMPTY_MESSAGE\"}", cancellationToken);
            return;
        }

        var convId = string.IsNullOrWhiteSpace(request.ConversationId)
            ? "admin-conv-" + Guid.NewGuid().ToString("N")[..8]
            : request.ConversationId.Trim();

        Response.ContentType = "application/x-ndjson; charset=utf-8";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Append("X-Accel-Buffering", "no");

        // 1. conversation event
        await WriteNdjsonAsync(Response, new { type = "conversation", conversationId = convId, compactStatus = "not_needed" }, cancellationToken);

        // 2. status event
        await WriteNdjsonAsync(Response, new { type = "status", label = "Đang phân tích dữ liệu..." }, cancellationToken);

        var chatRes = await aiChatService.ProcessAdminChatAsync(message, db, cancellationToken);

        // 3. sources event
        if (chatRes.Sources.Count > 0)
        {
            await WriteNdjsonAsync(Response, new { type = "sources", sources = chatRes.Sources }, cancellationToken);
        }

        // 4. report event if available
        if (chatRes.Report != null)
        {
            await WriteNdjsonAsync(Response, new { type = "report", report = chatRes.Report }, cancellationToken);
        }

        // 5. verified event
        await WriteNdjsonAsync(Response, new { type = "verified", verified = chatRes.Verified }, cancellationToken);

        // 6. delta events
        foreach (var chunk in chatRes.Chunks)
        {
            if (cancellationToken.IsCancellationRequested) break;
            await WriteNdjsonAsync(Response, new { type = "delta", content = chunk }, cancellationToken);
            await Task.Delay(25, cancellationToken);
        }

        // 7. done event
        await WriteNdjsonAsync(Response, new { type = "done", conversationId = convId, compactStatus = "not_needed" }, cancellationToken);
    }

    private static async Task WriteNdjsonAsync(HttpResponse response, object data, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(data);
        await response.WriteAsync(json + "\n", ct);
        await response.Body.FlushAsync(ct);
    }

    private static string RenderReceiptHtml(object order)
    {
        var json = JsonSerializer.Serialize(order);
        return $$"""
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="utf-8" />
            <title>Biên nhận đơn hàng</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: auto; }
                h1 { font-size: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
                .meta { margin-bottom: 16px; font-size: 14px; color: #64748b; line-height: 1.6; }
                .items { width: 100%; border-collapse: collapse; margin-top: 16px; }
                .items th, .items td { text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0; }
                .total { text-align: right; font-weight: bold; font-size: 18px; margin-top: 16px; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <button onclick="window.print()">In biên nhận (PDF)</button>
            <h1>STORE MINI MART — BIÊN NHẬN ĐƠN HÀNG</h1>
            <pre style="display:none;" id="data">{{json}}</pre>
            <div id="content"></div>
            <script>
                try {
                    const o = JSON.parse(document.getElementById('data').textContent);
                    document.getElementById('content').innerHTML = `
                        <div class="meta">
                            <p>Mã đơn: <strong>${o.id || ''}</strong></p>
                            <p>Khách hàng: <strong>${o.recipient || o.username || 'Khách'}</strong> (${o.phone || ''})</p>
                            <p>Địa chỉ: ${o.address || 'Tại quầy'}</p>
                            <p>Ngày tạo: ${o.createdAt || ''}</p>
                            <p>Trạng thái: <strong>${o.status || ''}</strong> (${o.paymentMethod || ''})</p>
                        </div>
                        <table class="items">
                            <thead><tr><th>Sản phẩm</th><th>SL</th><th>Giá</th></tr></thead>
                            <tbody>
                                ${(o.items || []).map(i => `<tr><td>${i.name || i.id}</td><td>${i.quantity || 1}</td><td>${(i.price || 0).toLocaleString('vi-VN')} ₫</td></tr>`).join('')}
                            </tbody>
                        </table>
                        <div class="total">Tổng tiền: ${(o.total || 0).toLocaleString('vi-VN')} ₫</div>
                    `;
                } catch(e) {}
            </script>
        </body>
        </html>
        """;
    }


    private (long Id, string Username)? RequireAdmin()
    {
        var raw = Request.Cookies[Cookie]; return string.IsNullOrWhiteSpace(raw) ? null : db.FindAdminBySession(Tokens.Sha256(raw));
    }

    private static object? ParseAfterSales(object value)
    {
        var record = ParseAfterSalesRecord(value);
        if (record is null) return null;
        return new
        {
            id = ReadDataString(record.Data, "id") ?? record.Id.ToString(),
            orderId = ReadDataString(record.Data, "orderId"),
            kind = ReadDataString(record.Data, "kind"),
            reason = ReadDataString(record.Data, "reason"),
            scheduledAt = ReadDataString(record.Data, "scheduledAt"),
            status = ReadDataString(record.Data, "status") ?? record.Status,
            username = "Khách hàng #" + ReadDataString(record.Data, "customerId"),
            quote = ReadDataObject(record.Data, "quote"),
            note = ReadDataString(record.Data, "note"),
            refundReference = ReadDataString(record.Data, "refundReference")
        };
    }

    private static AfterSalesRecord? ParseAfterSalesRecord(object value)
    {
        try
        {
            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(value));
            var root = doc.RootElement;
            var data = JsonSerializer.Deserialize<Dictionary<string, object?>>(root.GetProperty("data").GetRawText()) ?? [];
            return new AfterSalesRecord(root.GetProperty("id").GetInt32(), root.GetProperty("title").GetString() ?? "", root.GetProperty("status").GetString() ?? "", data);
        }
        catch { return null; }
    }

    private static string? ReadDataString(Dictionary<string, object?> data, string key)
    {
        return data.TryGetValue(key, out var value) ? value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.String => element.GetString(),
            null => null,
            _ => Convert.ToString(value)
        } : null;
    }

    private static int ReadDataInt(Dictionary<string, object?> data, string parent, string key)
    {
        if (!data.TryGetValue(parent, out var value)) return 0;
        var element = value is JsonElement json ? json : JsonSerializer.SerializeToElement(value);
        return element.ValueKind == JsonValueKind.Object && element.TryGetProperty(key, out var field) && field.TryGetInt32(out var number) ? number : 0;
    }

    private static object? ReadDataObject(Dictionary<string, object?> data, string key)
    {
        return data.TryGetValue(key, out var value) && value is JsonElement element ? JsonSerializer.Deserialize<object>(element.GetRawText()) : value;
    }

    private static string AfterSalesStatusLabel(string status) => status switch
    {
        "awaiting_payment" => "Chờ thanh toán phí",
        "awaiting_return" => "Chờ nhận hàng trả",
        "resolved" => "Đã xử lý",
        "rejected" => "Đã từ chối",
        "cancelled" => "Đã hủy yêu cầu",
        _ => "Chờ cửa hàng duyệt"
    };

    private sealed record AfterSalesRecord(int Id, string Title, string Status, Dictionary<string, object?> Data);

    private static JsonElement Property(JsonElement source, string name)
    {
        if (source.ValueKind != JsonValueKind.Object) return default;
        foreach (var property in source.EnumerateObject())
        {
            if (property.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) return property.Value;
        }
        return default;
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies[Cookie]; return !string.IsNullOrWhiteSpace(raw) && Request.Headers.TryGetValue("x-csrf-token", out var value) && value == Tokens.Sha256("csrf:" + raw);
    }
}
