/*
  FILE NOTE
  - Mục đích: Dịch vụ AI Local qwen3.5:4b cho Tự động hóa MXH v3.5.1:
    1. Viết bài sạch tự nhiên (loại bỏ sạch ký hiệu Markdown ** thừa trên FB/TikTok).
    2. Mắt Vision AI cứu cánh giao diện (DiagnoseExtensionUiAsync): timeout 45s, format json chuẩn, nhận diện nút "bạn đang nghĩ gì", đối tượng bài viết và lưu/xong.
    3. Mở rộng từ khóa đa dạng, phân loại xu hướng & lọc trùng bài Viral, tạo ý tưởng bán hàng, nhận diện ảnh sản phẩm, phân tích bình luận & lọc kênh.
  - Liên kết trực tiếp: server-dotnet/Controllers/AdminSocialController.cs, server-dotnet/Models/SocialCampaign.cs
  - Vùng ảnh hưởng khi sửa: Backend xử lý AI cho tạo bài viết, mở rộng từ khóa, phân loại viral, chẩn đoán vision UI cho extension.
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
    public string GeneratedBy { get; set; } = "Local Qwen 4B";
    public string Platform { get; set; } = "facebook";
    public string Tone { get; set; } = "viral_engaging";
}

public sealed class SocialCopywriterService(IConfiguration configuration)
{
    private static readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(75) };

    private string Config(string key, string fallback)
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value)) value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private string OllamaHost => Config("OLLAMA_HOST", "http://127.0.0.1:11434").TrimEnd('/');
    private string ModelName => Config("OLLAMA_MODEL", Config("AI_MODEL", "qwen3.5:4b"));

    public async Task<GeneratedPostResult> GeneratePostAsync(
        string productName, decimal price, string category, string description,
        string platform, string tone, SocialCampaignSettings settings,
        string? customTopic = null, string productId = "1")
    {
        platform = (platform ?? "facebook").ToLowerInvariant();
        tone = (tone ?? "viral_engaging").ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(productId)) productId = "1";

        try
        {
            var prompt = BuildPrompt(productName, price, category, description, platform, tone, settings, customTopic, productId);
            var qwenResult = await TryGenerateWithOllamaAsync(prompt, maxTokens: 1024, CancellationToken.None);
            if (!string.IsNullOrWhiteSpace(qwenResult))
                return ParseAiOutput(qwenResult, productName, platform, tone, $"Local Qwen ({ModelName})");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] Ollama Local fallback ({ex.Message})");
        }

        return GenerateSmartFallback(productName, price, category, description, platform, tone, settings, customTopic, productId);
    }

    private string BuildPrompt(
        string productName, decimal price, string category, string description,
        string platform, string tone, SocialCampaignSettings settings, string? customTopic, string productId)
    {
        var priceVnd = string.Format(new CultureInfo("vi-VN"), "{0:N0}đ", price);
        var orderLink = (settings.OrderLinkTemplate ?? "https://omnicart.vn/products/{id}").Replace("{id}", productId);
        var sb = new StringBuilder();
        sb.AppendLine("Bạn là chuyên gia viết bài bán hàng trên mạng xã hội cho cửa hàng OmniCart.");
        sb.AppendLine($"Nền tảng: {platform.ToUpperInvariant()} | Sản phẩm: {productName} | Giá: {priceVnd} | Danh mục: {category}");
        sb.AppendLine($"Mô tả: {description} | Phong cách: {tone}");
        if (!string.IsNullOrWhiteSpace(customTopic)) sb.AppendLine($"Yêu cầu thêm: {customTopic}");
        sb.AppendLine("QUY TẮC BẮT BUỘC:");
        sb.AppendLine("1. TUYỆT ĐỐI KHÔNG dùng ký hiệu Markdown như ** hoặc * hoặc ### trong bài viết (Facebook và TikTok không hiển thị in đậm bằng dấu **).");
        sb.AppendLine("2. Dòng đầu là tiêu đề thu hút; phần thân 2-3 đoạn ngắn gọn tự nhiên, đúng tiếng Việt.");
        if (settings.IncludeEmojis) sb.AppendLine("3. Dùng emoji vừa phải, tự nhiên.");
        if (settings.IncludeCta) sb.AppendLine($"4. Kèm lời kêu gọi đặt hàng và link: {orderLink}");
        if (settings.IncludeHotline) sb.AppendLine($"5. Đính kèm Hotline: {settings.ContactHotline}");
        if (settings.IncludeHashtags) sb.AppendLine("6. Cuối bài kèm 4-6 hashtag phù hợp.");
        sb.AppendLine("Chỉ trả về nội dung bài viết hoàn chỉnh, không thêm lời giải thích.");
        return sb.ToString();
    }

    private static GeneratedPostResult ParseAiOutput(string output, string productName, string platform, string tone, string source)
    {
        var cleaned = Regex.Replace(output, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\*\*([^*]+)\*\*", "$1");
        cleaned = Regex.Replace(cleaned, @"^#{1,4}\s*", "", RegexOptions.Multiline).Trim();
        var lines = cleaned.Split('\n', StringSplitOptions.TrimEntries);
        var title = lines.FirstOrDefault(l => !string.IsNullOrWhiteSpace(l)) ?? $"Khám phá ngay {productName} tại OmniCart!";
        var hashtagLine = lines.LastOrDefault(l => l.Contains('#')) ?? "#OmniCart #Shopping #TienIchMoiNgay #GiaTot #DealHot";

        return new GeneratedPostResult
        {
            Title = title.Trim('#', '*', ' '),
            Content = cleaned,
            Hashtags = hashtagLine,
            GeneratedBy = source,
            Platform = platform,
            Tone = tone
        };
    }

    private static GeneratedPostResult GenerateSmartFallback(
        string productName, decimal price, string category, string description,
        string platform, string tone, SocialCampaignSettings settings, string? customTopic, string productId)
    {
        var priceVnd = string.Format(new CultureInfo("vi-VN"), "{0:N0}đ", price);
        var orderLink = (settings.OrderLinkTemplate ?? "https://omnicart.vn/products/{id}").Replace("{id}", productId);
        var sb = new StringBuilder();
        var title = platform == "tiktok"
            ? $"Món đồ hot trend ai cũng săn lùng: {productName} ✨"
            : $"✨ Nâng cấp cuộc sống mỗi ngày cùng {productName}";
        sb.AppendLine(title);
        sb.AppendLine();
        sb.AppendLine($"Điểm nổi bật: {description}");
        if (!string.IsNullOrWhiteSpace(customTopic)) sb.AppendLine(customTopic);
        sb.AppendLine($"🏷️ Giá ưu đãi chỉ {priceVnd} tại OmniCart.");
        if (settings.IncludeCta) sb.AppendLine($"🛒 Đặt hàng nhanh: {orderLink}");
        if (settings.IncludeHotline) sb.AppendLine($"📞 Hotline: {settings.ContactHotline}");
        var hashtags = platform == "tiktok"
            ? "#TikTokShop #ReviewDoXinh #OmniCart #Trending2026"
            : "#OmniCart #MuaSamThongMinh #GiaTotMoiNgay #DealHot";
        if (settings.IncludeHashtags) { sb.AppendLine(); sb.AppendLine(hashtags); }

        return new GeneratedPostResult
        {
            Title = title, Content = sb.ToString().Trim(), Hashtags = hashtags,
            GeneratedBy = "Smart Engine (Fallback)", Platform = platform, Tone = tone
        };
    }

    public sealed record ExpandedTopicResult(
        string TopicLabel, IReadOnlyList<string> FbKeywords, IReadOnlyList<string> TtKeywords, IReadOnlyList<string> Tags, string GeneratedBy);

    public sealed record ClassifiedViralResult(
        IReadOnlyList<SocialViralPost> Posts, int RemovedOffTopic, int RemovedDuplicates, string GeneratedBy);

    public async Task<ExpandedTopicResult> ExpandViralTopicAsync(string? topicKey, string? customTopic)
    {
        var key = (topicKey ?? "all").Trim().ToLowerInvariant();
        var custom = (customTopic ?? "").Trim();
        var label = key switch
        {
            "vehicles" => "Xe cộ", "anime" => "Anime", "cartoon" => "Hoạt hình", "game" => "Game",
            "new_product" => "Quảng bá sản phẩm mới", "electronics_compare" => "So sánh sản phẩm điện tử",
            "custom" => custom, _ => ""
        };

        var fallback = DefaultKeywordsForTopic(key, custom);
        if (string.IsNullOrWhiteSpace(label))
            return new ExpandedTopicResult("", fallback.Fb, fallback.Tt, fallback.Tags, "Preset");

        try
        {
            var prompt =
                $"Chủ đề tìm bài Viral Facebook và TikTok: \"{label}\".\n" +
                "Tạo 6 từ khóa tìm kiếm Facebook (fbKeywords), 6 từ khóa TikTok (ttKeywords) và 5 hashtag (tags).\n" +
                "CHỈ TRẢ VỀ JSON HỢP LỆ: {\"fbKeywords\":[\"...\"],\"ttKeywords\":[\"...\"],\"tags\":[\"#...\"]}";
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(22));
            var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 420, cts.Token);
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
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] ExpandViralTopic fallback: {ex.Message}"); }

        return new ExpandedTopicResult(label, fallback.Fb, fallback.Tt, fallback.Tags, "Smart Preset");
    }

    public async Task<ClassifiedViralResult> ClassifyAndFilterViralPostsAsync(
        string? requestedTopic, string? requestedTopicLabel, IReadOnlyList<SocialViralPost> inputPosts)
    {
        if (inputPosts.Count == 0) return new ClassifiedViralResult([], 0, 0, "None");

        var deduped = new List<SocialViralPost>();
        var seenUrls = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenFingerprints = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int removedDup = 0;

        foreach (var p in inputPosts)
        {
            var urlKey = (p.PostUrl ?? "").Trim().TrimEnd('/').ToLowerInvariant();
            var titleNorm = Regex.Replace((p.Title ?? "").ToLowerInvariant(), @"[^a-z0-9\p{L}]+", " ").Trim();
            var fp = $"{p.Platform}|{(titleNorm.Length > 42 ? titleNorm[..42] : titleNorm)}|{p.LikesCount}";
            if ((!string.IsNullOrEmpty(urlKey) && !seenUrls.Add(urlKey)) || !seenFingerprints.Add(fp)) { removedDup++; continue; }
            deduped.Add(p);
        }

        var topicKey = (requestedTopic ?? "all").Trim().ToLowerInvariant();
        var topicLabel = (requestedTopicLabel ?? "").Trim();
        var isFilteredTopic = topicKey != "all" && !string.IsNullOrWhiteSpace(topicLabel);

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
                    idx, platform = p.Platform,
                    title = p.Title.Length > 110 ? p.Title[..110] : p.Title,
                    summary = p.Summary.Length > 130 ? p.Summary[..130] : p.Summary
                });

                var prompt =
                    "Bạn là bộ lọc AI phân loại chính xác bài đăng Viral mạng xã hội.\n" +
                    (isFilteredTopic ? $"Chủ đề yêu cầu: \"{topicLabel}\". Đặt match=true CHỈ KHI bài viết thực sự đúng chủ đề này.\n" : "Đang lấy tất cả xu hướng (match=true).\n") +
                    "Gán category ngắn gọn chuẩn tiếng Việt (Anime, Xe cộ, Hoạt hình, Game, Quảng bá sản phẩm mới, So sánh sản phẩm điện tử, Công nghệ, Ẩm thực, Thời trang, Âm nhạc, Hài hước, Đời sống) và 2-3 hashtag phù hợp trong tags.\n" +
                    "CHỈ TRẢ VỀ MẢNG JSON: [{\"idx\":0,\"match\":true,\"category\":\"...\",\"tags\":\"#...\",\"dup\":false}]\n" +
                    JsonSerializer.Serialize(compactItems);

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
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
                            if (!string.IsNullOrWhiteSpace(d.Category)) post.Category = isFilteredTopic ? topicLabel : d.Category;
                            if (!string.IsNullOrWhiteSpace(d.Tags) && !post.TrendingTopic.Contains('#'))
                                post.TrendingTopic = string.IsNullOrWhiteSpace(post.TrendingTopic) ? d.Tags : $"{post.TrendingTopic} • {d.Tags}";
                        }
                        finalPosts.Add(post);
                    }
                    continue;
                }
                ApplyFallbackClassification(batch, isFilteredTopic, topicKey, topicLabel, finalPosts, ref removedOffTopic);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SocialCopywriter] ClassifyViral fallback: {ex.Message}");
            finalPosts.Clear(); removedOffTopic = 0;
            ApplyFallbackClassification(deduped, isFilteredTopic, topicKey, topicLabel, finalPosts, ref removedOffTopic);
        }

        return new ClassifiedViralResult(finalPosts, removedOffTopic, removedDup, generatedBy);
    }

    // MẮT VISION qwen3.5:4b CỨU CÁNH GIAO DIỆN KHI FACEBOOK / TIKTOK ĐỔI DOM
    public async Task<ExtensionVisionDecision> DiagnoseExtensionUiAsync(ExtensionVisionAssistRequest req)
    {
        var elements = (req.Elements ?? []).Take(75).ToList();
        if (elements.Count == 0)
            return new(false, "Trang chưa có phần tử tương tác nào.", "wait_and_retry", null, "normal", null, "Rules");

        var compactMap = elements.Select(e => new
        {
            id = e.Id, tag = e.Tag, role = e.Role,
            text = e.Text.Length > 60 ? e.Text[..60] : e.Text,
            aria = e.AriaLabel.Length > 60 ? e.AriaLabel[..60] : e.AriaLabel,
            e2e = e.DataE2e, dlg = e.InDialog, portal = e.InPortal, dis = e.Disabled,
            color = e.PrimaryColor, box = new[] { e.X, e.Y, e.W, e.H }, sel = e.StableSelector
        });

        var prompt =
            $"Bạn là Mắt Vision AI điều khiển Chrome Extension trên {req.Platform.ToUpperInvariant()}.\n" +
            $"Mục tiêu ({req.StepKey}): {req.Goal}\n" +
            $"URL: {req.Url} | Viewport: {req.ViewportWidth}x{req.ViewportHeight} | ScrollY: {req.ScrollY}\n" +
            $"Lý do cần cứu cánh: {req.ErrorReason}\n" +
            "LƯU Ý QUAN TRỌNG:\n" +
            "- Trên Facebook Tạo bài viết, nút đối tượng nằm dưới tên tác giả (chữ Công khai / Bạn bè / Chỉ mình tôi); TUYỆT ĐỐI KHÔNG bấm 'Nhãn AI đang tắt'.\n" +
            "- Trong bảng Đối tượng Facebook, nếu chưa thấy 'Chỉ mình tôi', trả action='scroll_down'. Nếu thấy rồi, trả action='click_mark' đúng id đó.\n" +
            "- Trên TikTok Studio, chọn dropdown quyền riêng tư hoặc option trong portal (portal=true) với clickMode='skip_scroll'.\n" +
            "- Khi cào Viral mà thấy popup/đăng nhập che màn hình, trả action='dismiss_popup'.\n" +
            "Các action hợp lệ: click_mark | dismiss_popup | scroll_down | scroll_up | navigate_target | wait_and_retry.\n" +
            "CHỈ TRẢ VỀ DUY NHẤT JSON HỢP LỆ:\n" +
            "{\"diagnosis\":\"nguyên nhân tiếng Việt ngắn gọn\",\"action\":\"click_mark\",\"targetMarkId\":12,\"clickMode\":\"skip_scroll\",\"learnedRule\":{\"selector\":\"...\",\"role\":\"...\",\"textPattern\":\"...\",\"ariaPattern\":\"...\",\"inDialog\":true,\"clickMode\":\"skip_scroll\"}}\n" +
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
                format = "json",
                options = new { temperature = 0.12, num_predict = 500 }
            };

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(45));
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
                    if (markId.HasValue)
                    {
                        var matchedEl = elements.FirstOrDefault(e => e.Id == markId.Value);
                        if (matchedEl is not null)
                            learned = new ExtensionLearnedRule(matchedEl.StableSelector, matchedEl.Role, matchedEl.Text, matchedEl.AriaLabel, matchedEl.InDialog, clickMode);
                    }
                    return new(true, diagnosis, action, markId, clickMode, learned, $"Local Vision ({ModelName})");
                }
            }
        }
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] AI Vision Assist fallback ({ex.Message})"); }

        // Dự phòng thông minh nếu Ollama bận: tự dò theo ngữ nghĩa tiếng Việt từ bản đồ DOM để không bỏ cuộc
        var goalLower = (req.Goal ?? "").ToLowerInvariant();
        var fallbackEl = elements.FirstOrDefault(e =>
        {
            var t = $"{e.Text} {e.AriaLabel}".ToLowerInvariant();
            if (t.Contains("nhãn ai") || t.Contains("ai label") || t.Contains("chia sẻ suy nghĩ")) return false;
            if (goalLower.Contains("bạn đang nghĩ gì") || goalLower.Contains("tạo bài viết")) return t.Contains("bạn đang nghĩ gì") || t.Contains("what's on your mind") || t.Contains("bạn viết gì");
            if (goalLower.Contains("chỉ mình")) return t.Contains("chỉ mình") || t.Contains("only me") || t.Contains("only you") || t.Contains("công khai") || t.Contains("bạn bè");
            if (goalLower.Contains("mọi người") || goalLower.Contains("công khai")) return t.Contains("mọi người") || t.Contains("công khai") || t.Contains("everyone") || t.Contains("public");
            return false;
        });
        if (fallbackEl is not null)
        {
            return new(true, $"Dự phòng chọn đúng phần tử \"{fallbackEl.Text}\"", "click_mark", fallbackEl.Id, "skip_scroll",
                new ExtensionLearnedRule(fallbackEl.StableSelector, fallbackEl.Role, fallbackEl.Text, fallbackEl.AriaLabel, fallbackEl.InDialog, "skip_scroll"), "Smart Vision Fallback");
        }
        return new(true, "Chưa thấy phần tử trong khung hình — cuộn xuống để tìm tiếp.", "scroll_down", null, "normal", null, "Smart Vision Fallback");
    }

    public async Task<object> GenerateViralSalesIdeasAsync(IReadOnlyList<SocialViralPost> viralPosts, IReadOnlyList<CatalogProduct> catalog, int count = 4)
    {
        var topViral = viralPosts.OrderByDescending(v => v.LikesCount).Take(12)
            .Select(v => new { v.Platform, v.Category, title = v.Title.Length > 100 ? v.Title[..100] : v.Title, v.LikesCount, v.CommentsCount }).ToArray();
        var topProducts = catalog.Where(p => p.StockCount > 0).OrderByDescending(p => p.DiscountPercent > 0).ThenByDescending(p => p.ViewCount).Take(18)
            .Select(p => new { p.Id, p.Name, p.Category, p.Price, p.DiscountPercent, p.StockCount }).ToArray();

        if (topViral.Length == 0 || topProducts.Length == 0)
            return new { ok = true, summary = "Chưa đủ bài Viral hoặc sản phẩm để tạo ý tưởng.", ideas = Array.Empty<object>(), generatedBy = "Fallback" };

        try
        {
            var prompt =
                $"Dựa trên {topViral.Length} bài Viral và sản phẩm thật của OmniCart, đề xuất {Math.Clamp(count, 2, 6)} ý tưởng bán hàng bắt trend.\n" +
                "CHỈ TRẢ VỀ JSON: {\"summary\":\"...\",\"ideas\":[{\"trendName\":\"...\",\"productId\":\"...\",\"productName\":\"...\",\"platform\":\"facebook\",\"hook\":\"...\",\"angle\":\"...\",\"hashtags\":\"#...\",\"tone\":\"viral_engaging\"}]}\n" +
                "VIRAL: " + JsonSerializer.Serialize(topViral) + "\nSP: " + JsonSerializer.Serialize(topProducts);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
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
            return new { trendName = string.IsNullOrWhiteSpace(v.Category) ? "Xu hướng Viral" : v.Category, productId = prod.Id, productName = prod.Name, platform = v.Platform, hook = $"Bắt trend {v.Category}: Không thể bỏ qua {prod.Name}!", angle = $"Dẫn dắt từ xu hướng đạt {v.LikesCount:N0} tương tác.", hashtags = "#OmniCart #BatTrend #Viral2026", tone = "viral_engaging" };
        }).ToArray();
        return new { ok = true, summary = $"Tổng hợp từ {topViral.Length} bài viral nổi bật.", ideas = fallbackIdeas, generatedBy = "Smart Fallback" };
    }

    public async Task<object> ExtractProductFromImageAsync(string imageBase64, string? hint, long? suggestedPrice)
    {
        if (string.IsNullOrWhiteSpace(imageBase64)) return new { ok = false, error = "IMAGE_REQUIRED" };
        var prompt =
            "Nhìn kỹ ảnh sản phẩm này" + (string.IsNullOrWhiteSpace(hint) ? "" : $" (gợi ý: {hint})") + ".\n" +
            "Danh mục chọn 1 trong: Điện tử, Đồ gia dụng, Làm đẹp, Laptop, Linh kiện, Trang phục, Trang sức, Tự Thiết Kế.\n" +
            "CHỈ TRẢ VỀ JSON: {\"name\":\"Tên <= 55 ký tự\",\"category\":\"...\",\"price\":250000,\"description\":\"Mô tả 2-3 câu\",\"features\":[\"...\"],\"label\":\"Mới\"}";
        try
        {
            var payload = new { model = ModelName, messages = new[] { new { role = "user", content = prompt, images = new[] { StripDataUrlPrefix(imageBase64) } } }, stream = false, think = false, options = new { temperature = 0.25, num_predict = 550 } };
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
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
                    long parsedPrice = suggestedPrice is > 0 ? suggestedPrice.Value : (r.TryGetProperty("price", out var pP) && pP.TryGetInt64(out var pv) && pv > 0 ? pv : 199000);
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
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] Vision Product fallback: {ex.Message}"); }

        return new { ok = true, product = new { name = string.IsNullOrWhiteSpace(hint) ? "Sản phẩm tiện ích mới" : hint.Trim(), category = "Đồ gia dụng", price = suggestedPrice is > 0 ? suggestedPrice.Value : 199000, description = "Sản phẩm thiết kế gọn đẹp, bền bỉ cho nhu cầu hằng ngày.", features = new[] { "Thiết kế hiện đại", "Chất liệu bền đẹp" }, label = "Mới" }, generatedBy = "Fallback" };
    }

    public async Task<object> AnalyzeCommentsAsync(AnalyzeCommentsRequest req)
    {
        var comments = (req.Comments ?? []).Where(c => !string.IsNullOrWhiteSpace(c.Text)).ToList();
        var topLiked = comments.OrderByDescending(c => c.Likes).Take(10).ToArray();
        var repeated = comments.GroupBy(c => Regex.Replace(c.Text.ToLowerInvariant(), @"[^\p{L}\p{N}\s]+", "").Trim())
            .Where(g => g.Key.Length >= 2)
            .Select(g => new { text = g.First().Text, count = g.Count(), totalLikes = g.Sum(x => x.Likes) })
            .OrderByDescending(x => x.count).ThenByDescending(x => x.totalLikes).Take(8).ToArray();

        if (comments.Count > 0)
        {
            try
            {
                var sample = comments.Take(45).Select(c => new { t = c.Text.Length > 110 ? c.Text[..110] : c.Text, l = c.Likes });
                var prompt =
                    $"Phân tích bình luận bài ({req.Platform}): \"{req.PostTitle}\".\n" +
                    "CHỈ TRẢ VỀ JSON: {\"summary\":\"...\",\"sentiment\":\"...\",\"salesHook\":\"...\",\"topics\":[{\"topic\":\"...\",\"mentionsEstimate\":10,\"sampleQuote\":\"...\",\"interestLevel\":\"Cao\"}]}\n" +
                    JsonSerializer.Serialize(sample);
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
                var raw = await TryGenerateWithOllamaAsync(prompt, maxTokens: 750, cts.Token);
                var json = ExtractJsonObject(raw);
                if (json is not null)
                {
                    using var doc = JsonDocument.Parse(json);
                    var r = doc.RootElement.Clone();
                    return new
                    {
                        ok = true, totalComments = comments.Count,
                        summary = r.TryGetProperty("summary", out var s) ? s.GetString() : $"Đã phân tích {comments.Count} bình luận.",
                        sentiment = r.TryGetProperty("sentiment", out var se) ? se.GetString() : "Đa dạng",
                        salesHook = r.TryGetProperty("salesHook", out var sh) ? sh.GetString() : "",
                        topics = r.TryGetProperty("topics", out var tp) && tp.ValueKind == JsonValueKind.Array ? (object)tp : Array.Empty<object>(),
                        mostRepeated = repeated, topLiked, generatedBy = $"Local Qwen ({ModelName})"
                    };
                }
            }
            catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] AnalyzeComments fallback: {ex.Message}"); }
        }
        return new { ok = true, totalComments = comments.Count, summary = $"Đã phân tích {comments.Count} bình luận.", sentiment = "Chưa rõ", salesHook = "", topics = Array.Empty<object>(), mostRepeated = repeated, topLiked, generatedBy = "Smart Stats" };
    }

    public async Task<object> ClassifyChannelsAsync(ClassifyChannelsRequest req)
    {
        var channels = (req.Channels ?? []).Take(25).ToList();
        var target = (req.TargetTopic ?? "").Trim();
        if (channels.Count == 0) return new { ok = true, channels = Array.Empty<object>(), generatedBy = "None" };

        try
        {
            var compact = channels.Select((c, idx) => new { idx, c.Platform, name = c.ChannelName, handle = c.Handle, bio = c.Bio.Length > 140 ? c.Bio[..140] : c.Bio, followers = c.FollowersCount, samples = (c.SampleTitles ?? []).Take(8).ToArray() });
            var prompt =
                $"Chủ đề cần lọc kênh: \"{(string.IsNullOrWhiteSpace(target) ? "Tất cả" : target)}\".\n" +
                "CHỈ TRẢ VỀ MẢNG JSON: [{\"idx\":0,\"mainTopic\":\"...\",\"matchScore\":90,\"isMatch\":true,\"reason\":\"...\"}]\n" +
                JsonSerializer.Serialize(compact);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(35));
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
                    var d = map.TryGetValue(idx, out var info) ? info : ("Đa chủ đề", 50, string.IsNullOrWhiteSpace(target), "Phân tích sơ bộ");
                    return new { c.Platform, c.ChannelUrl, c.ChannelName, c.Handle, c.Bio, c.AvatarUrl, c.FollowersCount, c.TotalLikesCount, c.SampleTitles, mainTopic = d.Item1, matchScore = d.Item2, isMatch = d.Item3, reason = d.Item4 };
                }).OrderByDescending(x => x.matchScore).ThenByDescending(x => x.FollowersCount).ToArray();
                return new { ok = true, channels = enriched, generatedBy = $"Local Qwen ({ModelName})" };
            }
        }
        catch (Exception ex) { Console.WriteLine($"[SocialCopywriter] ClassifyChannels fallback: {ex.Message}"); }

        var fallback = channels.Select(c =>
        {
            var hay = $"{c.ChannelName} {c.Bio} {string.Join(' ', c.SampleTitles ?? [])}".ToLowerInvariant();
            var match = string.IsNullOrWhiteSpace(target) || hay.Contains(target.ToLowerInvariant());
            return new { c.Platform, c.ChannelUrl, c.ChannelName, c.Handle, c.Bio, c.AvatarUrl, c.FollowersCount, c.TotalLikesCount, c.SampleTitles, mainTopic = match && !string.IsNullOrWhiteSpace(target) ? target : "Tổng hợp", matchScore = match ? 80 : 30, isMatch = match, reason = "So khớp tiểu sử & tiêu đề." };
        }).ToArray();
        return new { ok = true, channels = fallback, generatedBy = "Smart Fallback" };
    }

    public async Task<object> AnalyzeSurfSessionAsync(AnalyzeSurfFeedRequest req)
    {
        var posts = (req.Posts ?? []).OrderByDescending(p => p.LikesCount).ToList();
        var classified = await ClassifyAndFilterViralPostsAsync(string.IsNullOrWhiteSpace(req.TargetTopic) || req.TargetTopic == "all" ? "all" : "custom", req.TargetTopic, posts);
        var topTopics = classified.Posts.GroupBy(p => string.IsNullOrWhiteSpace(p.Category) ? "Xu hướng chung" : p.Category)
            .Select(g => new { topic = g.Key, postCount = g.Count(), totalLikes = g.Sum(x => (long)x.LikesCount), topPostTitle = g.OrderByDescending(x => x.LikesCount).First().Title })
            .OrderByDescending(x => x.totalLikes).ThenByDescending(x => x.postCount).Take(8).ToArray();
        return new { ok = true, platform = req.Platform, durationMinutes = req.DurationMinutes, scannedCount = posts.Count, matchedCount = classified.Posts.Count, topTopics, topPosts = classified.Posts.OrderByDescending(p => p.LikesCount).Take(25).ToArray(), generatedBy = classified.GeneratedBy };
    }

    private async Task<string?> TryGenerateWithOllamaAsync(string prompt, int maxTokens, CancellationToken ct)
    {
        var requestPayload = new { model = ModelName, messages = new[] { new { role = "user", content = prompt } }, stream = false, think = false, options = new { temperature = 0.25, num_predict = maxTokens } };
        using var content = new StringContent(JsonSerializer.Serialize(requestPayload), Encoding.UTF8, "application/json");
        using var response = await _httpClient.PostAsync(OllamaHost + "/api/chat", content, ct);
        if (!response.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return doc.RootElement.TryGetProperty("message", out var msgElem) && msgElem.TryGetProperty("content", out var textElem) ? textElem.GetString() : null;
    }

    private static string? ExtractJsonObject(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var clean = Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
        var start = clean.IndexOf('{'); var end = clean.LastIndexOf('}');
        return start >= 0 && end > start ? clean[start..(end + 1)] : null;
    }

    private static string? ExtractJsonArray(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var clean = Regex.Replace(raw, @"<think>[\s\S]*?</think>", "", RegexOptions.IgnoreCase).Trim();
        var start = clean.IndexOf('['); var end = clean.LastIndexOf(']');
        return start >= 0 && end > start ? clean[start..(end + 1)] : null;
    }

    private static List<string> ReadStringList(JsonElement root, string prop)
    {
        var list = new List<string>();
        if (!root.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array) return list;
        foreach (var item in arr.EnumerateArray()) { var s = item.GetString()?.Trim(); if (!string.IsNullOrWhiteSpace(s)) list.Add(s); }
        return list;
    }

    private static string StripDataUrlPrefix(string raw) { var comma = raw.IndexOf(','); return comma >= 0 ? raw[(comma + 1)..] : raw; }

    private static (string[] Fb, string[] Tt, string[] Tags) DefaultKeywordsForTopic(string key, string custom) => key switch
    {
        "vehicles" => (["review ô tô", "xe máy độ đẹp", "siêu xe việt nam", "xe điện vinfast"], ["review xe hơi", "car edit", "siêu xe", "motor edit"], ["#XeCo", "#Oto"]),
        "anime" => (["anime vietsub", "anime edit", "review anime hay", "jujutsu kaisen vietsub"], ["anime edit", "anime vietsub", "jujutsu kaisen edit", "one piece edit"], ["#Anime", "#AnimeEdit"]),
        "cartoon" => (["phim hoạt hình review", "hoạt hình 3d trung quốc", "conan vietsub"], ["hoạt hình 3d", "donghua edit", "doraemon edit"], ["#HoatHinh", "#Donghua"]),
        "game" => (["liên quân mobile highlight", "lmht highlight", "valorant việt nam"], ["gaming highlight", "liên quân mobile", "valorant clutch"], ["#Game", "#Gaming"]),
        "new_product" => (["unbox sản phẩm mới", "đồ gia dụng thông minh review", "săn deal tiện ích"], ["unbox review", "đồ gia dụng thông minh", "tiktok made me buy it"], ["#SanPhamMoi", "#Review"]),
        "electronics_compare" => (["so sánh iphone samsung", "so sánh laptop", "so sánh điện thoại"], ["so sánh iphone", "iphone vs samsung", "tech comparison"], ["#CongNghe", "#SoSanh"]),
        "custom" when !string.IsNullOrWhiteSpace(custom) => ([custom, $"{custom} review", $"{custom} viral"], [custom, $"{custom} edit", $"{custom} viral"], [$"#{Regex.Replace(custom, @"[^\p{L}\p{N}]", "")}"]),
        _ => ([], [], [])
    };

    private static void ApplyFallbackClassification(IEnumerable<SocialViralPost> batch, bool isFilteredTopic, string topicKey, string topicLabel, List<SocialViralPost> target, ref int removedOffTopic)
    {
        var rules = new Dictionary<string, string[]>
        {
            ["anime"] = ["anime", "manga", "otaku", "vietsub", "jujutsu", "gojo", "one piece", "luffy", "naruto", "kimetsu", "demon slayer", "bleach", "isekai", "black clover", "noelle"],
            ["vehicles"] = ["xe ", "ô tô", "oto", "xe máy", "motor", "moto", "car", "supercar", "vinfast", "bmw", "mercedes", "porsche"],
            ["cartoon"] = ["hoạt hình", "hoat hinh", "cartoon", "donghua", "doraemon", "conan", "pixar", "disney", "3d"],
            ["game"] = ["game", "gaming", "liên quân", "lmht", "lol", "valorant", "pubg", "free fire", "minecraft", "genshin", "highlight"],
            ["new_product"] = ["unbox", "review", "sản phẩm", "gia dụng", "tiện ích", "deal", "ra mắt", "mới nhất"],
            ["electronics_compare"] = ["so sánh", " vs ", "iphone", "samsung", "xiaomi", "laptop", "macbook", "tai nghe", "điện thoại"]
        };

        foreach (var post in batch)
        {
            var hay = $"{post.Title} {post.Summary}".ToLowerInvariant();
            if (isFilteredTopic)
            {
                var kws = rules.TryGetValue(topicKey, out var r) ? r : topicLabel.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(w => w.Length >= 2).ToArray();
                if (kws.Length > 0 && !kws.Any(k => hay.Contains(k))) { removedOffTopic++; continue; }
                post.Category = topicLabel;
            }
            else
            {
                foreach (var (rk, rkws) in rules)
                {
                    if (rkws.Any(k => hay.Contains(k)))
                    {
                        post.Category = rk switch { "anime" => "Anime", "vehicles" => "Xe cộ", "cartoon" => "Hoạt hình", "game" => "Game", "new_product" => "Quảng bá sản phẩm mới", "electronics_compare" => "So sánh sản phẩm điện tử", _ => post.Category };
                        break;
                    }
                }
            }
            target.Add(post);
        }
    }
}

public sealed record ExtensionLearnedRule(string? Selector, string? Role, string? TextPattern, string? AriaPattern, bool InDialog, string ClickMode);
public sealed record ExtensionVisionDecision(bool Ok, string Diagnosis, string Action, int? TargetMarkId, string ClickMode, ExtensionLearnedRule? LearnedRule, string GeneratedBy);
