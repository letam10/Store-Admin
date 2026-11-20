/*
  FILE NOTE
  - Mục đích: Controller API quản trị cho module Tự động hóa tiếp thị Mạng Xã Hội (chu kỳ 30 giây / phút / giờ, quyền riêng tư chỉ mình tôi/công khai, Facebook Hoàng Thái HT, TikTok @harutv666, API đăng bài thật /publish-real).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs, Store-Admin/server-dotnet/Services/SocialCopywriterService.cs, Store-Admin/server-dotnet/Services/SocialAutoPostWorker.cs
  - Vùng ảnh hưởng khi sửa: Toàn bộ API mạng xã hội cung cấp dữ liệu cho tab "Tự động đăng bài Mạng Xã Hội" trên giao diện Admin, đăng bài Facebook Hoàng Thái HT và TikTok @harutv666.
  - Sửa 2026-11-20: Chấp nhận hai lựa chọn riêng tư dùng chung cho Facebook và TikTok.
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
    private const string Cookie = "store_admin_session";
    public const string DefaultFacebookProfileUrl = "https://www.facebook.com/profile.php?id=100037782653708";
    public const string DefaultTikTokProfileUrl = "https://www.tiktok.com/@harutv666";

    private bool CsrfValid()
    {
        var raw = Request.Cookies[Cookie];
        return !string.IsNullOrWhiteSpace(raw) &&
               Request.Headers.TryGetValue("x-csrf-token", out var value) &&
               value == Tokens.Sha256("csrf:" + raw);
    }

    [HttpGet("settings")]
    public IActionResult GetSettings()
    {
        var settings = db.GetSocialSettings();
        return Ok(new { ok = true, settings });
    }

    [HttpPost("settings")]
    public IActionResult SaveSettings([FromBody] SocialCampaignSettings request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var saved = db.SaveSocialSettings(request);
        return Ok(new { ok = true, settings = saved });
    }

    [HttpGet("posts")]
    public IActionResult GetPosts([FromQuery] string? status, [FromQuery] string? platform, [FromQuery] int limit = 60)
    {
        var posts = db.GetSocialPosts(status, platform, limit);
        return Ok(new { ok = true, posts });
    }

    [HttpPost("posts/create")]
    public IActionResult CreateCustomPost([FromBody] CreateCustomPostRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var now = DateTimeOffset.UtcNow;
        var platform = (request.Platform ?? "facebook").ToLowerInvariant();
        if (platform is not ("facebook" or "tiktok"))
            return BadRequest(new { error = "UNSUPPORTED_PLATFORM", message = "Chỉ hỗ trợ Facebook và TikTok." });
        var postId = "post-" + now.ToUnixTimeSeconds() + "-" + Guid.NewGuid().ToString("N")[..4];

        var post = new SocialAutoPost
        {
            Id = postId,
            ProductId = request.ProductId,
            ProductName = string.IsNullOrWhiteSpace(request.ProductName) ? "Sản phẩm OmniCart" : request.ProductName.Trim(),
            ProductPrice = request.ProductPrice,
            ProductImage = request.ProductImage ?? "/products/bag.svg",
            Platform = platform,
            Title = request.Title ?? "",
            Content = request.Content ?? "",
            Hashtags = request.Hashtags ?? "#OmniCart #EverydayEssentials",
            Status = "pending_approval",
            PostUrl = null,
            TargetGroup = request.TargetGroup,
            Privacy = request.Privacy ?? "only_me",
            TriggerTime = now.ToString("o"),
            PublishedTime = null,
            LikesCount = 0,
            SharesCount = 0,
            CommentsCount = 0,
            ViewsCount = 0,
            CreatedAt = now.ToString("o")
        };

        var created = db.CreateSocialPost(post);
        return Ok(new { ok = true, post = created });
    }

    [HttpPost("generate")]
    public async Task<IActionResult> GeneratePostDraft([FromBody] GeneratePostRequest request)
    {
        var settings = db.GetSocialSettings();
        var product = db.GetCatalogProductForPromotion(specificId: request.ProductId);
        if (product == null)
        {
            return BadRequest(new { error = "PRODUCT_NOT_FOUND", message = "Không tìm thấy thông tin sản phẩm để viết bài." });
        }

        var platform = request.Platform ?? "facebook";
        var tone = request.ToneStyle ?? settings.ToneStyle;

        var result = await copywriter.GeneratePostAsync(
            product.Value.Name,
            product.Value.Price,
            product.Value.Category,
            product.Value.Description,
            platform,
            tone,
            settings,
            request.CustomTopic,
            productId: product.Value.Id);

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
            generated = result
        });
    }

    [HttpPost("posts/{id}/approve")]
    public IActionResult ApprovePost(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (db.GetSocialPostById(id) == null) return NotFound(new { error = "POST_NOT_FOUND" });
        return Conflict(new { ok = false, error = "PUBLISH_REQUIRES_EXTENSION", message = "Bài chỉ được ghi là đã đăng sau khi Extension xác nhận permalink thật." });
    }

    [HttpPost("posts/{id}/publish")]
    public IActionResult RetryPublishPost(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (db.GetSocialPostById(id) == null) return NotFound(new { error = "POST_NOT_FOUND" });
        return Conflict(new { ok = false, error = "PUBLISH_REQUIRES_EXTENSION", message = "Bài chỉ được ghi là đã đăng sau khi Extension xác nhận permalink thật." });
    }

    [HttpPost("posts/{id}/publish-real")]
    public IActionResult PublishRealPost(string id, [FromBody] PublishRealPostRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request?.PostUrl) || string.IsNullOrWhiteSpace(request.RealPostId))
        {
            return BadRequest(new { error = "INVALID_POST_CONFIRMATION", message = "Cần permalink và mã bài viết thật từ Extension." });
        }

        var post = db.GetSocialPostById(id);
        if (post == null) return NotFound(new { error = "POST_NOT_FOUND" });

        var platform = (request.Platform ?? post.Platform).ToLowerInvariant();
        if (platform != post.Platform.ToLowerInvariant() || platform is not ("facebook" or "tiktok"))
            return BadRequest(new { error = "PLATFORM_MISMATCH", message = "Nền tảng xác nhận không khớp với bản nháp." });
        var privacy = (request.Privacy ?? post.Privacy ?? "public").Trim().ToLowerInvariant();
        if (privacy is not ("only_me" or "public"))
            return BadRequest(new { error = "INVALID_PRIVACY", message = "Quyền riêng tư phải là 'only_me' hoặc 'public'." });
        if (!IsRealPostPermalink(platform, request.PostUrl, request.RealPostId))
            return BadRequest(new { error = "INVALID_POST_PERMALINK", message = "Đường dẫn phải trỏ đến một bài viết cụ thể đã đăng, không phải trang cá nhân." });
        if (!DateTimeOffset.TryParse(request.PublishedTime, out var publishedAt))
            return BadRequest(new { error = "INVALID_PUBLISHED_TIME", message = "Extension chưa trả thời gian đăng hợp lệ." });

        var success = db.PublishRealSocialPost(
            id,
            request.PostUrl,
            publishedAt.ToUniversalTime().ToString("o"),
            platform,
            privacy,
            request.LikesCount,
            request.SharesCount,
            request.CommentsCount);
        var updated = db.GetSocialPostById(id);
        return Ok(new { ok = success, post = updated });
    }

    [HttpPost("posts/{id}/publish-failure")]
    public IActionResult RecordPublishFailure(string id, [FromBody] PublishFailureRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var post = db.GetSocialPostById(id);
        if (post == null) return NotFound(new { error = "POST_NOT_FOUND" });
        if (post.Status == "published")
            return Conflict(new { error = "POST_ALREADY_PUBLISHED", message = "Bài đã được xác nhận đăng; không thể đổi trạng thái thành lỗi." });

        var status = (request.Status ?? "failed").Trim().ToLowerInvariant();
        if (status is not ("failed" or "unverified"))
            return BadRequest(new { error = "INVALID_FAILURE_STATUS" });

        string? verifiedPostUrl = null;
        if (status == "unverified" && !string.IsNullOrWhiteSpace(request.PostUrl) &&
            !string.IsNullOrWhiteSpace(request.RealPostId) &&
            IsRealPostPermalink(post.Platform.ToLowerInvariant(), request.PostUrl, request.RealPostId))
        {
            verifiedPostUrl = request.PostUrl;
        }

        var errorMessage = string.IsNullOrWhiteSpace(request.ErrorMessage)
            ? "Extension chưa xác nhận kết quả đăng bài."
            : request.ErrorMessage.Trim();
        if (errorMessage.Length > 1000) errorMessage = errorMessage[..1000];

        var updatedStatus = db.MarkSocialPostPublishFailure(id, status, errorMessage, verifiedPostUrl);
        if (!updatedStatus) return Conflict(new { error = "POST_STATE_CHANGED" });

        return Ok(new { ok = true, post = db.GetSocialPostById(id) });
    }

    private static bool IsRealPostPermalink(string platform, string postUrl, string realPostId)
    {
        if (!Uri.TryCreate(postUrl, UriKind.Absolute, out var uri) || string.IsNullOrWhiteSpace(realPostId)) return false;

        var host = uri.Host.ToLowerInvariant();
        if (platform == "facebook")
        {
            if (host != "facebook.com" && !host.EndsWith(".facebook.com", StringComparison.Ordinal)) return false;
            var storyId = System.Text.RegularExpressions.Regex.Match(uri.Query, @"(?:story_fbid|fbid)=([^&]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var pathId = System.Text.RegularExpressions.Regex.Match(uri.AbsolutePath, @"/(?:posts|share/p)/([^/?]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var actualId = storyId.Success ? Uri.UnescapeDataString(storyId.Groups[1].Value) : pathId.Success ? pathId.Groups[1].Value : null;
            return actualId == realPostId;
        }

        if (platform == "tiktok")
        {
            if (host != "tiktok.com" && !host.EndsWith(".tiktok.com", StringComparison.Ordinal)) return false;
            var match = System.Text.RegularExpressions.Regex.Match(
                uri.AbsolutePath,
                @"^/@harutv666/(?:video|photo)/([0-9]+)/?$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return match.Success && match.Groups[1].Value == realPostId;
        }

        return false;
    }

    [HttpDelete("posts/{id}")]
    public IActionResult DeletePost(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var success = db.DeleteSocialPost(id);
        return Ok(new { ok = success });
    }

    [HttpGet("groups")]
    public IActionResult GetGroups([FromQuery] string? category)
    {
        var groups = db.GetSocialGroupTargets(category);
        return Ok(new { ok = true, groups });
    }

    [HttpPost("groups")]
    public IActionResult AddGroup([FromBody] AddGroupRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.GroupName) || string.IsNullOrWhiteSpace(request.GroupUrl))
        {
            return BadRequest(new { error = "INVALID_INPUT", message = "Tên nhóm và liên kết nhóm là bắt buộc." });
        }

        var group = new SocialGroupTarget
        {
            GroupName = request.GroupName.Trim(),
            GroupUrl = request.GroupUrl.Trim(),
            Category = request.Category ?? "Đồ gia dụng & Gia đình",
            MembersCount = request.MembersCount > 0 ? request.MembersCount : 10000,
            InteractionRate = request.InteractionRate ?? "Cao",
            IsAutoShare = request.IsAutoShare,
            Notes = request.Notes
        };

        var created = db.AddSocialGroupTarget(group);
        return Ok(new { ok = true, group = created });
    }

    [HttpDelete("groups/{id}")]
    public IActionResult DeleteGroup(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var success = db.DeleteSocialGroupTarget(id);
        return Ok(new { ok = success });
    }

    [HttpPost("groups/{id}/toggle")]
    public IActionResult ToggleGroupShare(string id, [FromBody] System.Text.Json.JsonElement payload)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var isAutoShare = payload.TryGetProperty("isAutoShare", out var elem) && elem.GetBoolean();
        var success = db.ToggleSocialGroupAutoShare(id, isAutoShare);
        return Ok(new { ok = success });
    }

    [HttpGet("viral")]
    public IActionResult GetViralPosts([FromQuery] string? category)
    {
        var posts = db.GetSocialViralPosts(category);
        return Ok(new { ok = true, posts });
    }

    [HttpPost("viral")]
    public IActionResult AddViralPost([FromBody] AddViralPostRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.PostUrl))
        {
            return BadRequest(new { error = "INVALID_INPUT", message = "Tiêu đề và đường dẫn bài viết là bắt buộc." });
        }

        var viral = new SocialViralPost
        {
            Title = request.Title.Trim(),
            Platform = request.Platform ?? "facebook",
            Category = request.Category ?? "Đồ gia dụng",
            PostUrl = request.PostUrl.Trim(),
            Summary = request.Summary ?? "",
            ViralityScore = request.ViralityScore > 0 ? request.ViralityScore : 95,
            LikesCount = request.LikesCount,
            SharesCount = request.SharesCount,
            CommentsCount = request.CommentsCount,
            TrendingTopic = request.TrendingTopic ?? "Thịnh hành"
        };

        var created = db.AddSocialViralPost(viral);
        return Ok(new { ok = true, viral = created });
    }

    [HttpPost("viral/fetch-more")]
    public IActionResult FetchMoreViralPosts()
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var added = db.FetchMoreRealisticViralPosts(5);
        return Ok(new { ok = true, addedCount = added.Count, posts = added });
    }

    [HttpPost("viral/import-real")]
    public IActionResult ImportRealViralPosts([FromBody] ImportRealViralRequest request)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        if (request?.Posts == null || request.Posts.Count == 0)
        {
            return BadRequest(new { error = "NO_POSTS", message = "Danh sách bài viết viral trống." });
        }

        var imported = db.ImportRealViralPosts(request.Posts);
        return Ok(new { ok = true, count = imported });
    }

    [HttpDelete("viral/{id}")]
    public IActionResult DeleteViralPost(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var success = db.DeleteSocialViralPost(id);
        return Ok(new { ok = success });
    }

    [HttpGet("stats")]
    public IActionResult GetStats()
    {
        var stats = db.GetSocialSummaryStats();
        return Ok(new { ok = true, stats });
    }

    [HttpPost("trigger-cycle")]
    public async Task<IActionResult> TriggerCycleNow([FromQuery] string? platform, CancellationToken cancellationToken)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });
        var post = await worker.TriggerCycleNowAsync(platform, cancellationToken);
        var stats = db.GetSocialSummaryStats();
        return Ok(new { ok = true, post, stats });
    }
}
