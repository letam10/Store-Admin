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

namespace StoreApi.Controllers;

[ApiController]
[Route("api/customer")]
// Vai trò kiểu CustomerController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class CustomerController(StoreDb db, IConfiguration configuration) : ControllerBase
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
}
