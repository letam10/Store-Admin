/*
  FILE NOTE
  - Mục đích: Dịch vụ nền tự động tạo bài tiếp thị MXH theo chu kỳ (đa tài khoản — không hardcode tên/ID nick).
*/

using StoreApi.Data;
using StoreApi.Models;

namespace StoreApi.Services;

public sealed class SocialAutoPostWorker(
    StoreDb db,
    SocialCopywriterService copywriter,
    ILogger<SocialAutoPostWorker> logger) : BackgroundService
{
    private static readonly SemaphoreSlim _cycleLock = new(1, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[SocialWorker] Bộ lập lịch đăng bài Mạng Xã Hội tự động đã khởi động.");
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckAndExecuteCycleAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[SocialWorker] Lỗi khi thực hiện chu kỳ đăng bài MXH tự động.");
            }
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }

    public async Task<SocialAutoPost?> TriggerCycleNowAsync(string? forcePlatform = null, CancellationToken cancellationToken = default)
        => await ExecuteOneCycleAsync(isManualTrigger: true, forcePlatform, cancellationToken);

    private async Task CheckAndExecuteCycleAsync(CancellationToken stoppingToken)
    {
        var settings = db.GetSocialSettings();
        if (!settings.IsActive) return;

        var now = DateTimeOffset.UtcNow;
        var shouldRun = string.IsNullOrWhiteSpace(settings.NextRunAt) ||
                        !DateTimeOffset.TryParse(settings.NextRunAt, out var nextRun) ||
                        now >= nextRun;

        if (shouldRun)
        {
            await ExecuteOneCycleAsync(isManualTrigger: false, forcePlatform: null, stoppingToken);
        }
    }

    private async Task<SocialAutoPost?> ExecuteOneCycleAsync(bool isManualTrigger, string? forcePlatform, CancellationToken cancellationToken)
    {
        if (!await _cycleLock.WaitAsync(0, cancellationToken))
        {
            logger.LogWarning("[SocialWorker] Chu kỳ trước đang chạy, bỏ qua lượt này.");
            return null;
        }

        (string Id, string Name, decimal Price, string Image, string Category, string Description)? product = null;
        string platform = "facebook";
        SocialCampaignSettings? settings = null;
        var now = DateTimeOffset.UtcNow;

        try
        {
            settings = db.GetSocialSettings();
            product = db.GetCatalogProductForPromotion(settings.PreferredCategory);
            if (product == null)
            {
                db.UpdateSocialScheduleTimestamps(now.ToString("o"), ComputeNextRun(now, settings).ToString("o"));
                return null;
            }

            if (!string.IsNullOrWhiteSpace(forcePlatform))
            {
                platform = forcePlatform.Trim().ToLowerInvariant();
            }
            else
            {
                var channels = (settings.Channels ?? "facebook,tiktok").Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                platform = channels.Length > 0 ? channels[Random.Shared.Next(channels.Length)] : "facebook";
            }

            var groups = db.GetSocialGroupTargets();
            var activeGroups = groups.Where(g => g.IsAutoShare).ToList();
            var targetGroup = platform == "facebook" && activeGroups.Count > 0
                ? activeGroups[Random.Shared.Next(activeGroups.Count)].GroupName
                : "Trang cá nhân đang đăng nhập";

            var generated = await copywriter.GeneratePostAsync(
                product.Value.Name,
                product.Value.Price,
                product.Value.Category,
                product.Value.Description,
                platform,
                settings.ToneStyle,
                settings,
                customTopic: null,
                productId: product.Value.Id);

            var isFullAuto = settings.Mode?.ToLowerInvariant() != "semi_auto";
            var postId = "post-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + "-" + Guid.NewGuid().ToString("N")[..4];

            var post = new SocialAutoPost
            {
                Id = postId,
                ProductId = product.Value.Id,
                ProductName = product.Value.Name,
                ProductPrice = product.Value.Price,
                ProductImage = product.Value.Image,
                Platform = platform,
                Title = generated.Title,
                Content = generated.Content,
                Hashtags = generated.Hashtags,
                Status = isFullAuto ? "ready_for_publish" : "pending_approval",
                PostUrl = null,
                TargetGroup = targetGroup,
                Privacy = settings.Privacy ?? "only_me",
                TriggerTime = now.ToString("o"),
                PublishedTime = null,
                CreatedAt = now.ToString("o")
            };

            db.CreateSocialPost(post);
            db.UpdateSocialScheduleTimestamps(now.ToString("o"), ComputeNextRun(now, settings).ToString("o"));

            logger.LogInformation("[SocialWorker] Đã tạo bài {PostId} ({Platform}) - Quyền: {Privacy}.", postId, platform, settings.Privacy);
            return post;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[SocialWorker] Lỗi trong chu kỳ tạo bài MXH: {Message}", ex.Message);
            db.UpdateSocialScheduleTimestamps(now.ToString("o"), ComputeNextRun(now, settings).ToString("o"));

            try
            {
                db.CreateSocialPost(new SocialAutoPost
                {
                    Id = "post-err-" + DateTimeOffset.UtcNow.ToUnixTimeSeconds() + "-" + Guid.NewGuid().ToString("N")[..4],
                    ProductId = product?.Id,
                    ProductName = product?.Name ?? "Sản phẩm OmniCart",
                    ProductPrice = product?.Price ?? 0,
                    ProductImage = product?.Image ?? "/products/bag.svg",
                    Platform = platform,
                    Title = "⚠️ Lỗi khi tạo bài viết tự động",
                    Content = $"Hệ thống gặp sự cố: {ex.Message}",
                    Status = "failed",
                    ErrorMessage = ex.Message,
                    TriggerTime = now.ToString("o"),
                    CreatedAt = now.ToString("o")
                });
            }
            catch { }

            if (isManualTrigger) throw;
            return null;
        }
        finally
        {
            _cycleLock.Release();
        }
    }

    private static DateTimeOffset ComputeNextRun(DateTimeOffset now, SocialCampaignSettings? settings)
    {
        if (settings is null) return now.AddHours(2);
        if (settings.IntervalSeconds is > 0 and < 3600) return now.AddSeconds(settings.IntervalSeconds);
        if (settings.IntervalMinutes > 0) return now.AddMinutes(settings.IntervalMinutes);
        var mins = (int)Math.Max(2, Math.Round((settings.IntervalHours > 0 ? settings.IntervalHours : 2) * 60));
        return now.AddMinutes(mins);
    }
}
