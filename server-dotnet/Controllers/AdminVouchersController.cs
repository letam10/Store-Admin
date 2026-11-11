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
public sealed class AdminVouchersController(StoreDb db) : ControllerBase
{
    [HttpGet("vouchers")]
    public IActionResult Vouchers() => Ok(new { vouchers = db.ListAdminVouchers() });

    [HttpPost("vouchers")]
    public IActionResult CreateVoucher(AdminVoucherRequest request) => Create(request, request.CustomerId);

    [HttpPost("customers/{id:long}/vouchers")]
    public IActionResult CreateCustomerVoucher(long id, AdminVoucherRequest request) => id > 0 ? Create(request, id) : BadRequest(new { error = "CUSTOMER_NOT_FOUND" });

    private IActionResult Create(AdminVoucherRequest request, long? customerId)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        if (customerId < 0) return BadRequest(new { error = "CUSTOMER_NOT_FOUND" });
        try
        {
            var code = string.IsNullOrWhiteSpace(request.Code) ? VoucherPolicy.NewCode() : VoucherPolicy.NormalizeCode(request.Code);
            VoucherPolicy.ValidateCode(code);
            var type = request.Type ?? "percent";
            var scope = request.Scope ?? "goods";
            var value = request.Value ?? 10;
            var label = string.IsNullOrWhiteSpace(request.Label)
                ? $"Giảm {value}{(type == "percent" ? "%" : "đ")} {(scope == "shipping" ? "phí vận chuyển" : "hàng hóa")}"
                : request.Label.Trim();
            var expiry = request.ExpiresAt ?? DateTimeOffset.UtcNow.AddDays(30).ToString("O");
            var voucher = db.CreateAdminVoucher(code, customerId is > 0 ? customerId : null, label, type, value, scope, expiry, "admin");
            return StatusCode(201, new { voucher });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(ex.Message == "VOUCHER_EXISTS" ? 409 : 400, new { error = ex.Message });
        }
    }

    [HttpPatch("vouchers/{code}")]
    public IActionResult UpdateVoucher(string code, AdminVoucherRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        code = VoucherPolicy.NormalizeCode(code);
        var current = Find(code);
        if (current is null) return NotFound(new { error = "VOUCHER_NOT_FOUND" });
        try
        {
            var item = current.Value;
            var label = request.Label?.Trim() ?? item.GetProperty("label").GetString()!;
            var type = request.Type ?? item.GetProperty("type").GetString()!;
            var scope = request.Scope ?? item.GetProperty("scope").GetString()!;
            var value = request.Value ?? item.GetProperty("value").GetInt32();
            var expiry = VoucherPolicy.Validate(label, type, value, scope, request.ExpiresAt ?? item.GetProperty("expiresAt").GetString()!);
            if (!db.UpdateAdminVoucher(code, label, type, value, scope, expiry)) return NotFound(new { error = "VOUCHER_NOT_FOUND" });
            return Ok(new { voucher = Find(code) });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpDelete("vouchers/{code}")]
    public IActionResult DeleteVoucher(string code)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.DeleteAdminVoucher(VoucherPolicy.NormalizeCode(code)) ? Ok(new { ok = true }) : NotFound(new { error = "VOUCHER_NOT_FOUND" });
    }

    private JsonElement? Find(string code)
    {
        foreach (var voucher in db.ListAdminVouchers())
        {
            var item = JsonSerializer.SerializeToElement(voucher);
            if (string.Equals(item.GetProperty("code").GetString(), code, StringComparison.OrdinalIgnoreCase)) return item;
        }
        return null;
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrEmpty(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
