using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace StoreApi.Services;

public sealed record OrderInvoiceItem(string Name, int Quantity, long Price, long TotalPrice);

public sealed record OrderInvoiceData(
    string OrderId,
    string CustomerEmail,
    string Recipient,
    string Phone,
    string Address,
    string Fulfillment,
    string PaymentMethod,
    IReadOnlyList<OrderInvoiceItem> Items,
    int Subtotal,
    int Discount,
    int ShippingFee,
    int Total,
    string Tier,
    string CreatedAt,
    string? ScheduledAt);

public sealed class EmailService
{
    private readonly IConfiguration _configuration;
    private readonly string _logsDirectory;

    public EmailService(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _logsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "logs", "emails");
        try
        {
            if (!Directory.Exists(_logsDirectory))
            {
                Directory.CreateDirectory(_logsDirectory);
            }
        }
        catch { }
    }

    private string GetConfig(string key, string fallback = "")
    {
        var val = _configuration[key];
        if (string.IsNullOrWhiteSpace(val)) val = Environment.GetEnvironmentVariable(key);
        return string.IsNullOrWhiteSpace(val) ? fallback : val.Trim();
    }

    private string FrontendUrl => GetConfig("FRONTEND_URL", "http://127.0.0.1:5173").TrimEnd('/');

    public async Task<bool> SendWelcomeEmailAsync(string toEmail, string username)
    {
        var subject = "[Store] Chào mừng bạn gia nhập Store - Đăng ký tài khoản thành công";
        var createdAt = DateTimeOffset.Now.ToString("dd/MM/yyyy HH:mm");
        var html = EmailTemplates.BuildWelcomeEmailHtml(username, toEmail, createdAt, FrontendUrl);
        return await SendOrLogEmailAsync(toEmail, subject, html, "welcome", username);
    }

    public async Task<bool> SendOrderInvoiceEmailAsync(string toEmail, OrderInvoiceData invoice)
    {
        var subject = $"[Store] Hóa đơn điện tử - Xác nhận đơn hàng #{invoice.OrderId}";
        var html = EmailTemplates.BuildInvoiceEmailHtml(invoice, FrontendUrl);
        return await SendOrLogEmailAsync(toEmail, subject, html, "invoice_" + invoice.OrderId, invoice.Recipient);
    }

    public async Task<bool> SendLoginNotificationEmailAsync(string toEmail, string username, string method = "Google OAuth")
    {
        var subject = $"[Store] Thông báo đăng nhập - Bạn vừa đăng nhập thành công ({method})";
        var createdAt = DateTimeOffset.Now.ToString("dd/MM/yyyy HH:mm");
        var html = EmailTemplates.BuildLoginNotificationEmailHtml(username, toEmail, createdAt, method, FrontendUrl);
        return await SendOrLogEmailAsync(toEmail, subject, html, "login_" + method.Replace(" ", "_").ToLowerInvariant(), username);
    }

    public Task<bool> SendGoogleLoginEmailAsync(string toEmail, string username)
        => SendLoginNotificationEmailAsync(toEmail, username, "Google OAuth");

    private async Task<bool> SendOrLogEmailAsync(string toEmail, string subject, string htmlBody, string logPrefix, string recipientName)
    {
        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var sanitizedEmail = toEmail.Replace("@", "_at_").Replace(".", "_");
        var fileName = $"{timestamp}_{logPrefix}_{sanitizedEmail}.html";
        var logFilePath = Path.Combine(_logsDirectory, fileName);

        try
        {
            await File.WriteAllTextAsync(logFilePath, htmlBody, Encoding.UTF8);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Store Mailer] Không thể lưu file HTML log: {ex.Message}");
        }

        var smtpHost = GetConfig("SMTP_HOST");
        var smtpPortStr = GetConfig("SMTP_PORT", "587");
        var smtpUser = GetConfig("SMTP_USER");
        var smtpPass = GetConfig("SMTP_PASS");
        var smtpFrom = GetConfig("SMTP_FROM", "Store <no-reply@store.local>");

        if (string.IsNullOrWhiteSpace(smtpHost))
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine($"[Store Mailer] [Offline/Dev] Đã tạo email cho {toEmail} ('{subject}')");
            Console.WriteLine($"[Store Mailer] File HTML xem trước: {logFilePath}");
            Console.ResetColor();
            return true;
        }

        try
        {
            int port = int.TryParse(smtpPortStr, out var p) ? p : 587;
            var message = new MimeMessage();

            if (!string.IsNullOrWhiteSpace(smtpFrom) && smtpFrom.Contains('<') && smtpFrom.Contains('>'))
            {
                message.From.Add(MailboxAddress.Parse(smtpFrom));
            }
            else
            {
                var addr = !string.IsNullOrWhiteSpace(smtpFrom) ? smtpFrom : (!string.IsNullOrWhiteSpace(smtpUser) ? smtpUser : "no-reply@store.local");
                message.From.Add(new MailboxAddress("Store Official", addr));
            }

            message.To.Add(new MailboxAddress(recipientName ?? toEmail, toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = htmlBody };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new MailKit.Net.Smtp.SmtpClient();
            client.Timeout = 15000;
            client.CheckCertificateRevocation = false;
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            var secureOption = port == 465 
                ? SecureSocketOptions.SslOnConnect 
                : (port == 587 ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto);

            await client.ConnectAsync(smtpHost, port, secureOption);

            var cleanPass = smtpPass.Replace(" ", "");
            if (!string.IsNullOrWhiteSpace(smtpUser) && !string.IsNullOrWhiteSpace(cleanPass))
            {
                await client.AuthenticateAsync(smtpUser, cleanPass);
            }

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"[Store Mailer] Đã gửi email thành công qua SMTP ({smtpHost}) tới {toEmail} ('{subject}')");
            Console.ResetColor();
            return true;
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Yellow;
            var innerMsg = ex.InnerException != null ? $" -> {ex.InnerException.Message}" : "";
            Console.WriteLine($"[Store Mailer] Gửi SMTP lỗi ({ex.Message}{innerMsg}). Email đã lưu tại: {logFilePath}");
            Console.ResetColor();
            return false;
        }
    }
}
