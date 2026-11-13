/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/AdminController.cs
 * Mục đích: Endpoint quản trị và kiểm tra quyền admin của API C#.
 * Thành phần chính: AdminController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc, StoreApi.Data, StoreApi.Models, StoreApi.Security.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Text.Json;

using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin")]
[TypeFilter(typeof(AdminAccessFilter))]
// Vai trò kiểu AdminController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class AdminController(StoreDb db, AiChatService aiChatService, ChatStreamService chat, IHostApplicationLifetime lifetime) : ControllerBase
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
        var actor = db.FindAdminActor(Tokens.Sha256(raw))!;
        return Ok(new { authenticated = true, username = actor.Username, role = actor.Role, csrfToken = Tokens.Sha256("csrf:" + raw), expiresAt = expires });
    }

    [HttpGet("session")]
    public IActionResult Session()
    {
        var raw = Request.Cookies[Cookie];
        var admin = HttpContext.Items["AdminActor"] as StoreDb.AdminActor;
        return admin is null ? Unauthorized(new { authenticated = false }) : Ok(new { authenticated = true, username = admin.Username, role = admin.Role, csrfToken = Tokens.Sha256("csrf:" + raw) });
    }

    [HttpPost("presence")]
    public IActionResult Presence()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var raw = Request.Cookies[Cookie]!;
        return db.TouchAdminPresence(Tokens.Sha256(raw)) ? Ok(new { online = true }) : Unauthorized(new { error = "UNAUTHENTICATED" });
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
    public IActionResult Products([FromQuery] int offset = 0, [FromQuery] int limit = 40, [FromQuery] string? q = null)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var page = db.CatalogPage(offset, limit, q);
        return Ok(new { products = page.Products, total = page.Total, offset = Math.Max(0, offset), limit = Math.Clamp(limit, 1, 100) });
    }

    [HttpPost("products")]
    public IActionResult CreateProduct(AdminProductRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.Name) || request.Price is null || !ValidProductInput(request)) return BadRequest(new { error = "INVALID_PRODUCT" });

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
        if (!ValidProductInput(request)) return BadRequest(new { error = "INVALID_PRODUCT" });

        var updated = db.UpdateCatalogProduct(id, request.Name, request.Category, request.Price, request.Description, request.Image, request.Label ?? request.Badge, request.StockCount, request.Symbol);
        return updated is null ? NotFound(new { error = "PRODUCT_NOT_FOUND" }) : Ok(new { product = updated });
    }

    private static bool ValidProductInput(AdminProductRequest request) =>
        (request.Name is null || !string.IsNullOrWhiteSpace(request.Name))
        && request.Price is not < 0
        && request.StockCount is not < 0;

    [HttpDelete("products/{id}")]
    public IActionResult DeleteProduct(string id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (id is "1" or "2" or "3" or "4") return BadRequest(new { error = "FEATURED_PRODUCT_PROTECTED" });

        try { return db.DeleteCatalogProduct(id) ? Ok(new { ok = true, id }) : NotFound(new { error = "PRODUCT_NOT_FOUND" }); }
        catch (InvalidOperationException ex) when (ex.Message == "PRODUCT_IN_USE") { return Conflict(new { error = ex.Message }); }
    }

    [HttpGet("product-views")]
    public IActionResult ProductViews() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { products = db.TopViews(), totalViews = db.TotalViews() });

    [HttpPatch("products/{id}/offer")]
    public IActionResult Offer(string id, OfferRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (!db.UpdateOffer(id, request.DiscountPercent, request.StockCount)) return BadRequest(new { error = "INVALID_PRODUCT_OFFER" });
        var product = db.GetCatalogProduct(id);
        return product is null ? NotFound(new { error = "PRODUCT_NOT_FOUND" })
            : Ok(new { offer = new { product.DiscountPercent, product.StockCount } });
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
        return db.DeleteAdminRecord(id, module) ? Ok(new { ok = true, id }) : NotFound(new { error = "RECORD_NOT_FOUND" });
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
        if (request is null) return BadRequest(new { error = "PAYMENT_CONFIRMATION_REQUIRED" });
        try { db.SettleCheckout(id, request); return Ok(new { success = true, orderId = id, order = db.FindCustomerOrder(id) }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPatch("customer-orders/{id}/fulfillment")]
    public IActionResult OrderFulfillment(string id, OrderFulfillmentRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        try { db.AdvanceFulfillment(id, request.Status ?? ""); return Ok(new { success = true, orderId = id }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPatch("orders/{id}/cancel")]
    public IActionResult OrderCancel(string id)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        try { db.CancelCheckout(id); return Ok(new { cancelled = true }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
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
            return Content(OrderReceiptHtml.Render(order, db.UnmatchedPayments(id)), "text/html; charset=utf-8");
        }
        return Ok(new { order, afterSales = Array.Empty<object>(), events = Array.Empty<object>(), store = new { name = "Store Mini Mart", address = "TP. Hồ Chí Minh", demo = false } });
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
    public IActionResult Settings() => RequireAdmin() is null ? Unauthorized(new { error = "UNAUTHENTICATED" }) : Ok(new { contextSize = aiChatService.ContextSize, allowedContextSizes = aiChatService.AllowedContextSizes, model = aiChatService.ModelName, thinking = aiChatService.ThinkingEnabled, thinkingMode = aiChatService.ThinkingMode });

    [HttpPut("settings")]
    public IActionResult UpdateSettings(AdminSettingsRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var requested = request.ContextSize ?? aiChatService.ContextSize;
        if (!aiChatService.AllowedContextSizes.Contains(requested)) return BadRequest(new { error = "INVALID_CONTEXT_SIZE" });
        aiChatService.SetContextSize(requested);
        var contextSize = aiChatService.ContextSize;
        return Ok(new { contextSize, allowedContextSizes = aiChatService.AllowedContextSizes, model = aiChatService.ModelName, thinking = aiChatService.ThinkingEnabled, thinkingMode = aiChatService.ThinkingMode });
    }

    [HttpGet("payment-settings")]
    public IActionResult PaymentSettings()
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        return Ok(new { settings = db.GetPaymentSettings(), policy = AfterSalesPolicy.Description });
    }

    [HttpPut("payment-settings")]
    public IActionResult UpdatePaymentSettings(PaymentSettingsRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        try { return Ok(new { settings = db.SavePaymentSettings(request.Mode ?? "", request.BankName, request.BankBin, request.AccountNumber, request.AccountName) }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("after-sales")]
    public IActionResult AfterSales()
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        return Ok(new { requests = db.AfterSalesCases(), policy = AfterSalesPolicy.Description });
    }

    [HttpPost("after-sales/{id}/action")]
    public IActionResult AfterSalesAction(string id, AfterSalesActionRequest request)
    {
        if (RequireAdmin() is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var actor = (StoreDb.AdminActor)HttpContext.Items["AdminActor"]!;
        try { return Ok(new { request = db.AdminAfterSalesAction(actor, id, request) }); }
        catch (InvalidOperationException ex)
        {
            return StatusCode(ex.Message == "FORBIDDEN" ? 403 : ex.Message.EndsWith("NOT_FOUND", StringComparison.Ordinal) ? 404 : 409,
                new { error = ex.Message });
        }
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

        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lifetime.ApplicationStopping);
        long? cursor = long.TryParse(Request.Headers["Last-Event-ID"], out var previousId) && previousId >= 0 ? previousId : null;
        var heartbeat = 0;
        try
        {
            while (!linked.IsCancellationRequested)
            {
                var actor = db.FindAdminActor(Tokens.Sha256(Request.Cookies[Cookie] ?? ""));
                if (actor is null || actor.Role is not ("admin" or "staff")) return;
                var events = db.ReadAdminEvents(cursor);
                foreach (var item in events)
                {
                    await Response.WriteAsync($"id: {item.Id}\nevent: {item.Kind}\ndata: {item.Payload}\n\n", linked.Token);
                    cursor = item.Id;
                }
                cursor ??= 0;
                if (events.Count > 0 || ++heartbeat >= 8)
                {
                    if (events.Count == 0) await Response.WriteAsync(": keepalive\n\n", linked.Token);
                    await Response.Body.FlushAsync(linked.Token);
                    heartbeat = 0;
                }
                await Task.Delay(3000, linked.Token);
            }
        }
        catch (OperationCanceledException) when (linked.IsCancellationRequested) { }

    }

    [HttpGet("conversations/{conversationId}")]
    public IActionResult Conversation(string conversationId)
    {
        var admin = RequireAdmin();
        if (admin is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        var id = (conversationId ?? "").Trim();
        if (string.IsNullOrWhiteSpace(id) || id.Length > 255) return BadRequest(new { error = "INVALID_CONVERSATION" });
        var ownerKey = "admin:" + admin.Value.Id;
        if (!db.OwnsConversation(id, ownerKey, "admin")) return NotFound(new { error = "CONVERSATION_NOT_FOUND" });
        return Ok(new { conversationId = id, messages = db.GetChatHistory(id, ownerKey, "admin"), compactStatus = "not_needed" });
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(ChatStreamRequest request, CancellationToken cancellationToken)
    {
        var admin = RequireAdmin();
        if (admin is null) return Unauthorized(new { error = "UNAUTHENTICATED" });
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        await chat.RunAsync(HttpContext, request, "admin:" + admin.Value.Id, "admin", cancellationToken);
        return new EmptyResult();
    }

    private (long Id, string Username)? RequireAdmin()
    {
        var raw = Request.Cookies[Cookie]; return string.IsNullOrWhiteSpace(raw) ? null : db.FindAdminBySession(Tokens.Sha256(raw));
    }

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
