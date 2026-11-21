/*
  FILE NOTE
  - Mục đích: Dịch vụ sáng tạo nội dung tiếp thị bài đăng mạng xã hội (Facebook / TikTok), tích hợp trực tiếp Local Qwen AI (Ollama qwen3.5:4b) và bộ mở rộng từ khóa, phân loại/gắn tag bài viral.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Services/OllamaChatClient.cs, Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs
  - Vùng ảnh hưởng khi sửa: Chất lượng viết bài, hashtag, gợi ý từ khóa mở rộng và phân loại lọc bài viral.
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


    public sealed record ExpandedTopicResult(
        string TopicLabel,
        IReadOnlyList<string> FbKeywords,
        IReadOnlyList<string> TtKeywords,
        IReadOnlyList<string> Tags,
        string GeneratedBy);

    public sealed record ClassifiedViralResult(
        IReadOnlyList<SocialViralPost> Posts,
        int RemovedOffTopic,
        int RemovedDuplicates,
        string GeneratedBy);

    public async Task<ExpandedTopicResult> ExpandViralTopicAsync(string? topicKey, string? customTopic)
    {
        var key = (topicKey ?? "all").Trim().ToLowerInvariant();
        var custom = (customTopic ?? "").Trim();
        var label = key switch
        {
            "vehicles" => "Xe cộ",
            "anime" => "Anime",
            "cartoon" => "Hoạt hình",
            "game" => "Game",
            "new_product" => "Quảng bá sản phẩm mới",
            "electronics_compare" => "So sánh sản phẩm điện tử",
            "custom" => custom,
            _ => ""
        };

        var fallback = DefaultKeywordsForTopic(key, custom);
        if (string.IsNullOrWhiteSpace(label))
            return new ExpandedTopicResult("", fallback.Fb, fallback.Tt, fallback.Tags, "Preset");

        try
        {
            var prompt =
                $"Bạn là chuyên gia tìm kiếm nội dung Viral Facebook và TikTok tại Việt Nam.\n" +
                $"Chủ đề cần cào bài viral: \"{label}\".\n" +
                $"Hãy tạo danh sách 6 từ khóa tìm kiếm phổ biến trên Facebook (fbKeywords), 6 từ khóa dễ ra video triệu tim trên TikTok gồm cả tiếng Việt lẫn tiếng Anh ngắn gọn (ttKeywords), và 5 hashtag ngắn gọn (tags).\n" +
                $"CHỈ TRẢ VỀ DUY NHẤT JSON hợp lệ theo mẫu (không giải thích thêm):\n" +
                $"{{\"fbKeywords\":[\"...\"],\"ttKeywords\":[\"...\"],\"tags\":[\"#...\"]}}";

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(18));
            var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 420, cts.Token);
            if (!string.IsNullOrWhiteSpace(raw))
            {
                var jsonText = ExtractJsonObject(raw);
                if (jsonText is not null)
                {
                    using var doc = JsonDocument.Parse(jsonText);
                    var root = doc.RootElement;
                    var fb = ReadStringList(root, "fbKeywords").Concat(fallback.Fb).Distinct(StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
                    var tt = ReadStringList(root, "ttKeywords").Concat(fallback.Tt).Distinct(StringComparer.OrdinalIgnoreCase).Take(8).ToArray();
                    var tags = ReadStringList(root, "tags").Concat(fallback.Tags).Distinct(StringComparer.OrdinalIgnoreCase).Take(6).ToArray();
                    if (fb.Length > 0 && tt.Length > 0)
                        return new ExpandedTopicResult(label, fb, tt, tags, $"Local Qwen ({ModelName})");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] AI mở rộng từ khóa dự phòng ({ex.Message})");
        }

        return new ExpandedTopicResult(label, fallback.Fb, fallback.Tt, fallback.Tags, "Smart Preset");
    }

    public async Task<ClassifiedViralResult> ClassifyAndFilterViralPostsAsync(
        string? requestedTopic,
        string? requestedTopicLabel,
        IReadOnlyList<SocialViralPost> inputPosts)
    {
        if (inputPosts.Count == 0)
            return new ClassifiedViralResult([], 0, 0, "None");

        // Bước 1: Lọc trùng chắc chắn theo URL chuẩn hóa và chữ ký tiêu đề + tương tác
        var deduped = new List<SocialViralPost>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenFingerprints = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int removedDup = 0;

        foreach (var p in inputPosts)
        {
            var urlKey = (p.PostUrl ?? "").Trim().TrimEnd('/').ToLowerInvariant();
            var titleNorm = Regex.Replace((p.Title ?? "").ToLowerInvariant(), @"[^a-z0-9\p{L}]+", " ").Trim();
            var fp = $"{p.Platform}|{(titleNorm.Length > 42 ? titleNorm[..42] : titleNorm)}|{p.LikesCount}";

            if ((!string.IsNullOrEmpty(urlKey) && !seenUrls.Add(urlKey)) || !seenFingerprints.Add(fp))
            {
                removedDup++;
                continue;
            }
            deduped.Add(p);
        }

        var topicKey = (requestedTopic ?? "all").Trim().ToLowerInvariant();
        var topicLabel = (requestedTopicLabel ?? "").Trim();
        var isFilteredTopic = topicKey != "all" && !string.IsNullOrWhiteSpace(topicLabel);

        // Bước 2: Gọi Local AI qwen3.5:4b để phân loại chủ đề, kiểm tra độ liên quan, gắn #tag & lọc trùng ngữ nghĩa
        int removedOffTopic = 0;
        var finalPosts = new List<SocialViralPost>();
        string generatedBy = "Smart Rules";

        try
        {
            const int batchSize = 15;
            for (int offset = 0; offset < deduped.Count; offset += batchSize)
            {
                var batch = deduped.Skip(offset).Take(batchSize).ToList();
                var compactItems = batch.Select((p, idx) => new
                {
                    idx,
                    platform = p.Platform,
                    title = p.Title.Length > 110 ? p.Title[..110] : p.Title,
                    summary = p.Summary.Length > 130 ? p.Summary[..130] : p.Summary
                });

                var prompt =
                    "Bạn là bộ lọc AI phân loại bài đăng Viral mạng xã hội.\n" +
                    (isFilteredTopic
                        ? $"Chủ đề người dùng yêu cầu: \"{topicLabel}\". Đặt match=true CHỈ KHI bài viết thực sự liên quan tới \"{topicLabel}\", nếu là chủ đề hoàn toàn khác (vd nấu ăn, giáng sinh, máy bay khi đang tìm Anime) thì đặt match=false.\n"
                        : "Người dùng đang lấy tất cả xu hướng (match luôn là true).\n") +
                    "Với mỗi bài, hãy gán:\n" +
                    "- category: 1 tên thể loại Tiếng Việt ngắn gọn (ví dụ: Anime, Xe cộ, Hoạt hình, Game, Quảng bá sản phẩm mới, So sánh sản phẩm điện tử, Công nghệ, Ẩm thực, Thời trang, Đời sống, Giải trí).\n" +
                    "- tags: 2-3 hashtag ngắn gọn phù hợp nội dung (ví dụ: #Anime #Edit).\n" +
                    "- dup: true nếu bài có nội dung gần như giống hệt một bài có idx nhỏ hơn trong danh sách, ngược lại false.\n" +
                    "CHỈ TRẢ VỀ MẢNG JSON hợp lệ (không giải thích): [{\"idx\":0,\"match\":true,\"category\":\"...\",\"tags\":\"#...\",\"dup\":false}]\n" +
                    "DANH SÁCH BÀI:\n" + JsonSerializer.Serialize(compactItems);

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(28));
                var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 900, cts.Token);
                var jsonArr = ExtractJsonArray(raw);

                if (jsonArr is not null)
                {
                    generatedBy = $"Local Qwen ({ModelName})";
                    var decisions = new Dictionary<int, (bool Match, string Category, string Tags, bool Dup)>();
                    using var doc = JsonDocument.Parse(jsonArr);
                    foreach (var elem in doc.RootElement.EnumerateArray())
                    {
                        if (!elem.TryGetProperty("idx", out var idxProp) || !idxProp.TryGetInt32(out var idx)) continue;
                        var match = !elem.TryGetProperty("match", out var mProp) || mProp.ValueKind != JsonValueKind.False;
                        var cat = elem.TryGetProperty("category", out var cProp) ? (cProp.GetString() ?? "").Trim() : "";
                        var tags = elem.TryGetProperty("tags", out var tProp) ? (tProp.GetString() ?? "").Trim() : "";
                        var dup = elem.TryGetProperty("dup", out var dProp) && dProp.ValueKind == JsonValueKind.True;
                        decisions[idx] = (match, cat, tags, dup);
                    }

                    for (int i = 0; i < batch.Count; i++)
                    {
                        var post = batch[i];
                        if (decisions.TryGetValue(i, out var d))
                        {
                            if (d.Dup) { removedDup++; continue; }
                            if (isFilteredTopic && !d.Match) { removedOffTopic++; continue; }
                            if (!string.IsNullOrWhiteSpace(d.Category))
                                post.Category = isFilteredTopic ? topicLabel : d.Category;
                            if (!string.IsNullOrWhiteSpace(d.Tags) && !post.TrendingTopic.Contains('#'))
                                post.TrendingTopic = string.IsNullOrWhiteSpace(post.TrendingTopic) ? d.Tags : $"{post.TrendingTopic} • {d.Tags}";
                        }
                        finalPosts.Add(post);
                    }
                    continue;
                }

                // Dự phòng bằng quy tắc từ khóa nếu Ollama không phản hồi JSON
                ApplyFallbackClassification(batch, isFilteredTopic, topicKey, topicLabel, finalPosts, ref removedOffTopic);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] AI phân loại bài Viral chuyển sang dự phòng ({ex.Message})");
            finalPosts.Clear();
            removedOffTopic = 0;
            ApplyFallbackClassification(deduped, isFilteredTopic, topicKey, topicLabel, finalPosts, ref removedOffTopic);
        }

        return new ClassifiedViralResult(finalPosts, removedOffTopic, removedDup, generatedBy);
    }

    private async Task<string?> TryGenerateWithOllamaAsync(string prompt, int maxTokens, CancellationToken ct)
    {
        var requestPayload = new
        {
            model = ModelName,
            messages = new[] { new { role = "user", content = prompt } },
            stream = false,
            think = false,
            options = new { temperature = 0.25, num_predict = maxTokens }
        };

        var json = JsonSerializer.Serialize(requestPayload);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await _httpClient.PostAsync(OllamaHost + "/api/chat", content, ct);
        if (!response.IsSuccessStatusCode) return null;

        var respStr = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(respStr);
        if (doc.RootElement.TryGetProperty("message", out var msgElem) &&
            msgElem.TryGetProperty("content", out var textElem))
            return textElem.GetString();
        return null;
    }

    private static string? ExtractJsonObject(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var clean = Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
        var start = clean.IndexOf('{');
        var end = clean.LastIndexOf('}');
        return start >= 0 && end > start ? clean[start..(end + 1)] : null;
    }

    private static string? ExtractJsonArray(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var clean = Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
        var start = clean.IndexOf('[');
        var end = clean.LastIndexOf(']');
        return start >= 0 && end > start ? clean[start..(end + 1)] : null;
    }

    private static List<string> ReadStringList(JsonElement root, string prop)
    {
        var list = new List<string>();
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var item in arr.EnumerateArray())
        {
            var s = item.GetString()?.Trim();
            if (!string.IsNullOrWhiteSpace(s)) list.Add(s);
        }
        return list;
    }

    private static (string[] Fb, string[] Tt, string[] Tags) DefaultKeywordsForTopic(string key, string custom) => key switch
    {
        "vehicles" => (["review ô tô", "xe máy độ đẹp", "siêu xe việt nam", "đánh giá xe hơi", "xe điện vinfast", "xe cộ viral"],
            ["review xe hơi", "siêu xe việt nam", "car edit", "xe máy độ", "motor edit", "supercar viral"], ["#XeCo", "#Oto", "#ReviewXe"]),
        "anime" => (["anime vietsub", "anime edit", "review anime hay", "jujutsu kaisen vietsub", "one piece vietsub", "naruto vietsub"],
            ["anime edit", "anime vietsub", "jujutsu kaisen edit", "one piece edit", "naruto edit", "demon slayer edit"], ["#Anime", "#AnimeEdit", "#Vietsub"]),
        "cartoon" => (["phim hoạt hình review", "hoạt hình 3d trung quốc", "doraemon vietsub", "conan vietsub", "hoạt hình hay"],
            ["hoạt hình 3d", "donghua edit", "doraemon edit", "conan edit", "cartoon edit", "animation viral"], ["#HoatHinh", "#Donghua", "#PhimHoatHinh"]),
        "game" => (["liên quân mobile highlight", "lmht highlight", "valorant việt nam", "gaming highlight", "game mobile hay"],
            ["gaming highlight", "liên quân mobile", "league of legends edit", "valorant clutch", "minecraft viral", "game edit"], ["#Game", "#Gaming", "#Highlight"]),
        "new_product" => (["unbox sản phẩm mới", "review đồ công nghệ mới", "ra mắt sản phẩm mới", "đồ gia dụng thông minh review", "săn deal đồ tiện ích"],
            ["unbox review", "đồ gia dụng thông minh", "review đồ tiện ích", "tech unboxing", "tiktok made me buy it", "sản phẩm mới"], ["#SanPhamMoi", "#Unbox", "#Review"]),
        "electronics_compare" => (["so sánh iphone samsung", "so sánh laptop", "so sánh điện thoại", "so sánh tai nghe", "đánh giá công nghệ"],
            ["so sánh iphone", "iphone vs samsung", "laptop review", "tech comparison", "so sánh điện thoại", "smartphone test"], ["#CongNghe", "#SoSanh", "#Tech"]),
        "custom" when !string.IsNullOrWhiteSpace(custom) => ([custom, $"{custom} review", $"{custom} việt nam", $"{custom} viral"],
            [custom, $"{custom} edit", $"{custom} review", $"{custom} viral"], [$"#{Regex.Replace(custom, @"[^\p{L}\p{N}]", "")}"]),
        _ => ([], [], [])
    };

    private static void ApplyFallbackClassification(
        IEnumerable<SocialViralPost> batch,
        bool isFilteredTopic,
        string topicKey,
        string topicLabel,
        List<SocialViralPost> target,
        ref int removedOffTopic)
    {
        var rules = new Dictionary<string, string[]>
        {
            ["anime"] = ["anime", "manga", "otaku", "vietsub", "jujutsu", "gojo", "one piece", "luffy", "naruto", "sasuke", "hinata", "kimetsu", "demon slayer", "bleach", "dragon ball", "isekai", "waifu", "cosplay", "kyuurun"],
            ["vehicles"] = ["xe ", "ô tô", "oto", "xe máy", "motor", "moto", "car", "supercar", "vinfast", "bmw", "mercedes", "porsche", "lamborghini", "ferrari", "exciter", "winner", "sh ", "vespa"],
            ["cartoon"] = ["hoạt hình", "hoat hinh", "cartoon", "donghua", "doraemon", "conan", "pixar", "disney", "tom and jerry", "animation", "3d"],
            ["game"] = ["game", "gaming", "liên quân", "lien quan", "lmht", "lol", "valorant", "pubg", "free fire", "minecraft", "roblox", "gta", "genshin", "esports", "highlight"],
            ["new_product"] = ["unbox", "review", "sản phẩm", "san pham", "gia dụng", "tiện ích", "deal", "shopee", "mua", "ra mắt", "mới nhất", "gadgets", "finds"],
            ["electronics_compare"] = ["so sánh", "so sanh", " vs ", "iphone", "samsung", "xiaomi", "laptop", "macbook", "ipad", "tai nghe", "airpods", "điện thoại", "camera", "chip", "snapdragon"]
        };

        foreach (var post in batch)
        {
            var hay = $"{post.Title} {post.Summary}".ToLowerInvariant();
            if (isFilteredTopic)
            {
                var kws = rules.TryGetValue(topicKey, out var r)
                    ? r
                    : topicLabel.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(w => w.Length >= 2).ToArray();
                if (kws.Length > 0 && !kws.Any(k => hay.Contains(k)))
                {
                    removedOffTopic++;
                    continue;
                }
                post.Category = topicLabel;
            }
            else if (string.IsNullOrWhiteSpace(post.Category) || post.Category is "Video TikTok" or "Facebook Reels" or "Bài ảnh")
            {
                foreach (var (rk, rkws) in rules)
                {
                    if (rkws.Any(k => hay.Contains(k)))
                    {
                        post.Category = rk switch
                        {
                            "anime" => "Anime",
                            "vehicles" => "Xe cộ",
                            "cartoon" => "Hoạt hình",
                            "game" => "Game",
                            "new_product" => "Quảng bá sản phẩm mới",
                            "electronics_compare" => "So sánh sản phẩm điện tử",
                            _ => post.Category
                        };
                        break;
                    }
                }
            }
            target.Add(post);
        }
    }

    public async Task<ExtensionVisionDecision> DiagnoseExtensionUiAsync(ExtensionVisionAssistRequest req)
    {
        var elements = (req.Elements ?? []).Take(65).ToList();
        if (elements.Count == 0)
            return new(false, "Trang chưa có phần tử tương tác nào.", "wait_and_retry", null, "normal", null, "Rules");

        var compactMap = elements.Select(e => new
        {
            id = e.Id,
            tag = e.Tag,
            role = e.Role,
            text = e.Text.Length > 60 ? e.Text[..60] : e.Text,
            aria = e.AriaLabel.Length > 60 ? e.AriaLabel[..60] : e.AriaLabel,
            e2e = e.DataE2e,
            dlg = e.InDialog,
            dis = e.Disabled,
            color = e.PrimaryColor,
            box = new[] { e.X, e.Y, e.W, e.H },
            sel = e.StableSelector
        });

        var prompt =
            $"Bạn là bộ não thị giác AI điều khiển Chrome Extension tự động đăng bài trên {req.Platform.ToUpperInvariant()}.\n" +
            $"Mục tiêu bước hiện tại ({req.StepKey}): {req.Goal}\n" +
            $"URL hiện tại: {req.Url} | Khung hình: {req.ViewportWidth}x{req.ViewportHeight} | ScrollY: {req.ScrollY}\n" +
            $"Lý do cần AI hỗ trợ: {req.ErrorReason}\n" +
            "Dựa vào ảnh chụp (nếu có) và bản đồ phần tử tương tác (mỗi phần tử có id, text, aria, dlg=nằm trong hộp thoại, box=[x,y,w,h], sel=selector), hãy chọn hành động chính xác nhất.\n" +
            "Các action hợp lệ:\n" +
            "- \"click_mark\": bấm vào phần tử có targetMarkId.\n" +
            "- \"dismiss_popup\": nhấn Escape hoặc bấm targetMarkId để đóng popup/gợi ý đang che màn hình.\n" +
            "- \"scroll_down\" hoặc \"scroll_up\": cuộn trang để lộ nút.\n" +
            "- \"navigate_target\": trang thực sự bị văng sang nơi khác, cần điều hướng lại.\n" +
            "- \"wait_and_retry\": trang đang tải dở, chờ thêm.\n" +
            "clickMode hợp lệ: \"skip_scroll\" (dùng cho nút trong dropdown/popover để không làm đóng menu) hoặc \"normal\".\n" +
            "CHỈ TRẢ VỀ DUY NHẤT JSON HỢP LỆ (không giải thích ngoài JSON):\n" +
            "{\"diagnosis\":\"nguyên nhân ngắn gọn tiếng Việt\",\"action\":\"click_mark\",\"targetMarkId\":12,\"clickMode\":\"skip_scroll\",\"learnedRule\":{\"selector\":\"...\",\"role\":\"...\",\"textPattern\":\"...\",\"ariaPattern\":\"...\",\"inDialog\":true,\"clickMode\":\"skip_scroll\"}}\n" +
            "BẢN ĐỒ PHẦN TỬ:\n" + JsonSerializer.Serialize(compactMap);

        try
        {
            var userMessage = string.IsNullOrWhiteSpace(req.ScreenshotBase64)
                ? (object)new { role = "user", content = prompt }
                : new { role = "user", content = prompt, images = new[] { StripDataUrlPrefix(req.ScreenshotBase64) } };

            var payload = new
            {
                model = ModelName,
                messages = new[] { userMessage },
                stream = false,
                think = false,
                options = new { temperature = 0.15, num_predict = 450 }
            };

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var response = await _httpClient.PostAsync(OllamaHost + "/api/chat", content, cts.Token);
            if (response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cts.Token);
                using var respDoc = JsonDocument.Parse(body);
                var rawText = respDoc.RootElement.TryGetProperty("message", out var msgObj) && msgObj.TryGetProperty("content", out var cObj)
                    ? cObj.GetString() : null;
                var jsonText = ExtractJsonObject(rawText);
                if (jsonText is not null)
                {
                    using var decisionDoc = JsonDocument.Parse(jsonText);
                    var r = decisionDoc.RootElement;
                    var diagnosis = r.TryGetProperty("diagnosis", out var dProp) ? (dProp.GetString() ?? "AI đã phân tích giao diện.") : "AI đã phân tích giao diện.";
                    var action = r.TryGetProperty("action", out var aProp) ? (aProp.GetString() ?? "wait_and_retry") : "wait_and_retry";
                    int? markId = r.TryGetProperty("targetMarkId", out var mProp) && mProp.TryGetInt32(out var mid) ? mid : null;
                    var clickMode = r.TryGetProperty("clickMode", out var cmProp) ? (cmProp.GetString() ?? "normal") : "normal";

                    ExtensionLearnedRule? learned = null;
                    if (r.TryGetProperty("learnedRule", out var lr) && lr.ValueKind == JsonValueKind.Object)
                    {
                        learned = new ExtensionLearnedRule(
                            lr.TryGetProperty("selector", out var sP) ? sP.GetString() : null,
                            lr.TryGetProperty("role", out var rP) ? rP.GetString() : null,
                            lr.TryGetProperty("textPattern", out var tP) ? tP.GetString() : null,
                            lr.TryGetProperty("ariaPattern", out var arP) ? arP.GetString() : null,
                            lr.TryGetProperty("inDialog", out var dP) && dP.ValueKind == JsonValueKind.True,
                            lr.TryGetProperty("clickMode", out var lcmP) ? (lcmP.GetString() ?? clickMode) : clickMode
                        );
                    }

                    // Tự làm giàu learnedRule từ chính phần tử markId nếu AI để trống selector
                    if (markId.HasValue)
                    {
                        var matchedEl = elements.FirstOrDefault(e => e.Id == markId.Value);
                        if (matchedEl is not null)
                        {
                            learned = new ExtensionLearnedRule(
                                string.IsNullOrWhiteSpace(learned?.Selector) ? matchedEl.StableSelector : learned.Selector,
                                string.IsNullOrWhiteSpace(learned?.Role) ? matchedEl.Role : learned.Role,
                                string.IsNullOrWhiteSpace(learned?.TextPattern) ? matchedEl.Text : learned.TextPattern,
                                string.IsNullOrWhiteSpace(learned?.AriaPattern) ? matchedEl.AriaLabel : learned.AriaPattern,
                                learned?.InDialog ?? matchedEl.InDialog,
                                learned?.ClickMode ?? clickMode);
                        }
                    }

                    return new(true, diagnosis, action, markId, clickMode, learned, $"Local Qwen ({ModelName})");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] AI Vision Assist lỗi ({ex.Message})");
        }

        return new(false, "AI Local tạm thời chưa phản hồi phán đoán giao diện.", "wait_and_retry", null, "normal", null, "Fallback");
    }

    private static string StripDataUrlPrefix(string raw)
    {
        var comma = raw.IndexOf(',');
        return comma >= 0 ? raw[(comma + 1)..] : raw;
    }

    // 1. Biến kho bài Viral thành Ý tưởng bán hàng gắn sản phẩm thật trong Store
    public async Task<object> GenerateViralSalesIdeasAsync(
        IReadOnlyList<SocialViralPost> viralPosts,
        IReadOnlyList<CatalogProduct> catalog,
        int count = 4)
    {
        var topViral = viralPosts.OrderByDescending(v => v.LikesCount).Take(12)
            .Select(v => new { v.Platform, v.Category, title = v.Title.Length > 100 ? v.Title[..100] : v.Title, v.LikesCount, v.CommentsCount }).ToArray();
        var topProducts = catalog.Where(p => p.StockCount > 0)
            .OrderByDescending(p => p.DiscountPercent > 0).ThenByDescending(p => p.ViewCount).Take(18)
            .Select(p => new { p.Id, p.Name, p.Category, p.Price, p.DiscountPercent, p.StockCount }).ToArray();

        if (topViral.Length == 0 || topProducts.Length == 0)
            return new { ok = true, summary = "Chưa đủ bài Viral hoặc sản phẩm để tạo ý tưởng.", ideas = Array.Empty<object>(), generatedBy = "Fallback" };

        try
        {
            var prompt =
                "Bạn là Giám đốc sáng tạo Marketing cho cửa hàng OmniCart.\n" +
                $"Dựa trên {topViral.Length} bài đăng Viral thực tế và danh sách sản phẩm thật của cửa hàng bên dưới, hãy phân tích xu hướng nổi bật nhất và đề xuất {Math.Clamp(count, 2, 6)} Ý TƯỞNG BÀI BÁN HÀNG BẮT TREND cụ thể.\n" +
                "CHỈ TRẢ VỀ JSON HỢP LỆ (không giải thích ngoài JSON):\n" +
                "{\"summary\":\"Tóm tắt 2 câu về xu hướng nổi bật\",\"ideas\":[{\"trendName\":\"...\",\"productId\":\"mã sp trong danh sách\",\"productName\":\"tên sp\",\"platform\":\"facebook hoặc tiktok\",\"hook\":\"Câu mở đầu giật tít\",\"angle\":\"Góc triển khai bắt trend\",\"hashtags\":\"#...\",\"tone\":\"viral_engaging\"}]}\n" +
                "BÀI VIRAL:\n" + JsonSerializer.Serialize(topViral) + "\n" +
                "SẢN PHẨM CỬA HÀNG:\n" + JsonSerializer.Serialize(topProducts);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 1100, cts.Token);
            var json = ExtractJsonObject(raw);
            if (json is not null)
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement.Clone();
                return new
                {
                    ok = true,
                    summary = root.TryGetProperty("summary", out var s) ? s.GetString() : "Phân tích xu hướng Viral thành công.",
                    ideas = root.TryGetProperty("ideas", out var arr) && arr.ValueKind == JsonValueKind.Array ? (object)arr : Array.Empty<object>(),
                    generatedBy = $"Local Qwen ({ModelName})"
                };
            }
        }
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] ViralSalesIdeas fallback: {ex.Message}"); }

        var fallbackIdeas = topViral.Take(Math.Min(count, topProducts.Length)).Select((v, idx) =>
        {
            var prod = topProducts[idx % topProducts.Length];
            return new
            {
                trendName = string.IsNullOrWhiteSpace(v.Category) ? "Xu hướng Viral" : v.Category,
                productId = prod.Id,
                productName = prod.Name,
                platform = v.Platform,
                hook = $"Bắt trend {v.Category}: Không thể bỏ qua {prod.Name} đang cực hot!",
                angle = $"Lấy cảm hứng từ bài đạt {v.LikesCount:N0} tương tác để dẫn dắt nhu cầu sử dụng {prod.Name}.",
                hashtags = "#OmniCart #BatTrend #Viral2026 #DealHot",
                tone = "viral_engaging"
            };
        }).ToArray();
        return new { ok = true, summary = $"Tổng hợp nhanh từ {topViral.Length} bài viral nổi bật.", ideas = fallbackIdeas, generatedBy = "Smart Fallback" };
    }

    // 2. Vision AI qwen3.5:4b nhìn ảnh sản phẩm -> tự điền Tên, Danh mục, Mô tả, Đặc điểm, Giá gợi ý
    public async Task<object> ExtractProductFromImageAsync(string imageBase64, string? hint, long? suggestedPrice)
    {
        if (string.IsNullOrWhiteSpace(imageBase64))
            return new { ok = false, error = "IMAGE_REQUIRED" };

        var prompt =
            "Bạn là chuyên gia nhập liệu sản phẩm thương mại điện tử Việt Nam.\n" +
            "Hãy nhìn thật kỹ tấm ảnh sản phẩm này" + (string.IsNullOrWhiteSpace(hint) ? "" : $" (gợi ý thêm: {hint})") + ".\n" +
            "Tạo thông tin sản phẩm chuẩn tiếng Việt ngắn gọn, tự nhiên.\n" +
            "Danh mục chọn 1 trong: Điện tử, Đồ gia dụng, Làm đẹp, Laptop, Linh kiện, Trang phục, Trang sức, Tự Thiết Kế.\n" +
            "CHỈ TRẢ VỀ JSON HỢP LỆ:\n" +
            "{\"name\":\"Tên tiếng Việt <= 55 ký tự\",\"category\":\"...\",\"price\":250000,\"description\":\"Mô tả 2-3 câu hấp dẫn rõ công dụng/chất liệu\",\"features\":[\"Đặc điểm 1\",\"Đặc điểm 2\",\"Đặc điểm 3\"],\"label\":\"Mới\"}";

        try
        {
            var payload = new
            {
                model = ModelName,
                messages = new[]
                {
                    new { role = "user", content = prompt, images = new[] { StripDataUrlPrefix(imageBase64) } }
                },
                stream = false,
                think = false,
                options = new { temperature = 0.25, num_predict = 550 }
            };
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            using var resp = await _httpClient.PostAsync(OllamaHost + "/api/chat", content, cts.Token);
            if (resp.IsSuccessStatusCode)
            {
                using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(cts.Token));
                var raw = doc.RootElement.TryGetProperty("message", out var m) && m.TryGetProperty("content", out var c) ? c.GetString() : null;
                var json = ExtractJsonObject(raw);
                if (json is not null)
                {
                    using var parsed = JsonDocument.Parse(json);
                    var r = parsed.RootElement;
                    long parsedPrice = suggestedPrice is > 0 ? suggestedPrice.Value
                        : (r.TryGetProperty("price", out var pP) && pP.TryGetInt64(out var pv) && pv > 0 ? pv : 199000);
                    return new
                    {
                        ok = true,
                        product = new
                        {
                            name = r.TryGetProperty("name", out var nP) ? (nP.GetString() ?? "Sản phẩm mới") : "Sản phẩm mới",
                            category = r.TryGetProperty("category", out var cP) ? (cP.GetString() ?? "Đồ gia dụng") : "Đồ gia dụng",
                            price = parsedPrice,
                            description = r.TryGetProperty("description", out var dP) ? (dP.GetString() ?? "") : "",
                            features = ReadStringList(r, "features"),
                            label = r.TryGetProperty("label", out var lP) ? (lP.GetString() ?? "Mới") : "Mới"
                        },
                        generatedBy = $"Local Vision ({ModelName})"
                    };
                }
            }
        }
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] Vision Product lỗi: {ex.Message}"); }

        return new
        {
            ok = true,
            product = new
            {
                name = string.IsNullOrWhiteSpace(hint) ? "Sản phẩm tiện ích mới" : hint.Trim(),
                category = "Đồ gia dụng",
                price = suggestedPrice is > 0 ? suggestedPrice.Value : 199000,
                description = "Sản phẩm thiết kế gọn đẹp, chất lượng bền bỉ, phù hợp sử dụng hằng ngày.",
                features = new[] { "Thiết kế hiện đại", "Chất liệu bền đẹp", "Dễ sử dụng hằng ngày" },
                label = "Mới"
            },
            generatedBy = "Fallback"
        };
    }

    // 3. Phân tích Bình luận bài FB / TikTok: top chủ đề thảo luận, bình luận viết nhiều nhất, bình luận nhiều tim nhất
    public async Task<object> AnalyzeCommentsAsync(AnalyzeCommentsRequest req)
    {
        var comments = (req.Comments ?? []).Where(c => !string.IsNullOrWhiteSpace(c.Text)).ToList();
        var topLiked = comments.OrderByDescending(c => c.Likes).Take(10).ToArray();

        // Thống kê cụm bình luận lặp lại nhiều nhất bằng chuẩn hóa văn bản
        var repeated = comments
            .GroupBy(c => Regex.Replace(c.Text.ToLowerInvariant(), @"[^\p{L}\p{N}\s]+", "").Trim())
            .Where(g => g.Key.Length >= 2)
            .Select(g => new { text = g.First().Text, count = g.Count(), totalLikes = g.Sum(x => x.Likes) })
            .OrderByDescending(x => x.count).ThenByDescending(x => x.totalLikes)
            .Take(8).ToArray();

        object[] aiTopics = [];
        string summary = $"Đã phân tích {comments.Count} bình luận.";
        string generatedBy = "Smart Stats";

        if (comments.Count > 0)
        {
            try
            {
                var sample = comments.Take(45).Select(c => new { t = c.Text.Length > 110 ? c.Text[..110] : c.Text, l = c.Likes });
                var prompt =
                    "Bạn là chuyên gia phân tích tâm lý người dùng mạng xã hội.\n" +
                    $"Dưới đây là các bình luận thực tế của bài đăng ({req.Platform}): \"{req.PostTitle}\".\n" +
                    "Hãy phân tích và gom nhóm xem người dùng đang thảo luận về những CHỦ ĐỀ nào nhiều nhất, thái độ chung (tích cực/hài hước/tranh cãi/hỏi mua) và đề xuất 1 góc bán hàng ăn theo.\n" +
                    "CHỈ TRẢ VỀ JSON HỢP LỆ:\n" +
                    "{\"summary\":\"Tóm tắt ngắn gọn 2 câu\",\"sentiment\":\"Tích cực / Hài hước / Tranh luận...\",\"salesHook\":\"Gợi ý câu dẫn bán hàng\",\"topics\":[{\"topic\":\"Tên chủ đề thảo luận\",\"mentionsEstimate\":12,\"sampleQuote\":\"Ví dụ tiêu biểu\",\"interestLevel\":\"Rất cao\"}]}\n" +
                    "BÌNH LUẬN:\n" + JsonSerializer.Serialize(sample);

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(28));
                var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 750, cts.Token);
                var json = ExtractJsonObject(raw);
                if (json is not null)
                {
                    using var doc = JsonDocument.Parse(json);
                    var r = doc.RootElement.Clone();
                    return new
                    {
                        ok = true,
                        totalComments = comments.Count,
                        summary = r.TryGetProperty("summary", out var s) ? s.GetString() : summary,
                        sentiment = r.TryGetProperty("sentiment", out var se) ? se.GetString() : "Đa dạng",
                        salesHook = r.TryGetProperty("salesHook", out var sh) ? sh.GetString() : "",
                        topics = r.TryGetProperty("topics", out var tp) && tp.ValueKind == JsonValueKind.Array ? (object)tp : aiTopics,
                        mostRepeated = repeated,
                        topLiked,
                        generatedBy = $"Local Qwen ({ModelName})"
                    };
                }
            }
            catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] AnalyzeComments fallback: {ex.Message}"); }
        }

        return new { ok = true, totalComments = comments.Count, summary, sentiment = "Chưa rõ", salesHook = "", topics = aiTopics, mostRepeated = repeated, topLiked, generatedBy };
    }

    // 4. Lọc Kênh / Trang cá nhân theo chủ đề (xác định kênh đó thiên về mảng nào & chấm điểm khớp %)
    public async Task<object> ClassifyChannelsAsync(ClassifyChannelsRequest req)
    {
        var channels = (req.Channels ?? []).Take(25).ToList();
        var target = (req.TargetTopic ?? "").Trim();
        if (channels.Count == 0) return new { ok = true, channels = Array.Empty<object>(), generatedBy = "None" };

        try
        {
            var compact = channels.Select((c, idx) => new
            {
                idx,
                c.Platform,
                name = c.ChannelName,
                handle = c.Handle,
                bio = c.Bio.Length > 140 ? c.Bio[..140] : c.Bio,
                followers = c.FollowersCount,
                samples = (c.SampleTitles ?? []).Take(8).Select(s => s.Length > 75 ? s[..75] : s).ToArray()
            });

            var prompt =
                "Bạn là chuyên gia phân loại kênh TikTok & trang Facebook.\n" +
                $"Chủ đề người dùng muốn lọc: \"{(string.IsNullOrWhiteSpace(target) ? "Tất cả (tự nhận diện chủ đề chính)" : target)}\".\n" +
                "Với mỗi kênh, hãy đọc tiểu sử (bio) và tiêu đề các video/bài gần nhất để xác định:\n" +
                "- mainTopic: Kênh này thực sự thiên về chủ đề gì bằng Tiếng Việt ngắn gọn (vd: Anime Edit, Âm nhạc Trung Quốc, Review Xe cộ, Ẩm thực, Công nghệ, Game, Gia dụng...).\n" +
                "- matchScore: Điểm phù hợp 0-100 với chủ đề cần lọc (nếu lọc Tất cả thì cho 100).\n" +
                "- isMatch: true nếu matchScore >= 60.\n" +
                "- reason: Lý do nhận định ngắn 1 câu.\n" +
                "CHỈ TRẢ VỀ MẢNG JSON HỢP LỆ: [{\"idx\":0,\"mainTopic\":\"...\",\"matchScore\":92,\"isMatch\":true,\"reason\":\"...\"}]\n" +
                "DANH SÁCH KÊNH:\n" + JsonSerializer.Serialize(compact);

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 900, cts.Token);
            var jsonArr = ExtractJsonArray(raw);
            if (jsonArr is not null)
            {
                var map = new Dictionary<int, (string Topic, int Score, bool Match, string Reason)>();
                using var doc = JsonDocument.Parse(jsonArr);
                foreach (var e in doc.RootElement.EnumerateArray())
                {
                    if (!e.TryGetProperty("idx", out var ip) || !ip.TryGetInt32(out var idx)) continue;
                    var tp = e.TryGetProperty("mainTopic", out var tP) ? (tP.GetString() ?? "Đa chủ đề") : "Đa chủ đề";
                    var sc = e.TryGetProperty("matchScore", out var sP) && sP.TryGetInt32(out var sV) ? sV : 50;
                    var mt = e.TryGetProperty("isMatch", out var mP) ? mP.ValueKind == JsonValueKind.True : sc >= 60;
                    var rs = e.TryGetProperty("reason", out var rP) ? (rP.GetString() ?? "") : "";
                    map[idx] = (tp, sc, mt, rs);
                }

                var enriched = channels.Select((c, idx) =>
                {
                    (string Topic, int Score, bool Match, string Reason) d = map.TryGetValue(idx, out var info) ? info : ("Đa chủ đề", 50, string.IsNullOrWhiteSpace(target), "Phân tích sơ bộ");
                    return new
                    {
                        c.Platform, c.ChannelUrl, c.ChannelName, c.Handle, c.Bio, c.AvatarUrl,
                        c.FollowersCount, c.TotalLikesCount, c.SampleTitles,
                        mainTopic = d.Topic, matchScore = d.Score, isMatch = d.Match, reason = d.Reason
                    };
                }).OrderByDescending(x => x.matchScore).ThenByDescending(x => x.FollowersCount).ToArray();

                return new { ok = true, channels = enriched, generatedBy = $"Local Qwen ({ModelName})" };
            }
        }
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] ClassifyChannels fallback: {ex.Message}"); }

        var fallback = channels.Select(c =>
        {
            var hay = $"{c.ChannelName} {c.Bio} {string.Join(' ', c.SampleTitles ?? [])}".ToLowerInvariant();
            var match = string.IsNullOrWhiteSpace(target) || hay.Contains(target.ToLowerInvariant());
            return new
            {
                c.Platform, c.ChannelUrl, c.ChannelName, c.Handle, c.Bio, c.AvatarUrl,
                c.FollowersCount, c.TotalLikesCount, c.SampleTitles,
                mainTopic = match && !string.IsNullOrWhiteSpace(target) ? target : "Tổng hợp",
                matchScore = match ? 80 : 30, isMatch = match, reason = "So khớp từ khóa trong tiểu sử và tiêu đề bài viết."
            };
        }).ToArray();
        return new { ok = true, channels = fallback, generatedBy = "Smart Fallback" };
    }

    // 5. Tổng hợp phiên Lướt FB/TikTok theo thời gian -> tìm chủ đề đang nóng nhất & xếp hạng bài đứng top
    public async Task<object> AnalyzeSurfSessionAsync(AnalyzeSurfFeedRequest req)
    {
        var posts = (req.Posts ?? []).OrderByDescending(p => p.LikesCount).ToList();
        var classified = await ClassifyAndFilterViralPostsAsync(
            string.IsNullOrWhiteSpace(req.TargetTopic) || req.TargetTopic == "all" ? "all" : "custom",
            req.TargetTopic,
            posts);

        var topTopics = classified.Posts
            .GroupBy(p => string.IsNullOrWhiteSpace(p.Category) ? "Xu hướng chung" : p.Category)
            .Select(g => new { topic = g.Key, postCount = g.Count(), totalLikes = g.Sum(x => (long)x.LikesCount), topPostTitle = g.OrderByDescending(x => x.LikesCount).First().Title })
            .OrderByDescending(x => x.totalLikes).ThenByDescending(x => x.postCount)
            .Take(8).ToArray();

        return new
        {
            ok = true,
            platform = req.Platform,
            durationMinutes = req.DurationMinutes,
            scannedCount = posts.Count,
            matchedCount = classified.Posts.Count,
            topTopics,
            topPosts = classified.Posts.OrderByDescending(p => p.LikesCount).Take(25).ToArray(),
            generatedBy = classified.GeneratedBy
        };
    }

}

    public sealed record ExtensionLearnedRule(
        string? Selector,
        string? Role,
        string? TextPattern,
        string? AriaPattern,
        bool InDialog,
        string ClickMode);

    public sealed record ExtensionVisionDecision(
        bool Ok,
        string Diagnosis,
        string Action,
        int? TargetMarkId,
        string ClickMode,
        ExtensionLearnedRule? LearnedRule,
        string GeneratedBy);
