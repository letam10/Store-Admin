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
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chào mừng thành viên mới - Store</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px -5px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg, #10b981 0%, #06b6d4 100%);line-height:5px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:#fafbfc;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0f172a;line-height:1;">store<span style="color:#10b981;">.</span></div>
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Smart Living & Convenience</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <div style="text-align:center;margin-bottom:26px;">
                <span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;">
                  ✓ KÍCH HOẠT THÀNH CÔNG
                </span>
                <h1 style="margin:16px 0 8px;font-size:23px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Chào mừng {u}!</h1>
                <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
                  Tài khoản của bạn đã được tạo thành công tại Store.
                </p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:20px;">
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">👤 Tên đăng nhập</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{u}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">✉ Email</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{e}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">🕒 Thời gian tạo</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{createdAt}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">🏅 Hạng thành viên</td>
                  <td align="right" style="padding:13px 18px;">
                    <span style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:800;">ĐỒNG (BRONZE)</span>
                  </td>
                </tr>
              </table>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#334155;line-height:1.7;">
                <div>🎁 <strong>Tích điểm mua sắm:</strong> Nhận điểm trên mỗi đơn hàng để nâng hạng và nhận quà.</div>
                <div>🎡 <strong>Vòng quay may mắn:</strong> Săn voucher giảm giá và mã miễn phí vận chuyển.</div>
                <div>🔒 <strong>Bảo mật:</strong> Bật xác thực 2 lớp (2FA) bất cứ lúc nào trong trang cá nhân.</div>
              </div>

              <div style="text-align:center;margin-bottom:8px;">
                <a href="{frontendUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 34px;border-radius:12px;box-shadow:0 6px 18px -2px rgba(5,150,105,0.35);">
                  Khám Phá Cửa Hàng Ngay →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
              © 2026 Store Inc. Tất cả quyền được bảo lưu.<br>
              Email tự động từ hệ thống xác thực. Vui lòng không trả lời thư này.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:10px 8px;text-align:center;color:#94a3b8;font-size:12px;">{idx++}</td>
              <td style="padding:10px 8px;">
                <div style="font-weight:700;color:#0f172a;font-size:13px;line-height:1.4;">{WebUtility.HtmlEncode(item.Name)}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">{item.Quantity} × {item.Price:N0} ₫</div>
              </td>
              <td style="padding:10px 8px;text-align:center;">
                <span style="background:#f1f5f9;color:#334155;padding:2px 7px;border-radius:6px;font-size:11px;font-weight:700;">x{item.Quantity}</span>
              </td>
              <td style="padding:10px 8px;text-align:right;font-weight:700;color:#0f172a;font-size:13px;">{item.TotalPrice:N0} ₫</td>
            </tr>
            """);
        }

        var fulfillmentLabel = invoice.Fulfillment == "pickup" ? "Nhận tại cửa hàng" : "Giao tận nơi";
        var paymentLabel = invoice.PaymentMethod switch
        {
            "bank_transfer" => "Chuyển khoản / VietQR",
            "cash" => "Tiền mặt tại quầy",
            "cod" => "Thanh toán khi nhận hàng (COD)",
            _ => invoice.PaymentMethod
        };

        var bankBox = invoice.PaymentMethod == "bank_transfer" ? $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-top:16px;">
          <tr>
            <td style="padding:14px 16px;">
              <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                🏦 THÔNG TIN CHUYỂN KHOẢN (VIETQR):
              </div>
              <div style="font-size:13px;color:#14532d;line-height:1.7;">
                Ngân hàng: <strong>MB Bank (Quân Đội)</strong> · STK: <strong style="color:#15803d;background:#dcfce7;padding:1px 6px;border-radius:4px;">0912345678</strong><br>
                Chủ TK: <strong>STORE MINI MART</strong> · Cú pháp: <strong style="color:#166534;background:#ffffff;border:1px dashed #22c55e;padding:2px 6px;border-radius:4px;">{invoice.OrderId}</strong>
              </div>
            </td>
          </tr>
        </table>
        """ : "";

        return $"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hóa đơn #{invoice.OrderId}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px -5px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg, #10b981 0%, #059669 100%);line-height:5px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:26px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;line-height:1;">store<span style="color:#10b981;">.</span></div>
                    <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Hóa đơn điện tử</div>
                  </td>
                  <td align="right">
                    <div style="background:#1e293b;border:1px solid #334155;display:inline-block;padding:4px 10px;border-radius:6px;font-weight:800;font-size:13px;color:#38bdf8;">
                      #{invoice.OrderId}
                    </div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:4px;">{invoice.CreatedAt}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:10px;padding:12px 16px;font-size:13px;color:#065f46;margin-bottom:18px;">
                <strong>✓ Đặt hàng thành công!</strong> Đơn hàng đã được lưu trữ trên hệ thống và đang được chuẩn bị.
              </div>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:13px;line-height:1.7;">
                <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Thông tin nhận hàng & thanh toán:</div>
                <div>👤 Người nhận: <strong>{WebUtility.HtmlEncode(invoice.Recipient)}</strong> ({WebUtility.HtmlEncode(invoice.Phone)})</div>
                <div>📍 Địa chỉ: {WebUtility.HtmlEncode(invoice.Address)}</div>
                <div style="margin-top:4px;">
                  🚚 <span style="background:#e2e8f0;color:#1e293b;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;">{fulfillmentLabel}</span>
                  &nbsp;·&nbsp; 💳 <span style="background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;">{paymentLabel}</span>
                </div>
              </div>

              <div style="font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Chi tiết sản phẩm ({invoice.Items.Count}):</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:16px;">
                <thead>
                  <tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:11px;color:#64748b;text-transform:uppercase;">
                    <th style="padding:8px;text-align:center;width:26px;">#</th>
                    <th style="padding:8px;text-align:left;">Sản phẩm</th>
                    <th style="padding:8px;text-align:center;width:40px;">SL</th>
                    <th style="padding:8px;text-align:right;width:95px;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>{itemsRows}</tbody>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;margin-bottom:12px;">
                <tr>
                  <td width="45%">&nbsp;</td>
                  <td width="55%">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Tạm tính:</td>
                        <td align="right" style="padding:3px 0;font-weight:700;color:#0f172a;">{invoice.Subtotal:N0} ₫</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Giảm voucher:</td>
                        <td align="right" style="padding:3px 0;font-weight:700;color:#e11d48;">- {invoice.Discount:N0} ₫</td>
                      </tr>
                      <tr>
                        <td style="padding:3px 0;color:#64748b;">Phí vận chuyển:</td>
                        <td align="right" style="padding:3px 0;font-weight:700;color:#0f172a;">{invoice.ShippingFee:N0} ₫</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0 0;border-top:2px solid #0f172a;font-size:13px;font-weight:800;color:#0f172a;">TỔNG TIỀN:</td>
                        <td align="right" style="padding:8px 0 0;border-top:2px solid #0f172a;font-size:17px;font-weight:900;color:#059669;">{invoice.Total:N0} ₫</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {bankBox}

              <div style="text-align:center;margin:24px 0 6px;">
                <a href="{frontendUrl}/account" style="display:inline-block;background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;box-shadow:0 4px 14px rgba(15,23,42,0.25);">
                  Tra Cứu Chi Tiết Đơn Hàng →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
              © 2026 Store. Cảm ơn quý khách đã tin tưởng và mua sắm!<br>
              Hỗ trợ khách hàng: cskh@store.local · Hotline: 1900 1234
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""";
    }

    public static string BuildSupportRequestEmailHtml(SupportRequestData request, string frontendUrl)
    {
        var id = WebUtility.HtmlEncode(request.RequestId);
        var name = WebUtility.HtmlEncode(request.CustomerName);
        var email = WebUtility.HtmlEncode(request.CustomerEmail);
        var topic = WebUtility.HtmlEncode(request.Topic);
        var message = WebUtility.HtmlEncode(request.Message).Replace("\n", "<br>");
        var createdAt = WebUtility.HtmlEncode(request.CreatedAt);
        return $"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yêu cầu hỗ trợ mới #{id}</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="height:5px;background:#0f766e;line-height:5px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:26px 28px 12px;"><div style="font-size:24px;font-weight:900;">store<span style="color:#10b981;">.</span></div><p style="margin:8px 0 0;color:#64748b;font-size:12px;">Yêu cầu hỗ trợ mới cần được xử lý</p></td></tr>
        <tr><td style="padding:12px 28px 28px;">
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:14px 16px;margin-bottom:18px;font-size:13px;color:#115e59;"><strong>Mã yêu cầu: #{id}</strong><br>Thời gian: {createdAt}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:1.7;margin-bottom:18px;">
            <tr><td style="color:#64748b;width:125px;">Khách hàng</td><td><strong>{name}</strong></td></tr>
            <tr><td style="color:#64748b;">Email phản hồi</td><td><a href="mailto:{email}">{email}</a></td></tr>
            <tr><td style="color:#64748b;">Chủ đề</td><td><strong>{topic}</strong></td></tr>
          </table>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:14px;line-height:1.7;">{message}</div>
          <p style="margin:20px 0 0;color:#64748b;font-size:12px;">Mở trang quản trị để phân công và phản hồi yêu cầu này.</p>
          <a href="{frontendUrl}/contact" style="display:inline-block;margin-top:12px;padding:11px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;">Mở Store</a>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:12px;">Email tự động từ hệ thống hỗ trợ Store.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""";
    }

    public static string BuildSupportAcknowledgementEmailHtml(SupportRequestData request, string frontendUrl)
    {
        var id = WebUtility.HtmlEncode(request.RequestId);
        var name = WebUtility.HtmlEncode(request.CustomerName);
        var topic = WebUtility.HtmlEncode(request.Topic);
        var message = WebUtility.HtmlEncode(request.Message).Replace("\n", "<br>");
        return $"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đã tiếp nhận yêu cầu hỗ trợ #{id}</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
        <tr><td style="height:5px;background:#10b981;line-height:5px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:26px 28px 12px;"><div style="font-size:24px;font-weight:900;">store<span style="color:#10b981;">.</span></div><p style="margin:8px 0 0;color:#64748b;font-size:12px;">Xác nhận tiếp nhận yêu cầu hỗ trợ</p></td></tr>
        <tr><td style="padding:12px 28px 28px;">
          <div style="text-align:center;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:16px;color:#065f46;margin-bottom:18px;"><strong>✓ Store đã nhận yêu cầu của bạn</strong><br><span style="font-size:13px;">Mã yêu cầu: #{id}</span></div>
          <p style="font-size:14px;line-height:1.7;">Chào {name}, Store sẽ kiểm tra và phản hồi qua email này. Bạn vui lòng giữ lại mã yêu cầu để tiện theo dõi.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:1.7;margin:18px 0;"><tr><td style="color:#64748b;width:125px;">Chủ đề</td><td><strong>{topic}</strong></td></tr><tr><td style="color:#64748b;vertical-align:top;">Nội dung</td><td>{message}</td></tr></table>
          <a href="{frontendUrl}/contact" style="display:inline-block;padding:11px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:9px;font-weight:700;font-size:13px;">Quay lại Store</a>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;color:#94a3b8;font-size:12px;">Email tự động từ hệ thống hỗ trợ Store. Vui lòng không trả lời trực tiếp nếu không cần thiết.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
""";
    }

    public static string BuildGoogleLoginEmailHtml(string username, string email, string loginAt, string frontendUrl)
        => BuildLoginNotificationEmailHtml(username, email, loginAt, "Google OAuth", frontendUrl);

    public static string BuildLoginNotificationEmailHtml(string username, string email, string loginAt, string method, string frontendUrl)
    {
        var u = WebUtility.HtmlEncode(username);
        var e = WebUtility.HtmlEncode(email);
        var m = WebUtility.HtmlEncode(method);
        return $"""
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thông báo đăng nhập tài khoản - Store</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 10px 30px -5px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg, #10b981 0%, #3b82f6 100%);line-height:5px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;background:#fafbfc;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0f172a;line-height:1;">store<span style="color:#10b981;">.</span></div>
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Trung tâm bảo mật tài khoản</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <div style="text-align:center;margin-bottom:26px;">
                <span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:5px 14px;border-radius:99px;font-size:12px;font-weight:700;">
                  ✓ ĐĂNG NHẬP THÀNH CÔNG
                </span>
                <h1 style="margin:16px 0 8px;font-size:23px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;">Xin chào {u}!</h1>
                <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
                  Tài khoản của bạn vừa có một phiên đăng nhập thành công vào Store ({m}).
                </p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:22px;">
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">👤 Tên người dùng</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{u}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">✉ Email xác thực</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{e}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#64748b;font-weight:600;">🕒 Thời gian</td>
                  <td align="right" style="padding:13px 18px;border-bottom:1px solid #edf2f7;font-size:13px;color:#0f172a;font-weight:700;">{loginAt}</td>
                </tr>
                <tr>
                  <td style="padding:13px 18px;font-size:13px;color:#64748b;font-weight:600;">🔐 Phương thức</td>
                  <td align="right" style="padding:13px 18px;">
                    <span style="background:#e0f2fe;border:1px solid #bae6fd;color:#0284c7;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:800;text-transform:uppercase;">{m}</span>
                  </td>
                </tr>
              </table>

              <div style="background:#fffbeb;border:1px solid #fef3c7;border-left:4px solid #f59e0b;border-radius:12px;padding:14px 18px;margin-bottom:26px;">
                <div style="font-size:13px;color:#92400e;line-height:1.6;">
                  <strong>⚠️ Bạn không thực hiện đăng nhập này?</strong><br>
                  Nếu nghi ngờ bị truy cập trái phép, vui lòng <a href="{frontendUrl}/account/security" style="color:#b45309;font-weight:700;text-decoration:underline;">kiểm tra và đổi mật khẩu ngay</a> hoặc kích hoạt xác thực 2 bước (2FA).
                </div>
              </div>

              <div style="text-align:center;margin-bottom:8px;">
                <a href="{frontendUrl}" style="display:inline-block;background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 34px;border-radius:12px;box-shadow:0 6px 18px -2px rgba(5,150,105,0.35);">
                  Quay Lại Store →
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #f1f5f9;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
              © 2026 Store Inc. Tất cả quyền được bảo lưu.<br>
              Thông báo bảo mật tự động gửi đến {e}. Vui lòng không trả lời thư này.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
""";
    }
}
