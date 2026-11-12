namespace StoreApi.Services;

public static class LoyaltyPolicy
{
    public const int Version = 2;
    public const int GoodsPerBasePoint = 1000;
    public const int GoodsPerSpin = 100000;

    public static int MultiplierTenths(string tier) => tier switch { "gold" => 12, "diamond" => 15, _ => 10 };

    public static int AwardPoints(long paidGoods, string tier)
    {
        // Lấy số nghìn đồng tròn trước, sau đó nhân quyền lợi hạng và bỏ phần lẻ điểm.
        var basePoints = Math.Max(0, paidGoods) / GoodsPerBasePoint;
        return (int)Math.Min(int.MaxValue, basePoints * MultiplierTenths(tier) / 10);
    }

    public static object Description => new
    {
        pointsFrom = "Tiền hàng thực trả sau giảm giá, không gồm phí vận chuyển hoặc phí xử lý",
        goodsPerBasePoint = GoodsPerBasePoint,
        multiplier = new { bronze = 1m, silver = 1m, gold = 1.2m, diamond = 1.5m },
        rounding = "Bỏ phần lẻ ở bước điểm cơ bản rồi bỏ phần lẻ sau khi nhân hạng",
        tierAt = "Hạng được lưu lúc đặt đơn",
        goodsPerSpin = GoodsPerSpin,
        tiers = new { bronze = 0, silver = 100, gold = 1000, diamond = 10000 }
    };
}
