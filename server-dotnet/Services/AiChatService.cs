using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using StoreApi.Data;
using StoreApi.Models;

namespace StoreApi.Services;

public sealed record AiChatResponse(
    IReadOnlyList<string> Chunks,
    object? Report,
    IReadOnlyList<object> Sources,
    bool Verified);

public sealed record AiProviderStatus(
    string Provider,
    string Model,
    bool Reachable,
    bool ModelAvailable);

public sealed class AiChatService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly SemaphoreSlim _ollamaGate = new(1, 1);

    public AiChatService(IConfiguration configuration)
    {
        _configuration = configuration;
        // Timeout của request được điều khiển bởi OllamaTimeoutSeconds ở từng lượt chat.
        _httpClient = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
    }

    private string GetConfig(string key, string fallback = "")
    {
        var val = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(val)) val = _configuration[key];
        return string.IsNullOrWhiteSpace(val) ? fallback : val.Trim();
    }

    private string OllamaHost => GetConfig("OLLAMA_HOST", "http://127.0.0.1:11434").TrimEnd('/');

    private string OllamaModel => GetConfig("OLLAMA_MODEL", "qwen3.5:4b");

    private int OllamaTimeoutSeconds
    {
        get
        {
            var raw = GetConfig("OLLAMA_TIMEOUT_SECONDS", "120");
            return int.TryParse(raw, out var value) ? Math.Clamp(value, 5, 180) : 120;
        }
    }

    public string ModelName => OllamaModel;

    public IReadOnlyList<int> AllowedContextSizes => new[] { 8192, 16384, 32768, 65536 };

    public string ThinkingMode
    {
        get
        {
            var raw = GetConfig("AI_THINKING", "off").ToLowerInvariant();
            return raw switch
            {
                "false" or "off" or "0" => "off",
                "medium" => "medium",
                "high" => "high",
                _ => "off"
            };
        }
    }

    public bool ThinkingEnabled => ThinkingMode != "off";

    private int OllamaPredictionTokens => ThinkingMode switch
    {
        "high" => 3072,
        "medium" => 2048,
        "low" => 1536,
        _ => 2048
    };

    public int ContextSize
    {
        get
        {
            var raw = GetConfig("AI_CONTEXT_SIZE", "32768");
            return int.TryParse(raw, out var value) && AllowedContextSizes.Contains(value) ? value : 32768;
        }
    }

    private static (string Context, IReadOnlyList<object> Sources) BuildVerifiedAppearanceContext(StoreDb db)
    {
        IReadOnlyDictionary<string, object?> appearance;
        try
        {
            appearance = db.Appearance();
        }
        catch
        {
            appearance = new Dictionary<string, object?>();
        }

        var keys = new[] { "brandName", "brandTagline", "footerInfo", "footerSupport", "contactAddress", "contactPhone", "contactEmail", "contactHours" };
        var lines = keys
            .Where(key => appearance.TryGetValue(key, out var value) && value is not null && !string.IsNullOrWhiteSpace(Convert.ToString(value)))
            .Select(key => $"{key}: {appearance[key]}")
            .ToArray();
        var context = lines.Length == 0
            ? "Không có nội dung appearance đã xác minh phù hợp."
            : string.Join("\n", lines);
        return (context, new object[] { new { id = "appearance", label = "Nội dung storefront đã xác minh" } });
    }

    public async Task<AiProviderStatus> GetProviderStatusAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(2));
            using var response = await _httpClient.GetAsync($"{OllamaHost}/api/tags", cts.Token);
            if (!response.IsSuccessStatusCode) return new("ollama", OllamaModel, false, false);
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cts.Token));
            var available = document.RootElement.TryGetProperty("models", out var models)
                && models.ValueKind == JsonValueKind.Array
                && models.EnumerateArray().Any(item => string.Equals(item.TryGetProperty("name", out var name) ? name.GetString() : null, OllamaModel, StringComparison.OrdinalIgnoreCase));
            return new("ollama", OllamaModel, true, available);
        }
        catch
        {
            return new("ollama", OllamaModel, false, false);
        }
    }

    public async Task<AiChatResponse> ProcessAdminChatAsync(string message, StoreDb db, IReadOnlyList<ChatTurnData> history, CancellationToken cancellationToken)
    {
        var lower = message.ToLowerInvariant();
        if (lower.Contains("doanh thu") || lower.Contains("báo cáo") || lower.Contains("thống kê") || lower.Contains("lợi nhuận") || lower.Contains("tiền"))
        {
            var from = DateTimeOffset.UtcNow.AddDays(-30).ToString("yyyy-MM-dd");
            var to = DateTimeOffset.UtcNow.ToString("yyyy-MM-dd");
            var report = db.CalculateAdminRevenue(from, to);

            long gross = 0, net = 0, allOrders = 0, incomeOrders = 0;
            try
            {
                var json = JsonSerializer.Serialize(report);
                using var doc = JsonDocument.Parse(json);
                gross = doc.RootElement.GetProperty("gross").GetInt64();
                net = doc.RootElement.GetProperty("net").GetInt64();
                allOrders = doc.RootElement.GetProperty("allOrders").GetInt64();
                incomeOrders = doc.RootElement.GetProperty("incomeOrders").GetInt64();
            }
            catch { }

            var text = $"📊 **BÁO CÁO DOANH THU 30 NGÀY GẦN NHẤT** ({from} → {to}):\n\n" +
                       $"- **Tổng doanh thu thực nhận (Net):** {net:N0} ₫\n" +
                       $"- **Doanh thu gộp (Gross):** {gross:N0} ₫\n" +
                       $"- **Tổng số đơn hàng:** {allOrders} đơn (trong đó có **{incomeOrders}** đơn đã thanh toán thành công)\n" +
                       $"- **Trạng thái đối soát:** Số liệu thời gian thực đã được xác thực từ CSDL hệ thống.\n\n" +
                       $"Thẻ báo cáo doanh thu chi tiết đã được cập nhật trực tiếp trên bảng điều khiển.";

            return new AiChatResponse(
                SplitIntoChunks(text),
                report,
                new object[] { new { id = "db-revenue", label = "CSDL Doanh thu StoreDb" } },
                true);
        }

        if (lower.Contains("sản phẩm") || lower.Contains("tồn kho") || lower.Contains("kho") || lower.Contains("hết hàng"))
        {
            var catalog = db.Catalog();
            var lowStock = catalog.Where(p => p.StockCount <= 5).Take(5).ToList();
            var total = catalog.Count;
            var outOfStockCount = catalog.Count(p => p.StockCount == 0);

            var sb = new StringBuilder();
            sb.AppendLine($"📦 **TÌNH TRẠNG KHO HÀNG & SẢN PHẨM HIỆN TẠI:**\n");
            sb.AppendLine($"- **Tổng số mã sản phẩm:** {total} mặt hàng");
            sb.AppendLine($"- **Số lượng sản phẩm hết hàng (Stock = 0):** {outOfStockCount} mặt hàng");
            if (lowStock.Count > 0)
            {
                sb.AppendLine("\n⚠️ **Các sản phẩm tồn ít (<= 5) cần nhập thêm:**");
                foreach (var p in lowStock)
                {
                    sb.AppendLine($"  • **{p.Name}** ({p.Category}): còn {p.StockCount} cái (Giá: {p.Price:N0} ₫)");
                }
            }
            else
            {
                sb.AppendLine("\n✅ Kho hàng hiện tại đang duy trì lượng tồn kho an toàn cho mọi mặt hàng.");
            }

            return new AiChatResponse(
                SplitIntoChunks(sb.ToString()),
                null,
                new object[] { new { id = "db-inventory", label = "CSDL Kho hàng StoreDb" } },
                true);
        }

        var retrieval = BuildCustomerRetrieval(message, db);
        var adminSystemPrompt = "Bạn là trợ lý AI quản trị kinh doanh cho Store. Khi câu hỏi cần dữ liệu Store, chỉ dùng phần NGUỒN ĐÃ XÁC MINH và không tự bịa giá, tồn kho, danh mục, chính sách, trạng thái đơn hoặc số liệu. Khi là câu hỏi kiến thức chung, được phép trả lời bằng kiến thức tổng quát; nếu câu hỏi không liên quan dữ liệu Store thì nói rõ điều đó. Trả lời tiếng Việt rõ ràng, đầy đủ, trực tiếp. Không in suy nghĩ nội bộ, nhãn nguồn, mã nguồn hoặc mục Nguồn trong nội dung trả lời; backend tự quản lý metadata nguồn.";
        var adminPrompt = BuildPrompt(message, history, retrieval.Context);
        var ollamaResult = await TryOllamaGenerateAsync(adminPrompt, adminSystemPrompt, cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                retrieval.Sources.Append(new { id = "ollama", label = $"AI Local ({OllamaModel})" }).ToArray(),
                true);
        }

        var fallbackText = "AI Local hiện chưa kết nối được với Ollama nên chưa thể trả lời câu hỏi này. Hãy mở Ollama, kiểm tra model qwen3.5:4b rồi thử lại.";

        return new AiChatResponse(
            SplitIntoChunks(fallbackText),
            null,
            retrieval.Sources.Append(new { id = "assistant-local", label = "AI Local chưa kết nối Ollama" }).ToArray(),
            true);
    }

    public async Task<AiChatResponse> ProcessCustomerChatAsync(string message, StoreDb db, string? customerName, IReadOnlyList<ChatTurnData> history, CancellationToken cancellationToken)
    {
        var retrieval = BuildCustomerRetrieval(message, db);

        var systemPrompt = "Bạn là trợ lý hỗ trợ khách hàng của Store. Khi câu hỏi liên quan Store, chỉ dùng phần NGUỒN ĐÃ XÁC MINH và không tự bịa giá, tồn kho, danh mục, chính sách, trạng thái đơn hoặc cam kết giao hàng. Nếu Store chưa có chính sách hoặc dữ liệu cần thiết, nói rõ chưa có dữ liệu được xác minh và không đoán. Khi là câu hỏi kiến thức chung, được phép trả lời trực tiếp bằng kiến thức phổ thông. Trả lời tiếng Việt rõ ràng, đầy đủ, trực tiếp. Không in suy nghĩ nội bộ, nhãn nguồn, mã nguồn hoặc mục Nguồn trong nội dung trả lời; backend tự quản lý metadata nguồn.";
        var ollamaResult = await TryOllamaGenerateAsync(BuildPrompt(message, history, retrieval.Context), systemPrompt, cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                retrieval.Sources.Append(new { id = "ollama", label = $"Ollama {OllamaModel}" }).ToArray(),
                true);
        }

        var matchedNames = string.Join(", ", retrieval.MatchedProducts.Take(3).Select(product => product.Name));
        var defaultText = retrieval.MatchedProducts.Count > 0
            ? $"AI Local hiện chưa kết nối được với Ollama. Tôi đã tìm thấy sản phẩm liên quan trong catalog: {matchedNames}, nhưng chưa thể tạo câu trả lời đầy đủ."
            : "AI Local hiện chưa kết nối được với Ollama nên chưa thể trả lời câu hỏi này. Hãy mở Ollama, kiểm tra model qwen3.5:4b rồi thử lại.";

        return new AiChatResponse(
            SplitIntoChunks(defaultText),
            null,
            retrieval.Sources.Append(new { id = "local-fallback", label = "AI Local chưa kết nối Ollama" }).ToArray(),
            true);
    }

    private static (string Context, IReadOnlyList<object> Sources, IReadOnlyList<CatalogProduct> MatchedProducts) BuildCustomerRetrieval(string message, StoreDb db)
    {
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "tôi", "mình", "bạn", "cho", "với", "của", "là", "có", "và", "hay", "những", "các", "một", "về", "này", "nào", "giúp", "xin", "hỏi", "store", "sản", "phẩm"
        };
        var terms = message.Split([' ', '\t', '\r', '\n', ',', '.', ':', ';', '?', '!', '(', ')', '[', ']'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(term => term.Length >= 2)
            .Where(term => !stopWords.Contains(term))
            .Select(term => term.ToLowerInvariant())
            .Distinct()
            .ToArray();
        IReadOnlyList<CatalogProduct> catalog;
        try
        {
            catalog = db.Catalog();
        }
        catch
        {
            catalog = Array.Empty<CatalogProduct>();
        }
        var matched = catalog
            .Select(product => new { Product = product, Score = terms.Count(term => ($"{product.Name} {product.Category} {product.Description}").ToLowerInvariant().Contains(term)) })
            .Where(item => item.Score > 0)
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.Product.Id, StringComparer.Ordinal)
            .Take(8)
            .Select(item => item.Product)
            .ToArray();
        var appearance = BuildVerifiedAppearanceContext(db);
        var categories = catalog
            .GroupBy(product => product.Category, StringComparer.OrdinalIgnoreCase)
            .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
            .Select(group => $"{group.Key}: {group.Count()}")
            .ToArray();
        var catalogContext = matched.Length == 0
            ? "Không có sản phẩm trong catalog khớp câu hỏi."
            : string.Join("\n", matched.Select(product => $"[catalog-{product.Id}] {product.Name} | danh mục: {product.Category} | giá: {product.Price:N0} VND | tồn kho: {product.StockCount} | mô tả: {product.Description}"));
        var context = $"[appearance]\n{appearance.Context}\n\n[catalog-summary]\nTổng số sản phẩm: {catalog.Count}. Danh mục: {string.Join(", ", categories)}.\n\n{catalogContext}";
        var sources = appearance.Sources
            .Concat(new object[] { new { id = "catalog-summary", label = "Catalog và danh mục đã xác minh" } })
            .Concat(matched.Select(product => (object)new { id = "catalog-" + product.Id, label = $"Catalog sản phẩm {product.Id}" }))
            .ToArray();
        return (context, sources, matched);
    }

    private async Task<string?> TryOllamaGenerateAsync(string prompt, string systemPrompt, CancellationToken cancellationToken)
    {
        if (!await _ollamaGate.WaitAsync(0, cancellationToken)) return null;
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(OllamaTimeoutSeconds));

            var think = ThinkingEnabled ? (object)ThinkingMode : false;
            var body = new
            {
                model = OllamaModel,
                prompt,
                system = systemPrompt,
                stream = false,
                think,
                options = new { num_ctx = ContextSize, num_predict = OllamaPredictionTokens, temperature = 0.12 }
            };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{OllamaHost}/api/generate", content, cts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var resJson = await response.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(resJson);
            if (doc.RootElement.TryGetProperty("response", out var respProp))
            {
                var responseText = respProp.GetString();
                if (!string.IsNullOrWhiteSpace(responseText)) return responseText;
                Console.WriteLine($"[AI Local] Ollama trả response rỗng cho model '{OllamaModel}'.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AI Local] Không gọi được Ollama: {ex.Message}");
        }
        finally
        {
            _ollamaGate.Release();
        }
        return null;
    }

    private static string BuildPrompt(string message, IReadOnlyList<ChatTurnData> history, string retrievalContext)
    {
        var previousTurns = history
            .TakeLast(8)
            .Select(turn => $"Khách/Admin: {TrimPromptText(turn.UserContent)}\nAI: {TrimPromptText(turn.AssistantContent)}")
            .ToArray();
        var conversation = previousTurns.Length == 0
            ? "Chưa có lịch sử hội thoại."
            : string.Join("\n\n", previousTurns);
        return $"LỊCH SỬ HỘI THOẠI:\n{conversation}\n\nCÂU HỎI HIỆN TẠI:\n{TrimPromptText(message)}\n\nNGUỒN ĐÃ XÁC MINH:\n{retrievalContext}";
    }

    private static string TrimPromptText(string value)
    {
        var clean = value.Trim();
        return clean.Length <= 1800 ? clean : clean[..1800] + "…";
    }

    private static IReadOnlyList<string> SplitIntoChunks(string text)
    {
        var words = text.Split(' ');
        var chunks = new List<string>();
        var current = new StringBuilder();

        for (int i = 0; i < words.Length; i++)
        {
            current.Append(words[i]);
            if (i < words.Length - 1) current.Append(' ');

            if (current.Length >= 30 || words[i].Contains('\n'))
            {
                chunks.Add(current.ToString());
                current.Clear();
            }
        }
        if (current.Length > 0)
        {
            chunks.Add(current.ToString());
        }
        return chunks;
    }
}

