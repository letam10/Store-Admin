/*
  FILE NOTE
  - Mục đích: Khai báo các mô hình dữ liệu (Models & DTOs) cho tính năng Tự động hóa đăng bài Mạng Xã Hội (Facebook, TikTok, Group targets, Viral posts, Post audit logs), hỗ trợ chu kỳ phút/giờ linh hoạt và quyền riêng tư chỉ mình tôi / công khai.
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.SocialAutomation.cs, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs, Store-Admin/server-dotnet/Services/SocialCopywriterService.cs
  - Vùng ảnh hưởng khi sửa: Cấu trúc dữ liệu lưu trữ cấu hình chiến dịch, lịch sử bài đăng MXH, nhóm mục tiêu và thống kê tương tác.
*/

namespace StoreApi.Models;

public sealed class SocialCampaignSettings
{
    public int Id { get; set; } = 1;
    public bool IsActive { get; set; } = true;
    public string Mode { get; set; } = "full_auto"; // full_auto | semi_auto
    public double IntervalHours { get; set; } = 2; // 0.0833 (5m), 0.5 (30m), 1, 2, 3, 6...
    public int IntervalMinutes { get; set; } = 120; // 5, 30, 60, 120, 180, 360
    public string Privacy { get; set; } = "only_me"; // only_me (Chỉ mình tôi) | public (Công khai)
    public string Channels { get; set; } = "facebook,tiktok";
    public string PreferredCategory { get; set; } = "all";
    public string ToneStyle { get; set; } = "viral_engaging"; // viral_engaging, humorous, fomo_sales, authentic_review, storytelling
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
    public string Platform { get; set; } = "facebook"; // facebook | tiktok
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string Hashtags { get; set; } = "";
    public string Status { get; set; } = "internal_draft"; // internal_draft | ready_for_api | published | pending_approval | failed
    public string? ErrorMessage { get; set; }
    public string? PostUrl { get; set; }
    public string? TargetGroup { get; set; }
    public string Privacy { get; set; } = "only_me"; // only_me | public
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
    public string Status { get; set; } = "active"; // active | joined | pending
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
    public string Category { get; set; } = "Đồ gia dụng & Gia đình";
    public int MembersCount { get; set; } = 25000;
    public string InteractionRate { get; set; } = "Cao";
    public bool IsAutoShare { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class AddViralPostRequest
{
    public string Title { get; set; } = "";
    public string Platform { get; set; } = "facebook";
    public string Category { get; set; } = "Gia dụng & Đời sống";
    public string PostUrl { get; set; } = "";
    public string Summary { get; set; } = "";
    public int ViralityScore { get; set; } = 96;
    public int LikesCount { get; set; } = 1200;
    public int SharesCount { get; set; } = 340;
    public int CommentsCount { get; set; } = 185;
    public string TrendingTopic { get; set; } = "Mẹo hay cuộc sống";
}
