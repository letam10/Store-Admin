using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public object AfterSalesPaymentWindow(string id, long customerId)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        var item = ReadAfterSalesCase(connection, transaction, id, customerId);
        var order = ReadAfterSalesOrder(connection, transaction, item.OrderId, customerId);
        var now = DateTimeOffset.UtcNow;
        if (item.FeePaidAt.HasValue)
        {
            transaction.Commit();
            return new { orderId = id, status = "paid", canPay = false, serverTime = now, amount = item.Quote.AdditionalDue };
        }
        if (item.Status != "awaiting_payment" || item.Quote.AdditionalDue <= 0) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        if (order.Method != "bank_transfer")
        {
            transaction.Commit();
            return new { orderId = id, amount = item.Quote.AdditionalDue, status = "pending", canPay = false,
                serverTime = now, payment = new { mode = "counter", amount = item.Quote.AdditionalDue, reference = id } };
        }
        if (!item.FeePaymentExpiresAt.HasValue)
        {
            item.FeeBank = BankPayment.ReadSettings(GetPaymentSettings());
            item.FeePaymentCreatedAt = now;
            item.FeePaymentExpiresAt = now.AddMinutes(2);
            item.FeePaymentPeriods.Add(new(now, item.FeePaymentExpiresAt.Value));
            SaveAfterSalesCase(connection, transaction, item);
        }
        var reported = item.FeeReportedAt.HasValue;
        var canPay = item.FeePaymentExpiresAt > now && !reported;
        object? payment = canPay ? BankPayment.Info(item.FeeBank!, id, checked((int)item.Quote.AdditionalDue)) : null;
        transaction.Commit();
        return new { orderId = id, amount = item.Quote.AdditionalDue, expiresAt = item.FeePaymentExpiresAt,
            canPay, canRenew = !reported && !canPay, status = reported ? "reported" : canPay ? "pending" : "expired", serverTime = now, payment };
    }
}
