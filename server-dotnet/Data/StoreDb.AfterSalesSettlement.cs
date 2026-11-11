using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private static void ReserveReplacement(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item)
    {
        foreach (var line in item.ReplacementItems.OrderBy(line => line.Id, StringComparer.Ordinal))
        {
            using var reserve = CheckoutCommand(connection, transaction,
                "UPDATE catalog_products SET stock_count=stock_count-@quantity WHERE id=@id AND stock_count>=@quantity",
                ("@id", line.Id), ("@quantity", line.Quantity));
            if (reserve.ExecuteNonQuery() != 1) throw new InvalidOperationException("PRODUCT_UNAVAILABLE");
        }
        item.ReplacementReserved = true;
    }

    private static void PutBackItems(SqlConnection connection, SqlTransaction transaction, IReadOnlyList<CheckoutLine> items)
    {
        foreach (var line in items)
        {
            using var restore = CheckoutCommand(connection, transaction,
                "UPDATE catalog_products SET stock_count=stock_count+@quantity WHERE id=@id",
                ("@id", line.Id), ("@quantity", line.Quantity));
            if (restore.ExecuteNonQuery() != 1) throw new InvalidOperationException("PRODUCT_UNAVAILABLE");
        }
    }

    private static void ReleaseReplacement(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item)
    {
        if (!item.ReplacementReserved) return;
        PutBackItems(connection, transaction, item.ReplacementItems);
        item.ReplacementReserved = false;
    }

    private static void ConfirmAfterSalesFee(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item,
        AfterSalesOrder order, AfterSalesActionRequest proof)
    {
        if (proof.ReceivedAmount != item.Quote.AdditionalDue || item.Quote.AdditionalDue <= 0)
            throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        if (proof.CounterConfirmed != true) throw new InvalidOperationException("PAYMENT_CONFIRMATION_REQUIRED");
        var reference = (proof.Reference ?? "").Trim().ToUpperInvariant();
        if (reference.Length is < 3 or > 100) throw new InvalidOperationException("PAYMENT_REFERENCE_REQUIRED");
        if (!DateTimeOffset.TryParse(proof.ReceivedAt, out var received) || received < item.CreatedAt || received > DateTimeOffset.UtcNow.AddMinutes(1))
            throw new InvalidOperationException("INVALID_PAYMENT_TIME");
        if (order.Method == "bank_transfer")
        {
            var periods = item.FeePaymentPeriods;
            if (periods.Count == 0 && item.FeePaymentCreatedAt.HasValue && item.FeePaymentExpiresAt.HasValue)
                periods = [new(item.FeePaymentCreatedAt.Value, item.FeePaymentExpiresAt.Value)];
            var inWindow = periods.Any(period => received >= period.CreatedAt && received <= period.ExpiresAt);
            if (!inWindow && (periods.Count == 0 || received < periods[0].CreatedAt || proof.AcceptLatePayment != true || (proof.Note ?? "").Trim().Length < 5))
                throw new InvalidOperationException("PAYMENT_SESSION_EXPIRED");
        }
        using var receipt = CheckoutCommand(connection, transaction, """
            INSERT INTO bank_payment_receipts(reference_hash,order_id,reference,amount,received_at)
            SELECT @hash,@id,@reference,@amount,@received WHERE NOT EXISTS
              (SELECT 1 FROM bank_payment_receipts WHERE reference_hash=@hash OR order_id=@id)
            """, ("@hash", Tokens.Sha256(reference)), ("@id", item.Id), ("@reference", reference),
            ("@amount", item.Quote.AdditionalDue), ("@received", received));
        if (receipt.ExecuteNonQuery() != 1) throw new InvalidOperationException("PAYMENT_REFERENCE_USED");
        using var update = CheckoutCommand(connection, transaction,
            "UPDATE customer_orders SET extra_paid=extra_paid+@amount WHERE id=@id", ("@amount", item.Quote.AdditionalDue), ("@id", item.OrderId));
        update.ExecuteNonQuery();
        item.FeePaidAt = received;
        item.FeePaymentReference = reference;
        item.Status = "awaiting_exchange";
    }

    private static void ConfirmAfterSalesRefund(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item,
        AfterSalesOrder order, AfterSalesActionRequest proof)
    {
        var amount = item.Quote.RefundAmount;
        if (amount > order.RemainingPaid) throw new InvalidOperationException("INVALID_REFUND_AMOUNT");
        if (amount > 0)
        {
            if (proof.RefundConfirmed != true) throw new InvalidOperationException("REFUND_CONFIRMATION_REQUIRED");
            if (proof.RefundAmount != amount) throw new InvalidOperationException("INVALID_REFUND_AMOUNT");
            var reference = (proof.RefundReference ?? "").Trim().ToUpperInvariant();
            if (reference.Length is < 3 or > 100) throw new InvalidOperationException("REFUND_REFERENCE_REQUIRED");
            if (!DateTimeOffset.TryParse(proof.RefundedAt, out var refunded) || refunded < item.CreatedAt
                || refunded > DateTimeOffset.UtcNow.AddMinutes(1)) throw new InvalidOperationException("INVALID_REFUND_TIME");
            using var receipt = CheckoutCommand(connection, transaction, """
                INSERT INTO after_sales_refunds(case_id,reference_hash,reference,amount,refunded_at)
                SELECT @id,@hash,@reference,@amount,@refunded WHERE NOT EXISTS
                  (SELECT 1 FROM after_sales_refunds WHERE reference_hash=@hash OR case_id=@id)
                  AND NOT EXISTS(SELECT 1 FROM bank_payment_receipts WHERE reference_hash=@hash)
                """, ("@id", item.Id), ("@hash", Tokens.Sha256(reference)), ("@reference", reference), ("@amount", amount), ("@refunded", refunded));
            if (receipt.ExecuteNonQuery() != 1) throw new InvalidOperationException("REFUND_REFERENCE_USED");
            using var update = CheckoutCommand(connection, transaction,
                "UPDATE customer_orders SET refund_amount=refund_amount+@amount WHERE id=@id", ("@amount", amount), ("@id", item.OrderId));
            update.ExecuteNonQuery();
            item.RefundReference = reference;
            item.RefundedAt = refunded;
        }
        if (item.Kind == "exchange")
        {
            item.Status = "awaiting_exchange";
            return;
        }
        if (item.Kind == "cancel" && !item.Restocked)
        {
            PutBackItems(connection, transaction, item.OriginalItems);
            item.Restocked = true;
        }
        AdjustAfterSalesRewards(connection, transaction, order, 0, 0);
        using var close = CheckoutCommand(connection, transaction,
            "UPDATE customer_orders SET status='refunded',delivery_status=CASE WHEN @kind='cancel' THEN 'cancelled' ELSE 'returned' END WHERE id=@id",
            ("@id", item.OrderId), ("@kind", item.Kind));
        close.ExecuteNonQuery();
        item.Status = "resolved";
    }

    private static void CompleteExchange(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item, AfterSalesOrder order)
    {
        var points = order.RemainingPaid > 0 ? (int)Math.Min(int.MaxValue, Math.Max(1, order.RemainingPaid / 10000)) : 0;
        AdjustAfterSalesRewards(connection, transaction, order, item.Quote.ReplacementGoods, points);
        using var update = CheckoutCommand(connection, transaction, """
            UPDATE customer_orders SET current_items_json=@items,delivery_status='delivered',delivered_at=@now,status='completed' WHERE id=@id
            """, ("@items", JsonSerializer.Serialize(item.ReplacementItems, CheckoutJson)), ("@now", DateTimeOffset.UtcNow), ("@id", item.OrderId));
        update.ExecuteNonQuery();
        item.ReplacementReserved = false;
        item.Status = "resolved";
    }

    private static void AdjustAfterSalesRewards(SqlConnection connection, SqlTransaction transaction, AfterSalesOrder order, long goods, int points)
    {
        // Cập nhật theo chênh lệch của đơn hiện tại; retry không cộng/trừ thưởng lần nữa.
        using var update = CheckoutCommand(connection, transaction, """
            DECLARE @newGoods BIGINT;
            SELECT @newGoods=CASE WHEN paid_goods_total+@goods-@oldGoods<0 THEN 0 ELSE paid_goods_total+@goods-@oldGoods END
              FROM customers WHERE id=@customer;
            UPDATE customers SET points=CASE WHEN CAST(points AS BIGINT)+@points-@oldPoints<0 THEN 0
                WHEN CAST(points AS BIGINT)+@points-@oldPoints>2147483647 THEN 2147483647 ELSE points+@points-@oldPoints END,
              spin_credits=CASE WHEN spin_credits+(@newGoods/100000-paid_goods_total/100000)<0 THEN 0
                ELSE spin_credits+(@newGoods/100000-paid_goods_total/100000) END,paid_goods_total=@newGoods WHERE id=@customer;
            UPDATE customer_orders SET current_goods_total=@goods,points_earned=@points WHERE id=@id;
            """, ("@customer", order.CustomerId), ("@goods", goods), ("@oldGoods", order.Goods),
            ("@points", points), ("@oldPoints", order.Points), ("@id", order.Id));
        update.ExecuteNonQuery();
    }
}
