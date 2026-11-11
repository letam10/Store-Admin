using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private void EnsureAfterSalesTables()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            IF COL_LENGTH('customer_orders','delivered_at') IS NULL
              ALTER TABLE customer_orders ADD delivered_at DATETIMEOFFSET NULL;
            IF COL_LENGTH('customer_orders','extra_paid') IS NULL
              ALTER TABLE customer_orders ADD extra_paid BIGINT NOT NULL DEFAULT 0;
            IF COL_LENGTH('customer_orders','current_items_json') IS NULL
              ALTER TABLE customer_orders ADD current_items_json NVARCHAR(MAX) NULL;
            IF COL_LENGTH('customer_orders','current_goods_total') IS NULL
              ALTER TABLE customer_orders ADD current_goods_total BIGINT NULL;
            IF OBJECT_ID('after_sales_refunds') IS NULL CREATE TABLE after_sales_refunds(
              case_id NVARCHAR(100) PRIMARY KEY, reference_hash NVARCHAR(64) NOT NULL UNIQUE,
              reference NVARCHAR(100) NOT NULL, amount BIGINT NOT NULL, refunded_at DATETIMEOFFSET NOT NULL);
            """;
        command.ExecuteNonQuery();
    }

    private sealed record AfterSalesOrder(string Id, long CustomerId, string Username, string Status, string Delivery,
        string Fulfillment, string Method, string? Schedule, DateTimeOffset? DeliveredAt, long Goods, long Shipping,
        long RemainingPaid, int Points, List<CheckoutLine> Items);

    private static AfterSalesOrder ReadAfterSalesOrder(SqlConnection connection, SqlTransaction transaction, string id, long? customerId = null)
    {
        using var query = CheckoutCommand(connection, transaction, """
            SELECT o.customer_id,c.username,o.status,o.delivery_status,o.fulfillment,o.payment_method,o.scheduled_at,
              o.delivered_at,COALESCE(o.current_goods_total,o.goods_total),o.shipping_fee,
              CAST(o.total AS BIGINT)+o.extra_paid-o.refund_amount,o.points_earned,COALESCE(o.current_items_json,o.items_json)
            FROM customer_orders o JOIN customers c ON c.id=o.customer_id
            WHERE o.id=@id AND (@customer IS NULL OR o.customer_id=@customer)
            """, ("@id", id), ("@customer", customerId));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("ORDER_NOT_FOUND");
        return new(id, reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
            reader.GetString(4), reader.GetString(5), reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.IsDBNull(7) ? null : reader.GetDateTimeOffset(7), Convert.ToInt64(reader.GetValue(8)),
            reader.GetInt32(9), reader.GetInt64(10), reader.GetInt32(11),
            JsonSerializer.Deserialize<List<CheckoutLine>>(reader.GetString(12), CheckoutJson)!);
    }

    public object CreateAfterSalesCase(long customerId, string orderId, AfterSalesCreateRequest request)
    {
        var kind = (request.Kind ?? "").Trim().ToLowerInvariant();
        var reason = (request.Reason ?? "").Trim();
        if (kind is not ("cancel" or "return" or "exchange" or "merchant_fault" or "reschedule") || reason.Length is < 5 or > 1000)
            throw new InvalidOperationException("INVALID_AFTER_SALES");
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        var order = ReadAfterSalesOrder(connection, transaction, orderId, customerId);
        var now = DateTimeOffset.UtcNow;
        AfterSalesPolicy.Validate(kind, order.Status, order.Delivery, order.DeliveredAt, order.Schedule, request.ScheduledAt, now);
        using (var open = CheckoutCommand(connection, transaction, """
            SELECT COUNT(*) FROM admin_records WHERE module='after-sales' AND JSON_VALUE(data_json,'$.orderId')=@order
              AND JSON_VALUE(data_json,'$.status') NOT IN ('resolved','rejected','cancelled')
            """, ("@order", orderId)))
            if (Convert.ToInt32(open.ExecuteScalar()) > 0) throw new InvalidOperationException("AFTER_SALES_ALREADY_OPEN");
        var replacements = kind == "exchange" ? QuoteReplacement(connection, transaction, request.ReplacementItems) : [];
        var quote = AfterSalesPolicy.Quote(kind, order.RemainingPaid, order.Goods,
            order.Fulfillment == "pickup" ? 0 : order.Shipping, replacements.Sum(item => item.Price * item.Quantity));
        var item = new AfterSalesCase
        {
            PolicyVersion = AfterSalesPolicy.Version, Id = "AS-" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant(),
            CustomerId = customerId, OrderId = orderId, Username = order.Username, Kind = kind, Reason = reason,
            Fulfillment = order.Fulfillment, PaymentMethod = order.Method,
            ScheduledAt = kind == "reschedule" ? DateTimeOffset.Parse(request.ScheduledAt!).ToString("O") : null,
            Quote = quote, OriginalItems = order.Items, ReplacementItems = replacements, CreatedAt = now
        };
        item.Events.Add(new("create", "Khách hàng", "Đã lập bảng phí, chờ khách xác nhận", now));
        using var insert = CheckoutCommand(connection, transaction, """
            INSERT INTO admin_records(module,title,status,data_json,created_at,updated_at)
            VALUES('after-sales',@title,@status,@data,@now,@now); SELECT CAST(SCOPE_IDENTITY() AS INT);
            """, ("@title", item.Id + " · " + orderId), ("@status", item.Status),
            ("@data", JsonSerializer.Serialize(item, CheckoutJson)), ("@now", now.ToString("O")));
        item.RecordId = Convert.ToInt32(insert.ExecuteScalar());
        transaction.Commit();
        return AfterSalesView(item);
    }

    private static List<CheckoutLine> QuoteReplacement(SqlConnection connection, SqlTransaction transaction, List<QuoteItemRequest>? lines)
    {
        if (lines is null || lines.Count is < 1 or > 100 || lines.Any(line => string.IsNullOrWhiteSpace(line.Id) || line.Quantity is < 1 or > 999)
            || lines.Select(line => line.Id!.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != lines.Count)
            throw new InvalidOperationException("INVALID_REPLACEMENT");
        var items = new List<CheckoutLine>();
        foreach (var line in lines)
        {
            using var query = CheckoutCommand(connection, transaction,
                "SELECT id,name,price,discount_percent,stock_count FROM catalog_products WHERE id=@id", ("@id", line.Id!.Trim()));
            using var reader = query.ExecuteReader();
            if (!reader.Read() || reader.GetInt32(4) < line.Quantity) throw new InvalidOperationException("PRODUCT_UNAVAILABLE");
            var price = (long)decimal.Round(Convert.ToDecimal(reader.GetValue(2)) * (100 - reader.GetInt32(3)) / 1000M, 0, MidpointRounding.ToEven) * 10;
            if (price < 0 || price > int.MaxValue) throw new InvalidOperationException("ORDER_TOTAL_TOO_LARGE");
            items.Add(new(reader.GetString(0), reader.GetString(1), line.Quantity, price));
        }
        if (items.Sum(item => item.Price * item.Quantity) > int.MaxValue - 100000000) throw new InvalidOperationException("ORDER_TOTAL_TOO_LARGE");
        return items;
    }

    public IReadOnlyList<object> AfterSalesCases(long? customerId = null, string? orderId = null)
    {
        using var connection = Open();
        using var query = connection.CreateCommand();
        query.CommandText = """
            SELECT id,data_json FROM admin_records WHERE module='after-sales'
              AND (@customer IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(data_json,'$.customerId'))=@customer)
              AND (@order IS NULL OR JSON_VALUE(data_json,'$.orderId')=@order) ORDER BY id DESC
            """;
        query.Parameters.AddWithValue("@customer", (object?)customerId ?? DBNull.Value);
        query.Parameters.AddWithValue("@order", (object?)orderId ?? DBNull.Value);
        using var reader = query.ExecuteReader();
        var cases = new List<object>();
        while (reader.Read()) cases.Add(AfterSalesView(JsonSerializer.Deserialize<AfterSalesCase>(reader.GetString(1), CheckoutJson)!));
        return cases;
    }

    private static AfterSalesCase ReadAfterSalesCase(SqlConnection connection, SqlTransaction transaction, string id, long? customerId = null)
    {
        using var query = CheckoutCommand(connection, transaction, """
            SELECT id,data_json FROM admin_records WHERE module='after-sales' AND JSON_VALUE(data_json,'$.id')=@id
              AND (@customer IS NULL OR TRY_CONVERT(bigint,JSON_VALUE(data_json,'$.customerId'))=@customer)
            """, ("@id", id), ("@customer", customerId));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("AFTER_SALES_NOT_FOUND");
        var item = JsonSerializer.Deserialize<AfterSalesCase>(reader.GetString(1), CheckoutJson)!;
        item.RecordId = reader.GetInt32(0);
        if (item.PolicyVersion != AfterSalesPolicy.Version) throw new InvalidOperationException("LEGACY_AFTER_SALES_REVIEW_REQUIRED");
        return item;
    }

    private static void SaveAfterSalesCase(SqlConnection connection, SqlTransaction transaction, AfterSalesCase item)
    {
        using var update = CheckoutCommand(connection, transaction,
            "UPDATE admin_records SET data_json=@data,status=@status,updated_at=@now WHERE id=@id AND module='after-sales'",
            ("@data", JsonSerializer.Serialize(item, CheckoutJson)), ("@status", item.Status),
            ("@now", DateTimeOffset.UtcNow.ToString("O")), ("@id", item.RecordId));
        update.ExecuteNonQuery();
    }

    private static object AfterSalesView(AfterSalesCase item) => new
    {
        item.Id, item.OrderId, item.Username, item.Kind, item.Reason, item.ScheduledAt, item.Status, item.Quote, item.Fulfillment, item.PaymentMethod,
        item.OriginalItems, item.ReplacementItems, item.CreatedAt, item.GoodsReceivedAt, item.FeePaidAt,
        item.FeeReportedAt, item.FeePaymentReportedReference, item.FeePaymentReference, item.RefundedAt,
        item.RefundReference, item.TrackingReference, item.Restocked, item.Note, item.Events, item.FeePaymentExpiresAt,
        legacyReviewRequired = item.PolicyVersion != AfterSalesPolicy.Version
    };
}
