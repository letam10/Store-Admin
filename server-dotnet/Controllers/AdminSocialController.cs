/*
  FILE NOTE
  - Mục đích: Bộ điều khiển API Tự động hóa đăng bài Mạng Xã Hội đa tài khoản.
  - Bổ sung mới:
    1. POST /api/admin/social/posts/{id}/pending-review (lưu trạng thái chờ TikTok duyệt 3-5 phút).
    2. DELETE /api/admin/social/posts/clear-all (xóa toàn bộ nhật ký đăng bài).
    3. DELETE /api/admin/social/viral/clear-all (xóa toàn bộ bài viral đã cào).
    4. POST /api/admin/social/groups/import-real (lưu 5 hội nhóm Facebook thật từ Extension).
    5. Cho phép xác minh link bài thật từ BẤT KỲ nick Facebook / TikTok nào đang đăng nhập.
*/

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
    public IActionResult Stats() => Ok(new { stats = db.GetSocialSummaryStats() });

    [HttpGet("settings")]
    public IActionResult GetSettings() => Ok(new { settings = db.GetSocialSettings() });

    [HttpPost("settings")]
    public IActionResult SaveSettings([FromBody] SocialCampaignSettings request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : "only_me";
        request.Privacy = privacy;
        var saved = db.SaveSocialSettings(request);
        return Ok(new { ok = true, settings = saved });
    }

    [HttpPost("trigger-cycle")]
    public async Task<IActionResult> TriggerCycle([FromQuery] string? platform = null, CancellationToken cancellationToken = default)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var post = await worker.TriggerCycleNowAsync(platform, cancellationToken);
        if (post is null) return BadRequest(new { ok = false, error = "CYCLE_BUSY_OR_NO_PRODUCT" });
        return Ok(new { ok = true, post });
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] GeneratePostRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var settings = db.GetSocialSettings();
        var product = db.GetCatalogProductForPromotion(settings.PreferredCategory, request.ProductId);
        if (product is null) return NotFound(new { ok = false, error = "PRODUCT_NOT_FOUND" });

        var generated = await copywriter.GeneratePostAsync(
            product.Value.Name,
            product.Value.Price,
            product.Value.Category,
            product.Value.Description,
            request.Platform ?? "facebook",
            request.ToneStyle ?? settings.ToneStyle,
            settings,
            request.CustomTopic,
            product.Value.Id);

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
    public IActionResult GetPosts([FromQuery] string? status = null, [FromQuery] string? platform = null, [FromQuery] int limit = 80)
        => Ok(new { posts = db.GetSocialPosts(status, platform, limit) });

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

        if (string.IsNullOrWhiteSpace(request.PostUrl) || !StoreDb.IsRealSocialPostPermalink(platform, request.PostUrl))
        {
            return BadRequest(new { ok = false, error = "INVALID_REAL_PERMALINK" });
        }

        var privacy = string.Equals(request.Privacy, "public", StringComparison.OrdinalIgnoreCase) ? "public" : "only_me";
        db.PublishRealSocialPost(
            id,
            request.PostUrl.Trim(),
            request.PublishedTime,
            platform,
            privacy,
            request.LikesCount,
            request.SharesCount,
            request.CommentsCount);

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
        var deletedCount = db.DeleteAllSocialPosts();
        return Ok(new { ok = true, deletedCount });
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
        => Ok(new { groups = db.GetSocialGroupTargets(category) });

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
        var groups = request.Groups ?? [];
        var addedCount = db.ImportRealGroupTargets(groups);
        return Ok(new { ok = true, addedCount, groups = db.GetSocialGroupTargets() });
    }

    [HttpPost("groups/{id}/toggle")]
    public IActionResult ToggleGroup(string id, [FromBody] ToggleGroupRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.ToggleSocialGroupAutoShare(id, request.IsAutoShare)
            ? Ok(new { ok = true })
            : NotFound(new { ok = false, error = "GROUP_NOT_FOUND" });
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
        => Ok(new { posts = db.GetSocialViralPosts(category) });

    [HttpPost("viral/import-real")]
    public IActionResult ImportRealViral([FromBody] ImportRealViralRequest request)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var posts = request.Posts ?? [];
        var addedCount = db.ImportRealViralPosts(posts);
        return Ok(new { ok = true, addedCount, posts = db.GetSocialViralPosts() });
    }

    [HttpDelete("viral/clear-all")]
    public IActionResult ClearAllViral()
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        var deletedCount = db.DeleteAllSocialViralPosts();
        return Ok(new { ok = true, deletedCount });
    }

    [HttpDelete("viral/{id}")]
    public IActionResult DeleteViral(string id)
    {
        if (!CsrfValid()) return StatusCode(403, new { error = "CSRF_INVALID" });
        return db.DeleteSocialViralPost(id) ? Ok(new { ok = true }) : NotFound(new { ok = false, error = "VIRAL_NOT_FOUND" });
    }

    private bool CsrfValid()
    {
        var raw = Request.Cookies["store_admin_session"];
        return !string.IsNullOrEmpty(raw) && Request.Headers["x-csrf-token"] == Tokens.Sha256("csrf:" + raw);
    }
}
