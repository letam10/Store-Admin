/*
  FILE NOTE
  - Mục đích: Các hàm truy vấn tổng hợp SQL Server cung cấp ngữ cảnh cho AI Local (đơn hàng, sản phẩm trong đơn, bán chạy, vận hành Admin, tài khoản khách hàng).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.cs, Store-Admin/server-dotnet/Services/AiStoreContext.cs
  - Vùng ảnh hưởng khi sửa: Toàn bộ dữ liệu ngữ cảnh SQL Server nạp cho mô hình AI Local.
*/

using System.Globalization;
using System.Text.Json;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public const int PresenceWindowSeconds = 90;
    public sealed record PublicVoucherFact(string Code, string Label, string Type, int Value, string Scope, DateTimeOffset ExpiresAt);
    public sealed record OnlineSupportFact(string DisplayName, string Role);
    public sealed record AiTopSoldProductFact(string ProductId, string Name, string Category, int QuantitySold, int OrderCount, long TotalRevenue, long CurrentSalePrice, int StockCount, string Image);
    public sealed record AiProductRatingFact(string ProductId, double AverageRating, int ReviewCount);

    public IReadOnlyList<PublicVoucherFact> PublicAiVouchers()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT code,label,type,value,scope,TRY_CONVERT(datetimeoffset,expires_at)
            FROM customer_vouchers WHERE customer_id IS NULL
              AND TRY_CONVERT(datetimeoffset,expires_at)>@now ORDER BY expires_at,code
            """;
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        using var reader = command.ExecuteReader();
        var items = new List<PublicVoucherFact>();
        while (reader.Read()) items.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2),
            Convert.ToInt32(reader.GetValue(3)), reader.GetString(4), reader.GetDateTimeOffset(5)));
        return items;
    }

    public bool TouchAdminPresence(string tokenHash)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE s SET last_seen_at=@now FROM admin_sessions s JOIN admins a ON a.id=s.admin_id
            WHERE s.token_hash=@token AND a.active=1 AND TRY_CONVERT(datetimeoffset,s.expires_at)>@now
            """;
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        command.Parameters.AddWithValue("@token", tokenHash);
        return command.ExecuteNonQuery() == 1;
    }

    public IReadOnlyList<OnlineSupportFact> OnlineSupportStaff()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT a.id,a.display_name,a.role FROM admins a JOIN admin_sessions s ON s.admin_id=a.id
            WHERE a.active=1 AND a.role IN ('staff','admin') AND s.last_seen_at>=@since
              AND TRY_CONVERT(datetimeoffset,s.expires_at)>@now
            GROUP BY a.id,a.display_name,a.role ORDER BY a.id
            """;
        var now = DateTimeOffset.UtcNow;
        command.Parameters.AddWithValue("@now", now);
        command.Parameters.AddWithValue("@since", now.AddSeconds(-PresenceWindowSeconds));
        using var reader = command.ExecuteReader();
        var people = new List<OnlineSupportFact>();
        while (reader.Read())
        {
            var role = reader.GetString(2);
            var name = reader.GetString(1).Trim();
            people.Add(new(name.Length == 0 ? role == "admin" ? "Quản trị Store" : "Nhân viên Store" : name, role));
        }
        return people;
    }

    public bool OwnsConversation(string id, string owner, string kind)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM conversations WHERE id=@id AND owner_key=@owner AND kind=@kind";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@owner", owner);
        command.Parameters.AddWithValue("@kind", kind);
        return Convert.ToInt32(command.ExecuteScalar(), CultureInfo.InvariantCulture) == 1;
    }

    public ChatStoredRequest? FindChatRequest(string owner, string requestId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT t.conversation_id,t.kind,t.user_content,t.assistant_content,t.status,t.sources_json,t.report_json,t.verified_json
            FROM chat_turns t JOIN conversations c ON c.id=t.conversation_id
            WHERE t.owner_key=@owner AND t.request_id=@request AND c.owner_key=@owner AND c.kind=t.kind
            """;
        command.Parameters.AddWithValue("@owner", owner);
        command.Parameters.AddWithValue("@request", requestId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
            reader.GetString(5), reader.GetString(6), reader.GetString(7)) : null;
    }

    // Tổng hợp TOP sản phẩm được mua nhiều nhất thực tế từ bảng customer_orders (không lộ PII khách hàng)
    public IReadOnlyList<AiTopSoldProductFact> AiTopSellingProducts(int limit = 15)
    {
        var result = new List<AiTopSoldProductFact>();
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (@limit)
                ISNULL(JSON_VALUE(j.value, '$.id'), '') AS product_id,
                COALESCE(MAX(p.name), MAX(JSON_VALUE(j.value, '$.name')), N'Sản phẩm') AS name,
                COALESCE(MAX(p.category), N'Khác') AS category,
                SUM(ISNULL(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.quantity')), 1)) AS qty_sold,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(CAST(ISNULL(TRY_CONVERT(INT, JSON_VALUE(j.value, '$.quantity')), 1) AS BIGINT)
                    * ISNULL(TRY_CONVERT(BIGINT, JSON_VALUE(j.value, '$.price')), 0)) AS total_revenue,
                COALESCE(MAX(p.price), 0) AS orig_price,
                COALESCE(MAX(p.discount_percent), 0) AS discount_pct,
                COALESCE(MAX(p.stock_count), 0) AS stock_count,
                COALESCE(MAX(p.image), '') AS image
            FROM customer_orders o
            CROSS APPLY OPENJSON(COALESCE(o.current_items_json, o.items_json)) j
            LEFT JOIN catalog_products p ON p.id = JSON_VALUE(j.value, '$.id')
            WHERE o.status IN ('paid', 'completed', 'delivered')
              AND ISJSON(COALESCE(o.current_items_json, o.items_json)) = 1
            GROUP BY JSON_VALUE(j.value, '$.id')
            ORDER BY qty_sold DESC, total_revenue DESC
            """;
        command.Parameters.AddWithValue("@limit", Math.Clamp(limit, 1, 50));
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var origPrice = Convert.ToInt64(reader.GetValue(6));
            var disc = Convert.ToInt32(reader.GetValue(7));
            var salePrice = (long)decimal.Round(origPrice * (100 - disc) / 1000m, 0, MidpointRounding.ToEven) * 10;
            result.Add(new(
                reader.GetString(0),
                reader.GetString(1),
                VietnameseLabels.Category(reader.GetString(2)),
                Convert.ToInt32(reader.GetValue(3)),
                Convert.ToInt32(reader.GetValue(4)),
                Convert.ToInt64(reader.GetValue(5)),
                salePrice,
                Convert.ToInt32(reader.GetValue(8)),
                reader.GetString(9)));
        }
        return result;
    }

    // Tổng hợp điểm đánh giá trung bình theo từng sản phẩm
    public IReadOnlyDictionary<string, AiProductRatingFact> AiProductRatingsMap()
    {
        var map = new Dictionary<string, AiProductRatingFact>(StringComparer.OrdinalIgnoreCase);
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT product_id, AVG(CAST(rating AS FLOAT)), COUNT(*) FROM product_reviews GROUP BY product_id";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var pid = reader.GetString(0);
            map[pid] = new(pid, Math.Round(reader.GetDouble(1), 2), Convert.ToInt32(reader.GetValue(2)));
        }
        return map;
    }

    // Lấy chi tiết đơn hàng KÈM danh sách sản phẩm trong đơn (Admin xem toàn bộ; Khách chỉ xem đơn của chính mình)
    public IReadOnlyList<object> AiRecentOrdersDetail(int limit = 20, long? customerId = null, string? orderIdOrQuery = null)
    {
        var orders = new List<object>();
        using var connection = Open();
        using var command = connection.CreateCommand();
        var hasSearch = !string.IsNullOrWhiteSpace(orderIdOrQuery);
        command.CommandText = """
            SELECT TOP (@limit)
                o.id, o.status, o.delivery_status, o.payment_method, o.fulfillment,
                o.recipient, o.phone, o.address,
                o.subtotal, o.discount, o.goods_total, o.shipping_fee, o.total,
                o.extra_paid, o.refund_amount, o.created_at, o.paid_at,
                COALESCE(o.current_items_json, o.items_json),
                COALESCE(c.username, N'Khách'),
                COALESCE(i.state, '')
            FROM customer_orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN checkout_intents i ON i.order_id = o.id
            WHERE (@cid IS NULL OR o.customer_id = @cid)
              AND (@search IS NULL OR o.id LIKE @search OR o.recipient LIKE @search OR c.username LIKE @search OR o.items_json LIKE @search)
            ORDER BY o.created_at DESC
            """;
        command.Parameters.AddWithValue("@limit", Math.Clamp(limit, 1, 40));
        command.Parameters.AddWithValue("@cid", (object?)customerId ?? DBNull.Value);
        command.Parameters.AddWithValue("@search", hasSearch ? "%" + orderIdOrQuery!.Trim() + "%" : DBNull.Value);

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var rawItems = reader.IsDBNull(17) ? "[]" : reader.GetString(17);
            List<CheckoutLine> lines;
            try { lines = JsonSerializer.Deserialize<List<CheckoutLine>>(rawItems, CheckoutJson) ?? []; }
            catch { lines = []; }

            var createdRaw = reader.IsDBNull(15) ? "" : reader.GetString(15);
            var paidRaw = reader.IsDBNull(16) ? null : reader.GetString(16);
            string FormatVn(string? iso) => !string.IsNullOrWhiteSpace(iso) && DateTimeOffset.TryParse(iso, out var dt)
                ? dt.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm")
                : (iso ?? "");

            orders.Add(new
            {
                orderId = reader.GetString(0),
                status = VietnameseLabels.Status(reader.GetString(1)),
                rawStatus = reader.GetString(1),
                deliveryStatus = VietnameseLabels.Status(reader.GetString(2)),
                paymentMethod = VietnameseLabels.Payment(reader.GetString(3)),
                paymentState = string.IsNullOrWhiteSpace(reader.GetString(19)) ? null : VietnameseLabels.Status(reader.GetString(19)),
                fulfillment = reader.GetString(4) == "pickup" ? "Nhận tại cửa hàng" : "Giao tận nơi",
                customerUsername = reader.GetString(18),
                recipient = reader.GetString(5),
                subtotal = reader.GetInt32(8),
                discount = reader.GetInt32(9),
                shippingFee = reader.GetInt32(11),
                total = reader.GetInt32(12),
                extraPaid = reader.GetInt64(13),
                refundAmount = Convert.ToInt64(reader.GetValue(14)),
                netPaid = reader.GetInt32(12) + reader.GetInt64(13) - Convert.ToInt64(reader.GetValue(14)),
                createdAt = FormatVn(createdRaw),
                paidAt = paidRaw is null ? null : FormatVn(paidRaw),
                items = lines.Select(item => new
                {
                    productId = item.Id,
                    productName = item.Name,
                    quantity = item.Quantity,
                    unitPriceVnd = item.Price,
                    lineTotalVnd = item.Price * item.Quantity
                }).ToArray()
            });
        }
        return orders;
    }

    // Tổng quan vận hành trực tiếp cho Admin AI
    public object AiAdminOperationsSnapshot()
    {
        var customers = ListAdminCustomers().Take(10).ToArray();
        var reviews = ListAdminReviews();
        var afterSales = AfterSalesCases().Take(10).ToArray();
        var supportTickets = ListAdminRecords("support").Take(8).ToArray();
        var lowStock = Catalog().Where(p => p.StockCount <= 5).OrderBy(p => p.StockCount).Take(12)
            .Select(p => new { id = p.Id, name = p.Name, category = VietnameseLabels.Category(p.Category), stockCount = p.StockCount, salePrice = AiStoreContext.SalePrice(p) }).ToArray();

        return new
        {
            totalCustomers = CustomerCount(),
            topCustomers = customers,
            totalOrders = OrderCount(),
            totalViews = TotalViews(),
            topViewedProducts = TopViews(10),
            topFavoritedProducts = ListAdminFavorites().Take(10).ToArray(),
            lowOrOutOfStockProducts = lowStock,
            reviewsSummary = new
            {
                total = reviews.Count,
                recent = reviews.Take(8).ToArray()
            },
            afterSalesRecent = afterSales,
            supportTicketsRecent = supportTickets,
            vouchersCount = ListAdminVouchers().Count
        };
    }

    // Dữ liệu cá nhân an toàn cho chính khách hàng đang đăng nhập (cô lập tuyệt đối theo customerId)
    public object? AiCustomerPersonalSnapshot(long customerId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT username, email, points, paid_goods_total, spin_credits FROM customers WHERE id = @id";
        command.Parameters.AddWithValue("@id", customerId);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;

        var points = Convert.ToInt32(reader.GetValue(2));
        var tier = points >= 10000 ? "Kim cương" : points >= 1000 ? "Vàng" : points >= 100 ? "Bạc" : "Đồng";
        var profile = new
        {
            username = reader.GetString(0),
            points,
            tier,
            paidGoodsTotalVnd = Convert.ToInt64(reader.GetValue(3)),
            spinCredits = Convert.ToInt32(reader.GetValue(4))
        };
        reader.Close();

        return new
        {
            profile,
            myVouchers = Vouchers(customerId),
            myFavoriteProductIds = Favorites(customerId).Take(15).ToArray(),
            myRecentOrders = AiRecentOrdersDetail(limit: 10, customerId: customerId)
        };
    }

    public sealed record ChatStoredRequest(string ConversationId, string Kind, string UserContent, string AssistantContent,
        string Status, string SourcesJson, string ReportJson, string VerifiedJson);
}
