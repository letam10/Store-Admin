/*
  FILE NOTE
  - Mục đích: Khai báo các mô hình dữ liệu (Models & DTOs) cho Tự động hóa đăng bài MXH đa tài khoản, mở rộng từ khóa AI và phân loại bài Viral.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Services/SocialCopywriterService.cs, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs
  - Vùng ảnh hưởng khi sửa: Toàn bộ API đăng bài, mở rộng từ khóa và phân loại bài viral.
*/

namespace StoreApi.Models;

public sealed class SocialCampaignSettings
{
    public int Id { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public string Mode { get; set; } = "full_auto";
    public double IntervalHours { get; set; } = 2;
    public int IntervalMinutes { get; set; } = 120;
    public int IntervalSeconds { get; set; } = 120;
    public string Privacy { get; set; } = "only_me";
    public string Channels { get; set; } = "facebook,tiktok";
    public string PreferredCategory { get; set; } = "all";
    public string ToneStyle { get; set; } = "viral_engaging";
    public bool IncludeHashtags { get; set; } = true;
    public bool IncludeEmojis { get; set; } = true;
    public bool IncludeCta { get; set; } = true;
    public bool IncludeHotline { get; set; } = true;
    public string ContactHotline { get; set; } = "0901.234.567";
    public string OrderLinkTemplate { get; set; } = "https://omnicart.vn/products/{id}";
    public string? LastRunAt { get; set; }
    public string? NextRunAt { get; set; }
    public string UpdatedAt { get; set; } = "";
}

public sealed class SocialAutoPost
{
    public string Id { get; set; } = "";
    public string? ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal ProductPrice { get; set; }
    public string? ProductImage { get; set; }
    public string Platform { get; set; } = "facebook";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Hashtags { get; set; } = "";
    public string Status { get; set; } = "internal_draft"; // internal_draft | ready_for_publish | pending_review | published | pending_approval | unverified | failed
    public string? ErrorMessage { get; set; }
    public string? PostUrl { get; set; }
    public string? TargetGroup { get; set; }
    public string Privacy { get; set; } = "only_me";
    public string TriggerTime { get; set; } = "";
    public string? PublishedTime { get; set; }
    public int LikesCount { get; set; }
    public int SharesCount { get; set; }
    public int CommentsCount { get; set; }
    public int ViewsCount { get; set; }
    public string CreatedAt { get; set; } = "";
}

public sealed class SocialGroupTarget
{
    public string Id { get; set; } = "";
    public string GroupName { get; set; } = "";
    public string GroupUrl { get; set; } = "";
    public string Category { get; set; } = "";
    public int MembersCount { get; set; }
    public string InteractionRate { get; set; } = "Cao";
    public string Status { get; set; } = "active";
    public bool IsAutoShare { get; set; } = true;
    public string? Notes { get; set; }
    public string CreatedAt { get; set; } = "";
}

public sealed class SocialViralPost
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Platform { get; set; } = "facebook";
    public string Category { get; set; } = "";
    public string PostUrl { get; set; } = "";
    public string Summary { get; set; } = "";
    public int ViralityScore { get; set; } = 95;
    public int LikesCount { get; set; }
    public int SharesCount { get; set; }
    public int CommentsCount { get; set; }
    public string TrendingTopic { get; set; } = "";
    public string CreatedAt { get; set; } = "";
}

public sealed class SocialSummaryStats
{
    public int TotalPostsToday { get; set; }
    public int PublishedCount { get; set; }
    public int PendingCount { get; set; }
    public int DraftCount { get; set; }
    public int FailedCount { get; set; }
    public int TotalLikes { get; set; }
    public int TotalShares { get; set; }
    public int TotalComments { get; set; }
    public string? LastRunAt { get; set; }
    public string? NextRunAt { get; set; }
    public bool IsActive { get; set; }
    public double IntervalHours { get; set; }
    public int IntervalMinutes { get; set; }
    public int IntervalSeconds { get; set; } = 120;
    public string Privacy { get; set; } = "only_me";
    public string Mode { get; set; } = "full_auto";
}

public sealed class GeneratePostRequest
{
    public string? ProductId { get; set; }
    public string? Platform { get; set; }
    public string? ToneStyle { get; set; }
    public string? CustomTopic { get; set; }
}

public sealed class CreateCustomPostRequest
{
    public string? ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public decimal ProductPrice { get; set; }
    public string? ProductImage { get; set; }
    public string Platform { get; set; } = "facebook";
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string? Hashtags { get; set; }
    public string? TargetGroup { get; set; }
    public string? Privacy { get; set; } = "only_me";
    public bool PublishImmediately { get; set; } = true;
}

public sealed class AddGroupRequest
{
    public string GroupName { get; set; } = "";
    public string GroupUrl { get; set; } = "";
    public string Category { get; set; } = "Cộng đồng Facebook";
    public int MembersCount { get; set; }
    public string InteractionRate { get; set; } = "Cao";
    public bool IsAutoShare { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class ToggleGroupRequest
{
    public bool IsAutoShare { get; set; }
}

public sealed class ImportRealGroupsRequest
{
    public List<SocialGroupTarget>? Groups { get; set; }
}

public sealed class AddViralPostRequest
{
    public string Title { get; set; } = "";
    public string Platform { get; set; } = "facebook";
    public string Category { get; set; } = "Đời sống & Tiện ích";
    public string PostUrl { get; set; } = "";
    public string Summary { get; set; } = "";
    public int ViralityScore { get; set; } = 96;
    public int LikesCount { get; set; }
    public int SharesCount { get; set; }
    public int CommentsCount { get; set; }
    public string TrendingTopic { get; set; } = "Xu hướng thực tế";
}

public sealed class PublishRealPostRequest
{
    public string? PostUrl { get; set; }
    public string? PublishedTime { get; set; }
    public string? Platform { get; set; }
    public string? RealPostId { get; set; }
    public string Privacy { get; set; } = "only_me";
    public int LikesCount { get; set; }
    public int SharesCount { get; set; }
    public int CommentsCount { get; set; }
}

public sealed class MarkPendingReviewRequest
{
    public string? Platform { get; set; }
    public string? Privacy { get; set; }
    public string? Message { get; set; }
}

public sealed class PublishFailureRequest
{
    public string? Status { get; set; }
    public string? ErrorMessage { get; set; }
    public string? PostUrl { get; set; }
    public string? RealPostId { get; set; }
}

public sealed class ImportRealViralRequest
{
    public List<SocialViralPost>? Posts { get; set; }
}

public sealed class ExpandViralTopicRequest
{
    public string? TopicKey { get; set; }
    public string? CustomTopic { get; set; }
}

public sealed class ClassifyViralPostsRequest
{
    public string? RequestedTopic { get; set; }
    public string? RequestedTopicLabel { get; set; }
    public List<SocialViralPost>? Posts { get; set; }
}
public sealed class ExtensionVisionElement
{
    public int Id { get; set; }
    public string Tag { get; set; } = "";
    public string Role { get; set; } = "";
    public string Label { get; set; } = "";
    public string Text { get; set; } = "";
    public string AriaLabel { get; set; } = "";
    public string DataE2e { get; set; } = "";
    public string StableSelector { get; set; } = "";
    public bool InDialog { get; set; }
    public bool Disabled { get; set; }
    public string PrimaryColor { get; set; } = "neutral";
    public int X { get; set; }
    public int Y { get; set; }
    public int W { get; set; }
    public int H { get; set; }
}

public sealed class ExtensionVisionAssistRequest
{
    public string Platform { get; set; } = "facebook";
    public string StepKey { get; set; } = "";
    public string Goal { get; set; } = "";
    public string Url { get; set; } = "";
    public string ErrorReason { get; set; } = "";
    public int ViewportWidth { get; set; }
    public int ViewportHeight { get; set; }
    public int ScrollY { get; set; }
    public string? ScreenshotBase64 { get; set; }
    public List<ExtensionVisionElement>? Elements { get; set; }
}

public sealed class ExtensionKnowledgeSaveRequest
{
    public Dictionary<string, object?>? Knowledge { get; set; }
}