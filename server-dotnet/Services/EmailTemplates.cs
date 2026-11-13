using System;
using System.Net;

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
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">Những điều nhỏ, cho một ngày tốt hơn</div>
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
                    <span style="background:#fef3c7;border:1px solid #fde68a;color:#92400e;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:800;">ĐỒNG</span>
                  </td>
                </tr>
              </table>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:24px;font-size:13px;color:#334155;line-height:1.7;">
                <div>🎁 <strong>Tích điểm mua sắm:</strong> Nhận điểm trên mỗi đơn hàng để nâng hạng và nhận quà.</div>
                <div>🎡 <strong>Vòng quay may mắn:</strong> Nhận mã giảm giá và mã miễn phí vận chuyển.</div>
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
        => InvoiceEmailTemplate.Render(invoice, frontendUrl);

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
