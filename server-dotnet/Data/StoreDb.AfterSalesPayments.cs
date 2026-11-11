using System.Text.Json;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public (int Amount, BankAccount? Bank, DateTimeOffset? ExpiresAt, bool Reported) AfterSalesPaymentWindow(int recordId, long customerId)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using var query = CheckoutCommand(connection, transaction, """
            SELECT r.data_json,o.payment_method FROM admin_records r
            JOIN customer_orders o ON o.id=JSON_VALUE(r.data_json,'$.orderId')
            WHERE r.id=@id AND r.module='after-sales' AND o.customer_id=@customer
              AND TRY_CONVERT(bigint,JSON_VALUE(r.data_json,'$.customerId'))=@customer
            """, ("@id", recordId), ("@customer", customerId));
        using var reader = query.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("AFTER_SALES_NOT_FOUND");
        var original = reader.GetString(0);
        var method = reader.GetString(1);
        reader.Close();
        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(original)!;
        if (data["status"].GetString() != "awaiting_payment") throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        var amount = data["quote"].GetProperty("feeAmount").GetInt32();
        if (amount <= 0) throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        var reported = data.TryGetValue("feeReportedAt", out var report) && report.ValueKind == JsonValueKind.String;
        if (method != "bank_transfer") { transaction.Commit(); return (amount, null, null, reported); }
        if (!data.ContainsKey("feePaymentExpiresAt"))
        {
            data["feePaymentExpiresAt"] = JsonSerializer.SerializeToElement(DateTimeOffset.UtcNow.AddMinutes(2));
            data["feeBank"] = JsonSerializer.SerializeToElement(BankPayment.ReadSettings(GetPaymentSettings()), CheckoutJson);
            using var save = CheckoutCommand(connection, transaction, "UPDATE admin_records SET data_json=@data,updated_at=@now WHERE id=@id AND data_json=@original",
                ("@data", JsonSerializer.Serialize(data)), ("@now", DateTimeOffset.UtcNow.ToString("O")), ("@id", recordId), ("@original", original));
            if (save.ExecuteNonQuery() != 1) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        }
        var expiry = data["feePaymentExpiresAt"].GetDateTimeOffset();
        var bank = data["feeBank"].Deserialize<BankAccount>(CheckoutJson)!;
        transaction.Commit();
        return (amount, bank, expiry, reported);
    }
}
