using System.Text.Json.Serialization;

namespace StoreApi.Models;

public sealed record SalesDay(
    [property: JsonPropertyName("date")] string Date,
    [property: JsonPropertyName("orders")] long Orders,
    [property: JsonPropertyName("grossRevenue")] long GrossRevenue,
    [property: JsonPropertyName("refunds")] long Refunds,
    [property: JsonPropertyName("revenue")] long Revenue);

public sealed record SalesStatus(
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("count")] long Count);

public sealed record SalesReport(
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] string To,
    [property: JsonPropertyName("allOrders")] long AllOrders,
    [property: JsonPropertyName("includedOrders")] long IncludedOrders,
    [property: JsonPropertyName("grossRevenue")] long GrossRevenue,
    [property: JsonPropertyName("refunds")] long Refunds,
    [property: JsonPropertyName("netRevenue")] long NetRevenue,
    [property: JsonPropertyName("excludedDemoOrders")] long ExcludedDemoOrders,
    [property: JsonPropertyName("undatedOrders")] long UndatedOrders,
    [property: JsonPropertyName("revenueByDay")] IReadOnlyList<SalesDay> RevenueByDay,
    [property: JsonPropertyName("orderStatus")] IReadOnlyList<SalesStatus> OrderStatus)
{
    [JsonPropertyName("timezone")] public string Timezone => "Asia/Ho_Chi_Minh";
    [JsonPropertyName("currency")] public string Currency => "VND";
    [JsonPropertyName("dataMode")] public string DataMode => AllOrders == 0 ? "none" : "real";
    [JsonPropertyName("basis")] public string Basis => "Theo ngày thanh toán tại Việt Nam; trừ khoản hoàn tiền đã ghi nhận của các đơn thuộc kỳ. Không tính đơn chờ thanh toán hoặc bản ghi được đánh dấu mô phỏng.";
}
