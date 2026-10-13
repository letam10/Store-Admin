/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/CustomerController.cs
 * Mục đích: Endpoint tài khoản và thao tác customer của API C#.
 * Thành phần chính: CustomerController.
 * Liên kết trực tiếp: System.Text.Json, Microsoft.AspNetCore.Mvc, StoreApi.Data, StoreApi.Models, StoreApi.Security.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/customer")]
// Vai trò kiểu CustomerController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class CustomerController(StoreDb db, IConfiguration configuration, EmailService emailService) : ControllerBase
{
    private const string Cookie = "store_customer_session";

    [HttpGet("session")]
    public IActionResult Session()
    {
        var customer = Current();
        var raw = Request.Cookies[Cookie];
        if (customer is null || string.IsNullOrWhiteSpace(raw)) return Unauthorized(new { authenticated = false });
        var full = db.FindCustomerFull(customer.Value.Id);
        var csrf = Tokens.Sha256("customer-csrf:" + raw);
        return Ok(new { authenticated = true, account = AccountEx(customer.Value, full?.GoogleSub ?? "", full?.TotpEnabled ?? 0, csrf) });
    }

    [HttpPost("register")]
    public IActionResult Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length < 3 || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            return BadRequest(new { error = "INVALID_CUSTOMER" });
        if (db.FindCustomer(request.Username) is not null || db.FindCustomer(request.Email) is not null) return Conflict(new { error = "CUSTOMER_EXISTS" });
        var (salt, hash) = Tokens.HashPassword(request.Password);
        try
        {
            var id = db.CreateCustomer(request.Username.Trim(), request.Email.Trim(), salt, hash);
            _ = Task.Run(async () =>
            {
                try { await emailService.SendWelcomeEmailAsync(request.Email.Trim(), request.Username.Trim()); }
                catch (Exception ex) { Console.WriteLine($"[Store Mailer] Welcome email exception: {ex.Message}"); }
            });
            return LoginInternal(request.Username.Trim(), id);
        }
        // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn, không làm lộ dữ liệu nhạy cảm.
        catch { return Conflict(new { error = "CUSTOMER_EXISTS" }); }
    }

    [HttpPost("login")]
    public IActionResult Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password)) return Unauthorized(new { error = "LOGIN_FAILED" });
        var found = db.FindCustomerAuth(request.Username.Trim().ToLowerInvariant());
        if (found is null || !Tokens.VerifyPassword(request.Password, found.Value.Salt, found.Value.Hash)) return Unauthorized(new { error = "LOGIN_FAILED" });
        if (found.Value.TotpEnabled == 1 && !string.IsNullOrEmpty(found.Value.TotpSecret))
        {
            var challenge = Guid.NewGuid().ToString();
            db.CreateLoginChallenge(challenge, found.Value.Id, DateTimeOffset.UtcNow.AddMinutes(5));
            return StatusCode(202, new { twoFactorRequired = true, challengeId = challenge });
        }
        return LoginInternal(found.Value.Username, found.Value.Id);
    }

    [HttpPost("login/2fa")]
    public IActionResult Login2fa(TwoFactorChallengeRequest request)
    {
        var challengeId = (request.ChallengeId ?? "").Trim();
        var code = (request.Code ?? "").Replace(" ", "");
        if (string.IsNullOrWhiteSpace(challengeId) || code.Length < 6 || code.Length > 10) return BadRequest(new { error = "INVALID_2FA_CODE" });
        var chall = db.FindLoginChallenge(challengeId);
        if (chall is null || string.Compare(chall.Value.ExpiresAt, DateTimeOffset.UtcNow.ToString("o"), StringComparison.Ordinal) <= 0)
        {
            if (chall is not null) db.DeleteLoginChallenge(challengeId);
            return Unauthorized(new { error = "CHALLENGE_EXPIRED" });
        }
        var full = db.FindCustomerFull(chall.Value.CustomerId);
        if (full is null) return Unauthorized(new { error = "INVALID_CREDENTIALS" });
        var ok = !string.IsNullOrEmpty(full.Value.TotpSecret) && Totp.Verify(full.Value.TotpSecret, code);
        if (!ok && db.ConsumeBackupCode(full.Value.Id, code.ToUpperInvariant())) ok = true;
        if (!ok) return Unauthorized(new { error = "INVALID_2FA_CODE" });
        db.DeleteLoginChallenge(challengeId);
        return LoginInternal(full.Value.Username, full.Value.Id);
    }

    [HttpGet("auth/status")]
    public IActionResult AuthStatus()
    {
        var googleId = configuration["GOOGLE_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? "";
        var googleSecret = configuration["GOOGLE_CLIENT_SECRET"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET") ?? "";
        var smtpHost = configuration["SMTP_HOST"] ?? Environment.GetEnvironmentVariable("SMTP_HOST") ?? "";
        return Ok(new { google = new { configured = !string.IsNullOrWhiteSpace(googleId) && !string.IsNullOrWhiteSpace(googleSecret) }, mailer = new { configured = !string.IsNullOrWhiteSpace(smtpHost), host = smtpHost } });
    }

    [HttpPost("password/forgot")]
    public IActionResult Forgot(PasswordForgotRequest request)
    {
        var email = (request.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254 || !email.Contains('@') || !email.Contains('.')) return BadRequest(new { error = "INVALID_EMAIL" });
        var found = db.FindCustomer(email);
        if (found is not null)
        {
            var raw = Tokens.RandomToken();
            db.CreatePasswordReset(Tokens.Sha256(raw), found.Value.Id, DateTimeOffset.UtcNow.AddMinutes(30));
            Console.WriteLine("[Store mailer] Reset link cho " + email + ": /reset-password?token=" + raw);
        }
        return Ok(new { ok = true });
    }

    [HttpPost("password/reset")]
    public IActionResult Reset(PasswordResetRequest request)
    {
        var token = (request.Token ?? "").Trim();
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200 || string.IsNullOrEmpty(request.Password) || request.Password.Length < 8 || request.Password.Length > 256)
            return BadRequest(new { error = "INVALID_RESET" });
        var saved = db.FindPasswordReset(Tokens.Sha256(token));
        if (saved is null || saved.Value.UsedAt is not null || string.Compare(saved.Value.ExpiresAt, DateTimeOffset.UtcNow.ToString("o"), StringComparison.Ordinal) <= 0)
            return BadRequest(new { error = "RESET_EXPIRED" });
        var (salt, hash) = Tokens.HashPassword(request.Password);
        db.ConsumePasswordReset(Tokens.Sha256(token), saved.Value.CustomerId, salt, hash);
        return Ok(new { ok = true });
    }

    [HttpGet("google/start")]
    public IActionResult GoogleStart([FromQuery] string? next)
    {
        var clientId = configuration["GOOGLE_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? "";
        var redirect = configuration["GOOGLE_REDIRECT_URI"] ?? Environment.GetEnvironmentVariable("GOOGLE_REDIRECT_URI") ?? "";
        var secret = configuration["GOOGLE_CLIENT_SECRET"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET") ?? "";
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(secret)) return StatusCode(501, new { error = "GOOGLE_NOT_CONFIGURED" });
        var safeNext = (!string.IsNullOrEmpty(next) && next.StartsWith("/") && !next.StartsWith("//") && next.Length <= 200) ? next : "/";
        var state = Tokens.RandomToken(16);
        db.CreateOAuthState(state, safeNext, DateTimeOffset.UtcNow.AddMinutes(10));
        var url = "https://accounts.google.com/o/oauth2/v2/auth?" + "client_id=" + Uri.EscapeDataString(clientId) + "&redirect_uri=" + Uri.EscapeDataString(redirect) + "&response_type=code&scope=" + Uri.EscapeDataString("openid email profile") + "&access_type=online&prompt=select_account&state=" + Uri.EscapeDataString(state);
        return Redirect(url);
    }

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? code, [FromQuery] string? state)
    {
        var frontend = (configuration["FRONTEND_URL"] ?? Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://127.0.0.1:5173").TrimEnd('/');
        IActionResult Fail(string msg) => Redirect(frontend + "/login?googleError=" + Uri.EscapeDataString(msg));
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state)) return Fail("GOOGLE_CANCELLED");
        var nextUrl = db.ConsumeOAuthState(state);
        if (nextUrl is null) return Fail("GOOGLE_STATE_EXPIRED");
        try
        {
            var clientId = configuration["GOOGLE_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? "";
            var secret = configuration["GOOGLE_CLIENT_SECRET"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_SECRET") ?? "";
            var redirect = configuration["GOOGLE_REDIRECT_URI"] ?? Environment.GetEnvironmentVariable("GOOGLE_REDIRECT_URI") ?? "";
            using var http = new HttpClient();
            var tokenRes = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string> { ["code"] = code, ["client_id"] = clientId, ["client_secret"] = secret, ["redirect_uri"] = redirect, ["grant_type"] = "authorization_code" }));
            var tokenJson = await tokenRes.Content.ReadAsStringAsync();
            if (!tokenRes.IsSuccessStatusCode) return Fail("GOOGLE_FAILED");
            var access = JsonDocument.Parse(tokenJson).RootElement.GetProperty("access_token").GetString() ?? "";
            var profileReq = new HttpRequestMessage(HttpMethod.Get, "https://openidconnect.googleapis.com/v1/userinfo");
            profileReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
            var profileRes = await http.SendAsync(profileReq);
            if (!profileRes.IsSuccessStatusCode) return Fail("GOOGLE_FAILED");
            var profile = JsonDocument.Parse(await profileRes.Content.ReadAsStringAsync()).RootElement;
            var email = (profile.TryGetProperty("email", out var em) ? em.GetString() ?? "" : "").ToLowerInvariant();
            var verified = profile.TryGetProperty("email_verified", out var ev) && ev.ValueKind == JsonValueKind.True;
            var sub = profile.TryGetProperty("sub", out var sb) ? sb.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(email) || !verified || string.IsNullOrWhiteSpace(sub)) return Fail("GOOGLE_EMAIL_UNVERIFIED");
            var rowBySub = db.FindCustomerByGoogleSub(sub);
            var rowByEmail = db.FindCustomer(email);
            long id;
            if (rowBySub is not null)
            {
                id = rowBySub.Value.Id;
                var full = db.FindCustomerFull(id);
                if (full is not null && string.IsNullOrEmpty(full.Value.GoogleSub)) db.LinkGoogleSub(id, sub);
            }
            else if (rowByEmail is not null)
            {
                id = rowByEmail.Value.Id;
                var full = db.FindCustomerFull(id);
                if (full is not null && string.IsNullOrEmpty(full.Value.GoogleSub)) db.LinkGoogleSub(id, sub);
            }
            else
            {
                var name = profile.TryGetProperty("name", out var nm) ? nm.GetString() ?? email : email;
                var (salt, hash) = Tokens.HashPassword(Tokens.RandomToken(16));
                try { id = db.CreateCustomer(name.Trim()[..Math.Min(60, name.Trim().Length)], email, salt, hash); }
                catch { id = db.CreateCustomer((name.Trim() + " " + Guid.NewGuid().ToString()[..4]).Trim(), email, salt, hash); }
                db.LinkGoogleSub(id, sub);
            }
            var auth = db.FindCustomerFull(id);
            if (auth is not null && auth.Value.TotpEnabled == 1 && !string.IsNullOrEmpty(auth.Value.TotpSecret))
            {
                var challenge = Guid.NewGuid().ToString();
                db.CreateLoginChallenge(challenge, id, DateTimeOffset.UtcNow.AddMinutes(5));
                return Redirect(frontend + "/login?challengeId=" + Uri.EscapeDataString(challenge) + "&twoFactor=1&next=" + Uri.EscapeDataString(nextUrl));
            }
            var raw = Tokens.RandomToken();
            db.CreateSession(Tokens.Sha256(raw), id, DateTimeOffset.UtcNow.AddDays(30));
            Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromDays(30), Path = "/" });
            return Redirect(frontend + nextUrl);
        }
        catch { return Fail("GOOGLE_FAILED"); }
    }

    [HttpGet("security")]
    public IActionResult Security()
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var full = db.FindCustomerFull(customer.Id);
        return Ok(new
        {
            twoFactorEnabled = full?.TotpEnabled == 1,
            googleLinked = full is not null && !string.IsNullOrEmpty(full.Value.GoogleSub),
            backupCodesLeft = db.BackupCodesLeft(customer.Id),
            google = new { configured = !string.IsNullOrWhiteSpace(configuration["GOOGLE_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") ?? "") }
        });
    }

    [HttpPost("2fa/setup")]
    public IActionResult Setup2fa()
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var full = db.FindCustomerFull(customer.Id);
        if (full?.TotpEnabled == 1) return Conflict(new { error = "TWO_FACTOR_ALREADY_ENABLED" });
        var secret = Totp.GenerateSecret();
        db.BeginTotpSetup(customer.Id, secret);
        var url = Totp.OtpauthUrl(secret, customer.Email);
        return Ok(new { otpauthUrl = url, qrImage = (string?)null, secretHint = secret[..4] + "…" + secret[^4..] });
    }

    [HttpPost("2fa/verify")]
    public IActionResult Verify2fa(TwoFactorCodeRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var code = (request.Code ?? "").Replace(" ", "");
        if (code.Length < 6 || code.Length > 8 || !code.All(char.IsDigit)) return BadRequest(new { error = "INVALID_2FA_CODE" });
        var full = db.FindCustomerFull(customer.Id);
        if (full is null || string.IsNullOrEmpty(full.Value.PendingSecret)) return BadRequest(new { error = "TWO_FACTOR_SETUP_REQUIRED" });
        if (!Totp.Verify(full.Value.PendingSecret, code)) return Unauthorized(new { error = "INVALID_2FA_CODE" });
        var codes = db.ConfirmTotpSetup(customer.Id, full.Value.PendingSecret);
        return Ok(new { enabled = true, backupCodes = codes });
    }

    [HttpPost("2fa/disable")]
    public IActionResult Disable2fa(TwoFactorDisableRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrEmpty(request.Password)) return BadRequest(new { error = "INVALID_CREDENTIALS" });
        var auth = db.FindCustomerAuth(customer.Username.ToLowerInvariant());
        if (auth is null || !Tokens.VerifyPassword(request.Password, auth.Value.Salt, auth.Value.Hash)) return Unauthorized(new { error = "INVALID_CREDENTIALS" });
        db.DisableTotp(customer.Id);
        return Ok(new { disabled = true });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var raw = Request.Cookies[Cookie];
        if (string.IsNullOrWhiteSpace(raw)) return Ok(new { ok = true });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        db.DeleteSession(Tokens.Sha256(raw)); Response.Cookies.Delete(Cookie); return Ok(new { ok = true });
    }

    [HttpGet("favorites")]
    // Chức năng Favorites: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Favorites() => RequireAccount(out var customer) ? Ok(new { ids = db.Favorites(customer.Id), favorites = db.Favorites(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    [HttpGet("orders")]
    // Đơn hàng: backend dotnet chưa full workflow nên trả danh sách rỗng để giữ phiên/avatar.
    public IActionResult Orders() => RequireAccount(out var customer) ? Ok(new { orders = db.Orders(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    [HttpPost("quote")]
    public IActionResult Quote(OrderQuoteRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        try
        {
            var q = ComputeQuote(customer, request);
            return Ok(new
            {
                items = q.Items.Select(i => new { id = i.Id, name = i.Name, quantity = i.Quantity, price = i.Price }).ToList(),
                subtotal = q.Subtotal,
                discount = q.Discount,
                goodsTotal = q.GoodsTotal,
                shippingFee = q.ShippingFee,
                shippingFeeBeforeDiscount = q.ShippingFeeBeforeDiscount,
                shippingDiscount = q.ShippingDiscount,
                total = q.Total,
                tier = q.Tier,
                voucherCodes = q.VoucherCodes,
                fulfillment = q.Fulfillment,
                region = q.Region,
                distanceKm = q.DistanceKm,
                weightKg = q.WeightKg
            });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpPost("orders")]
    public IActionResult CreateOrder(CreateOrderRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var recipient = (request.Recipient ?? "").Trim();
        var phone = (request.Phone ?? "").Trim();
        var address = (request.Address ?? "").Trim();
        if (recipient.Length < 2 || phone.Length < 8) return BadRequest(new { error = "INVALID_ORDER" });
        if (request.Fulfillment == "delivery" && address.Length < 5) return BadRequest(new { error = "INVALID_ORDER" });

        var quoteRequest = new OrderQuoteRequest(request.Items, request.Fulfillment, request.Region, request.DistanceKm, request.WeightKg, request.VoucherCodes);
        var q = ComputeQuote(customer, quoteRequest);
        if (request.ExpectedTotal > 0 && request.ExpectedTotal != q.Total) return Conflict(new { error = "QUOTE_CHANGED" });

        var orderId = "ST-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var method = request.PaymentMethod ?? (q.Fulfillment == "pickup" ? "cash" : "cod");
        var createdAt = DateTimeOffset.Now.ToString("dd/MM/yyyy HH:mm");
        var itemsJson = JsonSerializer.Serialize(q.Items.Select(i => new { id = i.Id, name = i.Name, quantity = i.Quantity, price = i.Price }));
        var voucherJson = JsonSerializer.Serialize(q.VoucherCodes);
        var pointsEarned = Math.Max(1, q.Total / 10000);

        db.CreateCustomerOrder(
            orderId, customer.Id, itemsJson, recipient, phone,
            q.Fulfillment == "pickup" ? "Nhận tại cửa hàng" : address,
            q.Fulfillment, q.Region, q.DistanceKm, q.WeightKg,
            q.Subtotal, q.Discount, q.GoodsTotal, q.ShippingFee, q.Total,
            voucherJson, q.Tier, method, request.ScheduledAt, createdAt, pointsEarned);

        if (q.VoucherCodes.Count > 0) db.ConsumeCustomerVouchers(customer.Id, q.VoucherCodes);
        db.AddCustomerPoints(customer.Id, pointsEarned);

        // Gửi hóa đơn điện tử về email của khách hàng
        var invoiceItems = q.Items.Select(i => new OrderInvoiceItem(i.Name, i.Quantity, i.Price, i.Price * i.Quantity)).ToList();
        var invoice = new OrderInvoiceData(
            orderId, customer.Email, recipient, phone,
            q.Fulfillment == "pickup" ? "Nhận tại cửa hàng" : address,
            q.Fulfillment, method, invoiceItems,
            q.Subtotal, q.Discount, q.ShippingFee, q.Total, q.Tier,
            createdAt, request.ScheduledAt);

        _ = Task.Run(async () =>
        {
            try { await emailService.SendOrderInvoiceEmailAsync(customer.Email, invoice); }
            catch (Exception ex) { Console.WriteLine($"[Store Mailer] Invoice mail exception: {ex.Message}"); }
        });

        var createdOrder = db.FindCustomerOrder(orderId, customer.Id);
        return StatusCode(StatusCodes.Status201Created, new { order = createdOrder });
    }
    [HttpGet("orders/{id}/receipt")]
    public IActionResult OrderReceipt(string id)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });
        return Ok(new
        {
            order,
            afterSales = Array.Empty<object>(),
            events = Array.Empty<object>(),
            store = new { name = "Store Mini Mart", address = "TP. Hồ Chí Minh", demo = true }
        });
    }

    [HttpGet("orders/{id}/payment-info")]
    public IActionResult OrderPaymentInfo(string id)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });
        var json = JsonSerializer.Serialize(order);
        var doc = JsonDocument.Parse(json);
        var total = doc.RootElement.GetProperty("total").GetInt32();
        var status = doc.RootElement.GetProperty("status").GetString();
        var payment = new
        {
            amount = total,
            reference = id,
            bankName = "MB Bank",
            accountNumber = "0912345678",
            accountName = "STORE MINI MART",
            purpose = "Thanh toan don hang " + id,
            mode = "demo",
            qrImage = $"https://img.vietqr.io/image/970422-0912345678-compact2.png?amount={total}&addInfo={id}&accountName=STORE%20MINI%20MART"
        };
        return Ok(new { order, payment, orderId = id, amount = total, currency = "VND", status });
    }

    [HttpPost("orders/{id}/demo-paid")]
    [HttpPost("orders/{id}/simulate-pay")]
    public IActionResult SimulatePay(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });
        db.UpdateOrderStatus(id, "paid", DateTimeOffset.UtcNow.ToString("o"));
        return Ok(new { success = true, orderId = id, status = "paid" });
    }

    [HttpPost("orders/{id}/cancel-unpaid")]
    public IActionResult CancelUnpaid(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });
        db.UpdateOrderStatus(id, "cancelled");
        return Ok(new { success = true, orderId = id, status = "cancelled" });
    }


    [HttpPut("favorites/{id}")]
    public IActionResult SetFavorite(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        db.SetFavorite(customer.Id, id, true); return Ok(new { saved = true, favorite = true });
    }

    [HttpDelete("favorites/{id}")]
    public IActionResult DeleteFavorite(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" }); db.SetFavorite(customer.Id, id, false); return Ok(new { ok = true });
    }

    [HttpGet("vouchers")]
    // Chức năng Vouchers: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Vouchers() => RequireAccount(out var customer) ? Ok(new { vouchers = db.Vouchers(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    private IActionResult LoginInternal(string username, long id)
    {
        var raw = Tokens.RandomToken(); var expires = DateTimeOffset.UtcNow.AddDays(30); db.CreateSession(Tokens.Sha256(raw), id, expires);
        Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromDays(30), Path = "/" });
        var customer = db.FindCustomer(username)!; var csrf = Tokens.Sha256("customer-csrf:" + raw);
        var full = db.FindCustomerFull(id);
        return Ok(new { account = AccountEx((customer.Value.Id, customer.Value.Username, customer.Value.Email, customer.Value.Points, customer.Value.SpinCredits), full?.GoogleSub ?? "", full?.TotpEnabled ?? 0, csrf) });
    }

    private (long Id, string Username, string Email, int Points, int SpinCredits)? Current()
    {
        var raw = Request.Cookies[Cookie]; return string.IsNullOrWhiteSpace(raw) ? null : db.FindCustomerBySession(Tokens.Sha256(raw));
    }

    // Chức năng CsrfValid: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    private bool CsrfValid(string raw) => Request.Headers.TryGetValue("x-csrf-token", out var value) && value == Tokens.Sha256("customer-csrf:" + raw);
    private bool RequireAccount(out (long Id, string Username, string Email, int Points, int SpinCredits) customer)
    {
        var current = Current(); customer = current ?? default; return current is not null;
    }
    private bool RequireAccount(out (long Id, string Username, string Email, int Points, int SpinCredits) customer, out string raw)
    {
        raw = Request.Cookies[Cookie] ?? string.Empty; var current = Current(); customer = current ?? default; return current is not null && raw.Length > 0;
    }
    // Chức năng Tier: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    private static string Tier(int points) => points >= 10000 ? "diamond" : points >= 1000 ? "gold" : points >= 100 ? "silver" : "bronze";
    // Chức năng Account: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    private static object Account((long Id, string Username, string Email, int Points, int SpinCredits) c, string csrf) => new { id = c.Id, username = c.Username, email = c.Email, points = c.Points, tier = Tier(c.Points), spinCredits = c.SpinCredits, csrfToken = csrf };
    private static object AccountEx((long Id, string Username, string Email, int Points, int SpinCredits) c, string googleSub, int totpEnabled, string csrf)
    {
        var methods = new List<string> { "password" };
        if (!string.IsNullOrEmpty(googleSub)) methods.Add("google");
        if (totpEnabled == 1) methods.Add("totp");
        return new { id = c.Id, username = c.Username, email = c.Email, points = c.Points, tier = Tier(c.Points), spinCredits = c.SpinCredits, csrfToken = csrf, googleLinked = !string.IsNullOrEmpty(googleSub), twoFactorEnabled = totpEnabled == 1, authMethods = methods.ToArray() };
    }
    private record QuoteItemResult(string Id, string Name, int Quantity, long Price);
    private record QuoteComputation(
        List<QuoteItemResult> Items,
        int Subtotal,
        int Discount,
        int GoodsTotal,
        int ShippingFee,
        int ShippingFeeBeforeDiscount,
        int ShippingDiscount,
        int Total,
        string Tier,
        List<string> VoucherCodes,
        string Fulfillment,
        string Region,
        int DistanceKm,
        double WeightKg);

    private QuoteComputation ComputeQuote((long Id, string Username, string Email, int Points, int SpinCredits) customer, OrderQuoteRequest req)
    {
        var fulfillment = req.Fulfillment == "pickup" ? "pickup" : "delivery";
        var region = fulfillment == "pickup" ? "pickup" : (req.Region ?? "hcm");
        var distanceKm = req.DistanceKm;
        var weightKg = req.WeightKg > 0 ? req.WeightKg : 1.0;
        var catalog = db.Catalog();
        var catalogMap = catalog.ToDictionary(p => p.Id, p => p);

        var items = new List<QuoteItemResult>();
        foreach (var line in req.Items ?? [])
        {
            if (string.IsNullOrEmpty(line.Id) || !catalogMap.TryGetValue(line.Id, out var prod) || line.Quantity < 1) continue;
            var price = (long)Math.Round(prod.Price * (100 - prod.DiscountPercent) / 1000.0) * 10;
            items.Add(new QuoteItemResult(prod.Id, prod.Name, line.Quantity, price));
        }

        var subtotal = (int)items.Sum(i => i.Price * i.Quantity);
        var tier = Tier(customer.Points);
        var voucherCodes = req.VoucherCodes ?? [];

        var customerVouchers = db.Vouchers(customer.Id);
        var validVouchers = new Dictionary<string, (string Type, int Value, string Scope)>();
        foreach (var v in customerVouchers)
        {
            var json = JsonSerializer.Serialize(v);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var code = root.GetProperty("code").GetString() ?? "";
            var type = root.GetProperty("type").GetString() ?? "amount";
            var val = root.GetProperty("value").GetInt32();
            var scope = root.GetProperty("scope").GetString() ?? "goods";
            validVouchers[code] = (type, val, scope);
        }

        int remainingGoods = subtotal;
        var appliedCodes = new List<string>();
        var shippingVouchers = new List<(string Type, int Value)>();

        foreach (var code in voucherCodes)
        {
            if (!validVouchers.TryGetValue(code, out var v)) continue;
            appliedCodes.Add(code);
            if (v.Scope == "shipping")
            {
                shippingVouchers.Add((v.Type, v.Value));
            }
            else
            {
                var discountAmount = v.Type == "percent" ? (int)(remainingGoods * v.Value / 100) : v.Value;
                remainingGoods = Math.Max(0, remainingGoods - discountAmount);
            }
        }

        int tierRate = tier switch { "diamond" => 5, "gold" => 2, "silver" => 1, _ => 0 };
        if (tierRate > 0)
        {
            int tierDiscount = (int)(remainingGoods * tierRate / 100);
            remainingGoods = Math.Max(0, remainingGoods - tierDiscount);
        }

        int originalShippingFee = CalculateShippingFee(fulfillment, region, weightKg, distanceKm);
        int finalShippingFee = originalShippingFee;
        foreach (var sv in shippingVouchers)
        {
            int shipDiscount = sv.Type == "percent" ? (int)(finalShippingFee * sv.Value / 100) : sv.Value;
            finalShippingFee = Math.Max(0, finalShippingFee - shipDiscount);
        }

        int totalDiscount = (subtotal - remainingGoods) + (originalShippingFee - finalShippingFee);
        int total = remainingGoods + finalShippingFee;

        return new QuoteComputation(
            items, subtotal, totalDiscount, remainingGoods, finalShippingFee,
            originalShippingFee, originalShippingFee - finalShippingFee, total,
            tier, appliedCodes, fulfillment, region, distanceKm, weightKg);
    }

    private static int CalculateShippingFee(string fulfillment, string region, double weightKg, int distanceKm)
    {
        if (fulfillment == "pickup") return 0;
        var w = weightKg > 0 ? weightKg : 1.0;
        if (region == "international") return w <= 1.0 ? 200000 : (int)Math.Ceiling(w / 5.0) * 400000;
        if (region == "hcm" || region == "binh-duong" || region == "ba-ria-vung-tau") return 30000;
        if (region == "nearby" || (region != null && region.StartsWith("province:"))) return 60000;
        if (region == "far") return 60000 + distanceKm * 1000;
        return 60000;
    }

}
