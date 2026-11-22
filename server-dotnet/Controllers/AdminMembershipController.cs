/*
  FILE NOTE
  - Mục đích: API quản trị cấu hình Thẻ Thành Viên (chỉ dành cho admin qua AdminAccessFilter + CSRF).
*/
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/membership-settings")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminMembershipController(StoreDb db) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { ok = true, policy = db.GetMembershipPolicy() });

    [HttpPut]
    public IActionResult Save([FromBody] MembershipPolicyConfig request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        try
        {
            return Ok(new { ok = true, policy = db.SaveMembershipPolicy(request) });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("reset")]
    public IActionResult Reset()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(new { ok = true, policy = db.ResetMembershipPolicy() });
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrEmpty(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
