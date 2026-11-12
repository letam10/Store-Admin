using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private void EnsureUnmatchedPaymentTables()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            IF OBJECT_ID('checkout_unmatched_payments') IS NULL
            BEGIN
              CREATE TABLE checkout_unmatched_payments(
                id NVARCHAR(100) PRIMARY KEY,order_id NVARCHAR(255) NOT NULL REFERENCES customer_orders(id),
                request_id NVARCHAR(64) NOT NULL,request_hash NVARCHAR(64) NOT NULL,
                reference NVARCHAR(100) NOT NULL,amount BIGINT NOT NULL CHECK(amount>0),
                received_at DATETIMEOFFSET NOT NULL,reason NVARCHAR(1000) NOT NULL,
                recorded_by BIGINT NOT NULL,created_at DATETIMEOFFSET NOT NULL,
                refund_reference NVARCHAR(100) NULL,refunded_at DATETIMEOFFSET NULL,
                refunded_by BIGINT NULL,refund_hash NVARCHAR(64) NULL,
                UNIQUE(order_id,request_id));
              CREATE INDEX IX_checkout_unmatched_order ON checkout_unmatched_payments(order_id,created_at);
            END
            """;
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<UnmatchedPayment> UnmatchedPayments(string orderId, long? customerId = null)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT p.id,p.order_id,p.reference,p.amount,p.received_at,p.reason,p.refund_reference,p.refunded_at
            FROM checkout_unmatched_payments p JOIN customer_orders o ON o.id=p.order_id
            WHERE p.order_id=@order AND (@customer IS NULL OR o.customer_id=@customer) ORDER BY p.created_at,p.id
            """;
        command.Parameters.AddWithValue("@order", orderId);
        command.Parameters.AddWithValue("@customer", (object?)customerId ?? DBNull.Value);
        var payments = new List<UnmatchedPayment>();
        using var reader = command.ExecuteReader();
        while (reader.Read()) payments.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt64(3),
            reader.GetDateTimeOffset(4), reader.GetString(5), reader.IsDBNull(7) ? "awaiting_refund" : "refunded",
            reader.IsDBNull(6) ? null : reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7)));
        return payments;
    }

    public string RecordUnmatchedPayment(long actorId, string orderId, UnmatchedPaymentRequest proof)
    {
        var reference = (proof.Reference ?? "").Trim().ToUpperInvariant();
        var reason = (proof.Reason ?? "").Trim();
        if (!proof.ReceivedConfirmed) throw new InvalidOperationException("PAYMENT_CONFIRMATION_REQUIRED");
        if (proof.ReceivedAmount <= 0) throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        if (reference.Length is < 3 or > 100) throw new InvalidOperationException("PAYMENT_REFERENCE_REQUIRED");
        if (reason.Length is < 5 or > 1000) throw new InvalidOperationException("UNMATCHED_REASON_REQUIRED");
        if (!Regex.IsMatch(proof.RequestId ?? "", "^[A-Za-z0-9-]{8,64}$")) throw new InvalidOperationException("INVALID_CHECKOUT_KEY");
        if (!DateTimeOffset.TryParse(proof.ReceivedAt, out var received) || received > DateTimeOffset.UtcNow.AddMinutes(1))
            throw new InvalidOperationException("INVALID_PAYMENT_TIME");
        var hash = Tokens.Sha256(JsonSerializer.Serialize(new { reference, proof.ReceivedAmount, received = received.ToUniversalTime(), reason }));
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using (var existing = CheckoutCommand(connection, transaction,
            "SELECT id,request_hash FROM checkout_unmatched_payments WHERE order_id=@order AND request_id=@request",
            ("@order", orderId), ("@request", proof.RequestId)))
        using (var reader = existing.ExecuteReader())
        {
            if (reader.Read())
            {
                if (reader.GetString(1) != hash) throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
                var previous = reader.GetString(0);
                reader.Close();
                transaction.Commit();
                return previous;
            }
        }
        bool paid;
        using (var order = CheckoutCommand(connection, transaction, """
            SELECT o.created_at,o.payment_method,o.paid_at,i.state FROM customer_orders o
            JOIN checkout_intents i ON i.order_id=o.id WHERE o.id=@order
            """, ("@order", orderId)))
        using (var reader = order.ExecuteReader())
        {
            if (!reader.Read()) throw new InvalidOperationException("ORDER_NOT_FOUND");
            if (reader.GetString(1) != "bank_transfer") throw new InvalidOperationException("BANK_TRANSFER_REQUIRED");
            if (PaymentTime.BeforeRecordedSecond(received, DateTimeOffset.Parse(reader.GetString(0)))) throw new InvalidOperationException("INVALID_PAYMENT_TIME");
            paid = !reader.IsDBNull(2) || reader.GetString(3) == "paid";
        }
        var id = "UM-" + Guid.NewGuid().ToString("N").ToUpperInvariant();
        using (var receipt = CheckoutCommand(connection, transaction, """
            INSERT INTO bank_payment_receipts(reference_hash,order_id,reference,amount,received_at)
            SELECT @hash,@id,@reference,@amount,@received WHERE NOT EXISTS
              (SELECT 1 FROM bank_payment_receipts WHERE reference_hash=@hash)
              AND NOT EXISTS(SELECT 1 FROM after_sales_refunds WHERE reference_hash=@hash)
            """, ("@hash", Tokens.Sha256(reference)), ("@id", id), ("@reference", reference),
            ("@amount", proof.ReceivedAmount), ("@received", received)))
            if (receipt.ExecuteNonQuery() != 1) throw new InvalidOperationException("PAYMENT_REFERENCE_USED");
        using (var insert = CheckoutCommand(connection, transaction, """
            INSERT INTO checkout_unmatched_payments(id,order_id,request_id,request_hash,reference,amount,received_at,reason,recorded_by,created_at)
            VALUES(@id,@order,@request,@hash,@reference,@amount,@received,@reason,@actor,@now)
            """, ("@id", id), ("@order", orderId), ("@request", proof.RequestId), ("@hash", hash),
            ("@reference", reference), ("@amount", proof.ReceivedAmount), ("@received", received), ("@reason", reason),
            ("@actor", actorId), ("@now", DateTimeOffset.UtcNow))) insert.ExecuteNonQuery();
        // Khoản chuyển trùng của đơn đã mua không được làm thay đổi đơn, điểm hay doanh thu đã xác nhận.
        if (!paid)
        {
            ReleaseCheckout(connection, transaction, orderId);
            using var close = CheckoutCommand(connection, transaction, """
                UPDATE checkout_intents SET state='unmatched_received' WHERE order_id=@order;
                UPDATE customer_orders SET status='cancelled' WHERE id=@order AND paid_at IS NULL;
                """, ("@order", orderId));
            close.ExecuteNonQuery();
        }
        transaction.Commit();
        return id;
    }

    public void RefundUnmatchedPayment(long actorId, string orderId, string id, UnmatchedRefundRequest proof)
    {
        var reference = (proof.Reference ?? "").Trim().ToUpperInvariant();
        if (!proof.RefundedConfirmed) throw new InvalidOperationException("REFUND_CONFIRMATION_REQUIRED");
        if (reference.Length is < 3 or > 100) throw new InvalidOperationException("REFUND_REFERENCE_REQUIRED");
        if (!DateTimeOffset.TryParse(proof.RefundedAt, out var refunded) || refunded > DateTimeOffset.UtcNow.AddMinutes(1))
            throw new InvalidOperationException("INVALID_REFUND_TIME");
        var hash = Tokens.Sha256(JsonSerializer.Serialize(new { reference, proof.Amount, refunded = refunded.ToUniversalTime() }));
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using (var find = CheckoutCommand(connection, transaction,
            "SELECT amount,received_at,refund_hash FROM checkout_unmatched_payments WHERE id=@id AND order_id=@order", ("@id", id), ("@order", orderId)))
        using (var reader = find.ExecuteReader())
        {
            if (!reader.Read()) throw new InvalidOperationException("UNMATCHED_PAYMENT_NOT_FOUND");
            if (proof.Amount != reader.GetInt64(0)) throw new InvalidOperationException("INVALID_REFUND_AMOUNT");
            if (PaymentTime.BeforeRecordedSecond(refunded, reader.GetDateTimeOffset(1))) throw new InvalidOperationException("INVALID_REFUND_TIME");
            if (!reader.IsDBNull(2))
            {
                if (reader.GetString(2) != hash) throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
                reader.Close();
                transaction.Commit();
                return;
            }
        }
        using (var receipt = CheckoutCommand(connection, transaction, """
            INSERT INTO after_sales_refunds(case_id,reference_hash,reference,amount,refunded_at)
            SELECT @id,@hash,@reference,@amount,@refunded WHERE NOT EXISTS
              (SELECT 1 FROM after_sales_refunds WHERE reference_hash=@hash OR case_id=@id)
              AND NOT EXISTS(SELECT 1 FROM bank_payment_receipts WHERE reference_hash=@hash)
            """, ("@id", id), ("@hash", Tokens.Sha256(reference)), ("@reference", reference), ("@amount", proof.Amount), ("@refunded", refunded)))
            if (receipt.ExecuteNonQuery() != 1) throw new InvalidOperationException("REFUND_REFERENCE_USED");
        using (var update = CheckoutCommand(connection, transaction, """
            UPDATE checkout_unmatched_payments SET refund_reference=@reference,refunded_at=@refunded,refunded_by=@actor,refund_hash=@hash WHERE id=@id;
            UPDATE checkout_intents SET state='refunded_unmatched' WHERE order_id=@order AND state='unmatched_received'
              AND NOT EXISTS(SELECT 1 FROM checkout_unmatched_payments WHERE order_id=@order AND refunded_at IS NULL);
            """, ("@reference", reference), ("@refunded", refunded), ("@actor", actorId), ("@hash", hash), ("@id", id), ("@order", orderId))) update.ExecuteNonQuery();
        transaction.Commit();
    }
}
