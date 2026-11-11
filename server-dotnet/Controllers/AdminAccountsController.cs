using System.Net.Mail;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminAccountsController(StoreDb db) : ControllerBase
{
    public sealed record StaffRequest(string Username, string DisplayName, string Email, string? Password, bool Active = true);
    public sealed record PasswordRequest(string Password);

    [HttpGet("staff")]
    public IActionResult Staff() => Ok(new { staff = db.ListStaffAccounts() });

    [HttpPost("staff")]
    public IActionResult CreateStaff(StaffRequest request) => SaveStaff(null, request);

    [HttpPatch("staff/{id:long}")]
    public IActionResult UpdateStaff(long id, StaffRequest request) => SaveStaff(id, request);

    private IActionResult SaveStaff(long? id, StaffRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var username = request.Username?.Trim() ?? "";
        var name = request.DisplayName?.Trim() ?? "";
        var email = request.Email?.Trim() ?? "";
        if (username.Length is < 3 or > 100 || name.Length is < 1 or > 255 || email.Length > 255 || !MailAddress.TryCreate(email, out _))
            return BadRequest(new { error = "INVALID_ACCOUNT" });
        if ((!id.HasValue || !string.IsNullOrEmpty(request.Password)) && !ValidPassword(request.Password))
            return BadRequest(new { error = "INVALID_PASSWORD" });
        try
        {
            var staff = db.SaveStaffAccount(id, username, name, email, request.Password, request.Active);
            return staff is null ? NotFound(new { error = "STAFF_NOT_FOUND" }) : Ok(new { staff });
        }
        catch (InvalidOperationException ex) when (ex.Message == "ACCOUNT_EXISTS")
        {
            return Conflict(new { error = "ACCOUNT_EXISTS" });
        }
    }

    [HttpPut("customers/{id:long}/password")]
    public IActionResult CustomerPassword(long id, PasswordRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        if (!ValidPassword(request.Password)) return BadRequest(new { error = "INVALID_PASSWORD" });
        return db.SetCustomerPassword(id, request.Password) ? Ok(new { updated = true }) : NotFound(new { error = "CUSTOMER_NOT_FOUND" });
    }

    private static bool ValidPassword(string? password) => password is { Length: >= 8 and <= 128 } && !string.IsNullOrWhiteSpace(password);

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrEmpty(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
