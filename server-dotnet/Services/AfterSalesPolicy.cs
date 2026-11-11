using StoreApi.Models;

namespace StoreApi.Services;

public static class AfterSalesPolicy
{
    public const int Version = 2;
    public const int ReturnDays = 7;
    public const int RescheduleDays = 3;
    public static object Description => new { cancellationPercent = 1, cancellationMinimum = 1000, returnDays = ReturnDays, rescheduleDays = RescheduleDays };

    public static AfterSalesQuote Quote(string kind, long remainingPaid, long goods, long shipping, long replacementGoods)
    {
        // Phí hủy khấu trừ đúng một lần, không vừa trừ tiền hoàn vừa thu thêm.
        if (kind == "cancel")
        {
            var fee = Math.Min(remainingPaid, Math.Max(1000, goods / 100));
            return new(fee, remainingPaid - fee, 0, [new("Phí hủy 1% (tối thiểu 1.000đ), trừ vào tiền hoàn", fee)]);
        }
        if (kind == "return")
            return new(0, Math.Min(remainingPaid, goods), 0,
                [new("Không hoàn phí giao hàng ban đầu", shipping), new("Cước gửi trả khách thanh toán trực tiếp cho đơn vị vận chuyển", null)]);
        if (kind == "merchant_fault")
            return new(0, remainingPaid, 0, [new("Miễn phí do lỗi cửa hàng", 0)]);
        if (kind == "exchange")
        {
            var difference = replacementGoods + shipping - goods;
            return new(shipping, Math.Max(0, -difference), Math.Max(0, difference),
                [new("Giá trị hàng cũ đã thanh toán", -goods), new("Giá trị hàng thay thế", replacementGoods),
                 new("Phí giao hàng thay thế", shipping), new("Cước gửi trả khách thanh toán cho đơn vị vận chuyển", null)], goods, replacementGoods);
        }
        return new(0, 0, 0, [new("Phí đổi lịch", 0)]);
    }

    public static void Validate(string kind, string status, string delivery, DateTimeOffset? deliveredAt,
        string? previousSchedule, string? nextSchedule, DateTimeOffset now)
    {
        if (status is not ("paid" or "completed")) throw new InvalidOperationException("PAYMENT_REQUIRED");
        if (kind == "cancel" && delivery is "shipped" or "delivered") throw new InvalidOperationException("ALREADY_SHIPPED");
        if (kind is "return" or "merchant_fault" or "exchange")
        {
            if (delivery != "delivered") throw new InvalidOperationException("DELIVERY_REQUIRED");
            if (!deliveredAt.HasValue) throw new InvalidOperationException("DELIVERY_DATE_REQUIRED");
            if (now > deliveredAt.Value.AddDays(ReturnDays)) throw new InvalidOperationException("RETURN_WINDOW_EXPIRED");
        }
        if (kind == "reschedule")
        {
            if (delivery is "shipped" or "delivered") throw new InvalidOperationException("ALREADY_SHIPPED");
            if (!DateTimeOffset.TryParse(previousSchedule, out var previous)
                || !DateTimeOffset.TryParse(nextSchedule, out var next) || next <= now
                || next > previous.AddDays(RescheduleDays)) throw new InvalidOperationException("RESCHEDULE_WINDOW_EXPIRED");
        }
    }
}
