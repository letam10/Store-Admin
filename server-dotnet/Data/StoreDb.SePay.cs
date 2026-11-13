using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private void EnsureSePayTables()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            IF OBJECT_ID('sepay_transactions') IS NULL
            BEGIN
              CREATE TABLE sepay_transactions(
                transaction_id BIGINT PRIMARY KEY,fingerprint NVARCHAR(64) NOT NULL,
                payment_id NVARCHAR(100) NULL,reference NVARCHAR(100) NOT NULL,
                amount BIGINT NOT NULL,received_at DATETIMEOFFSET NOT NULL,
                content NVARCHAR(2000) NOT NULL,state NVARCHAR(30) NOT NULL,reason NVARCHAR(100) NULL,
                imported_at DATETIMEOFFSET NOT NULL);
              CREATE INDEX IX_sepay_payment ON sepay_transactions(payment_id,received_at);
            END
            """;
        command.ExecuteNonQuery();
    }

    public string ImportSePayTransfer(SePayTransfer transfer, BankAccount configuredBank)
    {
        // Lọc đúng nguồn trước khi đụng tới đơn; không lấy số dư hay giao dịch tiền ra làm bằng chứng thanh toán.
        var bank = transfer.Bank.Replace(" ", "").ToUpperInvariant();
        if (!transfer.Incoming || configuredBank.BankBin != "970422" || bank is not ("MB" or "MBBANK")
            || transfer.Account != configuredBank.AccountNumber) return "ignored";
        if (transfer.Id <= 0 || transfer.Amount <= 0) throw new InvalidOperationException("SEPAY_INVALID_TRANSACTION");
        var fingerprint = Tokens.Sha256(JsonSerializer.Serialize(transfer));
        var ids = Regex.Matches(transfer.Content.ToUpperInvariant(), @"(?<![A-Z0-9])(?:ST[A-F0-9]{16}|AS-?[A-F0-9]{16})(?![A-Z0-9])")
            .Select(match => match.Value.StartsWith("AS", StringComparison.Ordinal) ? "AS-" + match.Value[2..].TrimStart('-') : match.Value)
            .Distinct(StringComparer.Ordinal).ToArray();
        var paymentId = ids.Length == 1 ? ids[0] : null;
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        using (var existing = CheckoutCommand(connection, transaction,
            "SELECT fingerprint,state FROM sepay_transactions WHERE transaction_id=@id", ("@id", transfer.Id)))
        using (var reader = existing.ExecuteReader())
        {
            if (reader.Read())
            {
                if (reader.GetString(0) != fingerprint) throw new InvalidOperationException("SEPAY_TRANSACTION_CONFLICT");
                var state = reader.GetString(1);
                reader.Close();
                transaction.Commit();
                return state;
            }
        }
        var result = "review";
        var reason = ids.Length > 1 ? "AMBIGUOUS_PAYMENT_CODE" : "ORDER_NOT_FOUND";
        if (paymentId is not null)
        {
            // Settlement có thể giữ lại kho/voucher đã hết hạn. Lỗi nghiệp vụ phải hoàn tác phần đó,
            // nhưng vẫn lưu chứng từ tiền thật để cửa hàng xử lý, không làm mất khoản nhận.
            transaction.Save("sepay_settlement");
            try
            {
                if (paymentId.StartsWith("ST", StringComparison.Ordinal)) SettleSePayOrder(connection, transaction, paymentId, transfer);
                else SettleSePayAfterSales(connection, transaction, paymentId, transfer);
                result = "paid";
                reason = "";
            }
            catch (InvalidOperationException ex) when (ex.Message != "CHECKOUT_BUSY")
            {
                transaction.Rollback("sepay_settlement");
                reason = ex.Message;
                using var review = CheckoutCommand(connection, transaction, """
                    UPDATE checkout_intents SET state='needs_review'
                    WHERE order_id=@id AND state IN ('pending','reported','expired')
                      AND EXISTS(SELECT 1 FROM customer_orders WHERE id=@id AND paid_at IS NULL);
                    """, ("@id", paymentId));
                review.ExecuteNonQuery();
            }
        }
        using var insert = CheckoutCommand(connection, transaction, """
            INSERT INTO sepay_transactions(transaction_id,fingerprint,payment_id,reference,amount,received_at,content,state,reason,imported_at)
            VALUES(@id,@hash,@payment,@reference,@amount,@received,@content,@state,@reason,@now)
            """, ("@id", transfer.Id), ("@hash", fingerprint), ("@payment", paymentId), ("@reference", transfer.Reference),
            ("@amount", transfer.Amount), ("@received", transfer.ReceivedAt), ("@content", transfer.Content),
            ("@state", result), ("@reason", reason), ("@now", DateTimeOffset.UtcNow));
        insert.ExecuteNonQuery();
        transaction.Commit();
        return result;
    }

    private void SettleSePayOrder(SqlConnection connection, SqlTransaction transaction, string id, SePayTransfer transfer)
    {
        using (var query = CheckoutCommand(connection, transaction,
            "SELECT bank_json,state FROM checkout_intents WHERE order_id=@id", ("@id", id)))
        using (var reader = query.ExecuteReader())
        {
            if (!reader.Read()) throw new InvalidOperationException("ORDER_NOT_FOUND");
            var account = reader.IsDBNull(0) ? null : JsonSerializer.Deserialize<BankAccount>(reader.GetString(0), CheckoutJson);
            if (account?.BankBin != "970422" || account.AccountNumber != transfer.Account)
                throw new InvalidOperationException("PAYMENT_ACCOUNT_MISMATCH");
            if (reader.GetString(1) == "cancelled") throw new InvalidOperationException("ORDER_CANCELLED");
        }
        if (transfer.Amount > int.MaxValue) throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        SettleCheckout(connection, transaction, id, new(transfer.Reference, null, true, (int)transfer.Amount, transfer.ReceivedAt.ToString("O")));
    }

    private static void SettleSePayAfterSales(SqlConnection connection, SqlTransaction transaction, string id, SePayTransfer transfer)
    {
        var item = ReadAfterSalesCase(connection, transaction, id);
        var order = ReadAfterSalesOrder(connection, transaction, item.OrderId);
        if (order.Method != "bank_transfer" || item.FeeBank?.BankBin != "970422" || item.FeeBank.AccountNumber != transfer.Account)
            throw new InvalidOperationException("PAYMENT_ACCOUNT_MISMATCH");
        if (item.FeePaidAt.HasValue)
        {
            if (item.FeePaymentReference != transfer.Reference || item.Quote.AdditionalDue != transfer.Amount)
                throw new InvalidOperationException("IDEMPOTENCY_CONFLICT");
            return;
        }
        if (item.Status != "awaiting_payment") throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        ConfirmAfterSalesFee(connection, transaction, item, order,
            new("fee_paid", null, transfer.Reference, null, true, null, null, transfer.Amount, transfer.ReceivedAt.ToString("O")));
        item.Events.Add(new("fee_paid", "SePay", "Tự động xác nhận khoản bù từ giao dịch ngân hàng", DateTimeOffset.UtcNow));
        SaveAfterSalesCase(connection, transaction, item);
    }

    public IReadOnlyList<object> SePayTransactions(string? paymentId = null)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP(100) s.transaction_id,s.payment_id,s.reference,s.amount,s.received_at,s.content,
              CASE WHEN s.state='review' AND EXISTS(SELECT 1 FROM bank_payment_receipts r
                WHERE r.reference=s.reference AND r.amount=s.amount AND (r.order_id=s.payment_id OR EXISTS
                  (SELECT 1 FROM checkout_unmatched_payments u WHERE u.id=r.order_id AND u.order_id=s.payment_id)))
                THEN 'resolved' ELSE s.state END,s.reason
            FROM sepay_transactions s WHERE (@payment IS NULL OR s.payment_id=@payment)
            ORDER BY s.imported_at DESC,s.transaction_id DESC
            """;
        command.Parameters.AddWithValue("@payment", (object?)paymentId ?? DBNull.Value);
        var rows = new List<object>();
        using var reader = command.ExecuteReader();
        while (reader.Read()) rows.Add(new
        {
            id = reader.GetInt64(0), paymentId = reader.IsDBNull(1) ? null : reader.GetString(1), reference = reader.GetString(2),
            amount = reader.GetInt64(3), receivedAt = reader.GetDateTimeOffset(4), content = reader.GetString(5),
            state = reader.GetString(6), reason = reader.IsDBNull(7) ? null : reader.GetString(7)
        });
        return rows;
    }
}
