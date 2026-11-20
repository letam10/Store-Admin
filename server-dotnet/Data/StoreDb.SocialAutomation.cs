/*
  FILE NOTE
  - Mục đích: Cung cấp các phương thức truy cập dữ liệu SQL Server cho hệ thống Tự động hóa đăng bài Mạng Xã Hội (cài đặt chu kỳ, quyền riêng tư dùng chung, Facebook Hoàng Thái HT, TikTok @harutv666, lưu trạng thái đăng bài đã xác nhận).
  - Liên kết trực tiếp: Store-Admin/server-dotnet/Data/StoreDb.cs, Store-Admin/server-dotnet/Models/SocialAutomationModels.cs, Store-Admin/server-dotnet/Controllers/AdminSocialController.cs, Store-Admin/server-dotnet/Services/SocialAutoPostWorker.cs
  - Vùng ảnh hưởng khi sửa: Tầng lưu trữ dữ liệu chiến dịch MXH, bảng audit logs đăng bài, nhóm Facebook mục tiêu và bảng theo dõi bài hot.
*/

using System.Data;
using Microsoft.Data.SqlClient;
using StoreApi.Models;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public void EnsureSocialAutomationTables()
    {
        using var db = Open();

        // 1. Tạo bảng social_campaign_settings nếu chưa tồn tại
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

        // 2. Thêm cột interval_minutes, interval_seconds và privacy vào social_campaign_settings nếu bảng đã tồn tại từ trước
        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'interval_minutes')
            BEGIN
                ALTER TABLE social_campaign_settings ADD interval_minutes INT NOT NULL DEFAULT 120;
            END;
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'interval_seconds')
            BEGIN
                ALTER TABLE social_campaign_settings ADD interval_seconds INT NOT NULL DEFAULT 30;
            END;
            """);

        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_campaign_settings') AND name = 'privacy')
            BEGIN
                ALTER TABLE social_campaign_settings ADD privacy NVARCHAR(50) NOT NULL DEFAULT 'only_me';
            END;
            """);

        // 3. Khởi tạo bản ghi cài đặt mặc định nếu chưa có
        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT 1 FROM social_campaign_settings WHERE id = 1)
            BEGIN
                INSERT INTO social_campaign_settings (
                    id, is_active, mode, interval_hours, interval_minutes, privacy, channels, preferred_category, tone_style,
                    include_hashtags, include_emojis, include_cta, include_hotline,
                    contact_hotline, order_link_template, last_run_at, next_run_at, updated_at
                ) VALUES (
                    1, 1, 'full_auto', 2, 120, 'only_me', 'facebook,tiktok', 'all', 'viral_engaging',
                    1, 1, 1, 1,
                    '0901.234.567', 'https://omnicart.vn/products/{id}',
                    CONVERT(NVARCHAR(30), DATEADD(HOUR, -2, GETUTCDATE()), 126),
                    CONVERT(NVARCHAR(30), DATEADD(HOUR, 2, GETUTCDATE()), 126),
                    CONVERT(NVARCHAR(30), GETUTCDATE(), 126)
                );
            END;
            """);

        // 4. Tạo bảng social_auto_posts nếu chưa tồn tại
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
            """);

        // 5. Thêm cột privacy vào social_auto_posts nếu chưa có
        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('social_auto_posts') AND name = 'privacy')
            BEGIN
                ALTER TABLE social_auto_posts ADD privacy NVARCHAR(50) NOT NULL DEFAULT 'only_me';
            END;
            """);

        // 6. Tạo bảng nhóm và bài viết viral nếu chưa có
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
            """);

        ExecuteNonQuery(db, """
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

        // 7. Xóa bỏ dứt điểm số liệu mock ảo, gỡ hội nhóm fake và bài viral giả mạo (an toàn sau khi các bảng đã tạo)
        ExecuteNonQuery(db, """
            -- Xóa các bài demo cũ và bài có liên kết giả mạo
            DELETE FROM social_auto_posts
            WHERE id IN ('post-demo-01', 'post-demo-02') 
               OR post_url LIKE '%omnicart.vietnam%' 
               OR post_url LIKE '%@omnicart.vn%';

            -- Reset toàn bộ tương tác ảo về 0 cho bài nháp/chờ duyệt
            UPDATE social_auto_posts
            SET likes_count = 0, shares_count = 0, comments_count = 0, views_count = 0, post_url = NULL
            WHERE status IN ('internal_draft', 'pending_approval', 'ready_for_api');

            -- Xóa các hội nhóm Facebook giả mạo với link 404 và số thành viên ảo
            DELETE FROM social_group_targets
            WHERE group_url LIKE '%nghiennha%' 
               OR group_url LIKE '%sandeal%' 
               OR group_url LIKE '%genz%' 
               OR group_url LIKE '%meovat%' 
               OR members_count > 10000;

            -- Cập nhật hoặc chuẩn hóa nhóm mẫu sang tài khoản Facebook Hoàng Thái HT
            UPDATE social_group_targets
            SET group_name = N'Trang cá nhân Facebook Hoàng Thái HT',
                group_url = 'https://www.facebook.com/profile.php?id=100037782653708',
                category = N'Trang cá nhân',
                notes = N'Trang cá nhân Facebook chính thức của quản trị viên'
            WHERE group_url LIKE '%facebook.com/groups/%' OR id LIKE 'grp-sample-%';

            -- Chuẩn hóa bài viral TikTok về kênh chính thức @harutv666
            UPDATE social_viral_posts
            SET post_url = 'https://www.tiktok.com/@harutv666'
            WHERE platform = 'tiktok' AND (post_url LIKE '%@omnicart.vietnam%' OR post_url = 'https://www.tiktok.com/' OR post_url IS NULL);
            """);

        // 8. Khởi tạo mẫu trung thực khi bảng trống (số liệu tương tác 0 trung thực)
        ExecuteNonQuery(db, """
            IF NOT EXISTS (SELECT 1 FROM social_group_targets)
            BEGIN
                INSERT INTO social_group_targets (
                    id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at
                ) VALUES
                ('grp-sample-01', N'Trang cá nhân Facebook Hoàng Thái HT', 'https://www.facebook.com/profile.php?id=100037782653708', N'Trang cá nhân', 0, N'Rất cao', 'active', 1, N'Trang cá nhân Facebook kết nối đăng bài', CONVERT(NVARCHAR(30), GETUTCDATE(), 126)),
                ('grp-sample-02', N'Cộng Đồng Mua Sắm Tiện Ích & Săn Deal Hời', 'https://www.facebook.com/profile.php?id=100037782653708', N'Khuyến mãi & Mua sắm', 0, N'Bình thường', 'active', 1, N'Kênh mục tiêu chia sẻ bài đăng ưu đãi sản phẩm', CONVERT(NVARCHAR(30), GETUTCDATE(), 126));
            END;

            IF NOT EXISTS (SELECT 1 FROM social_viral_posts)
            BEGIN
                INSERT INTO social_viral_posts (
                    id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at
                ) VALUES
                ('viral-ref-01', N'Mẹo sắp xếp đồ dùng gia đình gọn gàng trong 15 phút', 'facebook', N'Đồ gia dụng', 'https://www.facebook.com/profile.php?id=100037782653708', N'Mẫu ý tưởng nội dung hữu ích gắn liền với đời sống hàng ngày.', 85, 0, 0, 0, N'Lối sống tiện lợi', CONVERT(NVARCHAR(30), GETUTCDATE(), 126)),
                ('viral-ref-02', N'Đập hộp và trải nghiệm nhanh phụ kiện công nghệ tiện ích', 'tiktok', N'Công nghệ', 'https://www.tiktok.com/@harutv666', N'Mẫu kịch bản video ngắn review công năng thực tế.', 80, 0, 0, 0, N'Review chân thật', CONVERT(NVARCHAR(30), GETUTCDATE(), 126));
            END;
            """);
    }

    private static void ExecuteNonQuery(SqlConnection db, string sql)
    {
        using var command = db.CreateCommand();
        command.CommandText = sql;
        command.ExecuteNonQuery();
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
            int minutes = 120;
            try
            {
                if (!reader.IsDBNull(16)) minutes = reader.GetInt32(16);
                else minutes = rawHours > 0 ? rawHours * 60 : 120;
            }
            catch
            {
                minutes = rawHours > 0 ? rawHours * 60 : 120;
            }

            string privacy = "only_me";
            try
            {
                if (!reader.IsDBNull(17)) privacy = reader.GetString(17);
            }
            catch { }

            int seconds = 120 * 60;
            try
            {
                if (!reader.IsDBNull(18)) seconds = reader.GetInt32(18);
                else seconds = minutes * 60;
            }
            catch
            {
                seconds = minutes * 60;
            }

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
        if (seconds <= 0) seconds = 30;

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

    public IReadOnlyList<SocialAutoPost> GetSocialPosts(string? status = null, string? platform = null, int limit = 60)
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
        command.Parameters.Add(new SqlParameter("@limit", SqlDbType.Int) { Value = limit > 0 ? limit : 60 });

        var list = new List<SocialAutoPost>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var platformName = reader.GetString(5);
            var storedStatus = reader.GetString(9);
            var storedPostUrl = reader.IsDBNull(11) ? null : reader.GetString(11);
            var publishedWithoutPermalink = storedStatus == "published" && !IsRealSocialPostPermalink(platformName, storedPostUrl);
            string privacy = "only_me";
            try
            {
                if (!reader.IsDBNull(20)) privacy = reader.GetString(20);
            }
            catch { }

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
                    ? "Chưa xác minh được liên kết bài đăng thật; không tính vào số bài đã đăng hoặc tương tác."
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

    private static bool IsRealSocialPostPermalink(string platform, string? postUrl)
    {
        if (!Uri.TryCreate(postUrl, UriKind.Absolute, out var uri)) return false;

        var host = uri.Host.ToLowerInvariant();
        if (platform.Equals("facebook", StringComparison.OrdinalIgnoreCase))
        {
            if (host != "facebook.com" && !host.EndsWith(".facebook.com", StringComparison.Ordinal)) return false;
            var path = uri.AbsolutePath.ToLowerInvariant();
            return path.Contains("/posts/") || path.Contains("/share/p/") ||
                   (path.Contains("permalink.php") && uri.Query.Contains("story_fbid=", StringComparison.OrdinalIgnoreCase)) ||
                   uri.Query.Contains("story_fbid=", StringComparison.OrdinalIgnoreCase) ||
                   uri.Query.Contains("fbid=", StringComparison.OrdinalIgnoreCase);
        }

        if (platform.Equals("tiktok", StringComparison.OrdinalIgnoreCase))
        {
            if (host != "tiktok.com" && !host.EndsWith(".tiktok.com", StringComparison.Ordinal)) return false;
            return System.Text.RegularExpressions.Regex.IsMatch(
                uri.AbsolutePath,
                @"^/@harutv666/(?:video|photo)/[0-9]+/?$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }

        return false;
    }

    public SocialAutoPost? GetSocialPostById(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            SELECT id, product_id, product_name, product_price, product_image, platform,
                   title, content, hashtags, status, error_message, post_url, target_group,
                   trigger_time, published_time, likes_count, shares_count, comments_count, views_count, created_at, privacy
            FROM social_auto_posts
            WHERE id = @id;
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        using var reader = command.ExecuteReader();
        if (reader.Read())
        {
            string privacy = "only_me";
            try
            {
                if (!reader.IsDBNull(20)) privacy = reader.GetString(20);
            }
            catch { }

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
                Privacy = privacy
            };
        }
        return null;
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

    public bool UpdateSocialPostStatus(string id, string status, string? errorMessage = null, string? postUrl = null)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        var now = DateTimeOffset.UtcNow.ToString("o");
        command.CommandText = """
            UPDATE social_auto_posts
            SET status = @status,
                error_message = @error_message,
                post_url = COALESCE(@post_url, post_url),
                published_time = CASE WHEN @status = 'published' AND published_time IS NULL THEN @now ELSE published_time END
            WHERE id = @id;
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = id });
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = status });
        command.Parameters.Add(new SqlParameter("@error_message", SqlDbType.NVarChar, -1) { Value = (object?)errorMessage ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = (object?)postUrl ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@now", SqlDbType.NVarChar, 100) { Value = now });
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

    public IReadOnlyList<SocialGroupTarget> GetSocialGroupTargets(string? category = null)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        if (!string.IsNullOrWhiteSpace(category) && category != "all")
        {
            command.CommandText = "SELECT id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at FROM social_group_targets WHERE category = @cat ORDER BY members_count DESC";
            command.Parameters.Add(new SqlParameter("@cat", SqlDbType.NVarChar, 100) { Value = category.Trim() });
        }
        else
        {
            command.CommandText = "SELECT id, group_name, group_url, category, members_count, interaction_rate, status, is_auto_share, notes, created_at FROM social_group_targets ORDER BY members_count DESC";
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
        command.Parameters.Add(new SqlParameter("@category", SqlDbType.NVarChar, 100) { Value = group.Category });
        command.Parameters.Add(new SqlParameter("@members_count", SqlDbType.Int) { Value = group.MembersCount });
        command.Parameters.Add(new SqlParameter("@interaction_rate", SqlDbType.NVarChar, 50) { Value = group.InteractionRate ?? "Cao" });
        command.Parameters.Add(new SqlParameter("@status", SqlDbType.NVarChar, 50) { Value = group.Status ?? "active" });
        command.Parameters.Add(new SqlParameter("@is_auto_share", SqlDbType.Bit) { Value = group.IsAutoShare });
        command.Parameters.Add(new SqlParameter("@notes", SqlDbType.NVarChar, 500) { Value = (object?)group.Notes ?? DBNull.Value });
        command.Parameters.Add(new SqlParameter("@created_at", SqlDbType.NVarChar, 100) { Value = group.CreatedAt });
        command.ExecuteNonQuery();

        return group;
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
            command.CommandText = "SELECT id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at FROM social_viral_posts WHERE category = @cat ORDER BY virality_score DESC";
            command.Parameters.Add(new SqlParameter("@cat", SqlDbType.NVarChar, 100) { Value = category.Trim() });
        }
        else
        {
            command.CommandText = "SELECT id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at FROM social_viral_posts ORDER BY virality_score DESC";
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
                CreatedAt = reader.GetString(11)
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
                id, title, platform, category, post_url, summary, virality_score, likes_count, shares_count, comments_count, trending_topic, created_at
            ) VALUES (
                @id, @title, @platform, @category, @post_url, @summary, @virality_score, @likes_count, @shares_count, @comments_count, @trending_topic, @created_at
            );
            """;
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.NVarChar, 100) { Value = viral.Id });
        command.Parameters.Add(new SqlParameter("@title", SqlDbType.NVarChar, 500) { Value = viral.Title });
        command.Parameters.Add(new SqlParameter("@platform", SqlDbType.NVarChar, 50) { Value = viral.Platform });
        command.Parameters.Add(new SqlParameter("@category", SqlDbType.NVarChar, 100) { Value = viral.Category });
        command.Parameters.Add(new SqlParameter("@post_url", SqlDbType.NVarChar, 500) { Value = viral.PostUrl });
        command.Parameters.Add(new SqlParameter("@summary", SqlDbType.NVarChar, -1) { Value = viral.Summary });
        command.Parameters.Add(new SqlParameter("@virality_score", SqlDbType.Int) { Value = viral.ViralityScore });
        command.Parameters.Add(new SqlParameter("@likes_count", SqlDbType.Int) { Value = viral.LikesCount });
        command.Parameters.Add(new SqlParameter("@shares_count", SqlDbType.Int) { Value = viral.SharesCount });
        command.Parameters.Add(new SqlParameter("@comments_count", SqlDbType.Int) { Value = viral.CommentsCount });
        command.Parameters.Add(new SqlParameter("@trending_topic", SqlDbType.NVarChar, 255) { Value = viral.TrendingTopic });
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
        int count = 0;
        foreach (var post in posts)
        {
            if (string.IsNullOrWhiteSpace(post.Title) || string.IsNullOrWhiteSpace(post.PostUrl)) continue;
            AddSocialViralPost(post);
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

    public IReadOnlyList<SocialViralPost> FetchMoreRealisticViralPosts(int count = 5)
    {
        if (count <= 0) count = 5;

        // 1. Lấy danh sách sản phẩm thực tế từ kho catalog_products
        var catalogItems = new List<(string Name, string Category, string Description)>();
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = "SELECT TOP 10 name, category, description FROM catalog_products ORDER BY NEWID()";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                var name = reader.GetString(0);
                var cat = reader.GetString(1);
                var desc = reader.IsDBNull(2) ? "" : reader.GetString(2);
                catalogItems.Add((name, cat, desc));
            }
        }
        catch
        {
            // Catalog fallback nếu bảng tạm thời bận hoặc rỗng
        }

        if (catalogItems.Count == 0)
        {
            catalogItems.Add(("Tai nghe Bluetooth Chống Ồn OmiPro", "Công nghệ", "Tai nghe chống ồn chủ động cao cấp âm thanh vòm sống động"));
            catalogItems.Add(("Bình giữ nhiệt thông minh hiển thị LED", "Đồ gia dụng", "Giữ nhiệt 24h ruột inox 316 an toàn tuyệt đối"));
            catalogItems.Add(("Túi vải Canvas phong cách tối giản EcoBag", "Thời trang", "Chất vải canvas mộc cao cấp thân thiện môi trường"));
            catalogItems.Add(("Đèn ngủ để bàn cảm ứng 3 màu ánh sáng", "Đồ gia dụng", "Ánh sáng dịu mắt chống mỏi điều khiển chạm thông minh"));
            catalogItems.Add(("Bàn phím cơ không dây công thái học", "Công nghệ", "Gõ êm ái kết nối đa thiết bị pin dùng cả tháng"));
            catalogItems.Add(("Máy tạo ẩm xông tinh dầu sóng siêu âm", "Đồ gia dụng", "Khuếch tán sương mịn tạo ẩm bù ẩm phòng điều hòa"));
        }

        var templates = new (string Angle, string Platform, string Topic, Func<string, string> TitleGen, Func<string, string, string> SummaryGen)[]
        {
            (
                "Review Thật",
                "facebook",
                "Review trải nghiệm thật",
                name => $"[Review Thật 100%] Sau 30 ngày dùng {name}: Có thực sự thần thánh như lời đồn? ⭐",
                (name, desc) => $"Phân tích chuyên sâu về công năng thực tế, độ bền và cảm nhận sử dụng {name} trong sinh hoạt thường nhật. {desc}"
            ),
            (
                "Mẹo Hay Video Ngắn",
                "tiktok",
                "Mẹo sống thông minh",
                name => $"Tip biến cuộc sống nhẹ tênh mỗi ngày cùng {name} siêu tiện lợi 🎬✨",
                (name, desc) => $"Kịch bản video ngắn hướng dẫn mẹo tận dụng công năng của {name} giúp tiết kiệm tối đa thời gian. {desc}"
            ),
            (
                "Góc So Sánh",
                "facebook",
                "Tiêu dùng thông minh",
                name => $"Đặt lên bàn cân: Vì sao {name} liên tục đứng top bảng xếp hạng bán chạy? 🤔",
                (name, desc) => $"So sánh khách quan chất lượng, giá thành và tiện ích vượt trội của {name} so với các lựa chọn khác trên thị trường."
            ),
            (
                "Phong Cách Sống",
                "facebook",
                "Không gian sống & Decor",
                name => $"Nâng tầm thẩm mỹ không gian sống mỗi ngày với điểm nhấn từ {name} 🌿🏠",
                (name, desc) => $"Bộ ảnh phối cảnh thực tế và phong cách sống hiện đại cùng {name}, nhận bão tương tác tích cực từ cộng đồng."
            ),
            (
                "Top Xu Hướng",
                "tiktok",
                "Top thịnh hành 2026",
                name => $"Cơn sốt {name} đợt này: Lý do cháy hàng liên tục khiến ai cũng muốn sở hữu! 🔥",
                (name, desc) => $"Tổng hợp phản hồi bùng nổ của khách hàng và kỷ lục đơn đặt trước cho sản phẩm {name} tại OmniCart."
            )
        };

        var rng = Random.Shared;
        var newPosts = new List<SocialViralPost>();
        var now = DateTimeOffset.UtcNow;

        for (int i = 0; i < count; i++)
        {
            var product = catalogItems[rng.Next(catalogItems.Count)];
            var tpl = templates[i % templates.Length];

            // Số liệu khởi tạo trung thực bắt đầu từ 0 (không tạo số ảo gây sai lệch báo cáo)
            var likes = 0;
            var shares = 0;
            var comments = 0;
            var score = 88;

            var postUrl = tpl.Platform == "facebook"
                ? "https://www.facebook.com/profile.php?id=100037782653708"
                : "https://www.tiktok.com/@harutv666";

            var post = new SocialViralPost
            {
                Id = "viral-" + now.ToUnixTimeSeconds() + "-" + Guid.NewGuid().ToString("N")[..6],
                Title = tpl.TitleGen(product.Name),
                Platform = tpl.Platform,
                Category = product.Category,
                PostUrl = postUrl,
                Summary = tpl.SummaryGen(product.Name, product.Description),
                ViralityScore = score,
                LikesCount = likes,
                SharesCount = shares,
                CommentsCount = comments,
                TrendingTopic = tpl.Topic,
                CreatedAt = now.AddMinutes(-i * 15).ToString("o")
            };

            AddSocialViralPost(post);
            newPosts.Add(post);
        }

        return newPosts;
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
                        post_url LIKE '%facebook.com%/share/p/%' OR
                        post_url LIKE '%facebook.com%story_fbid=%' OR
                        post_url LIKE '%facebook.com%fbid=%'
                    ) THEN 1
                    WHEN status = 'published' AND platform = 'tiktok' AND (
                        post_url LIKE '%tiktok.com/@harutv666/video/%' OR
                        post_url LIKE '%tiktok.com/@harutv666/photo/%'
                    ) THEN 1
                    ELSE 0
                END AS is_verified_published
                FROM social_auto_posts
            )
            SELECT
                COUNT(*) as total_posts,
                SUM(is_verified_published) as published_count,
                SUM(CASE WHEN status IN ('pending_approval', 'ready_for_publish', 'ready_for_api') THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN likes_count ELSE 0 END), 0) as total_likes,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN shares_count ELSE 0 END), 0) as total_shares,
                COALESCE(SUM(CASE WHEN is_verified_published = 1 THEN comments_count ELSE 0 END), 0) as total_comments,
                SUM(CASE WHEN status = 'internal_draft' THEN 1 ELSE 0 END) as draft_count
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
        catch
        {
            // Fallback nếu chưa có catalog_products trong CSDL
        }

        return ("1", "Tai nghe Bluetooth Chống Ồn OmiPro", 890000m, "/products/headphones.svg", "Công nghệ", "Tai nghe chống ồn chủ động cao cấp mang lại trải nghiệm âm thanh tuyệt hảo.");
    }
}
