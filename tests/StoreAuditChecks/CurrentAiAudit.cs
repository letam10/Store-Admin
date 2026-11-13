using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using StoreApi.Data;
using StoreApi.Services;

public static class CurrentAiAudit
{
    public static async Task RunAsync(string output)
    {
        var backend = Path.Combine(Directory.GetCurrentDirectory(), "server-dotnet");
        var settings = new ConfigurationBuilder().AddJsonFile(Path.Combine(backend, "appsettings.json")).Build();
        var local = File.ReadLines(Path.Combine(backend, ".env"))
            .Where(line => !line.TrimStart().StartsWith('#') && line.Contains('='))
            .Select(line => line.Split('=', 2))
            .Where(pair => pair[0].Trim().StartsWith("AI_", StringComparison.Ordinal)
                || pair[0].Trim().StartsWith("OLLAMA_", StringComparison.Ordinal)
                || new[] { "ConnectionStrings__StoreDb", "SEPAY_ENABLED", "SEPAY_API_TOKEN" }.Contains(pair[0].Trim()))
            .GroupBy(pair => pair[0].Trim())
            .ToDictionary(group => group.Key, group => group.First()[1].Trim().Trim('"', '\''));
        var connection = local.GetValueOrDefault("ConnectionStrings__StoreDb") ?? settings.GetConnectionString("StoreDb")!;
        var address = new SqlConnectionStringBuilder(connection);
        if (!address.DataSource.StartsWith("(localdb)", StringComparison.OrdinalIgnoreCase) || address.InitialCatalog != "StoreDb")
            throw new Exception("LOCAL_STORE_DATABASE_REQUIRED");
        var values = local.Where(pair => pair.Key.StartsWith("AI_", StringComparison.Ordinal) || pair.Key.StartsWith("OLLAMA_", StringComparison.Ordinal))
            .ToDictionary(pair => pair.Key, pair => (string?)pair.Value);
        values["ConnectionStrings:StoreDb"] = connection;
        values["SEPAY_ENABLED"] = local.GetValueOrDefault("SEPAY_ENABLED", "false");
        // Ngữ cảnh chỉ cần biết có cấu hình; không đưa khóa thật vào công cụ đánh giá hoặc dữ liệu gửi model.
        values["SEPAY_API_TOKEN"] = string.IsNullOrWhiteSpace(local.GetValueOrDefault("SEPAY_API_TOKEN")) ? "" : "configured";
        var model = values.GetValueOrDefault("OLLAMA_MODEL") ?? "qwen3.5:4b";
        var host = values.GetValueOrDefault("OLLAMA_HOST") ?? "http://127.0.0.1:11434";
        if (!new Uri(host).IsLoopback || model.Contains("cloud", StringComparison.OrdinalIgnoreCase)) throw new Exception("LOCAL_MODEL_REQUIRED");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var db = new StoreDb(configuration);
        using var client = new OllamaChatClient();
        var ai = new AiChatService(configuration, db, client);
        var paymentOnly = Environment.GetEnvironmentVariable("STORE_AUDIT_PAYMENT_ONLY") == "1";
        var questions = paymentOnly ? new[]
        {
            "Chuyển khoản đúng mã và số tiền thì website có tự xác nhận không?",
            "Tôi vừa chuyển khoản thành công, có cần admin bấm xác nhận thủ công không?",
            "Tôi chuyển sai số tiền hoặc dùng mã QR đã hết hạn thì website có tự báo thanh toán thành công không?"
        } : new[]
        {
            "Sản phẩm có giá cao nhất hiện nay là gì, giá bao nhiêu?",
            "Sản phẩm rẻ nhất hiện nay là gì, giá bao nhiêu và còn bao nhiêu sản phẩm?",
            "Tháng sau có ưu đãi gì đã được công bố chưa?",
            "Nếu sản phẩm tôi muốn mua hết hàng thì tôi có được đặt trước không?",
            "Cho tôi thông tin về iPhone 13 Pro.",
            "Chuyển khoản đúng mã và số tiền thì website có tự xác nhận không?",
            "Tôi được trả hàng trong thời hạn nào, tính từ lúc nào?",
            "Tôi chỉ xem sản phẩm và hỏi tư vấn mà không mua có được không?"
        };
        var results = new List<object>();
        foreach (var question in questions)
        {
            var facts = ai.Context(question, [], false);
            var answer = new StringBuilder();
            var watch = System.Diagnostics.Stopwatch.StartNew();
            var state = "completed";
            string? error = null;
            try
            {
                await ai.StreamAsync(question, [], facts, false,
                    text => { answer.Append(text); return Task.CompletedTask; }, _ => Task.CompletedTask, CancellationToken.None);
            }
            catch (AiChatException failure) { state = "failed"; error = failure.Message; }
            results.Add(new { question, answer = answer.ToString(), state, error, seconds = watch.Elapsed.TotalSeconds,
                facts = JsonSerializer.Deserialize<JsonElement>(facts.Json) });
            File.WriteAllText(Path.Combine(output, paymentOnly ? "ai-payment-results.json" : "ai-current-results.json"), JsonSerializer.Serialize(new
                { model = ai.ModelName, context = ai.ContextSize, thinking = ai.ThinkingMode, results }, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine(JsonSerializer.Serialize(new { question, answer = answer.ToString(), state, error, seconds = Math.Round(watch.Elapsed.TotalSeconds, 2) }));
        }
    }
}
