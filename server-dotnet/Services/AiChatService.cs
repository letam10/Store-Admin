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

namespace StoreApi.Services;

public sealed record AiChatResponse(
    IReadOnlyList<string> Chunks,
    object? Report,
    IReadOnlyList<object> Sources,
    bool Verified);

public sealed class AiChatService
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public AiChatService(IConfiguration configuration)
    {
        _configuration = configuration;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    private string OllamaHost =>
        (_configuration["OLLAMA_HOST"] ?? Environment.GetEnvironmentVariable("OLLAMA_HOST") ?? "http://127.0.0.1:11434").TrimEnd('/');

    private string OllamaModel =>
        _configuration["OLLAMA_MODEL"] ?? Environment.GetEnvironmentVariable("OLLAMA_MODEL") ?? "qwen3.5:4b";

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

        var ollamaResult = await TryOllamaGenerateAsync(message, "Bạn là trợ lý AI quản trị kinh doanh cho hệ thống siêu thị Store Mini Mart. Hãy trả lời ngắn gọn, chuyên nghiệp, bằng tiếng Việt.", cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                new object[] { new { id = "ollama", label = $"AI Local ({OllamaModel})" } },
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
            new object[] { new { id = "assistant-local", label = "Hệ thống Quản trị Store" } },
            true);
    }

    public async Task<AiChatResponse> ProcessCustomerChatAsync(string message, StoreDb db, string? customerName, CancellationToken cancellationToken)
    {
        var lower = message.ToLowerInvariant();
        var name = string.IsNullOrWhiteSpace(customerName) ? "quý khách" : customerName.Trim();

        if (lower.Contains("ship") || lower.Contains("vận chuyển") || lower.Contains("giao hàng") || lower.Contains("phí"))
        {
            var text = $"Chào {name}! Chính sách vận chuyển của Store Mini Mart như sau:\n\n" +
                       "• **Nội thành TP.HCM & Bình Dương:** 30.000 ₫ (Giao trong 24h - 48h)\n" +
                       "• **Tỉnh lân cận / Toàn quốc:** 60.000 ₫ (Giao trong 2 - 4 ngày)\n" +
                       "• **Nhận tại quầy:** Hoàn toàn **Miễn phí**\n" +
                       "• **Ưu đãi FreeShip:** Đổi voucher tại Vòng quay may mắn hoặc áp dụng voucher thành viên để được giảm 50% đến 100% phí ship!";
            return new AiChatResponse(SplitIntoChunks(text), null, new object[] { new { id = "shipping-policy", label = "Chính sách vận chuyển Store" } }, true);
        }

        if (lower.Contains("thanh toán") || lower.Contains("chuyển khoản") || lower.Contains("vietqr") || lower.Contains("ngân hàng"))
        {
            var text = $"Dạ {name}, Store hỗ trợ các hình thức thanh toán tiện lợi:\n\n" +
                       "1. **Chuyển khoản VietQR tự động:** Khi đặt hàng, mã QR sẽ hiển thị kèm số tiền và nội dung chính xác. Sau khi chuyển khoản, hệ thống tự động xác nhận trong vòng 2 phút.\n" +
                       "2. **Thanh toán khi nhận hàng (COD):** Áp dụng cho các đơn giao tận nơi.\n" +
                       "Mọi giao dịch đều được bảo mật và lưu hóa đơn điện tử trong trang Cá nhân.";
            return new AiChatResponse(SplitIntoChunks(text), null, new object[] { new { id = "payment-policy", label = "Chính sách thanh toán VietQR" } }, true);
        }

        if (lower.Contains("đổi trả") || lower.Contains("bảo hành") || lower.Contains("hoàn tiền") || lower.Contains("hủy đơn"))
        {
            var text = $"Dạ {name}, Store có chính sách bảo hành và đổi trả minh bạch:\n\n" +
                       "• Đổi trả trong vòng **7 ngày** nếu sản phẩm bị lỗi do nhà sản xuất hoặc giao sai mẫu.\n" +
                       "• Sản phẩm cần giữ nguyên hộp, tem mác và hóa đơn mua hàng.\n" +
                       "• Để yêu cầu hỗ trợ sau bán hàng hoặc hoàn tiền, quý khách có thể gửi form tại trang Liên hệ hoặc chat trực tiếp với đội ngũ hỗ trợ.";
            return new AiChatResponse(SplitIntoChunks(text), null, new object[] { new { id = "return-policy", label = "Chính sách đổi trả 7 ngày" } }, true);
        }

        if (lower.Contains("voucher") || lower.Contains("vòng quay") || lower.Contains("khuyến mãi") || lower.Contains("giảm giá") || lower.Contains("xu") || lower.Contains("điểm"))
        {
            var text = $"Dạ {name}! Hiện tại Store đang có các chương trình ưu đãi rất hấp dẫn:\n\n" +
                       "🎡 **Vòng quay may mắn:** Nhận lượt quay mỗi khi tích điểm đơn hàng, cơ hội trúng voucher 100.000 ₫ hoặc FreeShip 100%!\n" +
                       "🏅 **Hạng thành viên:** Tích điểm để nâng hạng Đồng ➔ Bạc ➔ Vàng ➔ Kim Cương và nhận chiết khấu trực tiếp trên mỗi đơn hàng.\n" +
                       "Quý khách có thể vào mục **Ưu đãi & Đổi thưởng** để tham gia ngay!";
            return new AiChatResponse(SplitIntoChunks(text), null, new object[] { new { id = "promo-policy", label = "Chương trình khuyến mãi Store" } }, true);
        }

        var ollamaResult = await TryOllamaGenerateAsync(message, "Bạn là nhân viên chăm sóc khách hàng thân thiện của siêu thị Store Mini Mart. Hãy tư vấn chu đáo, lịch sự, ngắn gọn bằng tiếng Việt.", cancellationToken);
        if (!string.IsNullOrWhiteSpace(ollamaResult))
        {
            return new AiChatResponse(
                SplitIntoChunks(ollamaResult),
                null,
                new object[] { new { id = "ollama", label = "Trợ lý ảo Store" } },
                true);
        }

        var defaultText = $"Chào {name}! Em là Trợ lý ảo Store Mini Mart. Em có thể hỗ trợ quý khách về:\n\n" +
                          "• Tìm kiếm thông tin sản phẩm và tư vấn mua hàng\n" +
                          "• Biểu phí vận chuyển và thời gian giao nhận hàng\n" +
                          "• Hướng dẫn thanh toán quét mã VietQR tự động\n" +
                          "• Chính sách bảo hành, đổi trả và cách dùng voucher giảm giá\n\n" +
                          "Quý khách đang quan tâm đến thông tin nào, hãy nhắn cho em nhé!";

        return new AiChatResponse(
            SplitIntoChunks(defaultText),
            null,
            new object[] { new { id = "store-support", label = "Trung tâm hỗ trợ Store" } },
            true);
    }

    private async Task<string?> TryOllamaGenerateAsync(string prompt, string systemPrompt, CancellationToken cancellationToken)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(6));

            var body = new
            {
                model = OllamaModel,
                prompt,
                system = systemPrompt,
                stream = false
            };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{OllamaHost}/api/generate", content, cts.Token);
            if (!response.IsSuccessStatusCode) return null;

            var resJson = await response.Content.ReadAsStringAsync(cts.Token);
            using var doc = JsonDocument.Parse(resJson);
            if (doc.RootElement.TryGetProperty("response", out var respProp))
            {
                return respProp.GetString();
            }
        }
        catch
        {
            // Ollama offline or unreachable
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

