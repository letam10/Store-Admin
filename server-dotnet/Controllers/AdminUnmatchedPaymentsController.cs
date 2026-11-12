using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/customer-orders/{orderId}/unmatched-payments")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminUnmatchedPaymentsController(StoreDb db) : ControllerBase
{
    [HttpGet]
    public IActionResult ListUnmatchedPayments(string orderId) => db.FindCustomerOrder(orderId) is null
        ? NotFound(new { error = "ORDER_NOT_FOUND" }) : Ok(new { payments = db.UnmatchedPayments(orderId) });

    [HttpPost]
    public IActionResult RecordUnmatchedPayment(string orderId, UnmatchedPaymentRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var actor = (StoreDb.AdminActor)HttpContext.Items["AdminActor"]!;
        try
        {
            var id = db.RecordUnmatchedPayment(actor.Id, orderId, request);
            return Ok(new { id, payments = db.UnmatchedPayments(orderId), order = db.FindCustomerOrder(orderId) });
        }
        catch (InvalidOperationException ex) { return Failure(ex); }
    }

    [HttpPost("{id}/refund")]
    public IActionResult RefundUnmatchedPayment(string orderId, string id, UnmatchedRefundRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var actor = (StoreDb.AdminActor)HttpContext.Items["AdminActor"]!;
        try
        {
            db.RefundUnmatchedPayment(actor.Id, orderId, id, request);
            return Ok(new { payments = db.UnmatchedPayments(orderId), order = db.FindCustomerOrder(orderId) });
        }
        catch (InvalidOperationException ex) { return Failure(ex); }
    }

    private IActionResult Failure(InvalidOperationException ex) => StatusCode(ex.Message.EndsWith("NOT_FOUND", StringComparison.Ordinal) ? 404 : 409,
        new { error = ex.Message });

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrWhiteSpace(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
