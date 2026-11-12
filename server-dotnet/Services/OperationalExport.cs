using System.Globalization;
using System.Text.Json;
using StoreApi.Data;

namespace StoreApi.Services;

public static class OperationalExport
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static bool IsAllowed(string? module) => module is "products" or "customers" or "customer-orders" or "inventory" or "support" or "returns" or "reviews";

    public static byte[] Excel(StoreDb db, string module)
    {
        List<object[]> rows;
        string name;
        int[] widths;
        switch (module)
        {
            case "products":
                name = "Hàng hóa";
                widths = [42, 60, 24, 24, 16, 18, 18, 65, 90];
                rows = [["Mã", "Tên sản phẩm", "Danh mục", "Giá gốc (VND)", "Giảm (%)", "Tồn khả dụng", "Lượt xem", "Ảnh", "Mô tả"]];
                rows.AddRange(db.Catalog().Select(p => new object[] { p.Id, p.Name, p.Category, p.Price, p.DiscountPercent, p.StockCount, p.ViewCount, p.Image, p.Description }));
                break;
            case "customers":
                name = "Khách hàng";
                widths = [15, 32, 42, 18, 24, 22, 20, 26];
                rows = [["Mã khách", "Tên tài khoản", "Email", "Điểm", "Tiền hàng đã mua (VND)", "Lượt quay còn lại", "Hạng", "Ngày tạo (VN)"]];
                rows.AddRange(Elements(db.ListAdminCustomers()).Select(p => new object[] { Text(p, "id"), Text(p, "username"), Text(p, "email"),
                    Number(p, "points"), Number(p, "paidGoodsTotal"), Number(p, "spinCredits"), Text(p, "tier"), Time(p, "createdAt") }));
                break;
            case "customer-orders":
                name = "Đơn hàng";
                widths = [30, 28, 26, 24, 24, 28, 22, 65, 24, 24, 24, 26, 26, 26, 26, 26];
                rows = [["Mã đơn", "Tài khoản", "Trạng thái đơn", "Thanh toán", "Giao hàng", "Người nhận", "Điện thoại", "Địa chỉ", "Giá trị đơn (VND)",
                    "Khoản bù đã thu (VND)", "Hoàn của đơn (VND)", "Chuyển ngoài đơn (VND)", "Đã hoàn riêng (VND)", "Còn hoàn riêng (VND)", "Đã thanh toán lúc (VN)", "Hẹn giao/nhận (VN)"]];
                rows.AddRange(Elements(db.ListAllAdminOrders()).Select(p => new object[] { Text(p, "id"), Text(p, "username"), Text(p, "status"), Text(p, "paymentMethod"),
                    Text(p, "deliveryStatus"), Text(p, "recipient"), Text(p, "phone"), Text(p, "address"), Number(p, "total"), Number(p, "extraPaid"), Number(p, "refundAmount"),
                    Number(p, "unmatchedReceived"), Number(p, "unmatchedRefunded"), Number(p, "unmatchedOutstanding"), Time(p, "paidAt"), Time(p, "scheduledAt") }));
                break;
            case "inventory":
                name = "Xuất nhập kho";
                widths = [15, 36, 24, 45, 30, 20, 65, 24, 26];
                rows = [["Mã phiếu", "Tên phiếu", "Loại", "Sản phẩm / mã", "Kho", "Số lượng", "Ghi chú", "Trạng thái", "Cập nhật (VN)"]];
                rows.AddRange(Elements(db.ListAdminRecords("inventory")).Select(p => new object[] { Text(p, "id"), Text(p, "title"), Text(Data(p), "kind"),
                    Text(Data(p), "product"), Text(Data(p), "warehouse"), Number(Data(p), "quantity"), Text(Data(p), "note"), Text(p, "status"), Time(p, "updatedAt") }));
                break;
            case "support":
                name = "Chăm sóc khách hàng";
                widths = [15, 40, 32, 40, 32, 42, 90, 26, 26];
                rows = [["Mã yêu cầu", "Tiêu đề", "Khách hàng", "Chủ đề", "Phụ trách", "Email phản hồi", "Nội dung", "Trạng thái", "Cập nhật (VN)"]];
                rows.AddRange(Elements(db.ListAdminRecords("support")).Select(p => new object[] { Text(p, "id"), Text(p, "title"), Text(Data(p), "customer"),
                    Text(Data(p), "topic"), Text(Data(p), "assignee"), Text(Data(p), "email"), Text(Data(p), "message"), Text(p, "status"), Time(p, "updatedAt") }));
                break;
            case "returns":
                name = "Đổi trả hàng";
                widths = [30, 30, 28, 24, 28, 70, 24, 24, 24, 26, 26, 26, 65];
                rows = [["Mã yêu cầu", "Mã đơn", "Khách hàng", "Loại", "Trạng thái", "Lý do", "Phí (VND)", "Cần bù (VND)", "Cần hoàn (VND)",
                    "Ngày yêu cầu (VN)", "Đã thu bù (VN)", "Đã hoàn (VN)", "Ghi chú"]];
                rows.AddRange(Elements(db.AfterSalesCases()).Select(p => new object[] { Text(p, "id"), Text(p, "orderId"), Text(p, "username"), Text(p, "kind"), Text(p, "status"),
                    Text(p, "reason"), Number(Property(p, "quote"), "feeAmount"), Number(Property(p, "quote"), "additionalDue"), Number(Property(p, "quote"), "refundAmount"),
                    Time(p, "createdAt"), Time(p, "feePaidAt"), Time(p, "refundedAt"), Text(p, "note") }));
                break;
            case "reviews":
                name = "Đánh giá";
                widths = [15, 42, 60, 30, 14, 90, 90, 26];
                rows = [["Mã", "Mã sản phẩm", "Sản phẩm", "Khách hàng", "Số sao", "Đánh giá", "Phản hồi", "Ngày tạo (VN)"]];
                rows.AddRange(Elements(db.ListAdminReviews()).Select(p => new object[] { Text(p, "id"), Text(p, "productId"), Text(p, "productName"), Text(p, "username"),
                    Number(p, "rating"), Text(p, "comment"), Text(p, "adminReply"), Time(p, "createdAt") }));
                break;
            default:
                throw new InvalidOperationException("EXPORT_MODULE_NOT_FOUND");
        }
        return ReportExport.ExcelTable(name, rows, widths);
    }

    // Chỉ chiếu các cột công khai trong nghiệp vụ được phép; không xuất nguyên đối tượng chứa trường nội bộ.
    private static IEnumerable<JsonElement> Elements(object value) => JsonSerializer.SerializeToElement(value, Json).EnumerateArray();
    private static JsonElement Property(JsonElement value, string name) => value.ValueKind == JsonValueKind.Object && value.TryGetProperty(name, out var property) ? property : default;
    private static JsonElement Data(JsonElement value) => Property(value, "data");
    private static string Text(JsonElement value, string name)
    {
        var property = Property(value, name);
        return property.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined ? "" : property.ToString();
    }
    private static object Number(JsonElement value, string name) => decimal.TryParse(Text(value, name), NumberStyles.Number, CultureInfo.InvariantCulture, out var number) ? number : Text(value, name);
    private static string Time(JsonElement value, string name)
    {
        var text = Text(value, name);
        return text.Contains('T') && DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm:ss") : text;
    }
}
