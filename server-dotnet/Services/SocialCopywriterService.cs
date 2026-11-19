/*
  FILE NOTE
  - Mục đích: Dịch vụ sáng tạo nội dung tiếp thị bài đăng mạng xã hội (Facebook / TikTok), tích hợp trực tiếp Local Qwen AI (Ollama qwen3.5:4b) và bộ sinh nội dung chuyên biệt dự phòng với đường dẫn sản phẩm chính xác.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Services/OllamaChatClient.cs, Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs
  - Vùng ảnh hưởng khi sửa: Chất lượng văn chương, phong cách viết bài bán hàng, định dạng caption, hashtag, liên kết sản phẩm chính xác và câu kêu gọi hành động (CTA).
*/

using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using StoreApi.Models;

namespace StoreApi.Services;

public sealed class GeneratedPostResult
{
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Hashtags { get; set; } = "";
    public string GeneratedBy { get; set; } = "Local Qwen 4B"; // Local Qwen 4B | Smart Engine Fallback
    public string Platform { get; set; } = "facebook";
    public string Tone { get; set; } = "viral_engaging";
}

public sealed class SocialCopywriterService(IConfiguration configuration)
{
    private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(60) };

    private string Config(string key, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value)) value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private string OllamaHost => Config("OLLAMA_HOST", "http://127.0.0.1:11434").TrimEnd('/');
    private string ModelName => Config("OLLAMA_MODEL", Config("AI_MODEL", "qwen3.5:4b"));

    public async Task<GeneratedPostResult> GeneratePostAsync(
        string productName,
        decimal price,
        string category,
        string description,
        string platform,
        string tone,
        SocialCampaignSettings settings,
        string? customTopic = null,
        string productId = "1")
    {
        platform = (platform ?? "facebook").ToLowerInvariant();
        tone = (tone ?? "viral_engaging").ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(productId)) productId = "1";

        // Thử sinh văn phong thông qua Ollama Qwen Local trước
        try
        {
            var prompt = BuildPrompt(productName, price, category, description, platform, tone, settings, customTopic, productId);
            var qwenResult = await TryGenerateWithOllamaAsync(prompt);
            if (!string.IsNullOrWhiteSpace(qwenResult))
            {
                return ParseAiOutput(qwenResult, productName, platform, tone, $"Local Qwen ({ModelName})");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] Ollama Local không phản hồi hoặc timeout ({ex.Message}), chuyển sang Bộ sinh nội dung chuyên biệt.");
        }

        // Dự phòng bằng bộ sinh nội dung tự động thông minh
        return GenerateSmartFallback(productName, price, category, description, platform, tone, settings, customTopic, productId);
    }

    private string BuildPrompt(
        string productName,
        decimal price,
        string category,
        string description,
        string platform,
        string tone,
        SocialCampaignSettings settings,
        string? customTopic,
        string productId)
    {
        var priceVnd = string.Format(new CultureInfo("vi-VN"), "{0:N0}đ", price);
        var orderLink = (settings.OrderLinkTemplate ?? "https://omnicart.vn/products/{id}").Replace("{id}", productId);
        var sb = new StringBuilder();
        sb.AppendLine("Bạn là chuyên gia tiếp thị mạng xã hội hàng đầu cho chuỗi cửa hàng tiện ích phong cách sống OmniCart.");
        sb.AppendLine($"Hãy viết một bài đăng bán hàng trên nền tảng: {platform.ToUpperInvariant()}.");
        sb.AppendLine($"Sản phẩm: {productName}");
        sb.AppendLine($"Giá bán: {priceVnd}");
        sb.AppendLine($"Danh mục: {category}");
        sb.AppendLine($"Mô tả sản phẩm: {description}");
        sb.AppendLine($"Phong cách viết: {tone}");
        if (!string.IsNullOrWhiteSpace(customTopic))
        {
            sb.AppendLine($"Chủ đề / Yêu cầu thêm: {customTopic}");
        }

        sb.AppendLine("Yêu cầu định dạng bài viết:");
        sb.AppendLine("1. Dòng đầu tiên: Tiêu đề giật tít hấp dẫn kèm emoji.");
        sb.AppendLine("2. Phần thân: 2 - 3 đoạn văn ngắn gọn, nêu bật lợi ích thiết thực, khơi gợi nhu cầu mua hàng.");
        if (settings.IncludeEmojis) sb.AppendLine("3. Chèn các emoji phù hợp, sinh động.");
        if (settings.IncludeCta) sb.AppendLine("4. Kêu gọi hành động mạnh mẽ (Call to action).");
        if (settings.IncludeHotline) sb.AppendLine($"5. Đính kèm Hotline hỗ trợ: {settings.ContactHotline}");
        sb.AppendLine($"6. Kèm lời dẫn đặt hàng giao nhanh qua website OmniCart: {orderLink}");
        if (settings.IncludeHashtags) sb.AppendLine("7. Cuối bài chèn 4-6 hashtag bắt trend phù hợp.");
        sb.AppendLine("Chỉ trả về nội dung bài viết hoàn chỉnh bằng Tiếng Việt, không thêm lời dẫn giải của trợ lý.");

        return sb.ToString();
    }

    private async Task<string?> TryGenerateWithOllamaAsync(string prompt)
    {
        var requestPayload = new
        {
            model = ModelName,
            messages = new[]
            {
                new { role = "user", content = prompt }
            },
            stream = false,
            think = false,
            options = new
            {
                temperature = 0.7,
                num_predict = 1024
            }
        };

        var json = JsonSerializer.Serialize(requestPayload);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await _httpClient.PostAsync(OllamaHost + "/api/chat", content);
        if (!response.IsSuccessStatusCode) return null;

        var respStr = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(respStr);
        if (doc.RootElement.TryGetProperty("message", out var msgElem) &&
            msgElem.TryGetProperty("content", out var textElem))
        {
            return textElem.GetString();
        }

        return null;
    }

    private static GeneratedPostResult ParseAiOutput(string output, string productName, string platform, string tone, string source)
    {
        // Loại bỏ các thẻ suy luận ngầm <think>...</think> nếu có từ các model như Qwen
        var cleaned = Regex.Replace(output, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
        var lines = cleaned.Split('\n', StringSplitOptions.TrimEntries);
        var title = lines.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l)) ?? $"Khám phá ngay {productName} tại OmniCart!";
        
        var hashtags = "";
        var hashtagLine = lines.LastOrDefault(l => l.Contains('#'));
        if (hashtagLine != null)
        {
            hashtags = hashtagLine;
        }
        else
        {
            hashtags = "#OmniCart #Shopping #TienIchMoiNgay #GiaTot #DealHot";
        }

        return new GeneratedPostResult
        {
            Title = title.Trim('#', '*', ' '),
            Content = cleaned.Trim(),
            Hashtags = hashtags,
            GeneratedBy = source,
            Platform = platform,
            Tone = tone
        };
    }

    private static GeneratedPostResult GenerateSmartFallback(
        string productName,
        decimal price,
        string category,
        string description,
        string platform,
        string tone,
        SocialCampaignSettings settings,
        string? customTopic,
        string productId)
    {
        var priceVnd = string.Format(new CultureInfo("vi-VN"), "{0:N0}đ", price);
        var orderLink = (settings.OrderLinkTemplate ?? "https://omnicart.vn/products/{id}").Replace("{id}", productId);
        var sb = new StringBuilder();
        string title;
        string hashtags;

        if (platform == "tiktok")
        {
            title = tone switch
            {
                "humorous" => $"Trời ơi tin được không! {productName} có điểm này làm tui cười xỉu 😂",
                "fomo_sales" => $"CẢNH BÁO CHÁY HÀNG: {productName} chỉ còn vài suất giá sốc! ⚡",
                "authentic_review" => $"Review thật 100%: Có nên chi tiền cho {productName} không? 🤔",
                "storytelling" => $"Một ngày làm việc nhẹ tênh nhờ mang theo em {productName} này 🌿",
                _ => $"Món đồ hot trend ai cũng săn lùng: {productName} ✨"
            };

            sb.AppendLine($"🎬 [KỊCH BẢN TIKTOK 30s] - {title}");
            sb.AppendLine();
            sb.AppendLine($"✨ Góc review đồ xịn: Mọi người ơi, nếu đang tìm một món đồ vừa tiện, vừa thẩm mỹ thì nghía ngay {productName} này nha!");
            sb.AppendLine($"📌 Điểm sáng nhất: {description}");
            sb.AppendLine($"💰 Giá cực hời chỉ {priceVnd} tại OmniCart.");
            sb.AppendLine();
            if (settings.IncludeCta)
            {
                sb.AppendLine("👉 Nhấp vào biểu tượng giỏ hàng vàng góc trái màn hình hoặc link bio để rước em ấy về nhà ngay hôm nay!");
                sb.AppendLine($"🛒 Link mua sắm chính hãng: {orderLink}");
            }
            if (settings.IncludeHotline)
            {
                sb.AppendLine($"📞 Hỗ trợ nhanh: {settings.ContactHotline}");
            }

            hashtags = "#TikTokShop #ReviewDoXinh #OmniCart #GiaDungThongMinh #MuaSamTikTok #Trending2026";
        }
        else
        {
            // Facebook
            title = tone switch
            {
                "humorous" => $"Ủa rồi ai mượn cưng dữ vậy nè? {productName} xuất sắc từng chi tiết! 😆",
                "fomo_sales" => $"🔥 DEAL SỐC CHỈ CÓ TẠI OMNICART - {productName.ToUpperInvariant()} GIẢM CỰC MẠNH!",
                "authentic_review" => $"[GÓC CHIA SẺ THẬT] Đánh giá chi tiết {productName} sau thời gian trải nghiệm ⭐",
                "storytelling" => $"Nâng niu không gian sống mỗi ngày cùng {productName} 🍃",
                _ => $"✨ NÂNG CẤP CUỘC SỐNG MỖI NGÀY CÙNG {productName.ToUpperInvariant()}"
            };

            sb.AppendLine(title);
            sb.AppendLine();
            sb.AppendLine($"Chào cả nhà! Bạn đang muốn nâng cao chất lượng cuộc sống và tiết kiệm thời gian mỗi ngày? OmniCart giới thiệu đến bạn siêu phẩm: {productName}!");
            sb.AppendLine();
            sb.AppendLine("🌿 ĐIỂM NỔI BẬT KHÔNG THỂ BỎ LỠ:");
            sb.AppendLine($"• {description}");
            sb.AppendLine($"• Phân loại chuẩn chất lượng: {category}");
            sb.AppendLine($"• Cam kết hàng chính hãng, bảo hành chu đáo, đổi trả linh hoạt tại OmniCart.");
            sb.AppendLine();
            sb.AppendLine($"🏷️ ƯU ĐÃI ĐẶC BIỆT: {priceVnd}");
            if (settings.IncludeCta)
            {
                sb.AppendLine("🛒 Đặt hàng online ngay để nhận giao hàng tận tay siêu tốc:");
                sb.AppendLine(orderLink);
            }
            if (settings.IncludeHotline)
            {
                sb.AppendLine($"📞 Hotline tư vấn & CSKH: {settings.ContactHotline}");
            }

            hashtags = "#OmniCart #OmniCartEveryday #MuaSamThongMinh #GiaTotMoiNgay #DoGiaDung #ThoiTrangTienIch";
        }

        if (settings.IncludeHashtags)
        {
            sb.AppendLine();
            sb.AppendLine(hashtags);
        }

        return new GeneratedPostResult
        {
            Title = title,
            Content = sb.ToString().Trim(),
            Hashtags = hashtags,
            GeneratedBy = "Smart Engine (Fallback)",
            Platform = platform,
            Tone = tone
        };
    }
}
