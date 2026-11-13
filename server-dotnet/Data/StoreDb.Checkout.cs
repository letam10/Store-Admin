using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private static readonly JsonSerializerOptions CheckoutJson = new(JsonSerializerDefaults.Web);

    private void EnsureCheckoutTables()
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            IF COL_LENGTH('customer_orders','delivery_status') IS NULL
              ALTER TABLE customer_orders ADD delivery_status NVARCHAR(30) NOT NULL DEFAULT 'processing';
            IF COL_LENGTH('customer_orders','reward_policy_version') IS NULL
              ALTER TABLE customer_orders ADD reward_policy_version TINYINT NOT NULL DEFAULT 1;
            IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('customers') AND name='paid_goods_total' AND TYPE_NAME(system_type_id)='int')
            BEGIN
              DECLARE @defaultName sysname;
              SELECT @defaultName=d.name FROM sys.default_constraints d JOIN sys.columns c
                ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id
                WHERE c.object_id=OBJECT_ID('customers') AND c.name='paid_goods_total';
              DECLARE @dropDefault nvarchar(500)=N'ALTER TABLE customers DROP CONSTRAINT '+QUOTENAME(@defaultName);
              IF @defaultName IS NOT NULL EXEC(@dropDefault);
              ALTER TABLE customers ALTER COLUMN paid_goods_total BIGINT NOT NULL;
              ALTER TABLE customers ADD DEFAULT 0 FOR paid_goods_total;
            END;
            IF OBJECT_ID('checkout_intents') IS NULL CREATE TABLE checkout_intents(
              order_id NVARCHAR(255) PRIMARY KEY REFERENCES customer_orders(id),
              customer_id BIGINT NOT NULL, request_id NVARCHAR(64) NOT NULL, request_hash NVARCHAR(64) NOT NULL,
              state NVARCHAR(30) NOT NULL, expires_at DATETIMEOFFSET NULL, bank_json NVARCHAR(MAX) NULL,
              stock_reserved BIT NOT NULL DEFAULT 0, reported_at DATETIMEOFFSET NULL,
              report_reference NVARCHAR(100) NULL, payment_reference NVARCHAR(100) NULL, received_at DATETIMEOFFSET NULL,
              UNIQUE(customer_id,request_id));
            IF OBJECT_ID('checkout_voucher_holds') IS NULL CREATE TABLE checkout_voucher_holds(
              code NVARCHAR(255) PRIMARY KEY REFERENCES customer_vouchers(code),
              order_id NVARCHAR(255) NOT NULL REFERENCES customer_orders(id));
            IF OBJECT_ID('bank_payment_receipts') IS NULL CREATE TABLE bank_payment_receipts(
              reference_hash NVARCHAR(64) PRIMARY KEY, order_id NVARCHAR(255) NOT NULL UNIQUE,
              reference NVARCHAR(100) NOT NULL, amount BIGINT NOT NULL, received_at DATETIMEOFFSET NOT NULL);
            IF OBJECT_ID('notification_outbox') IS NULL CREATE TABLE notification_outbox(
              job_key NVARCHAR(160) PRIMARY KEY, kind NVARCHAR(40) NOT NULL, payload NVARCHAR(MAX) NOT NULL,
              status NVARCHAR(20) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
              available_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(), leased_until DATETIMEOFFSET NULL,
              sent_at DATETIMEOFFSET NULL, last_error NVARCHAR(500) NULL);
            """;
        command.ExecuteNonQuery();
        transaction.Commit();
    }

    private static SqlCommand CheckoutCommand(SqlConnection connection, SqlTransaction transaction, string sql, params (string Name, object? Value)[] parameters)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return command;
    }

    private static void LockCheckout(SqlConnection connection, SqlTransaction transaction)
    {
        // Khóa ngắn chỉ chứa SQL; không giữ khóa trong khi gọi mạng hoặc gửi email.
        using var command = CheckoutCommand(connection, transaction, "DECLARE @r int; EXEC @r=sp_getapplock @Resource='store-checkout',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @r");
        if (Convert.ToInt32(command.ExecuteScalar()) < 0) throw new InvalidOperationException("CHECKOUT_BUSY");
    }

    public string CreateCheckout(CheckoutDraft draft)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        ExpireCheckouts(connection, transaction);
        using (var existing = CheckoutCommand(connection, transaction,
            "SELECT order_id,request_hash FROM checkout_intents WHERE customer_id=@customer AND request_id=@request", ("@customer", draft.CustomerId), ("@request", draft.RequestId)))
        using (var reader = existing.ExecuteReader())
        {
            if (reader.Read())
            {
                if (reader.GetString(1) != draft.RequestHash) throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
                var previous = reader.GetString(0);
                reader.Close();
                transaction.Commit();
                return previous;
            }
        }
        if (draft.PaymentMethod == "bank_transfer")
        {
            using var active = CheckoutCommand(connection, transaction, "SELECT TOP 1 order_id FROM checkout_intents WHERE customer_id=@customer AND bank_json IS NOT NULL AND state IN ('pending','reported')", ("@customer", draft.CustomerId));
            if (active.ExecuteScalar() is string openId) throw new CheckoutAlreadyOpenException(openId);
        }
        var id = "ST" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant();
        var now = DateTimeOffset.UtcNow;
        using (var insert = CheckoutCommand(connection, transaction, """
            INSERT INTO customer_orders(id,customer_id,items_json,recipient,phone,address,fulfillment,region,distance_km,weight_kg,
              subtotal,discount,goods_total,shipping_fee,total,voucher_codes_json,tier,status,points_earned,created_at,payment_method,scheduled_at,reward_policy_version)
            VALUES(@id,@customer,@items,@recipient,@phone,@address,@fulfillment,@region,@distance,@weight,
              @subtotal,@discount,@goods,@shipping,@total,@vouchers,@tier,'pending',@points,@now,@method,@schedule,2)
            """, ("@id", id), ("@customer", draft.CustomerId), ("@items", JsonSerializer.Serialize(draft.Items, CheckoutJson)),
            ("@recipient", draft.Recipient), ("@phone", draft.Phone), ("@address", draft.Address), ("@fulfillment", draft.Fulfillment),
            ("@region", draft.Region), ("@distance", draft.DistanceKm), ("@weight", draft.WeightKg), ("@subtotal", draft.Subtotal),
            ("@discount", draft.Discount), ("@goods", draft.GoodsTotal), ("@shipping", draft.ShippingFee), ("@total", draft.Total),
            ("@vouchers", JsonSerializer.Serialize(draft.VoucherCodes)), ("@tier", draft.Tier), ("@points", LoyaltyPolicy.AwardPoints(draft.GoodsTotal, draft.Tier)),
            ("@now", now.ToString("O")), ("@method", draft.PaymentMethod), ("@schedule", draft.ScheduledAt))) insert.ExecuteNonQuery();
        ReserveCheckout(connection, transaction, id, draft.CustomerId, draft.Items, draft.VoucherCodes);
        using (var intent = CheckoutCommand(connection, transaction, """
            INSERT INTO checkout_intents(order_id,customer_id,request_id,request_hash,state,expires_at,bank_json,stock_reserved)
            VALUES(@id,@customer,@request,@hash,'pending',@expires,@bank,1)
            """, ("@id", id), ("@customer", draft.CustomerId), ("@request", draft.RequestId), ("@hash", draft.RequestHash),
            ("@expires", draft.PaymentMethod == "bank_transfer" ? now.AddMinutes(2) : null),
            ("@bank", draft.Bank is null ? null : JsonSerializer.Serialize(draft.Bank, CheckoutJson)))) intent.ExecuteNonQuery();
        // Voucher thanh toán đủ: hoàn tất trong cùng giao dịch giữ kho/tiêu mã, không tạo giao dịch ngân hàng giả.
        QueueAdminEvent(connection, transaction, "order:create:" + id, "order:created",
            new { orderId = id, total = draft.Total, customer = draft.Recipient });
        if (draft.Total == 0)
            CompleteCheckoutPayment(connection, transaction, id, draft.CustomerId, 0, 0, now, "voucher");
        transaction.Commit();
        return id;
    }

    private static void ReserveCheckout(SqlConnection connection, SqlTransaction transaction, string id, long customerId, IReadOnlyList<CheckoutLine> items, IReadOnlyList<string> vouchers, bool honorLockedQuote = false)
    {
        foreach (var item in items.OrderBy(item => item.Id, StringComparer.Ordinal))
        {
            using var command = CheckoutCommand(connection, transaction, "UPDATE catalog_products SET stock_count=stock_count-@quantity WHERE id=@product AND stock_count>=@quantity", ("@quantity", item.Quantity), ("@product", item.Id));
            if (command.ExecuteNonQuery() != 1) throw new InvalidOperationException("PRODUCT_UNAVAILABLE");
        }
        foreach (var code in vouchers.Order(StringComparer.Ordinal))
        {
            using var command = CheckoutCommand(connection, transaction, """
                SELECT customer_id FROM customer_vouchers WHERE code=@code AND (customer_id=@customer OR customer_id IS NULL)
                  AND (@honor=1 OR TRY_CONVERT(datetimeoffset,expires_at)>SYSDATETIMEOFFSET())
                """, ("@code", code), ("@customer", customerId), ("@honor", honorLockedQuote));
            var owner = command.ExecuteScalar();
            if (owner is null) throw new InvalidOperationException("INVALID_VOUCHER");
            if (owner is DBNull) continue;
            using var hold = CheckoutCommand(connection, transaction, "INSERT INTO checkout_voucher_holds(code,order_id) SELECT @code,@id WHERE NOT EXISTS(SELECT 1 FROM checkout_voucher_holds WHERE code=@code)", ("@code", code), ("@id", id));
            if (hold.ExecuteNonQuery() != 1) throw new InvalidOperationException("VOUCHER_RESERVED");
        }
    }

    private static void ReleaseCheckout(SqlConnection connection, SqlTransaction transaction, string id)
    {
        using var query = CheckoutCommand(connection, transaction, "SELECT o.items_json FROM customer_orders o JOIN checkout_intents i ON i.order_id=o.id WHERE o.id=@id AND i.stock_reserved=1", ("@id", id));
        var json = query.ExecuteScalar() as string;
        if (json is null) return;
        foreach (var item in JsonSerializer.Deserialize<List<CheckoutLine>>(json, CheckoutJson) ?? [])
        {
            using var restore = CheckoutCommand(connection, transaction, "UPDATE catalog_products SET stock_count=stock_count+@quantity WHERE id=@product", ("@product", item.Id), ("@quantity", item.Quantity));
            restore.ExecuteNonQuery();
        }
        using var release = CheckoutCommand(connection, transaction, "DELETE FROM checkout_voucher_holds WHERE order_id=@id; UPDATE checkout_intents SET stock_reserved=0 WHERE order_id=@id", ("@id", id));
        release.ExecuteNonQuery();
    }

    private static void ExpireCheckouts(SqlConnection connection, SqlTransaction transaction)
    {
        using var query = CheckoutCommand(connection, transaction, "SELECT order_id FROM checkout_intents WHERE state='pending' AND expires_at<=SYSDATETIMEOFFSET()");
        var ids = new List<string>();
        using (var reader = query.ExecuteReader()) while (reader.Read()) ids.Add(reader.GetString(0));
        foreach (var id in ids)
        {
            ReleaseCheckout(connection, transaction, id);
            using var expire = CheckoutCommand(connection, transaction, "UPDATE checkout_intents SET state='expired' WHERE order_id=@id; UPDATE customer_orders SET status='cancelled' WHERE id=@id", ("@id", id));
            expire.ExecuteNonQuery();
        }
    }

    public void ExpireCheckouts()
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        ExpireCheckouts(connection, transaction);
        transaction.Commit();
    }

    public CheckoutIntent? FindCheckout(string id, long? customerId = null)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT order_id,customer_id,state,expires_at,report_reference,reported_at,bank_json,payment_reference,received_at FROM checkout_intents WHERE order_id=@id AND (@customer IS NULL OR customer_id=@customer)";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@customer", (object?)customerId ?? DBNull.Value);
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(reader.GetString(0), reader.GetInt64(1), reader.GetString(2), reader.IsDBNull(3) ? null : reader.GetDateTimeOffset(3),
            reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetDateTimeOffset(5),
            reader.IsDBNull(6) ? null : JsonSerializer.Deserialize<BankAccount>(reader.GetString(6), CheckoutJson),
            reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetDateTimeOffset(8)) : null;
    }

    public string? FindCheckoutRequest(long customerId, string requestId, string requestHash)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT order_id,request_hash FROM checkout_intents WHERE customer_id=@customer AND request_id=@request";
        command.Parameters.AddWithValue("@customer", customerId);
        command.Parameters.AddWithValue("@request", requestId);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        if (reader.GetString(1) != requestHash) throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
        return reader.GetString(0);
    }

    public void ReportCheckout(string id, long customerId, string reference)
    {
        if (reference.Length is < 3 or > 100) throw new InvalidOperationException("PAYMENT_REFERENCE_REQUIRED");
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        ExpireCheckouts(connection, transaction);
        using var command = CheckoutCommand(connection, transaction, """
            UPDATE checkout_intents SET state=CASE WHEN state IN ('expired','cancelled','needs_review') THEN 'needs_review' ELSE 'reported' END,
              report_reference=@reference,reported_at=COALESCE(reported_at,SYSDATETIMEOFFSET())
            WHERE order_id=@id AND customer_id=@customer AND bank_json IS NOT NULL
              AND state IN ('pending','reported','expired','cancelled','needs_review')
            """, ("@reference", reference), ("@id", id), ("@customer", customerId));
        if (command.ExecuteNonQuery() == 0) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        transaction.Commit();
    }

    public void CancelCheckout(string id, long? customerId = null)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using var query = CheckoutCommand(connection, transaction, "SELECT i.state,o.delivery_status FROM checkout_intents i JOIN customer_orders o ON o.id=i.order_id WHERE order_id=@id AND (@customer IS NULL OR i.customer_id=@customer)", ("@id", id), ("@customer", customerId));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("ORDER_NOT_FOUND");
        var state = reader.GetString(0);
        if (reader.GetString(1) is "shipped" or "delivered") throw new InvalidOperationException("ALREADY_SHIPPED");
        reader.Close();
        if (state is not ("pending" or "cancelled" or "expired")) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        ReleaseCheckout(connection, transaction, id);
        using var command = CheckoutCommand(connection, transaction, "UPDATE checkout_intents SET state='cancelled' WHERE order_id=@id AND state='pending'; UPDATE customer_orders SET status='cancelled' WHERE id=@id AND paid_at IS NULL", ("@id", id));
        command.ExecuteNonQuery();
        transaction.Commit();
    }
}
