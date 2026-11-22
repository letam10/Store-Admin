/*
  FILE NOTE
  - Mục đích: Chính sách thẻ thành viên (Đồng, Bạc, Vàng, Kim Cương), mốc điểm, chiết khấu %, hệ số tích điểm, quyền lợi hiển thị và tính điểm/lượt quay động.
  - Liên kết trực tiếp: Data/StoreDb.Membership.cs, Controllers/AdminMembershipController.cs, Controllers/StorefrontController.cs, Controllers/CustomerController.cs
*/
using System.Text.Json.Serialization;

namespace StoreApi.Services;

public sealed record MembershipTierConfig(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("englishLabel")] string EnglishLabel,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("subtitle")] string Subtitle,
    [property: JsonPropertyName("minPoints")] int MinPoints,
    [property: JsonPropertyName("discountPercent")] int DiscountPercent,
    [property: JsonPropertyName("multiplier")] decimal Multiplier,
    [property: JsonPropertyName("benefits")] IReadOnlyList<string> Benefits);

public sealed record MembershipPolicyConfig(
    [property: JsonPropertyName("schemaVersion")] int SchemaVersion,
    [property: JsonPropertyName("goodsPerBasePoint")] int GoodsPerBasePoint,
    [property: JsonPropertyName("goodsPerSpin")] int GoodsPerSpin,
    [property: JsonPropertyName("footerNote")] string FooterNote,
    [property: JsonPropertyName("tiers")] IReadOnlyList<MembershipTierConfig> Tiers,
    [property: JsonPropertyName("updatedAt")] string? UpdatedAt = null);

public static class LoyaltyPolicy
{
    public const int Version = 2;
    public const int GoodsPerBasePoint = 1000;
    public const int GoodsPerSpin = 100000;

    private static readonly string[] TierOrder = ["bronze", "silver", "gold", "diamond"];

    public static MembershipPolicyConfig DefaultPolicy() => new(
        SchemaVersion: 1,
        GoodsPerBasePoint: GoodsPerBasePoint,
        GoodsPerSpin: GoodsPerSpin,
        FooterNote: "Chỉ tính tiền hàng đã thanh toán sau giảm giá, không gồm phí vận chuyển và phí dịch vụ. Mỗi 1.000 đ tròn nhận 1 điểm cơ bản; 999 đ không cộng điểm. Sau đó nhân quyền lợi hạng tại lúc đặt đơn và bỏ phần lẻ điểm. Đổi/trả hàng sẽ điều chỉnh điểm của đơn tương ứng.",
        Tiers:
        [
            new("bronze", "BRONZE", "Đồng", "Hạng mặc định, miễn phí.", 0, 0, 1.0m,
            [
                "Tích 1 điểm cho mỗi 1.000 đ hàng hóa đã thanh toán",
                "Mỗi 100.000 đ đã thanh toán nhận 1 lượt quay"
            ]),
            new("silver", "SILVER", "Bạc", "Mở khóa khi tích đủ 100 điểm.", 100, 1, 1.0m,
            [
                "Tự động giảm thêm 1% khi thanh toán",
                "Giữ quyền lợi hạng Đồng"
            ]),
            new("gold", "GOLD", "Vàng", "Mở khóa khi tích đủ 1.000 điểm.", 1000, 2, 1.2m,
            [
                "Giữ nguyên lợi ích hạng Bạc và hạng Đồng",
                "Tự động giảm thêm 2% khi thanh toán",
                "Tích điểm x1,2",
                "Phí giao hàng nội thành theo mức chung 30.000 đ"
            ]),
            new("diamond", "DIAMOND", "Kim Cương", "Mở khóa khi tích đủ 10.000 điểm.", 10000, 5, 1.5m,
            [
                "Giữ nguyên lợi ích hạng Vàng, Bạc và hạng Đồng",
                "Tự động giảm thêm 5% khi thanh toán",
                "Tích điểm x1,5",
                "Phí giao hàng theo khu vực áp dụng chung"
            ])
        ]);

    public static MembershipPolicyConfig NormalizeAndValidate(MembershipPolicyConfig? input)
    {
        var defaults = DefaultPolicy();
        if (input is null) return defaults;

        var goodsPerBasePoint = input.GoodsPerBasePoint;
        var goodsPerSpin = input.GoodsPerSpin;
        if (goodsPerBasePoint is < 100 or > 1_000_000) throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");
        if (goodsPerSpin is < 10_000 or > 100_000_000) throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");

        var byId = (input.Tiers ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t.Id))
            .GroupBy(t => t.Id.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.First());

        var normalized = new List<MembershipTierConfig>(4);
        foreach (var fallback in defaults.Tiers)
        {
            var src = byId.TryGetValue(fallback.Id, out var found) ? found : fallback;
            var name = string.IsNullOrWhiteSpace(src.Name) ? fallback.Name : src.Name.Trim();
            var eng = string.IsNullOrWhiteSpace(src.EnglishLabel) ? fallback.EnglishLabel : src.EnglishLabel.Trim().ToUpperInvariant();
            var subtitle = string.IsNullOrWhiteSpace(src.Subtitle) ? fallback.Subtitle : src.Subtitle.Trim();
            var minPoints = fallback.Id == "bronze" ? 0 : src.MinPoints;
            var discount = src.DiscountPercent;
            var multiplier = Math.Round(src.Multiplier, 2, MidpointRounding.AwayFromZero);

            if (name.Length > 60 || eng.Length > 30 || subtitle.Length > 200)
                throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");
            if (minPoints is < 0 or > 100_000_000)
                throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");
            if (discount is < 0 or > 50)
                throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");
            if (multiplier is < 1.0m or > 10.0m)
                throw new InvalidOperationException("INVALID_MEMBERSHIP_POLICY");

            var benefits = (src.Benefits ?? [])
                .Select(b => (b ?? "").Trim())
                .Where(b => b.Length > 0)
                .Select(b => b.Length <= 220 ? b : b[..220])
                .Take(10)
                .ToArray();
            if (benefits.Length == 0) benefits = fallback.Benefits.ToArray();

            normalized.Add(new(fallback.Id, eng, name, subtitle, minPoints, discount, multiplier, benefits));
        }

        // Bắt buộc mốc điểm tăng dần chặt: Đồng (0) < Bạc < Vàng < Kim Cương
        for (var i = 1; i < normalized.Count; i++)
        {
            if (normalized[i].MinPoints <= normalized[i - 1].MinPoints)
                throw new InvalidOperationException("INVALID_MEMBERSHIP_THRESHOLDS");
        }

        var footerNote = string.IsNullOrWhiteSpace(input.FooterNote) ? defaults.FooterNote : input.FooterNote.Trim();
        if (footerNote.Length > 600) footerNote = footerNote[..600];

        return new(1, goodsPerBasePoint, goodsPerSpin, footerNote, normalized, DateTimeOffset.UtcNow.ToString("O"));
    }

    public static string ResolveTier(int points, MembershipPolicyConfig? policy = null)
    {
        var tiers = (policy ?? DefaultPolicy()).Tiers;
        var current = "bronze";
        foreach (var id in TierOrder)
        {
            var tier = tiers.FirstOrDefault(t => t.Id == id);
            if (tier is not null && points >= tier.MinPoints) current = tier.Id;
        }
        return current;
    }

    public static int DiscountPercent(string tier, MembershipPolicyConfig? policy = null)
    {
        var key = (tier ?? "bronze").Trim().ToLowerInvariant();
        var found = (policy ?? DefaultPolicy()).Tiers.FirstOrDefault(t => t.Id == key);
        return found?.DiscountPercent ?? 0;
    }

    public static int MultiplierTenths(string tier) => tier switch { "gold" => 12, "diamond" => 15, _ => 10 };

    public static int AwardPoints(long paidGoods, string tier) => AwardPoints(paidGoods, tier, null);

    public static int AwardPoints(long paidGoods, string tier, MembershipPolicyConfig? policy)
    {
        var active = policy ?? DefaultPolicy();
        var key = (tier ?? "bronze").Trim().ToLowerInvariant();
        var tierCfg = active.Tiers.FirstOrDefault(t => t.Id == key);
        var multiplier = tierCfg?.Multiplier ?? (MultiplierTenths(key) / 10m);
        var basePoints = Math.Max(0, paidGoods) / Math.Max(1, active.GoodsPerBasePoint);
        return (int)Math.Min(int.MaxValue, (long)Math.Floor(basePoints * multiplier));
    }

    public static object ToDescription(MembershipPolicyConfig? policy = null)
    {
        var active = policy ?? DefaultPolicy();
        int MinOf(string id) => active.Tiers.FirstOrDefault(t => t.Id == id)?.MinPoints ?? 0;
        decimal MultOf(string id) => active.Tiers.FirstOrDefault(t => t.Id == id)?.Multiplier ?? 1m;
        int DiscOf(string id) => active.Tiers.FirstOrDefault(t => t.Id == id)?.DiscountPercent ?? 0;
        return new
        {
            pointsFrom = "Tiền hàng thực trả sau giảm giá, không gồm phí vận chuyển hoặc phí xử lý",
            goodsPerBasePoint = active.GoodsPerBasePoint,
            multiplier = new { bronze = MultOf("bronze"), silver = MultOf("silver"), gold = MultOf("gold"), diamond = MultOf("diamond") },
            discountPercent = new { bronze = DiscOf("bronze"), silver = DiscOf("silver"), gold = DiscOf("gold"), diamond = DiscOf("diamond") },
            rounding = "Bỏ phần lẻ ở bước điểm cơ bản rồi bỏ phần lẻ sau khi nhân hạng",
            tierAt = "Hạng được lưu lúc đặt đơn",
            goodsPerSpin = active.GoodsPerSpin,
            tiers = new { bronze = MinOf("bronze"), silver = MinOf("silver"), gold = MinOf("gold"), diamond = MinOf("diamond") }
        };
    }

    public static object Description => ToDescription(null);
}
