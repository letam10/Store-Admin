using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

public sealed partial class CustomerController
{
    [HttpPost("orders")]
    public IActionResult CreateOrder(CreateOrderRequest request) => BeginCheckout(request, false);

    [HttpPost("payment-sessions")]
    public IActionResult CreatePaymentSession(CreateOrderRequest request) => BeginCheckout(request, true);

    private IActionResult BeginCheckout(CreateOrderRequest request, bool bankTransfer)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(403, new { error = "CSRF_INVALID" });
        try
        {
            if (!Regex.IsMatch(request.RequestId ?? "", "^[A-Za-z0-9-]{8,64}$")) return BadRequest(new { error = "INVALID_CHECKOUT_KEY" });
            var hash = Tokens.Sha256(JsonSerializer.Serialize(request));
            var previous = db.FindCheckoutRequest(customer.Id, request.RequestId!, hash);
            if (previous is not null) return Ok(CheckoutPayload(previous, customer.Id));
            var recipient = (request.Recipient ?? "").Trim();
            var phone = (request.Phone ?? "").Trim();
            var address = (request.Address ?? "").Trim();
            if (recipient.Length is < 2 or > 255 || !Regex.IsMatch(phone, "^[+0-9 ()-]{8,30}$") || address.Length > 1000
                || (request.Fulfillment == "delivery" && address.Length < 5)) return BadRequest(new { error = "INVALID_ORDER" });
            if (!DateTimeOffset.TryParse(request.ScheduledAt, out var schedule) || schedule <= DateTimeOffset.UtcNow || schedule > DateTimeOffset.UtcNow.AddDays(30))
                return BadRequest(new { error = "INVALID_SCHEDULE" });
            var method = bankTransfer ? "bank_transfer" : request.PaymentMethod;
            if (!bankTransfer && !(method == "cash" && request.Fulfillment == "pickup") && !(method == "cod" && request.Fulfillment == "delivery"))
                return BadRequest(new { error = "INVALID_PAYMENT_METHOD" });
            var bank = bankTransfer ? BankPayment.ReadSettings(db.GetPaymentSettings()) : null;
            var quote = ComputeQuote(customer, new(request.Items, request.Fulfillment, request.Region, request.DistanceKm, request.WeightKg, request.VoucherCodes));
            if (quote.Total != request.ExpectedTotal) return Conflict(new { error = "QUOTE_CHANGED" });
            if (bankTransfer && quote.Total <= 0) return BadRequest(new { error = "INVALID_PAYMENT_AMOUNT" });
            var draft = new CheckoutDraft(customer.Id, request.RequestId!, hash,
                quote.Items.Select(item => new CheckoutLine(item.Id, item.Name, item.Quantity, item.Price)).ToArray(),
                recipient, phone, address, quote.Fulfillment, quote.Region, quote.DistanceKm, quote.WeightKg,
                quote.Subtotal, quote.Discount, quote.GoodsTotal, quote.ShippingFee, quote.Total, quote.VoucherCodes,
                quote.Tier, method!, schedule.ToString("O"), bank);
            var id = db.CreateCheckout(draft);
            return StatusCode(201, CheckoutPayload(id, customer.Id));
        }
        catch (CatalogOutOfSyncException ex) { return Conflict(new { error = "CATALOG_OUT_OF_SYNC", missingIds = ex.MissingIds }); }
        catch (CheckoutAlreadyOpenException ex) { return Conflict(new { error = ex.Message, orderId = ex.OrderId }); }
        catch (InvalidOperationException ex)
        {
            // Yêu cầu song song có thể vừa giữ voucher/kho; retry cùng khóa vẫn trả phiên đã tạo.
            if (ex.Message is "INVALID_VOUCHER" or "PRODUCT_UNAVAILABLE" or "VOUCHER_RESERVED")
            {
                try
                {
                    var existing = db.FindCheckoutRequest(customer.Id, request.RequestId!, Tokens.Sha256(JsonSerializer.Serialize(request)));
                    if (existing is not null) return Ok(CheckoutPayload(existing, customer.Id));
                }
                catch (InvalidOperationException retryError) { return Conflict(new { error = retryError.Message }); }
            }
            return Conflict(new { error = ex.Message });
        }
    }

    [HttpGet("pending-checkouts")]
    public IActionResult PendingCheckouts() => RequireAccount(out var customer)
        ? Ok(new { orders = db.PendingCheckouts(customer.Id) }) : Unauthorized(new { error = "LOGIN_REQUIRED" });

    [HttpGet("payment-sessions/{id}")]
    [HttpGet("orders/{id}/payment-info")]
    public IActionResult GetPaymentSession(string id)
    {
        if (!RequireAccount(out var customer)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        try { return Ok(CheckoutPayload(id, customer.Id)); }
        catch (InvalidOperationException ex) { return NotFound(new { error = ex.Message }); }
    }

    private object CheckoutPayload(string id, long customerId)
    {
        db.ExpireCheckouts();
        var intent = db.FindCheckout(id, customerId) ?? throw new InvalidOperationException("PAYMENT_SESSION_NOT_FOUND");
        var order = db.FindCustomerOrder(id, customerId)!;
        var total = JsonSerializer.SerializeToElement(order).GetProperty("total").GetInt32();
        var canPay = intent.State == "pending" && intent.ExpiresAt > DateTimeOffset.UtcNow && intent.Bank is not null;
        return new
        {
            sessionId = id, order, status = intent.State, intent.ExpiresAt, canPay, serverTime = DateTimeOffset.UtcNow,
            payment = canPay ? BankPayment.Info(intent.Bank!, id, total) : null
        };
    }

    [HttpDelete("payment-sessions/{id}")]
    [HttpPost("orders/{id}/cancel-unpaid")]
    public IActionResult CancelUnpaid(string id)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(403, new { error = "CSRF_INVALID" });
        try { db.CancelCheckout(id, customer.Id); return Ok(new { cancelled = true, sessionId = id }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }

    [HttpPost("payment-sessions/{id}/payment-report")]
    [HttpPost("orders/{id}/payment-report")]
    public IActionResult ReportPaymentSession(string id, PaymentReportRequest request)
    {
        if (!RequireAccount(out var customer, out var raw)) return Unauthorized(new { error = "LOGIN_REQUIRED" });
        if (!CsrfValid(raw)) return StatusCode(403, new { error = "CSRF_INVALID" });
        try
        {
            db.ReportCheckout(id, customer.Id, (request.Reference ?? "").Trim());
            return Ok(CheckoutPayload(id, customer.Id));
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
    }
}
