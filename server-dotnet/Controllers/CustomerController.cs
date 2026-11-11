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
public sealed partial class CustomerController(StoreDb db, IConfiguration configuration, EmailService emailService) : ControllerBase
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
        if (string.IsNullOrWhiteSpace(request.Username) || request.Username.Trim().Length is < 3 or > 100
            || !System.Net.Mail.MailAddress.TryCreate(request.Email, out var address) || address.Address != request.Email.Trim()
            || request.Email.Length > 254 || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length is < 8 or > 128)
            return BadRequest(new { error = "INVALID_CUSTOMER" });
        if (db.FindCustomer(request.Username) is not null || db.FindCustomer(request.Email) is not null) return Conflict(new { error = "CUSTOMER_EXISTS" });
        var (salt, hash) = Tokens.HashPassword(request.Password);
        try
        {
            var id = db.CreateCustomer(request.Username.Trim(), request.Email.Trim(), salt, hash);
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
        var email = found.Value.Email;
        var username = found.Value.Username;
        var res = LoginInternal(username, found.Value.Id);
        SendLoginNotificationAsync(email, username, "Mật khẩu");
        return res;
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
        var email = full.Value.Email;
        var username = full.Value.Username;
        var res = LoginInternal(username, full.Value.Id);
        SendLoginNotificationAsync(email, username, "Xác thực 2 bước (2FA)");
        return res;
    }

    [HttpGet("auth/status")]
    public IActionResult AuthStatus()
    {
        var googleId = GetConfig("GOOGLE_CLIENT_ID");
        var googleSecret = GetConfig("GOOGLE_CLIENT_SECRET");
        var smtpHost = GetConfig("SMTP_HOST");
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
            db.QueuePasswordReset(found.Value.Id, found.Value.Username, email, raw);
        }
        return Ok(new { ok = true });
    }

    [HttpPost("password/reset")]
    public IActionResult Reset(PasswordResetRequest request)
    {
        var token = (request.Token ?? "").Trim();
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200 || string.IsNullOrEmpty(request.Password) || request.Password.Length < 8 || request.Password.Length > 128)
            return BadRequest(new { error = "INVALID_RESET" });
        var saved = db.FindPasswordReset(Tokens.Sha256(token));
        if (saved is null || saved.Value.UsedAt is not null || string.Compare(saved.Value.ExpiresAt, DateTimeOffset.UtcNow.ToString("o"), StringComparison.Ordinal) <= 0)
            return BadRequest(new { error = "RESET_EXPIRED" });
        var (salt, hash) = Tokens.HashPassword(request.Password);
        if (!db.ConsumePasswordReset(Tokens.Sha256(token), saved.Value.CustomerId, salt, hash)) return BadRequest(new { error = "RESET_EXPIRED" });
        return Ok(new { ok = true });
    }

    [HttpGet("google/start")]
    public IActionResult GoogleStart([FromQuery] string? next)
    {
        var clientId = GetConfig("GOOGLE_CLIENT_ID");
        var redirect = GetConfig("GOOGLE_REDIRECT_URI", "http://127.0.0.1:5000/api/customer/google/callback");
        var secret = GetConfig("GOOGLE_CLIENT_SECRET");
        if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(secret)) return StatusCode(501, new { error = "GOOGLE_NOT_CONFIGURED" });
        var safeNext = (!string.IsNullOrEmpty(next) && next.StartsWith("/") && !next.StartsWith("//") && next.Length <= 200) ? next : "/";
        var state = Tokens.RandomToken(16);
        db.CreateOAuthState(state, safeNext, DateTimeOffset.UtcNow.AddMinutes(10));
        var url = "https://accounts.google.com/o/oauth2/v2/auth?" + "client_id=" + Uri.EscapeDataString(clientId) + "&redirect_uri=" + Uri.EscapeDataString(redirect) + "&response_type=code&scope=" + Uri.EscapeDataString("openid email profile") + "&access_type=online&prompt=select_account&state=" + Uri.EscapeDataString(state);
        return Redirect(url);
    }

    [HttpGet("google/callback")]
    public async Task<IActionResult> GoogleCallback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error)
    {
        var frontend = GetConfig("FRONTEND_URL", "http://127.0.0.1:5173").TrimEnd('/');
        IActionResult Fail(string msg) => Redirect(frontend + "/login?googleError=" + Uri.EscapeDataString(msg));
        if (!string.IsNullOrWhiteSpace(error))
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine($"[Google OAuth] Callback nhận lỗi từ Google: {error}. (Nếu là 'access_denied', hãy đảm bảo email đã được thêm vào Test users trong Google Cloud Console).");
            Console.ResetColor();
            return Fail(error);
        }
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state)) return Fail("GOOGLE_CANCELLED");
        var nextUrl = db.ConsumeOAuthState(state);
        if (nextUrl is null) return Fail("GOOGLE_STATE_EXPIRED");
        try
        {
            var clientId = GetConfig("GOOGLE_CLIENT_ID");
            var secret = GetConfig("GOOGLE_CLIENT_SECRET");
            var redirect = GetConfig("GOOGLE_REDIRECT_URI", "http://127.0.0.1:5000/api/customer/google/callback");
            using var http = new HttpClient();
            var tokenRes = await http.PostAsync("https://oauth2.googleapis.com/token", new FormUrlEncodedContent(new Dictionary<string, string> { ["code"] = code, ["client_id"] = clientId, ["client_secret"] = secret, ["redirect_uri"] = redirect, ["grant_type"] = "authorization_code" }));
            var tokenJson = await tokenRes.Content.ReadAsStringAsync();
            if (!tokenRes.IsSuccessStatusCode)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[Google OAuth Token Error] Status: {tokenRes.StatusCode}, Response: {tokenJson}");
                Console.ResetColor();
                return Fail("GOOGLE_FAILED");
            }
            var access = JsonDocument.Parse(tokenJson).RootElement.GetProperty("access_token").GetString() ?? "";
            var profileReq = new HttpRequestMessage(HttpMethod.Get, "https://openidconnect.googleapis.com/v1/userinfo");
            profileReq.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", access);
            var profileRes = await http.SendAsync(profileReq);
            if (!profileRes.IsSuccessStatusCode)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"[Google OAuth Profile Error] Status: {profileRes.StatusCode}");
                Console.ResetColor();
                return Fail("GOOGLE_FAILED");
            }
            var profile = JsonDocument.Parse(await profileRes.Content.ReadAsStringAsync()).RootElement;
            var email = (profile.TryGetProperty("email", out var em) ? em.GetString() ?? "" : "").ToLowerInvariant();
            var verified = profile.TryGetProperty("email_verified", out var ev) && ev.ValueKind == JsonValueKind.True;
            var sub = profile.TryGetProperty("sub", out var sb) ? sb.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(email) || !verified || string.IsNullOrWhiteSpace(sub)) return Fail("GOOGLE_EMAIL_UNVERIFIED");
            var rowBySub = db.FindCustomerByGoogleSub(sub);
            var rowByEmail = db.FindCustomer(email);
            long id;
            var createdByGoogle = false;
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
                var name = profile.TryGetProperty("name", out var nm) ? (nm.GetString() ?? "").Trim() : "";
                if (string.IsNullOrWhiteSpace(name)) name = email.Split('@')[0];
                var (salt, hash) = Tokens.HashPassword(Tokens.RandomToken(16));
                try { id = db.CreateCustomer(name[..Math.Min(60, name.Length)], email, salt, hash); }
                catch { id = db.CreateCustomer((name[..Math.Min(50, name.Length)] + " " + Guid.NewGuid().ToString()[..4]).Trim(), email, salt, hash); }
                db.LinkGoogleSub(id, sub);
                createdByGoogle = true;
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
            Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, MaxAge = TimeSpan.FromDays(30), Path = "/" });
            
            var recipientName = !string.IsNullOrWhiteSpace(auth?.Username) ? auth.Value.Username : email;
            if (!createdByGoogle)
            {
                SendLoginNotificationAsync(email, recipientName, "Google OAuth");
            }
            
            return Redirect(frontend + nextUrl);
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[Google OAuth Callback Exception] {ex.GetType().Name}: {ex.Message}");
            Console.ResetColor();
            return Fail("GOOGLE_FAILED");
        }
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
            google = new { configured = !string.IsNullOrWhiteSpace(GetConfig("GOOGLE_CLIENT_ID")) }
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
        return Ok(new { otpauthUrl = url, secret, qrImage = (string?)null, secretHint = secret[..4] + "…" + secret[^4..] });
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

    [HttpGet("logout")]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var raw = Request.Cookies[Cookie];
        if (!string.IsNullOrWhiteSpace(raw))
        {
            db.DeleteSession(Tokens.Sha256(raw));
        }

        Response.Cookies.Delete(Cookie, new CookieOptions
        {
            Path = "/",
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps,
            HttpOnly = true
        });
        Response.Cookies.Delete(Cookie, new CookieOptions
        {
            Path = "/",
            SameSite = SameSiteMode.Strict,
            Secure = Request.IsHttps,
            HttpOnly = true
        });
        Response.Cookies.Delete(Cookie);

        return Ok(new { ok = true, loggedOut = true });
    }

    [HttpGet("favorites")]
    // Chức năng Favorites: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Favorites() => RequireAccount(out var customer) ? Ok(new { ids = db.Favorites(customer.Id), favorites = db.Favorites(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    [HttpGet("orders")]
    // Lịch sử mua chỉ hiển thị đơn đã ghi nhận tiền; phiên chờ có endpoint riêng.
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
        catch (CatalogOutOfSyncException ex)
        {
            return Conflict(new { error = "CATALOG_OUT_OF_SYNC", missingIds = ex.MissingIds });
        }
        catch (Exception ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("orders/{id}/receipt")]
    [HttpGet("orders/{id}/receipt.html")]
    public IActionResult OrderReceipt(string id)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });

        if (Request.Path.Value?.EndsWith(".html") == true || Request.Query["format"] == "html")
        {
            return Content(OrderReceiptHtml.Render(order), "text/html; charset=utf-8");
        }

        return Ok(new
        {
            order,
            afterSales = ListCustomerAfterSales(customer.Id, id),
            events = Array.Empty<object>(),
            store = new { name = "Store Mini Mart", address = "TP. Hồ Chí Minh", demo = false }
        });
    }

    [HttpPost("orders/{id}/after-sales")]
    public IActionResult CreateAfterSales(string id, AfterSalesCreateRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var order = db.FindCustomerOrder(id, customer.Id);
        if (order is null) return NotFound(new { error = "ORDER_NOT_FOUND" });
        var kind = (request.Kind ?? "").Trim().ToLowerInvariant();
        if (kind is not ("cancel" or "return" or "reschedule" or "merchant_fault") || string.IsNullOrWhiteSpace(request.Reason)) return BadRequest(new { error = "INVALID_AFTER_SALES" });
        var orderJson = JsonSerializer.Serialize(order);
        using var orderDocument = JsonDocument.Parse(orderJson);
        var root = orderDocument.RootElement;
        if (root.GetProperty("status").GetString() is not ("paid" or "completed")) return Conflict(new { error = "PAYMENT_REQUIRED" });
        var delivery = root.GetProperty("deliveryStatus").GetString();
        if (kind == "cancel" && delivery is "shipped" or "delivered") return Conflict(new { error = "ALREADY_SHIPPED" });
        if (kind is "return" or "merchant_fault" && delivery != "delivered") return Conflict(new { error = "DELIVERY_REQUIRED" });
        var quote = BuildAfterSalesQuote(root, kind);
        var caseId = "AS-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var data = new Dictionary<string, object?>
        {
            ["id"] = caseId,
            ["customerId"] = customer.Id,
            ["orderId"] = id,
            ["kind"] = kind,
            ["reason"] = request.Reason.Trim(),
            ["scheduledAt"] = request.ScheduledAt,
            ["status"] = "awaiting_confirmation",
            ["quote"] = quote,
            ["feePaidAt"] = null,
            ["refundReference"] = null,
            ["note"] = "",
            ["compensation"] = Array.Empty<object>()
        };
        var record = db.CreateAdminRecord("after-sales", "#" + caseId + " · " + id, "Chờ khách xác nhận phí", JsonSerializer.Serialize(data));
        return StatusCode(StatusCodes.Status201Created, new { request = record });
    }

    [HttpGet("after-sales/{id}/payment")]
    public IActionResult AfterSalesPayment(string id)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        var record = FindCustomerAfterSales(id, customer.Id);
        if (record is null) return NotFound(new { error = "AFTER_SALES_NOT_FOUND" });
        try
        {
            var window = db.AfterSalesPaymentWindow(record.Id, customer.Id);
            var canPay = window.Bank is not null && window.ExpiresAt > DateTimeOffset.UtcNow && !window.Reported;
            object? payment = window.Bank is null ? new { mode = "counter", amount = window.Amount, reference = id }
                : canPay ? BankPayment.Info(window.Bank, id, window.Amount) : null;
            return Ok(new { orderId = id, amount = window.Amount, window.ExpiresAt, canPay, status = window.Reported ? "reported" : canPay ? "pending" : "expired", serverTime = DateTimeOffset.UtcNow, payment });
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("after-sales/{id}/action")]
    public IActionResult AfterSalesAction(string id, AfterSalesActionRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var record = FindCustomerAfterSales(id, customer.Id);
        if (record is null) return NotFound(new { error = "AFTER_SALES_NOT_FOUND" });
        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        var currentStatus = ReadString(record.Data, "status") ?? "awaiting_confirmation";
        var allowed = action == "confirm" && currentStatus == "awaiting_confirmation"
            || action == "cancel" && (currentStatus is "awaiting_confirmation" or "pending" or "awaiting_payment")
                && string.IsNullOrEmpty(ReadString(record.Data, "feePaidAt")) && string.IsNullOrEmpty(ReadString(record.Data, "feeReportedAt"))
            || action == "payment_report" && currentStatus == "awaiting_payment";
        if (!allowed) return Conflict(new { error = "ACTION_NOT_ALLOWED" });
        if (action == "payment_report" && (request.Reference?.Trim().Length is null or < 3 or > 100))
            return BadRequest(new { error = "PAYMENT_REFERENCE_REQUIRED" });
        var status = action == "confirm" ? "pending" : action == "cancel" ? "cancelled" : "awaiting_payment";
        record.Data["status"] = status;
        if (action == "payment_report")
        {
            record.Data["feeReportedAt"] = DateTimeOffset.UtcNow.ToString("O");
            record.Data["feePaymentReportedReference"] = request.Reference!.Trim();
        }
        db.UpdateAdminRecord(record.Id, "after-sales", record.Title, StatusLabel(status), JsonSerializer.Serialize(record.Data));
        return Ok(new { success = true, id, status });
    }

    [HttpPost("spin")]
    public IActionResult Spin(CustomerSpinRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var currentCredits = customer.SpinCredits;
        if (currentCredits < 1)
        {
            return BadRequest(new { error = "NO_SPIN_CREDITS" });
        }

        var wheel = (request.Wheel ?? "goods").Trim().ToLowerInvariant();
        if (wheel != "goods" && wheel != "shipping") wheel = "goods";

        var remainingCredits = db.DeductSpinCredit(customer.Id);
        var rnd = Random.Shared.Next(0, 10);
        object? voucher = null;

        if (wheel == "goods")
        {
            if (rnd == 2 || rnd == 6 || rnd == 8)
            {
                var code = "LUCKY100K-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
                var exp = DateTimeOffset.UtcNow.AddDays(14).ToString("yyyy-MM-dd");
                voucher = db.CreateAdminVoucher(code, customer.Id, "Voucher may mắn 100K", "amount", 100000, "goods", exp, "spin");
            }
            else if (rnd == 4)
            {
                var code = "LUCKY20-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
                var exp = DateTimeOffset.UtcNow.AddDays(14).ToString("yyyy-MM-dd");
                voucher = db.CreateAdminVoucher(code, customer.Id, "Voucher may mắn 20%", "percent", 20, "goods", exp, "spin");
            }
        }
        else
        {
            if (rnd == 2 || rnd == 6 || rnd == 8)
            {
                var code = "SHIP50-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
                var exp = DateTimeOffset.UtcNow.AddDays(14).ToString("yyyy-MM-dd");
                voucher = db.CreateAdminVoucher(code, customer.Id, "Giảm 50% phí ship", "percent", 50, "shipping", exp, "spin");
            }
            else if (rnd == 4)
            {
                var code = "FREESHIP-" + Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
                var exp = DateTimeOffset.UtcNow.AddDays(14).ToString("yyyy-MM-dd");
                voucher = db.CreateAdminVoucher(code, customer.Id, "Miễn phí vận chuyển", "percent", 100, "shipping", exp, "spin");
            }
        }

        return Ok(new
        {
            wheel,
            spinCredits = remainingCredits,
            index = rnd,
            voucher
        });
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

    [HttpGet("vouchers/{code}")]
    public IActionResult CheckVoucher(string code)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        code = VoucherPolicy.NormalizeCode(code);
        foreach (var voucher in db.Vouchers(customer.Id))
        {
            var item = JsonSerializer.SerializeToElement(voucher);
            if (string.Equals(item.GetProperty("code").GetString(), code, StringComparison.OrdinalIgnoreCase))
                return Ok(new { voucher });
        }
        return NotFound(new { error = "INVALID_VOUCHER" });
    }

    [HttpGet("vouchers")]
    // Chức năng Vouchers: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Vouchers() => RequireAccount(out var customer) ? Ok(new { vouchers = db.Vouchers(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    private IActionResult LoginInternal(string username, long id)
    {
        var raw = Tokens.RandomToken(); var expires = DateTimeOffset.UtcNow.AddDays(30); db.CreateSession(Tokens.Sha256(raw), id, expires);
        Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Lax, MaxAge = TimeSpan.FromDays(30), Path = "/" });
        var customer = db.FindCustomer(username)!; var csrf = Tokens.Sha256("customer-csrf:" + raw);
        var full = db.FindCustomerFull(id);
        return Ok(new { account = AccountEx((customer.Value.Id, customer.Value.Username, customer.Value.Email, customer.Value.Points, customer.Value.SpinCredits), full?.GoogleSub ?? "", full?.TotpEnabled ?? 0, csrf) });
    }

    private void SendLoginNotificationAsync(string email, string username, string method)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        _ = Task.Run(async () =>
        {
            try
            {
                await emailService.SendLoginNotificationEmailAsync(email, username, method);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"[Store Mailer] Lỗi gửi thông báo đăng nhập ({method}) tới {email}: {ex.Message}");
                Console.ResetColor();
            }
        });
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

    private sealed class CatalogOutOfSyncException(IReadOnlyList<string> missingIds) : Exception
    {
        public IReadOnlyList<string> MissingIds { get; } = missingIds;
    }

    private QuoteComputation ComputeQuote((long Id, string Username, string Email, int Points, int SpinCredits) customer, OrderQuoteRequest req)
    {
        if (req.Items is null || req.Items.Count is < 1 or > 100 || req.Items.Any(item => string.IsNullOrWhiteSpace(item.Id) || item.Quantity is < 1 or > 999)
            || req.Items.Select(item => item.Id).Distinct().Count() != req.Items.Count) throw new InvalidOperationException("INVALID_ORDER");
        if (req.Fulfillment is not ("pickup" or "delivery") || !double.IsFinite(req.WeightKg) || req.WeightKg is <= 0 or > 1000 || req.DistanceKm is < 0 or > 3000)
            throw new InvalidOperationException("INVALID_DELIVERY_REGION");
        var fulfillment = req.Fulfillment == "pickup" ? "pickup" : "delivery";
        var region = fulfillment == "pickup" ? "pickup" : (req.Region ?? "hcm");
        var distanceKm = req.DistanceKm;
        var weightKg = req.WeightKg > 0 ? req.WeightKg : 1.0;
        var catalog = db.Catalog();
        var catalogMap = catalog.ToDictionary(p => p.Id, p => p);

        var missingIds = (req.Items ?? [])
            .Where(line => !string.IsNullOrWhiteSpace(line.Id) && !catalogMap.ContainsKey(line.Id))
            .Select(line => line.Id!.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (missingIds.Length > 0) throw new CatalogOutOfSyncException(missingIds);

        var items = new List<QuoteItemResult>();
        foreach (var line in req.Items ?? [])
        {
            if (string.IsNullOrEmpty(line.Id) || !catalogMap.TryGetValue(line.Id, out var prod) || line.Quantity < 1) continue;
            if (line.Quantity > prod.StockCount) throw new InvalidOperationException("PRODUCT_UNAVAILABLE");
            if (prod.Price > int.MaxValue) throw new InvalidOperationException("ORDER_TOTAL_TOO_LARGE");
            var price = (long)decimal.Round((decimal)prod.Price * (100 - prod.DiscountPercent) / 1000M, 0, MidpointRounding.ToEven) * 10;
            items.Add(new QuoteItemResult(prod.Id, prod.Name, line.Quantity, price));
        }

        var sum = items.Sum(item => item.Price * item.Quantity);
        if (sum > int.MaxValue - 100000000 || sum < 0) throw new InvalidOperationException("ORDER_TOTAL_TOO_LARGE");
        var subtotal = (int)sum;
        var tier = Tier(customer.Points);
        var voucherCodes = (req.VoucherCodes ?? []).Select(VoucherPolicy.NormalizeCode).ToList();
        if (voucherCodes.Any(string.IsNullOrEmpty) || voucherCodes.Count != voucherCodes.Distinct().Count())
            throw new InvalidOperationException("DUPLICATE_VOUCHER");

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
            validVouchers[code.Trim().ToUpperInvariant()] = (type, val, scope);
        }

        int remainingGoods = subtotal;
        var appliedCodes = new List<string>();
        var shippingVouchers = new List<(string Type, int Value)>();
        var usedScopes = new HashSet<string>();

        foreach (var code in voucherCodes)
        {
            if (!validVouchers.TryGetValue(code.Trim().ToUpperInvariant(), out var v))
            {
                throw new InvalidOperationException("INVALID_VOUCHER");
            }
            if (!usedScopes.Add(v.Scope)) throw new InvalidOperationException("VOUCHER_SCOPE_LIMIT");
            appliedCodes.Add(code);
            if (v.Scope == "shipping")
            {
                shippingVouchers.Add((v.Type, v.Value));
            }
            else
            {
                var discountAmount = v.Type == "percent" ? (int)((long)remainingGoods * v.Value / 100) : v.Value;
                remainingGoods = Math.Max(0, remainingGoods - discountAmount);
            }
        }

        int tierRate = tier switch { "diamond" => 5, "gold" => 2, "silver" => 1, _ => 0 };
        if (tierRate > 0)
        {
            int tierDiscount = (int)((long)remainingGoods * tierRate / 100);
            remainingGoods = Math.Max(0, remainingGoods - tierDiscount);
        }

        int originalShippingFee = CalculateShippingFee(fulfillment, region, weightKg, distanceKm);
        int finalShippingFee = originalShippingFee;
        foreach (var sv in shippingVouchers)
        {
            int shipDiscount = sv.Type == "percent" ? (int)((long)finalShippingFee * sv.Value / 100) : sv.Value;
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

    private IReadOnlyList<object> ListCustomerAfterSales(long customerId, string orderId)
    {
        return db.ListAdminRecords("after-sales")
            .Select(item => ParseAfterSalesRecord(item))
            .Where(item => item is not null && ReadLong(item!.Data, "customerId") == customerId && string.Equals(ReadString(item.Data, "orderId"), orderId, StringComparison.OrdinalIgnoreCase))
            .Select(item => MapAfterSales(item!))
            .ToArray();
    }

    private AfterSalesRecord? FindCustomerAfterSales(string id, long customerId)
    {
        return db.ListAdminRecords("after-sales")
            .Select(item => ParseAfterSalesRecord(item))
            .FirstOrDefault(item => item is not null && ReadLong(item.Data, "customerId") == customerId && string.Equals(ReadString(item.Data, "id"), id, StringComparison.OrdinalIgnoreCase));
    }

    private static object MapAfterSales(AfterSalesRecord record)
    {
        return new
        {
            id = ReadString(record.Data, "id") ?? record.Id.ToString(),
            orderId = ReadString(record.Data, "orderId"),
            kind = ReadString(record.Data, "kind"),
            reason = ReadString(record.Data, "reason"),
            scheduledAt = ReadString(record.Data, "scheduledAt"),
            status = ReadString(record.Data, "status") ?? record.Status,
            quote = GetObject(record.Data, "quote"),
            feePaidAt = ReadString(record.Data, "feePaidAt"),
            refundReference = ReadString(record.Data, "refundReference"),
            note = ReadString(record.Data, "note"),
            compensation = GetObject(record.Data, "compensation") ?? Array.Empty<object>()
        };
    }

    private static AfterSalesRecord? ParseAfterSalesRecord(object value)
    {
        try
        {
            using var doc = JsonDocument.Parse(JsonSerializer.Serialize(value));
            var root = doc.RootElement;
            var id = root.GetProperty("id").GetInt32();
            var title = root.GetProperty("title").GetString() ?? "";
            var status = root.GetProperty("status").GetString() ?? "";
            var data = JsonSerializer.Deserialize<Dictionary<string, object?>>(root.GetProperty("data").GetRawText()) ?? [];
            return new AfterSalesRecord(id, title, status, data);
        }
        catch { return null; }
    }

    private static object BuildAfterSalesQuote(JsonElement order, string kind)
    {
        var total = Number(order, "total");
        var goods = Number(order, "goodsTotal");
        var shipping = Number(order, "shippingFee");
        var fee = kind == "cancel" ? Math.Max(1000, goods / 100) : 0;
        var refund = kind == "merchant_fault" ? total : kind == "return" ? Math.Max(0, total - shipping) : kind == "cancel" ? Math.Max(0, total - fee) : 0;
        var breakdown = new List<object>();
        if (kind == "cancel") breakdown.Add(new { label = "Phí hủy trước giao (1%)", amount = fee });
        if (kind == "return") breakdown.Add(new { label = "Phí gửi trả dự kiến", amount = shipping });
        if (kind == "merchant_fault") breakdown.Add(new { label = "Miễn phí do lỗi cửa hàng", amount = 0 });
        if (kind == "reschedule") breakdown.Add(new { label = "Phí đổi lịch", amount = 0 });
        return new { feeAmount = fee, refundAmount = refund, additionalDue = fee, breakdown };
    }

    private static int Number(JsonElement root, string property)
    {
        return root.TryGetProperty(property, out var value) && value.TryGetInt32(out var number) ? number : 0;
    }

    private static string? ReadString(Dictionary<string, object?> data, string key)
    {
        return data.TryGetValue(key, out var value) ? value switch
        {
            JsonElement element when element.ValueKind == JsonValueKind.String => element.GetString(),
            null => null,
            _ => Convert.ToString(value)
        } : null;
    }

    private static long ReadLong(Dictionary<string, object?> data, string key)
    {
        return long.TryParse(ReadString(data, key), out var value) ? value : 0;
    }

    private static int ReadInt(Dictionary<string, object?> data, string parent, string key)
    {
        if (!data.TryGetValue(parent, out var value)) return 0;
        var raw = value is JsonElement element ? element : JsonSerializer.SerializeToElement(value);
        return raw.ValueKind == JsonValueKind.Object && raw.TryGetProperty(key, out var field) && field.TryGetInt32(out var number) ? number : 0;
    }

    private static object? GetObject(Dictionary<string, object?> data, string key)
    {
        return data.TryGetValue(key, out var value) && value is JsonElement element ? JsonSerializer.Deserialize<object>(element.GetRawText()) : value;
    }

    private static string StatusLabel(string status) => status switch
    {
        "pending" => "Chờ cửa hàng duyệt",
        "awaiting_payment" => "Chờ thanh toán phí",
        "awaiting_return" => "Chờ nhận hàng trả",
        "resolved" => "Đã xử lý",
        "rejected" => "Đã từ chối",
        "cancelled" => "Đã hủy yêu cầu",
        _ => "Chờ khách xác nhận phí"
    };

    private sealed record AfterSalesRecord(int Id, string Title, string Status, Dictionary<string, object?> Data);

    private string GetConfig(string key, string fallback = "")
    {
        var val = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(val)) val = configuration[key];
        return string.IsNullOrWhiteSpace(val) ? fallback : val.Trim();
    }
}
