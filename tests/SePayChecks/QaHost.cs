using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StoreApi.Controllers;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

public static class QaHost
{
    public static async Task RunAsync(StoreDb db, IConfiguration configuration, BankAccount bank, string output)
    {
        if (!db.DatabaseName.StartsWith("StoreSePayQA_", StringComparison.Ordinal)) throw new Exception("QA database required");
        foreach (var (key, value) in new Dictionary<string, string>
        {
            ["SMTP_HOST"] = "127.0.0.1", ["SMTP_PORT"] = "2527", ["SMTP_USER"] = "qa@example.invalid",
            ["SMTP_PASS"] = "qa", ["SMTP_FROM"] = "qa@example.invalid", ["SUPPORT_EMAIL"] = "support@example.invalid",
            ["ADMIN_NOTIFICATION_EMAILS"] = "admin1@example.invalid,admin2@example.invalid", ["FRONTEND_URL"] = "http://127.0.0.1:5199"
        }) Environment.SetEnvironmentVariable(key, value);
        var password = Tokens.RandomToken(20);
        var (salt, hash) = Tokens.HashPassword(password);
        var customer = db.CreateCustomer("sepay_browser_qa", "browser@example.invalid", salt, hash);
        db.CreateAdmin("sepay_admin_qa", password);
        var handler = new FakeSePayHandler(bank.AccountNumber) { FeedPath = Path.Combine(output, "qa-feed.json") };
        File.WriteAllText(handler.FeedPath, "{\"status\":200,\"transactions\":[]}");
        File.WriteAllText(Path.Combine(output, "qa-fixture.json"), JsonSerializer.Serialize(new
        {
            database = db.DatabaseName, customerId = customer, username = "sepay_browser_qa", admin = "sepay_admin_qa",
            password, account = bank.AccountNumber, api = "http://127.0.0.1:5099", products = new[] { "qa-a", "qa-z" }
        }));
        var builder = WebApplication.CreateBuilder();
        // Không kế thừa Kestrel:Endpoints của app thật (cổng 5000) vào máy chủ QA.
        builder.Configuration.Sources.Clear();
        builder.Configuration.AddConfiguration(configuration);
        builder.WebHost.UseUrls("http://127.0.0.1:5099");
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        builder.Services.AddSingleton(configuration);
        builder.Services.AddSingleton(db);
        builder.Services.AddSingleton(new SePayClient(new HttpClient(handler), configuration));
        builder.Services.AddHostedService<SePayWorker>();
        builder.Services.AddSingleton<EmailService>();
        builder.Services.AddSingleton<AiChatService>();
        builder.Services.AddSingleton<OllamaChatClient>();
        builder.Services.AddSingleton<ChatStreamService>();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddControllers().AddApplicationPart(typeof(CustomerController).Assembly);
        var app = builder.Build();
        app.MapControllers();
        Console.WriteLine("SePay QA host ready on 5099; fake provider only; SMTP worker disabled; private fixture outside repository.");
        await app.RunAsync();
    }
}
