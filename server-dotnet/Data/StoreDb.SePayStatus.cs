using System.Text.Json;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public object SePayStatus()
    {
        BankAccount? bank = null;
        try { bank = BankPayment.ReadSettings(GetPaymentSettings()); }
        catch (InvalidOperationException) { }
        return SePayPaymentStatus(null, bank);
    }

    public object SePayPaymentStatus(string? paymentId, BankAccount? bank)
    {
        var settings = JsonSerializer.SerializeToElement(GetPaymentSettings());
        var configured = _configuration["SEPAY_ENABLED"] == "true" && !string.IsNullOrWhiteSpace(_configuration["SEPAY_API_TOKEN"])
            && bank?.BankBin == "970422" && settings.GetProperty("bankBin").GetString() == bank.BankBin
            && settings.GetProperty("accountNumber").GetString() == bank.AccountNumber;
        var lastSyncAt = bank is null ? null : GetSetting("sepay.sync." + bank.AccountNumber);
        var error = GetSetting("sepay.last_error");
        var healthy = configured && string.IsNullOrEmpty(error) && DateTimeOffset.TryParse(lastSyncAt, out var last)
            && last > DateTimeOffset.UtcNow.AddSeconds(-45);
        // Chỉ gọi sau kiểm tra chủ đơn; khách không đọc được chứng từ của tài khoản khác.
        var transfers = paymentId is null ? [] : SePayTransactions(paymentId).Select(item =>
        {
            var row = JsonSerializer.SerializeToElement(item);
            return new
            {
                reference = row.GetProperty("reference").GetString(), amount = row.GetProperty("amount").GetInt64(),
                receivedAt = row.GetProperty("receivedAt").GetDateTimeOffset(), state = row.GetProperty("state").GetString()
            };
        }).ToArray();
        return new { configured, healthy, lastSyncAt, error = configured ? error : null, intervalSeconds = SePayClient.IntervalSeconds, transfers };
    }
}
