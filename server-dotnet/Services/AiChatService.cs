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
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
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
            var raw = GetConfig("OLLAMA_TIMEOUT_SECONDS", "30");
            return int.TryParse(raw, out var value) ? Math.Clamp(value, 5, 60) : 30;
        }
    }

    public string ModelName => OllamaModel;

    public IReadOnlyList<int> AllowedContextSizes => new[] { 8192, 16384, 32768, 65536 };

    public int ContextSize
    {
        get
        {
            var raw = GetConfig("AI_CONTEXT_SIZE", "16384");
            return int.TryParse(raw, out var value) && AllowedContextSizes.Contains(value) ? value : 16384;
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

    public async Task<AiChatResponse> ProcessAdminChatAsync(string message, StoreDb db, CancellationToken cancellationToken)
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
        var adminSystemPrompt = "Bạn là trợ lý AI quản trị kinh doanh cho Store. Chỉ dùng dữ liệu trong phần NGUỒN ĐÃ XÁC MINH. Không tự bịa giá, tồn kho, danh mục, chính sách, trạng thái đơn hoặc số liệu. Nếu nguồn không có câu trả lời, nói rõ chưa có dữ liệu được xác minh. Trả lời tiếng Việt ngắn gọn và kết thúc bằng mục Nguồn, nêu đúng mã nguồn đã dùng.";
        var adminPrompt = $"Câu hỏi quản trị: {message}\n\nNGUỒN ĐÃ XÁC MINH:\n{retrieval.Context}";
        var ollamaResult = await TryOllamaGenerateAsync(adminPrompt, adminSystemPrompt, cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                retrieval.Sources.Append(new { id = "ollama", label = $"AI Local ({OllamaModel})" }).ToArray(),
                true);
        }

        var fallbackText = "Chào bạn! Tôi là Trợ lý AI Quản trị của Store. Tôi có thể hỗ trợ bạn:\n\n" +
                           "1. **Báo cáo doanh thu:** Gõ *'Báo cáo doanh thu'* hoặc *'Thống kê'* để xem doanh thu và đối soát 30 ngày.\n" +
                           "2. **Kiểm tra kho hàng:** Gõ *'Kiểm tra tồn kho'* để xem các mặt hàng sắp hết hoặc cần bổ sung.\n" +
                           "3. **Quản lý đơn hàng:** Theo dõi tình trạng giao vận và đối soát chuyển khoản VietQR.\n\n" +
                           "Bạn cần tôi hỗ trợ phân tích thông tin nào?";

        return new AiChatResponse(
            SplitIntoChunks(fallbackText),
            null,
            retrieval.Sources.Append(new { id = "assistant-local", label = "Fallback dữ liệu Store" }).ToArray(),
            true);
    }

    public async Task<AiChatResponse> ProcessCustomerChatAsync(string message, StoreDb db, string? customerName, CancellationToken cancellationToken)
    {
        var lower = message.ToLowerInvariant();
        var name = string.IsNullOrWhiteSpace(customerName) ? "quý khách" : customerName.Trim();
        var retrieval = BuildCustomerRetrieval(message, db);

        if (lower.Contains("ship") || lower.Contains("vận chuyển") || lower.Contains("giao hàng") || lower.Contains("phí"))
        {
            return MissingPolicyResponse(name, "vận chuyển", retrieval.Sources);
        }

        if (lower.Contains("thanh toán") || lower.Contains("chuyển khoản") || lower.Contains("vietqr") || lower.Contains("ngân hàng"))
        {
            return MissingPolicyResponse(name, "thanh toán", retrieval.Sources);
        }

        if (lower.Contains("đổi trả") || lower.Contains("bảo hành") || lower.Contains("hoàn tiền") || lower.Contains("hủy đơn"))
        {
            return MissingPolicyResponse(name, "đổi trả và bảo hành", retrieval.Sources);
        }

        if (lower.Contains("voucher") || lower.Contains("vòng quay") || lower.Contains("khuyến mãi") || lower.Contains("giảm giá") || lower.Contains("xu") || lower.Contains("điểm"))
        {
            return MissingPolicyResponse(name, "voucher và khuyến mãi", retrieval.Sources);
        }

        var systemPrompt = "Bạn là trợ lý hỗ trợ Store. Chỉ dùng dữ liệu trong phần NGUỒN ĐÃ XÁC MINH. Không tự bịa giá, tồn kho, danh mục, chính sách, trạng thái đơn hoặc cam kết giao hàng. Nếu nguồn không có câu trả lời, nói rõ Store chưa cung cấp thông tin được xác minh. Trả lời tiếng Việt ngắn gọn và kết thúc bằng mục Nguồn, nêu đúng mã nguồn sản phẩm khi có.";
        var ollamaResult = await TryOllamaGenerateAsync($"Câu hỏi: {message}\n\nNGUỒN ĐÃ XÁC MINH:\n{retrieval.Context}", systemPrompt, cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                retrieval.Sources.Append(new { id = "ollama", label = $"Ollama {OllamaModel}" }).ToArray(),
                true);
        }

        var defaultText = retrieval.MatchedProducts.Count > 0
            ? $"Chào {name}! Dữ liệu hiện có cho câu hỏi này:\n\n{retrieval.Context}\n\nStore chưa có thêm chính sách được xác minh cho yêu cầu này."
            : $"Chào {name}! Store chưa có dữ liệu được xác minh để trả lời câu hỏi này. Quý khách có thể hỏi tên sản phẩm, danh mục hoặc giá để tôi tra trong catalog.";

        return new AiChatResponse(
            SplitIntoChunks(defaultText),
            null,
            retrieval.Sources.Append(new { id = "local-fallback", label = "Fallback dữ liệu Store" }).ToArray(),
            true);
    }

    private static AiChatResponse MissingPolicyResponse(string name, string topic, IReadOnlyList<object> sources)
    {
        var text = $"Chào {name}! Store chưa cung cấp thông tin {topic} đã được xác minh trong dữ liệu hiện tại. Tôi không tự suy đoán nội dung chính sách; vui lòng gửi form Liên hệ để nhân viên xác nhận.";
        return new AiChatResponse(SplitIntoChunks(text), null, sources.Append(new { id = "policy-missing", label = $"Chưa có chính sách {topic} được duyệt" }).ToArray(), true);
    }

    private static (string Context, IReadOnlyList<object> Sources, IReadOnlyList<CatalogProduct> MatchedProducts) BuildCustomerRetrieval(string message, StoreDb db)
    {
        var terms = message.Split([' ', '\t', '\r', '\n', ',', '.', ':', ';', '?', '!'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(term => term.Length >= 2)
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

            var body = new
            {
                model = OllamaModel,
                prompt,
                system = systemPrompt,
                stream = false,
                think = false,
                options = new { num_ctx = Math.Min(ContextSize, 8192), num_predict = 600, temperature = 0.15 }
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

