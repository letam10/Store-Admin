using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StoreApi.Controllers;
using StoreApi.Data;
using StoreApi.Services;

public static class AuditHost
{
    public static async Task RunAsync(StoreDb db, IConfiguration configuration, string output)
    {
        if (!db.DatabaseName.StartsWith("StoreVietnameseQA", StringComparison.Ordinal)) throw new Exception("QA_DATABASE_REQUIRED");
        foreach (var (key, value) in new Dictionary<string, string>
        {
            ["SMTP_HOST"] = "127.0.0.1", ["SMTP_PORT"] = "2528", ["SMTP_USER"] = "qa@example.invalid",
            ["SMTP_PASS"] = "qa", ["SMTP_FROM"] = "qa@example.invalid", ["SUPPORT_EMAIL"] = "support@example.invalid",
            ["ADMIN_NOTIFICATION_EMAILS"] = "admin1@example.invalid,admin2@example.invalid", ["FRONTEND_URL"] = "http://localhost:5197",
            ["SEPAY_ENABLED"] = "false", ["SEPAY_API_TOKEN"] = ""
        }) Environment.SetEnvironmentVariable(key, value);
        var builder = WebApplication.CreateBuilder();
        builder.Configuration.Sources.Clear();
        builder.Configuration.AddConfiguration(configuration);
        builder.WebHost.UseUrls("http://127.0.0.1:5097");
        builder.Logging.SetMinimumLevel(LogLevel.Warning);
        builder.Services.AddSingleton(configuration);
        builder.Services.AddSingleton(db);
        builder.Services.AddSingleton<EmailService>();
        builder.Services.AddSingleton<AiChatService>();
        builder.Services.AddSingleton<OllamaChatClient>();
        builder.Services.AddSingleton<OllamaRuntime>();
        builder.Services.AddSingleton<ChatStreamService>();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddControllers().AddApplicationPart(typeof(CustomerController).Assembly);
        var app = builder.Build();
        app.MapControllers();
        Console.WriteLine("Vietnamese QA API ready on 5097. SePay and email workers disabled. Ollama uses local model.");
        await app.RunAsync();
    }
}
