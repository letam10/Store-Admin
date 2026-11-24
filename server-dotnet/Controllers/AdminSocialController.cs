/*
  FILE NOTE
  - Mục đích: Bộ điều khiển API Tự động hóa MXH v3.5.6:
    1. Quản lý chiến dịch MXH, viral posts và lưu/đọc/xóa lịch sử lướt theo thời gian vào SQL Server.
    2. Luôn lưu và đồng bộ kết quả phiên lướt gần nhất (social.surf.last_result) với JsonSerializerOptions camelCase chuẩn, chống mất dữ liệu khi chuyển tab hoặc tải lại trang.
    3. AnalyzeSurf fallback an toàn không bao giờ throw 500 khi AI phân tích phiên lướt gặp sự cố; hỗ trợ import viral chống trùng ID/URL.
  - Liên kết trực tiếp: server-dotnet/Services/SocialCopywriterService.cs, server-dotnet/Data/StoreDb.cs, src/pages/AdminSocialAutomation.jsx
  - Vùng ảnh hưởng khi sửa: Toàn bộ API endpoint quản trị mạng xã hội (/api/admin/social/*), bao gồm import viral, phân tích lướt và lịch sử lướt.
*/

using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/social")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminSocialController(
    StoreDb db,
    SocialCopywriterService copywriter,
    SocialAutoPostWorker worker) : ControllerBase
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public const string DefaultFacebookProfileUrl = "https://www.facebook.com/me";
    public const string DefaultTikTokProfileUrl = "https://www.tiktok.com/";

    [HttpGet("stats")]
    public IActionResult Stats() => Ok(new { ok = true, stats = db.GetSocialSummaryStats() });

    [HttpGet("settings")]
    public IActionResult GetSettings() => Ok(new { ok = true, settings = db.GetSocialSettings() });

    [HttpPost("settings")]
    public IActionResult SaveSettings([FromBody] SocialCampaignSettings request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        request.Privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : "only_me";
        return Ok(new { ok = true, settings = db.SaveSocialSettings(request) });
    }

    [HttpPost("trigger-cycle")]
    public async Task<IActionResult> TriggerCycle([FromQuery] string? platform = null, CancellationToken cancellationToken = default)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var post = await worker.TriggerCycleNowAsync(platform, cancellationToken);
        if (post is null) return BadRequest(new { ok = false, error = "CYCLE_BUSY_OR_NO_PRODUCT" });
        return Ok(new { ok = true, post, stats = db.GetSocialSummaryStats() });
    }

    // Hỗ trợ 3 chế độ chọn sản phẩm: custom (Admin chọn) | smart (AI ưu tiên giảm giá / tồn kho / bán chạy) | random
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GeneratePostRequest request)
    {
        var settings = db.GetSocialSettings();
        string? chosenProductId = request.ProductId;

        if (string.IsNullOrWhiteSpace(chosenProductId) && string.Equals(request.SelectionMode, "smart", StringComparison.OrdinalIgnoreCase))
        {
            var catalog = db.Catalog().Where(p => p.StockCount > 0).ToList();
            var preferred = settings.PreferredCategory is not (null or "" or "all")
                ? catalog.Where(p => p.Category.Equals(settings.PreferredCategory, StringComparison.OrdinalIgnoreCase)).ToList()
                : catalog;
            var pool = (preferred.Count > 0 ? preferred : catalog)
                .OrderByDescending(p => p.DiscountPercent)
                .ThenByDescending(p => p.StockCount)
                .ThenByDescending(p => p.ViewCount)
                .Take(12).ToList();
            if (pool.Count > 0) chosenProductId = pool[Random.Shared.Next(pool.Count)].Id;
        }

        var product = db.GetCatalogProductForPromotion(settings.PreferredCategory, chosenProductId);
        if (product is null) return NotFound(new { ok = false, error = "PRODUCT_NOT_FOUND" });

        var generated = await copywriter.GeneratePostAsync(
            product.Value.Name, product.Value.Price, product.Value.Category, product.Value.Description,
            request.Platform ?? "facebook", request.ToneStyle ?? settings.ToneStyle, settings, request.CustomTopic, product.Value.Id);

        return Ok(new
        {
            ok = true,
            product = new
            {
                id = product.Value.Id,
                name = product.Value.Name,
                price = product.Value.Price,
                image = product.Value.Image,
                category = product.Value.Category,
                description = product.Value.Description
            },
            generated
        });
    }

    [HttpGet("posts")]
    public IActionResult GetPosts([FromQuery] string? status = null, [FromQuery] string? platform = null, [FromQuery] int limit = 120)
        => Ok(new { ok = true, posts = db.GetSocialPosts(status, platform, limit) });

    [HttpGet("posts/export")]
    public IActionResult ExportPostsExcel([FromQuery] string? status = null, [FromQuery] string? platform = null)
    {
        var posts = db.GetSocialPosts(status, platform, limit: 1000);
        var bytes = SocialExcelExport.BuildPostsWorkbook(posts);
        var fileName = $"Bao_Cao_Dang_Bai_MXH_{DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)):yyyy-MM-dd}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    [HttpPost("posts/create")]
    public IActionResult CreatePost([FromBody] CreateCustomPostRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var platform = (request.Platform ?? "facebook").Trim().ToLowerInvariant();
        if (platform is not ("facebook" or "tiktok")) return BadRequest(new { ok = false, error = "UNSUPPORTED_PLATFORM" });
        var privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : "only_me";

        var created = db.CreateSocialPost(new SocialAutoPost
        {
            ProductId = request.ProductId,
            ProductName = string.IsNullOrWhiteSpace(request.ProductName) ? "Sản phẩm OmniCart" : request.ProductName.Trim(),
            ProductPrice = request.ProductPrice,
            ProductImage = request.ProductImage,
            Platform = platform,
            Title = request.Title?.Trim() ?? "",
            Content = request.Content?.Trim() ?? "",
            Hashtags = request.Hashtags?.Trim() ?? "",
            Status = "internal_draft",
            TargetGroup = string.IsNullOrWhiteSpace(request.TargetGroup) ? "Trang cá nhân đang đăng nhập" : request.TargetGroup.Trim(),
            Privacy = privacy
        });

        return Ok(new { ok = true, post = created });
    }

    [HttpPost("posts/{id}/approve")]
    [HttpPost("posts/{id}/publish")]
    public IActionResult LegacyPublishBlocked(string id)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        if (db.GetSocialPostById(id) is null) return NotFound(new { error = "POST_NOT_FOUND" });
        return Conflict(new { ok = false, error = "PUBLISH_REQUIRES_EXTENSION" });
    }

    [HttpPost("posts/{id}/pending-review")]
    public IActionResult MarkPendingReview(string id, [FromBody] MarkPendingReviewRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var existing = db.GetSocialPostById(id);
        if (existing is null) return NotFound(new { ok = false, error = "POST_NOT_FOUND" });
        var privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : existing.Privacy;
        db.MarkSocialPostPendingReview(id, privacy, request.Message);
        return Ok(new { ok = true, post = db.GetSocialPostById(id) });
    }

    [HttpPost("posts/{id}/publish-real")]
    public IActionResult PublishReal(string id, [FromBody] PublishRealPostRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var existing = db.GetSocialPostById(id);
        if (existing is null) return NotFound(new { ok = false, error = "POST_NOT_FOUND" });

        var platform = string.IsNullOrWhiteSpace(request.Platform) ? existing.Platform : request.Platform.Trim().ToLowerInvariant();
        if (platform is not ("facebook" or "tiktok")) return BadRequest(new { ok = false, error = "UNSUPPORTED_PLATFORM" });
        if (string.IsNullOrWhiteSpace(request.PostUrl) || !IsAnyLoggedInRealPermalink(platform, request.PostUrl))
            return BadRequest(new { ok = false, error = "INVALID_REAL_PERMALINK" });

        var privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : "only_me";
        db.PublishRealSocialPost(id, request.PostUrl.Trim(), request.PublishedTime, platform, privacy, request.LikesCount, request.SharesCount, request.CommentsCount);
        return Ok(new { ok = true, post = db.GetSocialPostById(id) });
    }

    [HttpPost("posts/{id}/publish-failure")]
    public IActionResult PublishFailure(string id, [FromBody] PublishFailureRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var status = request.Status is "unverified" or "failed" ? request.Status : "failed";
        var msg = string.IsNullOrWhiteSpace(request.ErrorMessage) ? "Đăng bài chưa thành công." : request.ErrorMessage.Trim();
        var updated = db.MarkSocialPostPublishFailure(id, status, msg, request.PostUrl);
        if (!updated) return NotFound(new { ok = false, error = "POST_NOT_FOUND_OR_PUBLISHED" });
        return Ok(new { ok = true, post = db.GetSocialPostById(id) });
    }

    [HttpDelete("posts/clear-all")]
    public IActionResult ClearAllPosts()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(new { ok = true, deletedCount = db.DeleteAllSocialPosts() });
    }

    [HttpDelete("posts/{id}")]
    public IActionResult DeletePost(string id)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.DeleteSocialPost(id) ? Ok(new { ok = true }) : NotFound(new { ok = false, error = "POST_NOT_FOUND" });
    }

    // ================= HỘI NHÓM FACEBOOK =================

    [HttpGet("groups")]
    public IActionResult GetGroups([FromQuery] string? category = null)
        => Ok(new { ok = true, groups = db.GetSocialGroupTargets(category) });

    [HttpPost("groups")]
    public IActionResult AddGroup([FromBody] AddGroupRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.GroupName) || string.IsNullOrWhiteSpace(request.GroupUrl))
            return BadRequest(new { ok = false, error = "INVALID_GROUP" });

        var group = db.AddSocialGroupTarget(new SocialGroupTarget
        {
            GroupName = request.GroupName.Trim(),
            GroupUrl = request.GroupUrl.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Cộng đồng Facebook" : request.Category.Trim(),
            MembersCount = Math.Max(0, request.MembersCount),
            InteractionRate = string.IsNullOrWhiteSpace(request.InteractionRate) ? "Cao" : request.InteractionRate.Trim(),
            IsAutoShare = request.IsAutoShare,
            Notes = request.Notes?.Trim()
        });
        return Ok(new { ok = true, group });
    }

    [HttpPost("groups/import-real")]
    public IActionResult ImportRealGroups([FromBody] ImportRealGroupsRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var addedCount = db.ImportRealGroupTargets(request.Groups ?? []);
        return Ok(new { ok = true, addedCount, groups = db.GetSocialGroupTargets() });
    }

    [HttpPost("groups/{id}/toggle")]
    public IActionResult ToggleGroup(string id, [FromBody] ToggleGroupRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.ToggleSocialGroupAutoShare(id, request.IsAutoShare) ? Ok(new { ok = true }) : NotFound(new { ok = false, error = "GROUP_NOT_FOUND" });
    }

    [HttpDelete("groups/{id}")]
    public IActionResult DeleteGroup(string id)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.DeleteSocialGroupTarget(id) ? Ok(new { ok = true }) : NotFound(new { ok = false, error = "GROUP_NOT_FOUND" });
    }

    // ================= BÀI ĐĂNG VIRAL & TÍCH HỢP AI LOCAL =================

    [HttpGet("viral")]
    public IActionResult GetViral([FromQuery] string? category = null)
        => Ok(new { ok = true, posts = db.GetSocialViralPosts(category) });

    [HttpPost("viral/import-real")]
    public IActionResult ImportRealViral([FromBody] ImportRealViralRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var addedCount = db.ImportRealViralPosts(request.Posts ?? []);
        return Ok(new { ok = true, addedCount, posts = db.GetSocialViralPosts() });
    }

    [HttpDelete("viral/clear-all")]
    public IActionResult ClearAllViral()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(new { ok = true, deletedCount = db.DeleteAllSocialViralPosts() });
    }

    [HttpDelete("viral/{id}")]
    public IActionResult DeleteViral(string id)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.DeleteSocialViralPost(id) ? Ok(new { ok = true }) : NotFound(new { ok = false, error = "VIRAL_NOT_FOUND" });
    }

    [HttpPost("ai/expand-topic")]
    public async Task<IActionResult> ExpandViralTopic([FromBody] ExpandViralTopicRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var result = await copywriter.ExpandViralTopicAsync(request.TopicKey, request.CustomTopic);
        return Ok(new { ok = true, result.TopicLabel, result.FbKeywords, result.TtKeywords, result.Tags, result.GeneratedBy });
    }

    [HttpPost("ai/classify-viral")]
    public async Task<IActionResult> ClassifyViralPosts([FromBody] ClassifyViralPostsRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var source = request.Posts is { Count: > 0 } ? request.Posts : db.GetSocialViralPosts().ToList();
        var result = await copywriter.ClassifyAndFilterViralPostsAsync(request.RequestedTopic, request.RequestedTopicLabel, source);
        if (request.Posts is null or { Count: 0 })
        {
            db.DeleteAllSocialViralPosts();
            db.ImportRealViralPosts(result.Posts);
        }
        return Ok(new { ok = true, result.Posts, result.RemovedOffTopic, result.RemovedDuplicates, result.GeneratedBy });
    }

    [HttpPost("ai/vision-assist")]
    public async Task<IActionResult> VisionAssist([FromBody] ExtensionVisionAssistRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var decision = await copywriter.DiagnoseExtensionUiAsync(request);
        return Ok(new { ok = decision.Ok, decision.Diagnosis, decision.Action, decision.TargetMarkId, decision.ClickMode, decision.LearnedRule, decision.GeneratedBy });
    }

    [HttpGet("ai/knowledge")]
    public IActionResult GetExtensionKnowledge()
    {
        var raw = db.GetSetting("social.extension.knowledge");
        if (string.IsNullOrWhiteSpace(raw)) return Ok(new { ok = true, knowledge = new Dictionary<string, object?>() });
        try
        {
            var parsed = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object?>>(raw) ?? [];
            return Ok(new { ok = true, knowledge = parsed });
        }
        catch { return Ok(new { ok = true, knowledge = new Dictionary<string, object?>() }); }
    }

    [HttpPost("ai/knowledge")]
    public IActionResult SaveExtensionKnowledge([FromBody] ExtensionKnowledgeSaveRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        db.SetSetting("social.extension.knowledge", System.Text.Json.JsonSerializer.Serialize(request.Knowledge ?? []));
        return Ok(new { ok = true });
    }

    [HttpPost("ai/viral-sales-ideas")]
    public async Task<IActionResult> ViralSalesIdeas([FromBody] ViralSalesIdeasRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var viral = db.GetSocialViralPosts(request.TopicFilter);
        var catalog = db.Catalog();
        return Ok(await copywriter.GenerateViralSalesIdeasAsync(viral, catalog, request.Count));
    }

    [HttpPost("ai/product-from-image")]
    public async Task<IActionResult> ProductFromImage([FromBody] ProductFromImageRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(await copywriter.ExtractProductFromImageAsync(request.ImageBase64 ?? "", request.Hint, request.SuggestedPrice));
    }

    [HttpGet("ai/inventory-recommendations")]
    public IActionResult InventoryRecommendations()
    {
        var catalog = db.Catalog();
        var topSold = db.AiTopSellingProducts(10);
        var soldIds = topSold.Select(x => x.ProductId).ToHashSet(StringComparer.OrdinalIgnoreCase);

        var highStockNeedPromo = catalog.Where(p => p.StockCount >= 18 && p.DiscountPercent == 0 && !soldIds.Contains(p.Id))
            .OrderByDescending(p => p.StockCount).Take(6)
            .Select(p => new { p.Id, p.Name, p.Category, p.Price, p.StockCount, p.DiscountPercent, p.Image, suggestedDiscount = 15, reason = $"Tồn cao ({p.StockCount}) chưa có giảm giá — nên giảm 15% đẩy đơn." }).ToArray();

        var lowStockAlert = catalog.Where(p => p.StockCount <= 5)
            .OrderBy(p => p.StockCount).Take(6)
            .Select(p => new { p.Id, p.Name, p.Category, p.Price, p.StockCount, p.DiscountPercent, p.Image, reason = p.StockCount == 0 ? "Đã hết hàng — cần nhập thêm." : $"Chỉ còn {p.StockCount} sản phẩm." }).ToArray();

        return Ok(new { ok = true, topSold, highStockNeedPromo, lowStockAlert });
    }

    [HttpPost("ai/analyze-comments")]
    public async Task<IActionResult> AnalyzeComments([FromBody] AnalyzeCommentsRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(await copywriter.AnalyzeCommentsAsync(request));
    }

    [HttpPost("ai/classify-channels")]
    public async Task<IActionResult> ClassifyChannels([FromBody] ClassifyChannelsRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return Ok(await copywriter.ClassifyChannelsAsync(request));
    }

    [HttpPost("ai/analyze-surf")]
    public async Task<IActionResult> AnalyzeSurf([FromBody] AnalyzeSurfFeedRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });

        object result;
        try
        {
            result = await copywriter.AnalyzeSurfSessionAsync(request);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AdminSocial] AnalyzeSurf fallback: {ex.Message}");
            var rawList = (request.Posts ?? []).OrderByDescending(p => p.LikesCount).ToList();
            var topTopics = rawList.GroupBy(p => string.IsNullOrWhiteSpace(p.Category) ? (string.IsNullOrWhiteSpace(request.TargetTopic) ? "Xu hướng chung" : request.TargetTopic) : p.Category)
                .Select(g => new { topic = g.Key, postCount = g.Count(), totalLikes = g.Sum(x => (long)x.LikesCount), topPostTitle = g.OrderByDescending(x => x.LikesCount).First().Title })
                .OrderByDescending(x => x.totalLikes).Take(8).ToArray();
            result = new
            {
                ok = true,
                platform = request.Platform,
                durationMinutes = request.DurationMinutes,
                scannedCount = rawList.Count,
                matchedCount = rawList.Count,
                topTopics,
                topPosts = rawList.ToArray(),
                generatedBy = "Fallback Rules"
            };
        }

        // Lưu toàn bộ bài vừa lướt vào lịch sử bền vững để hiển thị bên Tab Nhật ký & Báo cáo
        var incoming = request.Posts ?? [];
        if (incoming.Count > 0)
        {
            var existing = ReadSurfHistory();
            var byUrl = existing.ToDictionary(p => (p.PostUrl ?? "").Trim().ToLowerInvariant(), p => p, StringComparer.OrdinalIgnoreCase);
            var nowIso = DateTimeOffset.UtcNow.ToString("o");
            foreach (var post in incoming)
            {
                if (string.IsNullOrWhiteSpace(post.PostUrl)) continue;
                post.CreatedAt = string.IsNullOrWhiteSpace(post.CreatedAt) ? nowIso : post.CreatedAt;
                byUrl[post.PostUrl.Trim().ToLowerInvariant()] = post;
            }
            var merged = byUrl.Values.OrderByDescending(p => p.CreatedAt).Take(500).ToList();
            db.SetSetting("social.surf.history", JsonSerializer.Serialize(merged, _jsonOptions));
        }
        // Luôn lưu last_result để lưu bền vững trạng thái phiên lướt gần nhất chuẩn camelCase
        db.SetSetting("social.surf.last_result", JsonSerializer.Serialize(result, _jsonOptions));
        return Ok(result);
    }

    [HttpGet("surf-history")]
    public IActionResult GetSurfHistory()
    {
        var rawLast = db.GetSetting("social.surf.last_result");
        object? lastResult = null;
        if (!string.IsNullOrWhiteSpace(rawLast))
        {
            try { lastResult = JsonSerializer.Deserialize<JsonElement>(rawLast, _jsonOptions); } catch { }
        }
        return Ok(new { ok = true, posts = ReadSurfHistory(), lastResult });
    }

    [HttpDelete("surf-history")]
    public IActionResult ClearSurfHistory()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        db.SetSetting("social.surf.history", "[]");
        db.SetSetting("social.surf.last_result", "");
        return Ok(new { ok = true });
    }

    private List<SocialViralPost> ReadSurfHistory()
    {
        var raw = db.GetSetting("social.surf.history");
        if (string.IsNullOrWhiteSpace(raw)) return [];
        try { return JsonSerializer.Deserialize<List<SocialViralPost>>(raw, _jsonOptions) ?? []; }
        catch { return []; }
    }

    private static bool IsAnyLoggedInRealPermalink(string platform, string postUrl)
    {
        if (StoreDb.IsRealSocialPostPermalink(platform, postUrl)) return true;
        if (!Uri.TryCreate(postUrl, UriKind.Absolute, out var uri)) return false;
        var host = uri.Host.ToLowerInvariant();
        if (platform == "tiktok")
        {
            return (host == "tiktok.com" || host.EndsWith(".tiktok.com", StringComparison.Ordinal)) &&
                   Regex.IsMatch(uri.AbsolutePath, @"^/@[A-Za-z0-9._-]+/(?:video|photo)/[0-9]+/?$", RegexOptions.IgnoreCase);
        }
        return false;
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrEmpty(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
