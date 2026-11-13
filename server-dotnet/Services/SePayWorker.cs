using StoreApi.Data;

namespace StoreApi.Services;

public sealed class SePayWorker(StoreDb db, SePayClient client, ILogger<SePayWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = SePayClient.IntervalSeconds;
            try
            {
                if (client.Enabled) await SyncOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                var code = ex is InvalidOperationException && ex.Message.StartsWith("SEPAY_", StringComparison.Ordinal)
                    ? ex.Message : "SEPAY_SYNC_FAILED";
                // Không ghi body phản hồi, header hay token vào log.
                logger.LogWarning("Chưa đồng bộ giao dịch SePay ({Code}); sẽ thử lại.", code);
                try { db.SetSetting("sepay.last_error", code); }
                catch (Exception) { logger.LogWarning("Chưa lưu được trạng thái SePay; sẽ thử lại khi database kết nối lại."); }
                delay = Math.Max(30, client.RetryAfterSeconds);
            }
            await Task.Delay(TimeSpan.FromSeconds(delay), stoppingToken);
        }
    }

    public async Task SyncOnceAsync(CancellationToken cancellationToken)
    {
        var bank = BankPayment.ReadSettings(db.GetPaymentSettings());
        if (bank.BankBin != "970422") throw new InvalidOperationException("SEPAY_MB_REQUIRED");
        var key = "sepay.sync." + bank.AccountNumber;
        var now = DateTimeOffset.UtcNow;
        // Lùi lại một ngày để bắt giao dịch lên chậm; mốc bền vững giúp lấy bù sau khi tắt máy.
        var from = DateTimeOffset.TryParse(db.GetSetting(key), out var previous) ? previous.AddDays(-1) : now.AddDays(-7);
        var transfers = await client.ReadAsync(bank.AccountNumber, from, cancellationToken);
        foreach (var transfer in transfers)
        {
            cancellationToken.ThrowIfCancellationRequested();
            db.ImportSePayTransfer(transfer, bank);
        }
        db.SetSetting(key, now.ToString("O"));
        db.SetSetting("sepay.last_error", "");
    }
}
