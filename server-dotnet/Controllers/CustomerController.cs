using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/customer")]
public sealed class CustomerController(StoreDb db) : ControllerBase
{
    private const string Cookie = "store_customer_session";

    [HttpGet("session")]
    public IActionResult Session()
    {
        var customer = Current();
        var raw = Request.Cookies[Cookie];
        return customer is null || string.IsNullOrWhiteSpace(raw) ? Unauthorized(new { authenticated = false }) : Ok(new { account = Account(customer.Value, Tokens.Sha256("customer-csrf:" + raw)) });
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
        catch { return Conflict(new { error = "CUSTOMER_EXISTS" }); }
    }

    [HttpPost("login")]
    public IActionResult Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password)) return Unauthorized(new { error = "LOGIN_FAILED" });
        var found = db.FindCustomer(request.Username);
        if (found is null || !Tokens.VerifyPassword(request.Password, found.Value.Salt, found.Value.Hash)) return Unauthorized(new { error = "LOGIN_FAILED" });
        return LoginInternal(found.Value.Username, found.Value.Id);
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
    public IActionResult Favorites() => RequireAccount(out var customer) ? Ok(new { favorites = db.Favorites(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    [HttpPut("favorites/{id}")]
    public IActionResult SetFavorite(string id, [FromBody] JsonElement body)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var favorite = body.TryGetProperty("favorite", out var value) && value.ValueKind == JsonValueKind.True; db.SetFavorite(customer.Id, id, favorite); return Ok(new { favorite });
    }

    [HttpDelete("favorites/{id}")]
    public IActionResult DeleteFavorite(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" }); db.SetFavorite(customer.Id, id, false); return Ok(new { ok = true });
    }

    [HttpGet("vouchers")]
    public IActionResult Vouchers() => RequireAccount(out var customer) ? Ok(new { vouchers = db.Vouchers(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    private IActionResult LoginInternal(string username, long id)
    {
        var raw = Tokens.RandomToken(); var expires = DateTimeOffset.UtcNow.AddDays(30); db.CreateSession(Tokens.Sha256(raw), id, expires);
        Response.Cookies.Append(Cookie, raw, new CookieOptions { HttpOnly = true, SameSite = SameSiteMode.Strict, MaxAge = TimeSpan.FromDays(30), Path = "/" });
        var customer = db.FindCustomer(username)!; var csrf = Tokens.Sha256("customer-csrf:" + raw);
        return Ok(new { account = Account((customer.Value.Id, customer.Value.Username, customer.Value.Email, customer.Value.Points, customer.Value.SpinCredits), csrf) });
    }

    private (long Id, string Username, string Email, int Points, int SpinCredits)? Current()
    {
        var raw = Request.Cookies[Cookie]; return string.IsNullOrWhiteSpace(raw) ? null : db.FindCustomerBySession(Tokens.Sha256(raw));
    }

    private bool CsrfValid(string raw) => Request.Headers.TryGetValue("x-csrf-token", out var value) && value == Tokens.Sha256("customer-csrf:" + raw);
    private bool RequireAccount(out (long Id, string Username, string Email, int Points, int SpinCredits) customer)
    {
        var current = Current(); customer = current ?? default; return current is not null;
    }
    private bool RequireAccount(out (long Id, string Username, string Email, int Points, int SpinCredits) customer, out string raw)
    {
        raw = Request.Cookies[Cookie] ?? string.Empty; var current = Current(); customer = current ?? default; return current is not null && raw.Length > 0;
    }
    private static string Tier(int points) => points >= 10000 ? "diamond" : points >= 1000 ? "gold" : points >= 100 ? "silver" : "bronze";
    private static object Account((long Id, string Username, string Email, int Points, int SpinCredits) c, string csrf) => new { id = c.Id, username = c.Username, email = c.Email, points = c.Points, tier = Tier(c.Points), spinCredits = c.SpinCredits, csrfToken = csrf };
}
