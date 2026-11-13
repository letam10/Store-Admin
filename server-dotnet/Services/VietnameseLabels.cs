namespace StoreApi.Services;

public static class VietnameseLabels
{
    public static string Category(string value) => value == "Laptop" ? "Máy tính xách tay" : value;
    public static string Tier(string value) => value.ToLowerInvariant() switch
    {
        "bronze" => "Đồng", "silver" => "Bạc", "gold" => "Vàng", "diamond" => "Kim cương", _ => value
    };
    public static string Payment(string value) => value switch
    {
        "bank_transfer" => "Chuyển khoản ngân hàng", "cash" => "Tiền mặt tại quầy",
        "cod" => "Thu tiền khi giao hàng", "voucher" => "Mã giảm giá đủ giá trị", _ => "Chưa xác định"
    };
    public static string AfterSalesKind(string value) => value switch
    {
        "cancel" => "Hủy đơn", "return" => "Trả hàng", "exchange" => "Đổi hàng",
        "merchant_fault" => "Lỗi từ cửa hàng", "reschedule" => "Đổi lịch giao nhận", _ => "Chưa xác định"
    };
    public static string Status(string value, bool workflow = false) => value switch
    {
        "pending" => workflow ? "Đang chờ xử lý" : "Chờ thanh toán", "paid" => "Đã thanh toán",
        "completed" => workflow ? "Đã hoàn tất" : "Đã nhận hàng", "delivered" => "Đã giao hàng",
        "cancelled" => "Đã hủy", "refunded" => "Đã hoàn tiền", "expired" => "Hết hạn thanh toán",
        "reported" => "Khách báo đã chuyển", "needs_review" => "Cần đối soát",
        "unmatched_received" => "Đã nhận khoản cần hoàn", "refunded_unmatched" => "Đã hoàn khoản chuyển không khớp",
        "processing" => workflow ? "Đang xử lý" : "Đang chuẩn bị", "ready" => "Sẵn sàng giao hoặc nhận",
        "shipped" => "Đang giao", "returned" => "Đã nhận hàng trả", "new" or "open" => "Mới tiếp nhận",
        "active" => "Đang hoạt động", "draft" => "Bản nháp", "approved" => "Đã duyệt", "rejected" => "Đã từ chối",
        "resolved" => "Đã giải quyết", "closed" => "Đã đóng", "awaiting_confirmation" => "Chờ khách xác nhận",
        "awaiting_return" => "Chờ nhận hàng trả", "awaiting_payment" => "Chờ thanh toán khoản bù",
        "awaiting_refund" => "Chờ hoàn tiền", "awaiting_exchange" => "Chờ giao hàng đổi",
        "exchange_shipped" => "Đang giao hàng đổi", _ => value.Any(c => c > 127) ? value : "Chưa xác định"
    };
}
