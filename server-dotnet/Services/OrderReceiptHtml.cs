using System.Globalization;
using System.Net;
using System.Text.Json;
using StoreApi.Models;

namespace StoreApi.Services;

public static class OrderReceiptHtml
{
    public static string Render(object order, IReadOnlyList<UnmatchedPayment>? unmatched = null)
    {
        var data = JsonSerializer.SerializeToElement(order);
        static string Text(JsonElement element, string name) => element.TryGetProperty(name, out var value) ? value.ToString() : "";
        static long Number(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.TryGetInt64(out var number) ? number : 0;
        static string Escape(string value) => WebUtility.HtmlEncode(value);
        static string Money(long value) => value.ToString("N0", CultureInfo.GetCultureInfo("vi-VN")) + " ₫";
        static string LocalTime(string value) => DateTimeOffset.TryParse(value, out var time)
            ? time.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm:ss") : value;
        var status = Text(data, "status");
        var paid = status is "paid" or "completed" or "delivered" or "refunded";
        var title = paid ? "Biên nhận thanh toán" : unmatched is { Count: > 0 } ? "Phiếu đối soát khoản chuyển không khớp" : "Thông tin yêu cầu đặt hàng";
        var unmatchedSection = unmatched is { Count: > 0 }
            ? "<h2>Khoản chuyển đối soát riêng</h2><p>Các khoản này không cộng vào doanh thu hoặc giá trị đơn đã thanh toán.</p>" +
              "<table><thead><tr><th>Mã nhận / thời điểm</th><th>Số tiền nhận</th><th>Hoàn tiền</th></tr></thead><tbody>" +
              string.Join("", unmatched.Select(item => "<tr><td>" + Escape(item.Reference) + "<br>" + Escape(LocalTime(item.ReceivedAt.ToString("O"))) +
                  "<br>" + Escape(item.Reason) + "</td><td>" + Money(item.Amount) + "</td><td>" +
                  (item.RefundedAt.HasValue ? "Đã hoàn đủ " + Money(item.Amount) + "<br>" + Escape(item.RefundReference ?? "") + "<br>" + Escape(LocalTime(item.RefundedAt.Value.ToString("O"))) : "Chờ hoàn tiền") + "</td></tr>")) +
              "</tbody></table><p class='total'>Còn cần hoàn riêng: " + Money(unmatched.Where(item => !item.RefundedAt.HasValue).Sum(item => item.Amount)) + "</p>"
            : "";
        var items = data.TryGetProperty("items", out var array) ? array.EnumerateArray().Select(item =>
            $"<tr><td>{Escape(Text(item, "name"))}</td><td>{Number(item, "quantity")}</td><td>{Money(Number(item, "price"))}</td><td>{Money(Number(item, "price") * Number(item, "quantity"))}</td></tr>") : [];
        var statusLabel = status switch { "paid" => "Đã thanh toán", "completed" or "delivered" => "Đã nhận hàng", "refunded" => "Đã hoàn tiền", "cancelled" => "Đã hủy / hết hạn", _ => "Chưa xác nhận thanh toán" };
        return $$$"""
            <!doctype html><html lang="vi"><head><meta charset="utf-8"><title>{{{title}}}</title>
            <style>@page{size:A4;margin:16mm}body{font:13px/1.5 Arial,sans-serif;color:#17382c;max-width:850px;margin:24px auto}h1{font-size:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd8ce;padding:8px;text-align:right}th:first-child,td:first-child{text-align:left}tr{break-inside:avoid}thead{display:table-header-group}dt{font-weight:bold}dd{margin:0 0 8px}button{padding:10px 16px}.total{text-align:right;font-size:18px;font-weight:bold}@media print{body{margin:0}button{display:none}}</style></head>
            <body><button onclick="window.print()">In / lưu PDF</button><h1>STORE — {{{title}}}</h1>
            <dl><dt>Mã</dt><dd>{{{Escape(Text(data, "id"))}}}</dd><dt>Trạng thái</dt><dd>{{{statusLabel}}}</dd>
            <dt>Người nhận</dt><dd>{{{Escape(Text(data, "recipient"))}}} · {{{Escape(Text(data, "phone"))}}}</dd>
            <dt>Địa chỉ</dt><dd>{{{Escape(Text(data, "address"))}}}</dd><dt>Ngày tạo / ngày thanh toán (giờ Việt Nam)</dt><dd>{{{Escape(LocalTime(Text(data, "createdAt")))}}} / {{{Escape(LocalTime(Text(data, "paidAt")))}}}</dd></dl>
            <table><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{{{string.Join("", items)}}}</tbody></table>
            <p>Tạm tính: {{{Money(Number(data, "subtotal"))}}} · Giảm tiền hàng: {{{Money(Math.Max(0, Number(data, "subtotal") - Number(data, "goodsTotal")))}}} · Vận chuyển sau giảm: {{{Money(Number(data, "shippingFee"))}}}</p>
            <p class="total">Giá trị đơn ban đầu: {{{Money(Number(data, "total"))}}}</p>
            <p>Khoản bù / phí sau mua đã thu: {{{Money(Number(data, "extraPaid"))}}}</p>
            <p>Hoàn tiền đã ghi nhận: {{{Money(Number(data, "refundAmount"))}}}</p>
            {{{(paid ? "<p class='total'>Số tiền thực giữ sau thu / hoàn: " + Money(Number(data, "total") + Number(data, "extraPaid") - Number(data, "refundAmount")) + "</p>" : "")}}}
            {{{unmatchedSection}}}
            <p>{{{(paid ? "Biên nhận phản ánh trạng thái đã được cửa hàng ghi nhận." : unmatched is { Count: > 0 } ? "Đơn chưa được ghi nhận thành mua hàng. Các khoản tiền thực nhận và hoàn riêng được đối soát ở bảng trên." : "Đây là yêu cầu đặt hàng, chưa xác nhận cửa hàng đã nhận tiền.")}}}</p></body></html>
            """;
    }
}
