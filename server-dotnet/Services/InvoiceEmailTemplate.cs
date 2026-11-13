using System.Globalization;
using System.Net;
using System.Text;

namespace StoreApi.Services;

internal static class InvoiceEmailTemplate
{
    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");
    private static string Encode(string? value) => WebUtility.HtmlEncode(value ?? "");
    private static string Money(long value) => value.ToString("N0", Vietnamese) + " ₫";
    private static string DateLabel(string? value) => DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture,
        DateTimeStyles.None, out var date) ? date.ToOffset(TimeSpan.FromHours(7)).ToString("HH:mm · dd/MM/yyyy", Vietnamese) : "Đang cập nhật";

    public static string Render(OrderInvoiceData invoice, string frontendUrl)
    {
        var id = Encode(invoice.OrderId);
        var payment = VietnameseLabels.Payment(invoice.PaymentMethod);
        var destination = invoice.Fulfillment == "pickup" ? "Nhận tại cửa hàng" : "Giao tận nơi";
        var address = invoice.Fulfillment == "pickup" ? "Theo lịch hẹn tại cửa hàng" : Encode(invoice.Address);
        var link = Encode(frontendUrl.TrimEnd('/') + "/checkout?order=" + Uri.EscapeDataString(invoice.OrderId));
        var rows = new StringBuilder();
        foreach (var item in invoice.Items)
        {
            rows.Append($"""
            <tr>
              <td style="padding:18px 0;border-bottom:1px solid #e7ece5;vertical-align:top;">
                <strong style="font-size:14px;line-height:1.6;color:#213c30;">{Encode(item.Name)}</strong><br>
                <span style="font-size:12px;color:#6c7f73;">Số lượng {item.Quantity} · {Money(item.Price)} / sản phẩm</span>
              </td>
              <td align="right" style="padding:18px 0 18px 12px;border-bottom:1px solid #e7ece5;vertical-align:top;white-space:nowrap;font-size:14px;font-weight:700;color:#213c30;">{Money(item.TotalPrice)}</td>
            </tr>
            """);
        }
        var schedule = string.IsNullOrWhiteSpace(invoice.ScheduledAt) ? "" : $"<p style=\"margin:8px 0 0;\">Lịch giao / nhận: <strong>{DateLabel(invoice.ScheduledAt)}</strong></p>";
        // Biên nhận chỉ được gửi sau đối soát: không kèm QR hay hướng dẫn chuyển tiền lần nữa.
        return $"""
        <!doctype html>
        <html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Biên nhận thanh toán · {id}</title></head>
        <body style="margin:0;padding:0;background:#f1f4ee;font-family:Arial,Helvetica,sans-serif;color:#213c30;">
          <div style="display:none;max-height:0;overflow:hidden;">Đã xác nhận {Money(invoice.Total)} cho đơn {id}. Cảm ơn bạn đã mua sắm tại Store.</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:20px;border:1px solid #e0e7db;overflow:hidden;">
              <tr><td style="padding:28px 28px 24px;background:#173e2e;color:#ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                  <td style="font-size:32px;font-weight:800;letter-spacing:-1.5px;color:#ffffff;">store<span style="color:#a4d5af;">.</span></td>
                  <td align="right" style="font-size:11px;letter-spacing:1.3px;color:#c4dac8;">BIÊN NHẬN<br>THANH TOÁN</td>
                </tr></table>
              </td></tr>
              <tr><td style="padding:30px 28px;background:#edf6ed;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:1px;color:#34734e;">✓ ĐÃ XÁC NHẬN THANH TOÁN</p>
                <h1 style="margin:0 0 12px;font-size:27px;line-height:1.3;color:#173e2e;">Cảm ơn bạn đã chọn Store.</h1>
                <p style="margin:0;font-size:14px;line-height:1.8;color:#4c6855;">Cửa hàng đã ghi nhận thanh toán của bạn.<br>Bạn có thể yên tâm theo dõi tiến độ giao / nhận hàng.</p>
                <p style="margin:22px 0 4px;font-size:12px;color:#4c6855;">TỔNG TIỀN ĐÃ THANH TOÁN</p>
                <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:-1px;color:#1e6241;">{Money(invoice.Total)}</p>
              </td></tr>
              <tr><td style="padding:26px 28px;">
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:1px;color:#6c7f73;">MÃ ĐƠN HÀNG</p>
                <p style="margin:0 0 6px;font-size:17px;font-weight:700;overflow-wrap:anywhere;">{id}</p>
                <p style="margin:0 0 24px;font-size:12px;color:#6c7f73;">Đặt lúc {DateLabel(invoice.CreatedAt)} · Giờ Việt Nam</p>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <thead><tr><th align="left" style="padding:0 0 10px;border-bottom:2px solid #213c30;font-size:12px;">Sản phẩm</th><th align="right" style="padding:0 0 10px;border-bottom:2px solid #213c30;font-size:12px;">Thành tiền</th></tr></thead>
                  <tbody>{rows}</tbody>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;font-size:13px;line-height:2;color:#607367;">
                  <tr><td>Tạm tính</td><td align="right">{Money(invoice.Subtotal)}</td></tr>
                  <tr><td>Giảm tiền hàng</td><td align="right">− {Money(invoice.Discount)}</td></tr>
                  <tr><td>Phí giao hàng sau giảm</td><td align="right">{Money(invoice.ShippingFee)}</td></tr>
                  <tr><td style="padding-top:12px;font-weight:700;color:#213c30;">Tổng đã thanh toán</td><td align="right" style="padding-top:12px;font-size:20px;font-weight:800;color:#1e6241;">{Money(invoice.Total)}</td></tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;background:#f6f8f3;border-radius:12px;"><tr><td style="padding:20px;font-size:13px;line-height:1.8;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:1px;color:#6c7f73;">THÔNG TIN GIAO / NHẬN</p>
                  <strong>{Encode(invoice.Recipient)}</strong> · {Encode(invoice.Phone)}<br>{address}
                  <p style="margin:8px 0 0;">{destination} · {Encode(payment)}</p>{schedule}
                </td></tr></table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px auto 18px;"><tr><td align="center" style="border-radius:10px;background:#236343;"><a href="{link}" style="display:inline-block;padding:15px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Theo dõi đơn hàng →</a></td></tr></table>
                <p style="margin:0;text-align:center;font-size:12px;line-height:1.8;color:#6c7f73;">Thanh toán đã hoàn tất. Bạn không cần chuyển thêm tiền cho đơn này.<br>Trạng thái chuẩn bị / giao hàng được cập nhật riêng trên website.</p>
              </td></tr>
              <tr><td style="padding:22px 28px;border-top:1px solid #e7ece5;text-align:center;font-size:12px;line-height:1.8;color:#6c7f73;">Store · Những điều nhỏ, cho một ngày tốt hơn.<br>Cần hỗ trợ? <a href="{Encode(frontendUrl.TrimEnd('/') + "/contact")}" style="color:#236343;">Liên hệ cửa hàng</a><br>Vui lòng giữ biên nhận này để tra cứu giao dịch.</td></tr>
            </table>
          </td></tr></table>
        </body></html>
        """;
    }
}
