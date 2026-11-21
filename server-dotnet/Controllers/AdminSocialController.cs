/*
  FILE NOTE
  - Mục đích: Controller quản lý chiến dịch MXH, hàng đợi đăng bài, cào bài viral và tích hợp AI mở rộng từ khóa / phân loại viral.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Services/SocialCopywriterService.cs, Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs
  - Vùng ảnh hưởng khi sửa: Các API đăng bài MXH, quản lý bài viral và gợi ý AI cho mạng xã hội.
*/

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



    [HttpPost("generate")]

    public async Task<IActionResult> Generate([FromBody] GeneratePostRequest request)

    {

        var settings = db.GetSocialSettings();

        var product = db.GetCatalogProductForPromotion(settings.PreferredCategory, request.ProductId);

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



    // ================= BÀI ĐĂNG VIRAL THẬT =================



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
        return Ok(new
        {
            ok = true,
            topicLabel = result.TopicLabel,
            fbKeywords = result.FbKeywords,
            ttKeywords = result.TtKeywords,
            tags = result.Tags,
            generatedBy = result.GeneratedBy
        });
    }

    [HttpPost("ai/classify-viral")]
    public async Task<IActionResult> ClassifyViralPosts([FromBody] ClassifyViralPostsRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var source = request.Posts is { Count: > 0 } ? request.Posts : db.GetSocialViralPosts().ToList();
        var result = await copywriter.ClassifyAndFilterViralPostsAsync(request.RequestedTopic, request.RequestedTopicLabel, source);

        // Nếu gọi để lọc & gắn tag lại kho bài hiện có (không truyền posts mới) -> cập nhật thẳng vào DB
        if (request.Posts is null or { Count: 0 })
        {
            db.DeleteAllSocialViralPosts();
            db.ImportRealViralPosts(result.Posts);
        }

        return Ok(new
        {
            ok = true,
            posts = result.Posts,
            removedOffTopic = result.RemovedOffTopic,
            removedDuplicates = result.RemovedDuplicates,
            generatedBy = result.GeneratedBy
        });
    }
    [HttpPost("ai/vision-assist")]
    public async Task<IActionResult> VisionAssist([FromBody] ExtensionVisionAssistRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var decision = await copywriter.DiagnoseExtensionUiAsync(request);
        return Ok(new
        {
            ok = decision.Ok,
            diagnosis = decision.Diagnosis,
            action = decision.Action,
            targetMarkId = decision.TargetMarkId,
            clickMode = decision.ClickMode,
            learnedRule = decision.LearnedRule,
            generatedBy = decision.GeneratedBy
        });
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
        catch
        {
            return Ok(new { ok = true, knowledge = new Dictionary<string, object?>() });
        }
    }

    [HttpPost("ai/knowledge")]
    public IActionResult SaveExtensionKnowledge([FromBody] ExtensionKnowledgeSaveRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var json = System.Text.Json.JsonSerializer.Serialize(request.Knowledge ?? []);
        db.SetSetting("social.extension.knowledge", json);
        return Ok(new { ok = true });
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
