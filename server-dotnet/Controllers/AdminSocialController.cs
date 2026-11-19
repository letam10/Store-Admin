/*
  FILE NOTE
  - Mục đích: Controller API quản trị cho module Tự động hóa tiếp thị Mạng Xã Hội (cấu hình chu kỳ phút/giờ, quyền riêng tư chỉ mình tôi/công khai, sinh nội dung AI Qwen, duyệt bài, xuất bản bài viết lên Facebook, nhật ký audit logs trung thực, nhóm Facebook, bài viral).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs, Store-Admin/server-dotnet/Services/SocialCopywriterService.cs, Store-Admin/server-dotnet/Services/SocialAutoPostWorker.cs
  - Vùng ảnh hưởng khi sửa: Toàn bộ API mạng xã hội cung cấp dữ liệu cho tab "Tự động đăng bài Mạng Xã Hội" trên giao diện Admin và đăng bài Facebook.
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
        var isPublished = request.PublishImmediately;
        var platform = (request.Platform ?? "facebook").ToLowerInvariant();
        var postId = "post-" + now.ToUnixTimeSeconds() + "-" + Guid.NewGuid().ToString("N")[..4];

        string? postUrl = null;
        if (isPublished)
        {
            if (platform == "facebook")
            {
                var groups = db.GetSocialGroupTargets();
                var matchedGroup = !string.IsNullOrWhiteSpace(request.TargetGroup)
                    ? groups.FirstOrDefault(g => g.GroupName.Equals(request.TargetGroup, StringComparison.OrdinalIgnoreCase))
                    : groups.FirstOrDefault(g => g.IsAutoShare);

                postUrl = matchedGroup?.GroupUrl ?? "https://www.facebook.com/groups/feed/";
            }
            else
            {
                postUrl = "https://www.tiktok.com/";
            }
        }

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
            Status = isPublished ? "published" : "pending_approval",
            PostUrl = postUrl,
            TargetGroup = request.TargetGroup,
            Privacy = request.Privacy ?? "only_me",
            TriggerTime = now.ToString("o"),
            PublishedTime = isPublished ? now.ToString("o") : null,
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

        var post = db.GetSocialPostById(id);
        if (post == null) return NotFound(new { error = "POST_NOT_FOUND" });

        string postUrl;
        if ((post.Platform ?? "").ToLowerInvariant() == "facebook")
        {
            var groups = db.GetSocialGroupTargets();
            var matchedGroup = !string.IsNullOrWhiteSpace(post.TargetGroup)
                ? groups.FirstOrDefault(g => g.GroupName.Equals(post.TargetGroup, StringComparison.OrdinalIgnoreCase))
                : groups.FirstOrDefault(g => g.IsAutoShare);
            postUrl = matchedGroup?.GroupUrl ?? "https://www.facebook.com/groups/feed/";
        }
        else
        {
            postUrl = "https://www.tiktok.com/";
        }

        db.UpdateSocialPostStatus(id, "published", errorMessage: null, postUrl: postUrl);
        var updated = db.GetSocialPostById(id);
        return Ok(new { ok = true, post = updated });
    }

    [HttpPost("posts/{id}/publish")]
    public IActionResult RetryPublishPost(string id)
    {
        if (!CsrfValid()) return StatusCode(StatusCodes.Status403Forbidden, new { error = "CSRF_INVALID" });

        var post = db.GetSocialPostById(id);
        if (post == null) return NotFound(new { error = "POST_NOT_FOUND" });

        string postUrl;
        if ((post.Platform ?? "").ToLowerInvariant() == "facebook")
        {
            var groups = db.GetSocialGroupTargets();
            var matchedGroup = !string.IsNullOrWhiteSpace(post.TargetGroup)
                ? groups.FirstOrDefault(g => g.GroupName.Equals(post.TargetGroup, StringComparison.OrdinalIgnoreCase))
                : groups.FirstOrDefault(g => g.IsAutoShare);
            postUrl = matchedGroup?.GroupUrl ?? "https://www.facebook.com/groups/feed/";
        }
        else
        {
            postUrl = "https://www.tiktok.com/";
        }

        db.UpdateSocialPostStatus(id, "published", errorMessage: null, postUrl: postUrl);
        var updated = db.GetSocialPostById(id);
        return Ok(new { ok = true, post = updated });
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
