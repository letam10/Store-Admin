using System.Net;
using System.Text.Json;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Services;

public sealed class NotificationWorker(StoreDb db, EmailService email, ILogger<NotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Không chặn khởi động web bằng truy vấn hay kết nối SMTP.
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                db.ExpireCheckouts();
                var job = db.ClaimNotification();
                if (job is null) await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                else await Deliver(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning("Hàng đợi email chưa sẵn sàng ({ErrorType}); sẽ thử lại.", ex.GetType().Name);
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }
    }

    private async Task Deliver(NotificationJob job, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(job.Payload);
        var data = document.RootElement;
        string Text(string name) => data.TryGetProperty(name, out var value) ? value.ToString() : "";
        if (job.Kind.EndsWith(".admin", StringComparison.Ordinal) && string.IsNullOrWhiteSpace(Text("recipient")))
        {
            if (!db.ExpandAdminNotification(job)) db.FinishNotification(job, false, "ADMIN_EMAIL_NOT_CONFIGURED");
            return;
        }
        var username = Text("username");
        var recipient = Text("email");
        string subject;
        string html;
        if (job.Kind.StartsWith("invoice.", StringComparison.Ordinal))
        {
            var id = Text("orderId");
            var order = db.FindCustomerOrder(id);
            if (order is null || JsonSerializer.SerializeToElement(order).GetProperty("paidAt").ValueKind == JsonValueKind.Null)
            {
                db.FinishNotification(job, false, "ORDER_NOT_PAID", obsolete: true);
                return;
            }
            var customerEmail = db.FindCustomerEmailForOrder(id) ?? "";
            var invoice = OrderEmailService.BuildInvoice(customerEmail, order);
            recipient = job.Kind == "invoice.admin" ? Text("recipient") : customerEmail;
            username = job.Kind == "invoice.admin" ? "Quản trị Store" : invoice.Recipient;
            subject = job.Kind == "invoice.admin" ? $"[Store] Đã nhận thanh toán đơn {id}" : $"[Store] Biên nhận thanh toán đơn {id}";
            html = EmailTemplates.BuildInvoiceEmailHtml(invoice, email.FrontendUrl);
        }
        else if (job.Kind is "support.admin" or "support.customer")
        {
            var support = data.Deserialize<SupportRequestData>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
            recipient = job.Kind == "support.admin" ? Text("recipient") : support.CustomerEmail;
            username = job.Kind == "support.admin" ? "Quản trị Store" : support.CustomerName;
            subject = job.Kind == "support.admin" ? "[Store] Yêu cầu hỗ trợ " + support.RequestId : "[Store] Đã tiếp nhận hỗ trợ " + support.RequestId;
            html = job.Kind == "support.admin" ? EmailTemplates.BuildSupportRequestEmailHtml(support, email.FrontendUrl)
                : EmailTemplates.BuildSupportAcknowledgementEmailHtml(support, email.FrontendUrl);
        }
        else if (job.Kind == "registered.customer")
        {
            subject = "[Store] Đăng ký tài khoản thành công";
            html = EmailTemplates.BuildWelcomeEmailHtml(username, recipient, DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm"), email.FrontendUrl);
        }
        else if (job.Kind == "reset.customer")
        {
            var token = Text("token");
            var reset = db.FindPasswordReset(Tokens.Sha256(token));
            if (reset is null || reset.Value.UsedAt is not null || !DateTimeOffset.TryParse(reset.Value.ExpiresAt, out var expiry) || expiry <= DateTimeOffset.UtcNow)
            {
                db.FinishNotification(job, false, "RESET_EXPIRED", obsolete: true);
                return;
            }
            subject = "[Store] Đặt lại mật khẩu";
            var link = email.FrontendUrl + "/reset-password?token=" + Uri.EscapeDataString(token);
            html = $"<html lang='vi'><body><h1>Đặt lại mật khẩu Store</h1><p>Chào {WebUtility.HtmlEncode(username)},</p><p><a href='{WebUtility.HtmlEncode(link)}'>Đặt mật khẩu mới</a>. Liên kết dùng một lần, hết hạn sau 30 phút từ lúc yêu cầu.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.</p></body></html>";
        }
        else if (job.Kind is "registered.admin" or "reset.admin")
        {
            var action = job.Kind == "registered.admin" ? "Khách đăng ký tài khoản" : "Khách yêu cầu đặt lại mật khẩu";
            subject = "[Store] " + action;
            html = $"<html lang='vi'><body><h1>{action}</h1><p>Tài khoản: {WebUtility.HtmlEncode(username)}</p><p>Email: {WebUtility.HtmlEncode(recipient)}</p><p>Thông báo quản trị; không chứa mật khẩu hoặc liên kết đặt lại mật khẩu của khách.</p></body></html>";
            recipient = Text("recipient");
            username = "Quản trị Store";
        }
        else
        {
            db.FinishNotification(job, false, "UNKNOWN_NOTIFICATION", obsolete: true);
            return;
        }
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        bool sent;
        try { sent = !string.IsNullOrWhiteSpace(recipient) && await email.SendQueuedAsync(recipient, subject, html, job.Key, username, timeout.Token); }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            db.FinishNotification(job, false, "SMTP_TIMEOUT");
            return;
        }
        db.FinishNotification(job, sent, sent ? null : "SMTP_DELIVERY_FAILED");
        if (sent && job.Kind == "invoice.customer") db.MarkInvoiceEmailSent(Text("orderId"));
    }
}
