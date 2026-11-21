/*
  FILE NOTE
  - Mục đích: Truy cập dữ liệu SQL Server cho Tự động hóa đăng bài MXH đa tài khoản v3.1.0 (không hardcode tên/ID nick).
  - Nâng cấp v3.1.0:
    1. ImportRealGroupTargets chống trùng theo cả URL lẫn Tên nhóm + cập nhật số thành viên nếu nhóm cũ từng bị 0.
    2. IsRealSocialPostPermalink chấp nhận link bài viết thật từ BẤT KỲ tài khoản Facebook hoặc TikTok nào (@any_handle/video|photo/id).
    3. Hỗ trợ trạng thái pending_review (chờ TikTok duyệt 3-5 phút).
    4. Thêm DeleteAllSocialPosts(), DeleteAllSocialViralPosts(), ImportRealGroupTargets() và ImportRealViralPosts().
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Controllers/AdminSocialController.cs, Store-Admin/server-dotnet/Models/SocialAutomationModels.cs
  - Vùng ảnh hưởng khi sửa: Dữ liệu đăng bài tự động, nhóm Facebook mục tiêu, bài viết viral và cấu hình chiến dịch.
*/

using System.Data;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using StoreApi.Models;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public void EnsureSocialAutomationTables()
    {
        using var db = Open();

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'social_campaign_settings')
            BEGIN
                CREATE TABLE social_campaign_settings (
                    id INT PRIMARY KEY,
                    is_active BIT NOT NULL DEFAULT 1,
                    mode NVARCHAR(50) NOT NULL DEFAULT 'full_auto',
                    interval_hours INT NOT NULL DEFAULT 2,
                    channels NVARCHAR(255) NOT NULL DEFAULT 'facebook,tiktok',
                    preferred_category NVARCHAR(100) NOT NULL DEFAULT 'all',
                    tone_style NVARCHAR(100) NOT NULL DEFAULT 'viral_engaging',
                    include_hashtags BIT NOT NULL DEFAULT 1,
                    include_emojis BIT NOT NULL DEFAULT 1,
                    include_cta BIT NOT NULL DEFAULT 1,
                    include_hotline BIT NOT NULL DEFAULT 1,
                    contact_hotline NVARCHAR(50) NOT NULL DEFAULT '0901.234.567',
                    order_link_template NVARCHAR(255) NOT NULL DEFAULT 'https://omnicart.vn/products/{id}',
                    last_run_at NVARCHAR(100) NULL,
                    next_run_at NVARCHAR(100) NULL,
                    updated_at NVARCHAR(100) NOT NULL
                );
            END;
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'interval_minutes')
                ALTER TABLE social_campaign_settings ADD interval_minutes INT NOT NULL DEFAULT 120;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'interval_seconds')
                ALTER TABLE social_campaign_settings ADD interval_seconds INT NOT NULL DEFAULT 120;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'privacy')
                ALTER TABLE social_campaign_settings ADD privacy NVARCHAR(50) NOT NULL DEFAULT 'only_me';
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT 1 FROM social_campaign_settings WHERE id = 1)
            BEGIN
                INSERT INTO social_campaign_settings (
                    id, is_active, mode, interval_hours, interval_minutes, interval_seconds, privacy, channels, preferred_category, tone_style,
                    include_hashtags, include_emojis, include_cta, include_hotline,
                    contact_hotline, order_link_template, last_run_at, next_run_at, updated_at
                ) VALUES (
                    1, 0, 'full_auto', 2, 120, 7200, 'only_me', 'facebook,tiktok', 'all', 'viral_engaging',
                    1, 1, 1, 1,
                    '0901.234.567', 'https://omnicart.vn/products/{id}',
                    CONVERT(NVARCHAR(30), DATEADD(HOUR, -2, GETUTCDATE()), 126),
                    CONVERT(NVARCHAR(30), DATEADD(HOUR, 2, GETUTCDATE()), 126),
                    CONVERT(NVARCHAR(30), GETUTCDATE(), 126)
                );
            END;
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'social_auto_posts')
            BEGIN
                CREATE TABLE social_auto_posts (
                    id NVARCHAR(100) PRIMARY KEY,
                    product_id NVARCHAR(255) NULL,
                    product_name NVARCHAR(255) NOT NULL,
                    product_price DECIMAL(18,2) NOT NULL DEFAULT 0,
                    product_image NVARCHAR(500) NULL,
                    platform NVARCHAR(50) NOT NULL,
                    title NVARCHAR(500) NOT NULL,
                    content NVARCHAR(MAX) NOT NULL,
                    hashtags NVARCHAR(500) NOT NULL DEFAULT '',
                    status NVARCHAR(50) NOT NULL DEFAULT 'internal_draft',
                    error_message NVARCHAR(MAX) NULL,
                    post_url NVARCHAR(500) NULL,
                    target_group NVARCHAR(255) NULL,
                    trigger_time NVARCHAR(100) NOT NULL,
                    published_time NVARCHAR(100) NULL,
                    likes_count INT NOT NULL DEFAULT 0,
                    shares_count INT NOT NULL DEFAULT 0,
                    comments_count INT NOT NULL DEFAULT 0,
                    views_count INT NOT NULL DEFAULT 0,
                    created_at NVARCHAR(100) NOT NULL
                );
            END;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_auto_posts') AND name = 'privacy')
                ALTER TABLE social_auto_posts ADD privacy NVARCHAR(50) NOT NULL DEFAULT 'only_me';
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'social_group_targets')
            BEGIN
                CREATE TABLE social_group_targets (
                    id NVARCHAR(100) PRIMARY KEY,
                    group_name NVARCHAR(255) NOT NULL,
                    group_url NVARCHAR(500) NOT NULL,
                    category NVARCHAR(100) NOT NULL,
                    members_count INT NOT NULL DEFAULT 0,
                    interaction_rate NVARCHAR(50) NOT NULL DEFAULT 'Cao',
                    status NVARCHAR(50) NOT NULL DEFAULT 'active',
                    is_auto_share BIT NOT NULL DEFAULT 1,
                    notes NVARCHAR(500) NULL,
                    created_at NVARCHAR(100) NOT NULL
                );
            END;

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'social_viral_posts')
            BEGIN
                CREATE TABLE social_viral_posts (
                    id NVARCHAR(100) PRIMARY KEY,
                    title NVARCHAR(500) NOT NULL,
                    platform NVARCHAR(50) NOT NULL,
                    category NVARCHAR(100) NOT NULL,
                    post_url NVARCHAR(500) NOT NULL,
                    summary NVARCHAR(MAX) NOT NULL,
                    virality_score INT NOT NULL DEFAULT 95,
                    likes_count INT NOT NULL DEFAULT 0,
                    shares_count INT NOT NULL DEFAULT 0,
                    comments_count INT NOT NULL DEFAULT 0,
                    trending_topic NVARCHAR(255) NOT NULL,
                    created_at NVARCHAR(100) NOT NULL
                );
            END;
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_viral_posts') AND name = 'thumbnail_url')
                ALTER TABLE social_viral_posts ADD thumbnail_url NVARCHAR(1000) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_viral_posts') AND name = 'author_name')
                ALTER TABLE social_viral_posts ADD author_name NVARCHAR(255) NULL;
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_viral_posts') AND name = 'author_url')
                ALTER TABLE social_viral_posts ADD author_url NVARCHAR(500) NULL;
            """);

        // Làm sạch dữ liệu mẫu hardcode nick cũ nếu còn sót
        ExecuteNonQuery(db, """
            UPDATE social_auto_posts
            SET target_group = N'Trang cá nhân đang đăng nhập'
            WHERE target_group LIKE N'%John Harper%' OR target_group LIKE N'%Hoàng Thái HT%';
            """);
    }

    private static void ExecuteNonQuery(SqlConnection db, string sql)
    {
        using var command = db.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
    }

    // Chấp nhận link bài đăng thật từ BẤT KỲ tài khoản Facebook hoặc TikTok nào đang đăng nhập!
    public static bool IsRealSocialPostPermalink(string platform, string? postUrl)
    {
        if (!Uri.TryCreate(postUrl, UriKind.Absolute, out var uri)) return false;
        var host = uri.Host.ToLowerInvariant();

        if (platform.Equals("facebook", StringComparison.OrdinalIgnoreCase))
        {
            if (host != "facebook.com" && !host.EndsWith(".facebook.com", StringComparison.Ordinal)) return false;
            var path = uri.AbsolutePath.ToLowerInvariant();
            return path.Contains("/posts/") ||
                   path.Contains("/share/") ||
                   path.Contains("/reel/") ||
                   path.Contains("/videos/") ||
                   path.Contains("/photo") ||
                   (path.Contains("permalink.php") && uri.Query.Contains("story_fbid=", StringComparison.OrdinalIgnoreCase)) ||
                   uri.Query.Contains("story_fbid=", StringComparison.OrdinalIgnoreCase) ||
                   uri.Query.Contains("fbid=", StringComparison.OrdinalIgnoreCase) ||
                   uri.Query.Contains("v=", StringComparison.OrdinalIgnoreCase);
        }

        if (platform.Equals("tiktok", StringComparison.OrdinalIgnoreCase))
        {
            if (host != "tiktok.com" && !host.EndsWith(".tiktok.com", StringComparison.Ordinal)) return false;
            return Regex.IsMatch(
                uri.AbsolutePath,
                @"^/@[A-Za-z0-9._-]+/(?:video|photo)/[0-9]+/?$",
                RegexOptions.IgnoreCase);
        }

        return false;
    }

    public SocialCampaignSettings GetSocialSettings()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id, is_active, mode, interval_hours, channels, preferred_category, tone_style, include_hashtags, include_emojis, include_cta, include_hotline, contact_hotline, order_link_template, last_run_at, next_run_at, updated_at, interval_minutes, privacy, interval_seconds FROM social_campaign_settings WHERE id = 1";
        using var reader = command.ExecuteReader();
        if (reader.Read())
        {
            var rawHours = reader.GetInt32(3);
            int minutes = !reader.IsDBNull(16) ? reader.GetInt32(16) : (rawHours > 0 ? rawHours * 60 : 120);
            string privacy = !reader.IsDBNull(17) ? reader.GetString(17) : "only_me";
            int seconds = !reader.IsDBNull(18) ? reader.GetInt32(18) : minutes * 60;

            return new SocialCampaignSettings
            {
                Id = reader.GetInt32(0),
                IsActive = reader.GetBoolean(1),
                Mode = reader.GetString(2),
                IntervalHours = seconds < 3600 ? Math.Round((double)seconds / 3600.0, 4) : (double)minutes / 60.0,
                IntervalMinutes = minutes,
                IntervalSeconds = seconds,
                Privacy = privacy,
                Channels = reader.GetString(4),
                PreferredCategory = reader.GetString(5),
                ToneStyle = reader.GetString(6),
                IncludeHashtags = reader.GetBoolean(7),
                IncludeEmojis = reader.GetBoolean(8),
                IncludeCta = reader.GetBoolean(9),
                IncludeHotline = reader.GetBoolean(10),
                ContactHotline = reader.GetString(11),
                OrderLinkTemplate = reader.GetString(12),
                LastRunAt = reader.IsDBNull(13) ? null : reader.GetString(13),
                NextRunAt = reader.IsDBNull(14) ? null : reader.GetString(14),
                UpdatedAt = reader.GetString(15)
            };
        }

        return new SocialCampaignSettings();
    }

    public SocialCampaignSettings SaveSocialSettings(SocialCampaignSettings settings)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        var now = DateTimeOffset.UtcNow.ToString("o");
        int seconds = settings.IntervalSeconds > 0
            ? settings.IntervalSeconds
            : (settings.IntervalMinutes > 0 ? settings.IntervalMinutes * 60 : (int)Math.Round(settings.IntervalHours * 3600));
        if (seconds <= 0) seconds = 120;

        int minutes = seconds >= 60 ? seconds / 60 : 0;
        int hours = (int)Math.Max(1, Math.Round((double)seconds / 3600.0));

        command.CommandText = """
            UPDATE social_campaign_settings
            SET is_active = @is_active,
                mode = @mode,
                interval_hours = @interval_hours,
                interval_minutes = @interval_minutes,
                interval_seconds = @interval_seconds,
                privacy = @privacy,
                channels = @channels,
                preferred_category = @preferred_category,
                tone_style = @tone_style,
                include_hashtags = @include_hashtags,
                include_emojis = @include_emojis,
                include_cta = @include_cta,
                include_hotline = @include_hotline,
                contact_hotline = @contact_hotline,
                order_link_template = @order_link_template,
                updated_at = @updated_at
            WHERE id = 1;
            """;
        command.Parameters.Add(new SqlParameter("@is_active", SqlDbType.Bit) { Value = settings.IsActive });
        command.Parameters.Add(new SqlParameter("@mode", SqlDbType.NVarChar, 50) { Value = settings.Mode ?? "full_auto" });
        command.Parameters.Add(new SqlParameter("@interval_hours", SqlDbType.Int) { Value = hours });
        command.Parameters.Add(new SqlParameter("@interval_minutes", SqlDbType.Int) { Value = minutes });
        command.Parameters.Add(new SqlParameter("@interval_seconds", SqlDbType.Int) { Value = seconds });
        command.Parameters.Add(new SqlParameter("@privacy", SqlDbType.NVarChar, 50) { Value = settings.Privacy ?? "only_me" });
        command.Parameters.Add(new SqlParameter("@channels", SqlDbType.NVarChar, 255) { Value = settings.Channels ?? "facebook,tiktok" });
        command.Parameters.Add(new SqlParameter("@preferred_category", SqlDbType.NVarChar, 100) { Value = settings.PreferredCategory ?? "all" });
        command.Parameters.Add(new SqlParameter("@tone_style", SqlDbType.NVarChar, 100) { Value = settings.ToneStyle ?? "viral_engaging" });
        command.Parameters.Add(new SqlParameter("@include_hashtags", SqlDbType.Bit) { Value = settings.IncludeHashtags });
        command.Parameters.Add(new SqlParameter("@include_emojis", SqlDbType.Bit) { Value = settings.IncludeEmojis });
        command.Parameters.Add(new SqlParameter("@include_cta", SqlDbType.Bit) { Value = settings.IncludeCta });
        command.Parameters.Add(new SqlParameter("@include_hotline", SqlDbType.Bit) { Value = settings.IncludeHotline });
        command.Parameters.Add(new SqlParameter("@contact_hotline", SqlDbType.NVarChar, 50) { Value = settings.ContactHotline ?? "0901.234.567" });
        command.Parameters.Add(new SqlParameter("@order_link_template", SqlDbType.NVarChar, 255) { Value = settings.OrderLinkTemplate ?? "https://omnicart.vn/products/{id}" });
        command.Parameters.Add(new SqlParameter("@updated_at", SqlDbType.NVarChar, 100) { Value = now });
        command.ExecuteNonQuery();

        return GetSocialSettings();
    }

    public void UpdateSocialScheduleTimestamps(string lastRunAt, string nextRunAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE social_campaign_settings SET last_run_at = @last_run, next_run_at = @next_run WHERE id = 1";
        command.Parameters.Add(new SqlParameter("@last_run", SqlDbType.NVarChar, 100) { Value = lastRunAt });
        command.Parameters.Add(new SqlParameter("@next_run", SqlDbType.NVarChar, 100) { Value = nextRunAt });
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<SocialAutoPost> GetSocialPosts(string? status = null, string? platform = null, int limit = 80)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        var conditions = new List<string>();
        if (!string.IsNullOrWhiteSpace(status) && status != "all")
        {
            conditions.Add("status = @status");
            command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = status.Trim() });
        }
        if (!string.IsNullOrWhiteSpace(platform) && platform != "all")
        {
            conditions.Add("platform = @platform");
            command.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 50) { Value = platform.Trim() });
        }

        var whereClause = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";
        command.CommandText = $"""
            SELECT TOP (@limit) id, product_id, product_name, product_price, product_image, platform,
                   title, content, hashtags, status, error_message, post_url, target_group,
                   trigger_time, published_time, likes_count, shares_count, comments_count, views_count, created_at, privacy
            FROM social_auto_posts
            {whereClause}
            ORDER BY created_at DESC;
            """;
        command.Parameters.Add(new SqlParameter("@limit", SqlDbType.Int) { Value = limit > 0 ? limit : 80 });

        var list = new List<SocialAutoPost>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var platformName = reader.GetString(5);
            var storedStatus = reader.GetString(9);
            var storedPostUrl = reader.IsDBNull(11) ? null : reader.GetString(11);
            var publishedWithoutPermalink = storedStatus == "published" && !IsRealSocialPostPermalink(platformName, storedPostUrl);
            var privacy = !reader.IsDBNull(20) ? reader.GetString(20) : "only_me";

            list.Add(new SocialAutoPost
            {
                Id = reader.GetString(0),
                ProductId = reader.IsDBNull(1) ? null : reader.GetString(1),
                ProductName = reader.GetString(2),
                ProductPrice = reader.GetDecimal(3),
                ProductImage = reader.IsDBNull(4) ? null : reader.GetString(4),
                Platform = platformName,
                Title = reader.GetString(6),
                Content = reader.GetString(7),
                Hashtags = reader.GetString(8),
                Status = publishedWithoutPermalink ? "unverified" : storedStatus,
                ErrorMessage = publishedWithoutPermalink
                    ? "Chưa xác minh được liên kết bài đăng thật."
                    : reader.IsDBNull(10) ? null : reader.GetString(10),
                PostUrl = publishedWithoutPermalink ? null : storedPostUrl,
                TargetGroup = reader.IsDBNull(12) ? null : reader.GetString(12),
                TriggerTime = reader.GetString(13),
                PublishedTime = publishedWithoutPermalink || reader.IsDBNull(14) ? null : reader.GetString(14),
                LikesCount = publishedWithoutPermalink ? 0 : reader.GetInt32(15),
                SharesCount = publishedWithoutPermalink ? 0 : reader.GetInt32(16),
                CommentsCount = publishedWithoutPermalink ? 0 : reader.GetInt32(17),
                ViewsCount = publishedWithoutPermalink ? 0 : reader.GetInt32(18),
                CreatedAt = reader.GetString(19),
                Privacy = privacy
            });
        }
        return list;
    }

    public SocialAutoPost? GetSocialPostById(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            SELECT id, product_id, product_name, product_price, product_image, platform,
                   title, content, hashtags, status, error_message, post_url, target_group,
                   trigger_time, published_time, likes_count, shares_count, comments_count, views_count, created_at, privacy
            FROM social_auto_posts WHERE id = @id;
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;

        return new SocialAutoPost
        {
            Id = reader.GetString(0),
            ProductId = reader.IsDBNull(1) ? null : reader.GetString(1),
            ProductName = reader.GetString(2),
            ProductPrice = reader.GetDecimal(3),
            ProductImage = reader.IsDBNull(4) ? null : reader.GetString(4),
            Platform = reader.GetString(5),
            Title = reader.GetString(6),
            Content = reader.GetString(7),
            Hashtags = reader.GetString(8),
            Status = reader.GetString(9),
            ErrorMessage = reader.IsDBNull(10) ? null : reader.GetString(10),
            PostUrl = reader.IsDBNull(11) ? null : reader.GetString(11),
            TargetGroup = reader.IsDBNull(12) ? null : reader.GetString(12),
            TriggerTime = reader.GetString(13),
            PublishedTime = reader.IsDBNull(14) ? null : reader.GetString(14),
            LikesCount = reader.GetInt32(15),
            SharesCount = reader.GetInt32(16),
            CommentsCount = reader.GetInt32(17),
            ViewsCount = reader.GetInt32(18),
            CreatedAt = reader.GetString(19),
            Privacy = !reader.IsDBNull(20) ? reader.GetString(20) : "only_me"
        };
    }

    public SocialAutoPost CreateSocialPost(SocialAutoPost post)
    {
        if (string.IsNullOrWhiteSpace(post.Id)) post.Id = "post-" + Guid.NewGuid().ToString("N")[..10];
        if (string.IsNullOrWhiteSpace(post.CreatedAt)) post.CreatedAt = DateTimeOffset.UtcNow.ToString("o");
        if (string.IsNullOrWhiteSpace(post.TriggerTime)) post.TriggerTime = post.CreatedAt;

        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO social_auto_posts (
                id, product_id, product_name, product_price, product_image, platform,
                title, content, hashtags, status, error_message, post_url, target_group,
                privacy, trigger_time, published_time, likes_count, shares_count, comments_count, views_count, created_at
            ) VALUES (
                @id, @product_id, @product_name, @product_price, @product_image, @platform,
                @title, @content, @hashtags, @status, @error_message, @post_url, @target_group,
                @privacy, @trigger_time, @published_time, @likes_count, @shares_count, @comments_count, @views_count, @created_at
            );
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = post.Id });
        command.Parameters.Add(new SqlParameter("@product_id", SqlDbType.NVarChar, 255) { Value = (object?)post.ProductId ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@product_name", SqlDbType.NVarChar, 255) { Value = post.ProductName ?? "" });
        command.Parameters.Add(new SqlParameter("@product_price", SqlDbType.Decimal) { Value = post.ProductPrice, Precision = 18, Scale = 2 });
        command.Parameters.Add(new SqlParameter("@product_image", SqlDbType.NVarChar, 500) { Value = (object?)post.ProductImage ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 50) { Value = post.Platform ?? "facebook" });
        command.Parameters.Add(new SqlParameter("@title", SqlDbType.NVarChar, 500) { Value = post.Title ?? "" });
        command.Parameters.Add(new SqlParameter("@content", SqlDbType.NVarChar, -1) { Value = post.Content ?? "" });
        command.Parameters.Add(new SqlParameter("@hashtags", SqlDbType.NVarChar, 500) { Value = post.Hashtags ?? "" });
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = post.Status ?? "internal_draft" });
        command.Parameters.Add(new SqlParameter("@error_message", SqlDbType.NVarChar, -1) { Value = (object?)post.ErrorMessage ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = (object?)post.PostUrl ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@target_group", SqlDbType.NVarChar, 255) { Value = (object?)post.TargetGroup ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@privacy", SqlDbType.NVarChar, 50) { Value = post.Privacy ?? "only_me" });
        command.Parameters.Add(new SqlParameter("@trigger_time", SqlDbType.NVarChar, 100) { Value = post.TriggerTime });
        command.Parameters.Add(new SqlParameter("@published_time", SqlDbType.NVarChar, 100) { Value = (object?)post.PublishedTime ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@likes_count", SqlDbType.Int) { Value = post.LikesCount });
        command.Parameters.Add(new SqlParameter("@shares_count", SqlDbType.Int) { Value = post.SharesCount });
        command.Parameters.Add(new SqlParameter("@comments_count", SqlDbType.Int) { Value = post.CommentsCount });
        command.Parameters.Add(new SqlParameter("@views_count", SqlDbType.Int) { Value = post.ViewsCount });
        command.Parameters.Add(new SqlParameter("@created_at", SqlDbType.NVarChar, 100) { Value = post.CreatedAt });
        command.ExecuteNonQuery();

        return post;
    }

    public bool MarkSocialPostPendingReview(string id, string? privacy, string? message)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            UPDATE social_auto_posts
            SET status = 'pending_review',
                privacy = COALESCE(@privacy, privacy),
                error_message = @msg,
                post_url = NULL
            WHERE id = @id;
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        command.Parameters.Add(new SqlParameter("@privacy", SqlDbType.NVarChar, 50) { Value = (object?)privacy ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@msg", SqlDbType.NVarChar, -1) { Value = (object?)(message ?? "Đang chờ duyệt trên mạng xã hội (3–5 phút)...") ?? DBNull.Value });
        return command.ExecuteNonQuery() > 0;
    }

    public bool MarkSocialPostPublishFailure(string id, string status, string errorMessage, string? postUrl)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            UPDATE social_auto_posts
            SET status = @status,
                error_message = @error_message,
                post_url = @post_url,
                published_time = NULL,
                likes_count = 0,
                shares_count = 0,
                comments_count = 0,
                views_count = 0
            WHERE id = @id AND status <> 'published';
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = status });
        command.Parameters.Add(new SqlParameter("@error_message", SqlDbType.NVarChar, -1) { Value = errorMessage });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = (object?)postUrl ?? DBNull.Value });
        return command.ExecuteNonQuery() > 0;
    }

    public bool DeleteSocialPost(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM social_auto_posts WHERE id = @id";
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        return command.ExecuteNonQuery() > 0;
    }

    public int DeleteAllSocialPosts()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM social_auto_posts";
        return command.ExecuteNonQuery();
    }

    public IReadOnlyList<SocialGroupTarget> GetSocialGroupTargets(string? category = null)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
        {
            command.CommandText = "SELECT id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at FROM social_group_targets WHERE category = @cat ORDER BY members_count DESC, created_at DESC";
            command.Parameters.Add(new SqlParameter("@cat", SqlDbType.NVarChar, 100) { Value = category.Trim() });
        }
        else
        {
            command.CommandText = "SELECT id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at FROM social_group_targets ORDER BY members_count DESC, created_at DESC";
        }

        var list = new List<SocialGroupTarget>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new SocialGroupTarget
            {
                Id = reader.GetString(0),
                GroupName = reader.GetString(1),
                GroupUrl = reader.GetString(2),
                Category = reader.GetString(3),
                MembersCount = reader.GetInt32(4),
                InteractionRate = reader.GetString(5),
                Status = reader.GetString(6),
                IsAutoShare = reader.GetBoolean(7),
                Notes = reader.IsDBNull(8) ? null : reader.GetString(8),
                CreatedAt = reader.GetString(9)
            });
        }
        return list;
    }

    public SocialGroupTarget AddSocialGroupTarget(SocialGroupTarget group)
    {
        if (string.IsNullOrWhiteSpace(group.Id)) group.Id = "grp-" + Guid.NewGuid().ToString("N")[..8];
        if (string.IsNullOrWhiteSpace(group.CreatedAt)) group.CreatedAt = DateTimeOffset.UtcNow.ToString("o");

        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO social_group_targets (
                id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at
            ) VALUES (
                @id, @group_name, @group_url, @category, @members_count, @interaction_rate, @status, @is_auto_share, @notes, @created_at
            );
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = group.Id });
        command.Parameters.Add(new SqlParameter("@group_name", SqlDbType.NVarChar, 255) { Value = group.GroupName });
        command.Parameters.Add(new SqlParameter("@group_url", SqlDbType.NVarChar, 500) { Value = group.GroupUrl });
        command.Parameters.Add(new SqlParameter("@category", SqlDbType.NVarChar, 100) { Value = group.Category ?? "Cộng đồng Facebook" });
        command.Parameters.Add(new SqlParameter("@members_count", SqlDbType.Int) { Value = group.MembersCount });
        command.Parameters.Add(new SqlParameter("@interaction_rate", SqlDbType.NVarChar, 50) { Value = group.InteractionRate ?? "Cao" });
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = group.Status ?? "active" });
        command.Parameters.Add(new SqlParameter("@is_auto_share", SqlDbType.Bit) { Value = group.IsAutoShare });
        command.Parameters.Add(new SqlParameter("@notes", SqlDbType.NVarChar, 500) { Value = (object?)group.Notes ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@created_at", SqlDbType.NVarChar, 100) { Value = group.CreatedAt });
        command.ExecuteNonQuery();

        return group;
    }

    public int ImportRealGroupTargets(IEnumerable<SocialGroupTarget> groups)
    {
        var existing = GetSocialGroupTargets();
        var existingByUrl = new Dictionary<string, SocialGroupTarget>(StringComparer.OrdinalIgnoreCase);
        var existingNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var g in existing)
        {
            var urlKey = g.GroupUrl.Trim().TrimEnd('/').ToLowerInvariant();
            existingByUrl[urlKey] = g;
            existingNames.Add(g.GroupName.Trim().ToLowerInvariant());
        }

        int added = 0;
        using var db = Open();
        foreach (var group in groups)
        {
            if (string.IsNullOrWhiteSpace(group.GroupName) || string.IsNullOrWhiteSpace(group.GroupUrl)) continue;
            var urlKey = group.GroupUrl.Trim().TrimEnd('/').ToLowerInvariant();
            var nameKey = group.GroupName.Trim().ToLowerInvariant();

            if (existingByUrl.TryGetValue(urlKey, out var old))
            {
                // Nếu nhóm cũ từng bị lưu lỗi 0 thành viên -> cập nhật lại số thành viên thật!
                if (old.MembersCount == 0 && group.MembersCount > 0)
                {
                    using var upd = db.CreateCommand();
                    upd.CommandText = "UPDATE social_group_targets SET members_count = @m, interaction_rate = @r WHERE id = @id";
                    upd.Parameters.Add(new SqlParameter("@m", SqlDbType.Int) { Value = group.MembersCount });
                    upd.Parameters.Add(new SqlParameter("@r", SqlDbType.NVarChar, 50) { Value = group.InteractionRate ?? "Cao" });
                    upd.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = old.Id });
                    upd.ExecuteNonQuery();
                }
                continue;
            }

            if (existingNames.Contains(nameKey)) continue;

            AddSocialGroupTarget(group);
            existingByUrl[urlKey] = group;
            existingNames.Add(nameKey);
            added++;
        }
        return added;
    }

    public bool DeleteSocialGroupTarget(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM social_group_targets WHERE id = @id";
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        return command.ExecuteNonQuery() > 0;
    }

    public bool ToggleSocialGroupAutoShare(string id, bool isAutoShare)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE social_group_targets SET is_auto_share = @share WHERE id = @id";
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        command.Parameters.Add(new SqlParameter("@share", SqlDbType.Bit) { Value = isAutoShare });
        return command.ExecuteNonQuery() > 0;
    }

    public IReadOnlyList<SocialViralPost> GetSocialViralPosts(string? category = null)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
        {
            command.CommandText = "SELECT id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at, thumbnail_url, author_name, author_url FROM social_viral_posts WHERE category = @cat ORDER BY likes_count DESC, created_at DESC";
            command.Parameters.Add(new SqlParameter("@cat", SqlDbType.NVarChar, 100) { Value = category.Trim() });
        }
        else
        {
            command.CommandText = "SELECT id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at, thumbnail_url, author_name, author_url FROM social_viral_posts ORDER BY likes_count DESC, created_at DESC";
        }

        var list = new List<SocialViralPost>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new SocialViralPost
            {
                Id = reader.GetString(0),
                Title = reader.GetString(1),
                Platform = reader.GetString(2),
                Category = reader.GetString(3),
                PostUrl = reader.GetString(4),
                Summary = reader.GetString(5),
                ViralityScore = reader.GetInt32(6),
                LikesCount = reader.GetInt32(7),
                SharesCount = reader.GetInt32(8),
                CommentsCount = reader.GetInt32(9),
                TrendingTopic = reader.GetString(10),
                CreatedAt = reader.GetString(11),
                ThumbnailUrl = reader.IsDBNull(12) ? null : reader.GetString(12),
                AuthorName = reader.IsDBNull(13) ? null : reader.GetString(13),
                AuthorUrl = reader.IsDBNull(14) ? null : reader.GetString(14)
            });
        }
        return list;
    }

    public SocialViralPost AddSocialViralPost(SocialViralPost viral)
    {
        if (string.IsNullOrWhiteSpace(viral.Id)) viral.Id = "viral-" + Guid.NewGuid().ToString("N")[..8];
        if (string.IsNullOrWhiteSpace(viral.CreatedAt)) viral.CreatedAt = DateTimeOffset.UtcNow.ToString("o");

        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO social_viral_posts (
                id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, thumbnail_url, author_name, author_url, created_at
            ) VALUES (
                @id, @title, @platform, @category, @post_url, @summary, @virality_score, @likes_count, @shares_count, @comments_count, @trending_topic, @thumbnail_url, @author_name, @author_url, @created_at
            );
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = viral.Id });
        command.Parameters.Add(new SqlParameter("@title", SqlDbType.NVarChar, 500) { Value = viral.Title });
        command.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 50) { Value = viral.Platform });
        command.Parameters.Add(new SqlParameter("@category", SqlDbType.NVarChar, 100) { Value = viral.Category ?? "Xu hướng thực tế" });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = viral.PostUrl });
        command.Parameters.Add(new SqlParameter("@summary", SqlDbType.NVarChar, -1) { Value = viral.Summary ?? "" });
        command.Parameters.Add(new SqlParameter("@virality_score", SqlDbType.Int) { Value = viral.ViralityScore });
        command.Parameters.Add(new SqlParameter("@likes_count", SqlDbType.Int) { Value = viral.LikesCount });
        command.Parameters.Add(new SqlParameter("@shares_count", SqlDbType.Int) { Value = viral.SharesCount });
        command.Parameters.Add(new SqlParameter("@comments_count", SqlDbType.Int) { Value = viral.CommentsCount });
        command.Parameters.Add(new SqlParameter("@trending_topic", SqlDbType.NVarChar, 255) { Value = viral.TrendingTopic ?? "Viral thực tế" });
        command.Parameters.Add(new SqlParameter("@thumbnail_url", SqlDbType.NVarChar, 1000) { Value = (object?)viral.ThumbnailUrl ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@author_name", SqlDbType.NVarChar, 255) { Value = (object?)viral.AuthorName ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@author_url", SqlDbType.NVarChar, 500) { Value = (object?)viral.AuthorUrl ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@created_at", SqlDbType.NVarChar, 100) { Value = viral.CreatedAt });
        command.ExecuteNonQuery();

        return viral;
    }

    public bool PublishRealSocialPost(string postId, string postUrl, string? publishedTime, string? platform, string privacy, int likes = 0, int shares = 0, int comments = 0)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        var now = string.IsNullOrWhiteSpace(publishedTime) ? DateTimeOffset.UtcNow.ToString("o") : publishedTime;
        command.CommandText = """
            UPDATE social_auto_posts
            SET status = 'published',
                post_url = @post_url,
                published_time = @published_time,
                platform = COALESCE(@platform, platform),
                privacy = @privacy,
                likes_count = @likes_count,
                shares_count = @shares_count,
                comments_count = @comments_count,
                error_message = NULL
            WHERE id = @id;
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = postId });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = postUrl });
        command.Parameters.Add(new SqlParameter("@published_time", SqlDbType.NVarChar, 100) { Value = now });
        command.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 50) { Value = (object?)platform ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@privacy", SqlDbType.NVarChar, 50) { Value = privacy });
        command.Parameters.Add(new SqlParameter("@likes_count", SqlDbType.Int) { Value = likes });
        command.Parameters.Add(new SqlParameter("@shares_count", SqlDbType.Int) { Value = shares });
        command.Parameters.Add(new SqlParameter("@comments_count", SqlDbType.Int) { Value = comments });
        return command.ExecuteNonQuery() > 0;
    }

    public int ImportRealViralPosts(IEnumerable<SocialViralPost> posts)
    {
        var existingUrls = new HashSet<string>(
            GetSocialViralPosts().Select(p => p.PostUrl.Trim().TrimEnd('/').ToLowerInvariant()),
            StringComparer.OrdinalIgnoreCase);

        int count = 0;
        foreach (var post in posts)
        {
            if (string.IsNullOrWhiteSpace(post.Title) || string.IsNullOrWhiteSpace(post.PostUrl)) continue;
            var key = post.PostUrl.Trim().TrimEnd('/').ToLowerInvariant();
            if (existingUrls.Contains(key)) continue;

            AddSocialViralPost(post);
            existingUrls.Add(key);
            count++;
        }
        return count;
    }

    public bool DeleteSocialViralPost(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM social_viral_posts WHERE id = @id";
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        return command.ExecuteNonQuery() > 0;
    }

    public int DeleteAllSocialViralPosts()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM social_viral_posts";
        return command.ExecuteNonQuery();
    }

    public SocialSummaryStats GetSocialSummaryStats()
    {
        var settings = GetSocialSettings();
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            WITH social_posts AS (
                SELECT *, CASE
                    WHEN status = 'published' AND platform = 'facebook' AND (
                        post_url LIKE '%facebook.com%/posts/%' OR
                        post_url LIKE '%facebook.com%/share/%' OR
                        post_url LIKE '%facebook.com%/reel/%' OR
                        post_url LIKE '%facebook.com%/videos/%' OR
                        post_url LIKE '%facebook.com%/photo%' OR
                        post_url LIKE '%facebook.com%story_fbid=%' OR
                        post_url LIKE '%facebook.com%fbid=%'
                    ) THEN 1
                    WHEN status = 'published' AND platform = 'tiktok' AND (
                        post_url LIKE '%tiktok.com/@%/video/%' OR
                        post_url LIKE '%tiktok.com/@%/photo/%'
                    ) THEN 1
                    ELSE 0
                END AS is_verified_published
                FROM social_auto_posts
            )
            SELECT
                COUNT(*) as total_posts,
                COALESCE(SUM(is_verified_published), 0) as published_count,
                COALESCE(SUM(CASE WHEN status IN ('pending_approval', 'pending_review', 'ready_for_publish', 'ready_for_api') THEN 1 ELSE 0 END), 0) as pending_count,
                COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_count,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN likes_count ELSE 0 END), 0) as total_likes,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN shares_count ELSE 0 END), 0) as total_shares,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN comments_count ELSE 0 END), 0) as total_comments,
                COALESCE(SUM(CASE WHEN status = 'internal_draft' THEN 1 ELSE 0 END), 0) as draft_count
            FROM social_posts;
            """;
        using var reader = command.ExecuteReader();
        var stats = new SocialSummaryStats
        {
            IsActive = settings.IsActive,
            IntervalHours = settings.IntervalHours,
            IntervalMinutes = settings.IntervalMinutes,
            IntervalSeconds = settings.IntervalSeconds,
            Privacy = settings.Privacy,
            Mode = settings.Mode,
            LastRunAt = settings.LastRunAt,
            NextRunAt = settings.NextRunAt
        };

        if (reader.Read())
        {
            stats.TotalPostsToday = reader.IsDBNull(0) ? 0 : reader.GetInt32(0);
            stats.PublishedCount = reader.IsDBNull(1) ? 0 : reader.GetInt32(1);
            stats.PendingCount = reader.IsDBNull(2) ? 0 : reader.GetInt32(2);
            stats.FailedCount = reader.IsDBNull(3) ? 0 : reader.GetInt32(3);
            stats.TotalLikes = reader.IsDBNull(4) ? 0 : reader.GetInt32(4);
            stats.TotalShares = reader.IsDBNull(5) ? 0 : reader.GetInt32(5);
            stats.TotalComments = reader.IsDBNull(6) ? 0 : reader.GetInt32(6);
            stats.DraftCount = reader.IsDBNull(7) ? 0 : reader.GetInt32(7);
        }

        return stats;
    }

    public (string Id, string Name, decimal Price, string Image, string Category, string Description)? GetCatalogProductForPromotion(string? preferredCategory = null, string? specificId = null)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        if (!string.IsNullOrWhiteSpace(specificId))
        {
            command.CommandText = "SELECT TOP 1 id, name, price, image, category, description FROM catalog_products WHERE id = @id";
            command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 255) { Value = specificId.Trim() });
        }
        else if (!string.IsNullOrWhiteSpace(preferredCategory) && preferredCategory != "all")
        {
            command.CommandText = "SELECT TOP 1 id, name, price, image, category, description FROM catalog_products WHERE category = @cat ORDER BY NEWID()";
            command.Parameters.Add(new SqlParameter("@cat", SqlDbType.NVarChar, 255) { Value = preferredCategory.Trim() });
        }
        else
        {
            command.CommandText = "SELECT TOP 1 id, name, price, image, category, description FROM catalog_products ORDER BY NEWID()";
        }

        try
        {
            using var reader = command.ExecuteReader();
            if (reader.Read())
            {
                return (
                    reader.GetString(0),
                    reader.GetString(1),
                    Convert.ToDecimal(reader.GetValue(2)),
                    reader.IsDBNull(3) ? "/products/headphones.svg" : reader.GetString(3),
                    reader.IsDBNull(4) ? "Công nghệ" : reader.GetString(4),
                    reader.IsDBNull(5) ? "" : reader.GetString(5)
                );
            }
        }
        catch { }

        return ("1", "Tai nghe Bluetooth Chống Ồn OmiPro", 890000m, "/products/headphones.svg", "Công nghệ", "Tai nghe chống ồn chủ động cao cấp mang lại trải nghiệm âm thanh tuyệt hảo.");
    }
}
