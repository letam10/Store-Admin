using System;
using System.Net;
using System.Text;

namespace StoreApi.Services;

public static class EmailTemplates
{
    public static string BuildWelcomeEmailHtml(string username, string email, string createdAt, string frontendUrl)
    {
        var u = WebUtility.HtmlEncode(username);
        var e = WebUtility.HtmlEncode(email);
        return $"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Store Welcome</title></head>
<body style="margin:0;padding:24px;background:#f3f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e2922;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe6dd;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
    <div style="background:#1b3d2f;padding:28px;text-align:center;color:#fff;">
      <h1 style="margin:0;font-size:30px;letter-spacing:-1px;">store<span style="color:#6be092;">.</span></h1>
      <p style="margin:4px 0 0;font-size:13px;color:#c9e7d3;text-transform:uppercase;letter-spacing:1px;">Cửa hàng tiện lợi & phong cách sống</p>
    </div>
    <div style="padding:28px 24px;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;background:#e3f5e9;color:#217743;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;">✓ ĐĂNG KÝ THÀNH CÔNG</span>
        <h2 style="margin:12px 0 6px;color:#152c21;font-size:22px;">Chào mừng {u}!</h2>
        <p style="margin:0;color:#55695e;font-size:14px;">Tài khoản của bạn đã được khởi tạo thành công tại Store.</p>
      </div>
      <div style="background:#f7faf8;border:1px solid #e1ebe3;border-radius:12px;padding:16px;margin-bottom:20px;font-size:14px;">
        <div style="font-weight:700;color:#2d4a3b;margin-bottom:8px;text-transform:uppercase;font-size:12px;">Thông tin tài khoản:</div>
        <div style="padding:4px 0;">👤 <strong>Tên đăng nhập:</strong> {u}</div>
        <div style="padding:4px 0;">✉ <strong>Email:</strong> {e}</div>
        <div style="padding:4px 0;">🕒 <strong>Thời gian kích hoạt:</strong> {createdAt}</div>
        <div style="padding:4px 0;">🏅 <strong>Hạng thành viên:</strong> <span style="background:#fce8d5;color:#8f4a14;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">ĐỒNG (BRONZE)</span></div>
      </div>
      <div style="font-size:13px;color:#3e5447;line-height:1.7;margin-bottom:24px;">
        <div>🎁 <strong>Tích điểm mua sắm:</strong> Nhận điểm trên mỗi đơn hàng để nâng hạng và nhận đặc quyền.</div>
        <div>🎡 <strong>Vòng quay may mắn:</strong> Săn voucher giảm giá hàng và mã freeship miễn phí.</div>
        <div>🔒 <strong>Bảo mật:</strong> Bạn có thể bật xác thực 2 lớp (2FA) trong phần Quản lý tài khoản.</div>
      </div>
      <div style="text-align:center;margin:24px 0 10px;">
        <a href="{frontendUrl}" style="display:inline-block;background:#205e3e;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 30px;border-radius:10px;">Khám Phá Cửa Hàng Ngay →</a>
      </div>
    </div>
    <div style="background:#f8faf8;border-top:1px solid #e7efe9;padding:16px;text-align:center;font-size:11px;color:#809487;">
      © 2026 Store. Đây là thư tự động, vui lòng không trả lời thư này.
    </div>
  </div>
</body>
</html>
""";
    }
    public static string BuildInvoiceEmailHtml(OrderInvoiceData invoice, string frontendUrl)
    {
        var itemsRows = new StringBuilder();
        int idx = 1;
        foreach (var item in invoice.Items)
        {
            itemsRows.Append($"""
            <tr style="border-bottom:1px solid #e8efe9;">
              <td style="padding:8px;text-align:center;color:#6b8073;">{idx++}</td>
              <td style="padding:8px;font-weight:600;color:#183225;">{WebUtility.HtmlEncode(item.Name)}</td>
              <td style="padding:8px;text-align:center;">{item.Quantity}</td>
              <td style="padding:8px;text-align:right;">{item.Price:N0} ₫</td>
              <td style="padding:8px;text-align:right;font-weight:700;">{item.TotalPrice:N0} ₫</td>
            </tr>
            """);
        }

        var fulfillmentLabel = invoice.Fulfillment == "pickup" ? "Nhận tại cửa hàng" : "Giao tận nơi";
        var paymentLabel = invoice.PaymentMethod switch
        {
            "bank_transfer" => "Chuyển khoản / VietQR",
            "cash" => "Tiền mặt tại quầy",
            "cod" => "Thanh toán khi nhận hàng",
            _ => invoice.PaymentMethod
        };

        var bankBox = invoice.PaymentMethod == "bank_transfer" ? $"""
        <div style="background:#eef7f0;border:1px solid #c8e5cf;border-radius:8px;padding:12px;margin-top:16px;font-size:13px;">
          <div style="font-weight:700;color:#1b5434;margin-bottom:4px;">THÔNG TIN CHUYỂN KHOẢN:</div>
          <div>Ngân hàng: <strong>MB Bank</strong> · STK: <strong style="color:#1b5434;">0912345678</strong></div>
          <div>Chủ TK: <strong>STORE MINI MART</strong> · Cú pháp: <strong style="background:#fff;padding:2px 6px;border:1px dashed #2d7a4d;">{invoice.OrderId}</strong></div>
        </div>
        """ : "";

        return $"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Hóa đơn #{invoice.OrderId}</title></head>
<body style="margin:0;padding:20px;background:#f2f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c2d24;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #dce8df;box-shadow:0 8px 24px rgba(0,0,0,0.06);">
    <div style="background:#133324;padding:20px 24px;color:#fff;">
      <table style="width:100%;">
        <tr>
          <td><div style="font-size:24px;font-weight:900;">store<span style="color:#5ae28a;">.</span></div><div style="color:#b2ddc2;font-size:11px;text-transform:uppercase;">Hóa đơn điện tử</div></td>
          <td style="text-align:right;"><div style="background:#285a40;display:inline-block;padding:4px 10px;border-radius:6px;font-weight:700;font-size:12px;">#{invoice.OrderId}</div><div style="color:#b2ddc2;font-size:11px;margin-top:3px;">{invoice.CreatedAt}</div></td>
        </tr>
      </table>
    </div>
    <div style="padding:20px;">
      <div style="background:#eaf8ee;border-left:4px solid #28844e;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:13px;color:#1b6338;">
        <strong>✓ Đặt hàng thành công!</strong> Đơn hàng đã được lưu trữ trên hệ thống Store.
      </div>
      <div style="background:#f7faf8;border:1px solid #e1ece4;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">
        <div style="font-weight:700;color:#2c4939;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Thông tin nhận hàng & thanh toán:</div>
        <div>👤 Người nhận: <strong>{WebUtility.HtmlEncode(invoice.Recipient)}</strong> ({WebUtility.HtmlEncode(invoice.Phone)})</div>
        <div>📍 Địa chỉ: {WebUtility.HtmlEncode(invoice.Address)}</div>
        <div>🚚 Hình thức: <strong>{fulfillmentLabel}</strong> | Thanh toán: <strong>{paymentLabel}</strong></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #dce7df;font-size:13px;">
        <thead>
          <tr style="background:#ebf3ed;color:#234433;font-size:11px;text-transform:uppercase;">
            <th style="padding:6px;text-align:center;width:28px;">#</th>
            <th style="padding:6px;text-align:left;">Sản phẩm</th>
            <th style="padding:6px;text-align:center;width:36px;">SL</th>
            <th style="padding:6px;text-align:right;width:80px;">Đơn giá</th>
            <th style="padding:6px;text-align:right;width:85px;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>{itemsRows}</tbody>
      </table>
      <div style="margin-left:auto;width:240px;font-size:13px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Tạm tính:</span><span>{invoice.Subtotal:N0} ₫</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;color:#b23535;"><span>Giảm voucher:</span><span>-{invoice.Discount:N0} ₫</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Phí ship:</span><span>{invoice.ShippingFee:N0} ₫</span></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:2px solid #2d6b47;font-weight:800;font-size:15px;color:#186a3b;">
          <span>TỔNG TIỀN:</span><span>{invoice.Total:N0} ₫</span>
        </div>
      </div>
      <div style="clear:both;"></div>
      {bankBox}
      <div style="text-align:center;margin:20px 0 10px;">
        <a href="{frontendUrl}/account" style="display:inline-block;background:#205e3e;color:#fff;text-decoration:none;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;">Tra Cứu Đơn Hàng Tại Store →</a>
      </div>
    </div>
    <div style="background:#f8faf8;border-top:1px solid #e7efe9;padding:12px;text-align:center;font-size:11px;color:#809487;">
      © 2026 Store. Cảm ơn quý khách đã mua sắm!
    </div>
  </div>
</body>
</html>
""";
    }

}
