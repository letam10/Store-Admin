using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private static void QueueNotification(SqlConnection connection, SqlTransaction transaction, string key, string kind, object payload)
    {
        using var command = CheckoutCommand(connection, transaction, """
            IF NOT EXISTS(SELECT 1 FROM notification_outbox WITH(UPDLOCK,HOLDLOCK) WHERE job_key=@key)
              INSERT INTO notification_outbox(job_key,kind,payload) VALUES(@key,@kind,@payload)
            """, ("@key", key), ("@kind", kind), ("@payload", JsonSerializer.Serialize(payload, CheckoutJson)));
        command.ExecuteNonQuery();
    }

    private void QueueAdminNotifications(SqlConnection connection, SqlTransaction transaction, string key, string kind, object payload)
    {
        var recipients = MailSettings.AdminRecipients(_configuration);
        if (recipients.Count == 0) { QueueNotification(connection, transaction, key, kind, payload); return; }
        foreach (var recipient in recipients)
        {
            var data = JsonSerializer.SerializeToNode(payload, CheckoutJson)!.AsObject();
            data["recipient"] = recipient;
            QueueNotification(connection, transaction, key + ":" + Tokens.Sha256(recipient.ToLowerInvariant()), kind, data);
        }
    }

    public bool ExpandAdminNotification(NotificationJob job)
    {
        if (MailSettings.AdminRecipients(_configuration).Count == 0) return false;
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        QueueAdminNotifications(connection, transaction, job.Key, job.Kind, JsonSerializer.Deserialize<JsonElement>(job.Payload));
        using var update = CheckoutCommand(connection, transaction, "UPDATE notification_outbox SET status='expanded',payload='{}',leased_until=NULL WHERE job_key=@key", ("@key", job.Key));
        update.ExecuteNonQuery();
        transaction.Commit();
        return true;
    }

    public void CreateSupportRequest(long customerId, SupportRequestData request)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        var data = new { customer = request.CustomerName, customerId, topic = request.Topic, email = request.CustomerEmail, message = request.Message, assignee = "Chưa phân công" };
        using var insert = CheckoutCommand(connection, transaction, """
            INSERT INTO admin_records(module,title,data_json,status,created_at,updated_at)
            VALUES('support',@title,@data,N'Chờ duyệt',@now,@now)
            """, ("@title", "#" + request.RequestId + " - " + request.CustomerName + " (" + request.Topic + ")"),
            ("@data", JsonSerializer.Serialize(data)), ("@now", DateTimeOffset.UtcNow.ToString("O")));
        insert.ExecuteNonQuery();
        QueueAdminNotifications(connection, transaction, "support:admin:" + request.RequestId, "support.admin", request);
        QueueNotification(connection, transaction, "support:customer:" + request.RequestId, "support.customer", request);
        transaction.Commit();
    }

    public void QueuePasswordReset(long customerId, string username, string email, string rawToken)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        var now = DateTimeOffset.UtcNow;
        using (var limit = CheckoutCommand(connection, transaction, "SELECT COUNT(*) FROM password_resets WHERE customer_id=@id AND created_at>@recent", ("@id", customerId), ("@recent", now.AddMinutes(-1).ToString("O"))))
            if (Convert.ToInt32(limit.ExecuteScalar()) > 0) return;
        var hash = Tokens.Sha256(rawToken);
        var expiry = now.AddMinutes(30);
        using (var command = CheckoutCommand(connection, transaction, """
            DELETE FROM password_resets WHERE customer_id=@id;
            INSERT INTO password_resets(token_hash,customer_id,expires_at,created_at) VALUES(@hash,@id,@expires,@now)
            """, ("@id", customerId), ("@hash", hash), ("@expires", expiry.ToString("O")), ("@now", now.ToString("O")))) command.ExecuteNonQuery();
        QueueNotification(connection, transaction, "reset:customer:" + hash, "reset.customer", new { customerId, username, email, token = rawToken, expiresAt = expiry });
        QueueAdminNotifications(connection, transaction, "reset:admin:" + hash, "reset.admin", new { username, email });
        transaction.Commit();
    }

    public NotificationJob? ClaimNotification()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            ;WITH candidate AS (
              SELECT TOP 1 * FROM notification_outbox WITH(UPDLOCK,ROWLOCK)
              WHERE status='pending' AND available_at<=SYSDATETIMEOFFSET()
                AND (leased_until IS NULL OR leased_until<SYSDATETIMEOFFSET())
              ORDER BY available_at,job_key
            )
            UPDATE candidate SET leased_until=DATEADD(minute,2,SYSDATETIMEOFFSET()),attempts=attempts+1
            OUTPUT inserted.job_key,inserted.kind,inserted.payload,inserted.attempts;
            """;
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3)) : null;
    }

    public void FinishNotification(NotificationJob job, bool sent, string? error = null, bool obsolete = false)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE notification_outbox SET status=@status,sent_at=CASE WHEN @sent=1 THEN SYSDATETIMEOFFSET() ELSE sent_at END,
              payload=CASE WHEN @finished=1 THEN '{}' ELSE payload END,leased_until=NULL,last_error=@error,
              available_at=DATEADD(second,@retry,SYSDATETIMEOFFSET()) WHERE job_key=@key
            """;
        command.Parameters.AddWithValue("@key", job.Key);
        command.Parameters.AddWithValue("@sent", sent);
        command.Parameters.AddWithValue("@finished", sent || obsolete);
        command.Parameters.AddWithValue("@status", sent ? "sent" : obsolete ? "cancelled" : "pending");
        command.Parameters.AddWithValue("@error", (object?)error ?? DBNull.Value);
        command.Parameters.AddWithValue("@retry", Math.Min(900, 15 * job.Attempts));
        command.ExecuteNonQuery();
    }
}
