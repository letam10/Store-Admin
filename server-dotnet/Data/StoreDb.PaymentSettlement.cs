using System.Text.Json;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public void SettleCheckout(string id, OrderPaidRequest proof)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        ExpireCheckouts(connection, transaction);
        using var query = CheckoutCommand(connection, transaction, """
            SELECT o.customer_id,o.total,o.goods_total,o.points_earned,o.payment_method,o.items_json,o.voucher_codes_json,o.created_at,
              i.state,i.expires_at,i.stock_reserved,i.payment_reference
            FROM customer_orders o JOIN checkout_intents i ON i.order_id=o.id WHERE o.id=@id
            """, ("@id", id));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("LEGACY_ORDER_REVIEW_REQUIRED");
        var customerId = reader.GetInt64(0);
        var total = reader.GetInt32(1);
        var goods = reader.GetInt32(2);
        var points = reader.GetInt32(3);
        var method = reader.GetString(4);
        var items = JsonSerializer.Deserialize<List<CheckoutLine>>(reader.GetString(5), CheckoutJson)!;
        var vouchers = JsonSerializer.Deserialize<List<string>>(reader.GetString(6))!;
        var created = DateTimeOffset.Parse(reader.GetString(7));
        var state = reader.GetString(8);
        var expires = reader.IsDBNull(9) ? (DateTimeOffset?)null : reader.GetDateTimeOffset(9);
        var reserved = reader.GetBoolean(10);
        var previousReference = reader.IsDBNull(11) ? null : reader.GetString(11);
        reader.Close();
        if (proof.ReceivedAmount != total) throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        var reference = (proof.Reference ?? "").Trim().ToUpperInvariant();
        var now = DateTimeOffset.UtcNow;
        var received = now;
        if (method == "bank_transfer")
        {
            if (proof.ReceivedConfirmed != true) throw new InvalidOperationException("PAYMENT_CONFIRMATION_REQUIRED");
            if (reference.Length is < 3 or > 100) throw new InvalidOperationException("PAYMENT_REFERENCE_REQUIRED");
            if (!DateTimeOffset.TryParse(proof.ReceivedAt, out received) || received > now.AddMinutes(1) || received < created)
                throw new InvalidOperationException("INVALID_PAYMENT_TIME");
            if (!expires.HasValue || received > expires)
                throw new InvalidOperationException("PAYMENT_SESSION_EXPIRED");
        }
        else if (method == "cash" && proof.CounterConfirmed != true)
            throw new InvalidOperationException("COUNTER_CONFIRMATION_REQUIRED");
        else if (method == "cod" && proof.ReceivedConfirmed != true)
            throw new InvalidOperationException("DELIVERY_PAYMENT_CONFIRMATION_REQUIRED");
        if (state == "paid")
        {
            if (method == "bank_transfer" && previousReference != reference) throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
            transaction.Commit();
            return;
        }
        if (state == "refunded_unmatched" || (method != "bank_transfer" && state != "pending"))
            throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        if (method == "bank_transfer")
        {
            using var receipt = CheckoutCommand(connection, transaction, """
                INSERT INTO bank_payment_receipts(reference_hash,order_id,reference,amount,received_at)
                SELECT @hash,@id,@reference,@amount,@received
                WHERE NOT EXISTS(SELECT 1 FROM bank_payment_receipts WHERE reference_hash=@hash OR order_id=@id)
                """, ("@hash", Tokens.Sha256(reference)), ("@id", id), ("@reference", reference), ("@amount", total), ("@received", received));
            if (receipt.ExecuteNonQuery() != 1) throw new InvalidOperationException("PAYMENT_REFERENCE_USED");
        }
        if (!reserved) ReserveCheckout(connection, transaction, id, customerId, items, vouchers, honorLockedQuote: true);
        using (var consume = CheckoutCommand(connection, transaction, """
            SELECT code INTO #used_vouchers FROM checkout_voucher_holds WHERE order_id=@id;
            DELETE FROM checkout_voucher_holds WHERE order_id=@id;
            DELETE FROM customer_vouchers WHERE customer_id=@customer AND code IN (SELECT code FROM #used_vouchers);
            DROP TABLE #used_vouchers;
            UPDATE customers SET points=points+@points,
              spin_credits=spin_credits+((paid_goods_total+CAST(@goods AS BIGINT))/100000-paid_goods_total/100000),
              paid_goods_total=paid_goods_total+@goods WHERE id=@customer;
            UPDATE customer_orders SET status='paid',paid_at=@paid WHERE id=@id;
            UPDATE checkout_intents SET state='paid',stock_reserved=0,payment_reference=@reference,received_at=@received WHERE order_id=@id;
            """, ("@id", id), ("@customer", customerId), ("@points", points), ("@goods", goods), ("@paid", received.ToString("O")),
            ("@reference", method == "bank_transfer" ? reference : method), ("@received", received))) consume.ExecuteNonQuery();
        QueueNotification(connection, transaction, "invoice:customer:" + id, "invoice.customer", new { orderId = id });
        QueueAdminNotifications(connection, transaction, "invoice:admin:" + id, "invoice.admin", new { orderId = id });
        transaction.Commit();
    }

    public void AdvanceFulfillment(string id, string next)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using var query = CheckoutCommand(connection, transaction, "SELECT status,payment_method,fulfillment,delivery_status FROM customer_orders WHERE id=@id", ("@id", id));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("ORDER_NOT_FOUND");
        var paid = reader.GetString(0) == "paid";
        var cod = reader.GetString(1) == "cod";
        var delivery = reader.GetString(2) == "delivery";
        var current = reader.GetString(3);
        var validStatus = reader.GetString(0) is "pending" or "paid";
        reader.Close();
        var allowed = validStatus && ((current == "processing" && next == "ready")
            || (current == "ready" && next == "shipped" && delivery && (paid || cod))
            || (next == "delivered" && paid && (current == "shipped" || (current == "ready" && !delivery))));
        if (!allowed) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        using var update = CheckoutCommand(connection, transaction, "UPDATE customer_orders SET delivery_status=@next,status=CASE WHEN @next='delivered' THEN 'completed' ELSE status END WHERE id=@id", ("@next", next), ("@id", id));
        update.ExecuteNonQuery();
        transaction.Commit();
    }
}
