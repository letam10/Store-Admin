namespace StoreApi.Services;

public static class PaymentTime
{
    // Sao kê và form đối soát chỉ ghi đến giây; không loại giao dịch cùng giây vì phần mili giây của thời điểm tạo.
    public static bool BeforeRecordedSecond(DateTimeOffset observed, DateTimeOffset earliest) =>
        observed < DateTimeOffset.FromUnixTimeSeconds(earliest.ToUnixTimeSeconds());
}
