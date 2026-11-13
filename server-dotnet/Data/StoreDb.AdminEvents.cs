using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public sealed record AdminEvent(long Id, string Kind, string Payload);

    private void EnsureAdminEventTable()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            IF OBJECT_ID('admin_events') IS NULL
              CREATE TABLE admin_events(
                id BIGINT IDENTITY(1,1) PRIMARY KEY,event_key NVARCHAR(160) NOT NULL UNIQUE,
                kind NVARCHAR(40) NOT NULL,payload NVARCHAR(MAX) NOT NULL,
                created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET());
            """;
        command.ExecuteNonQuery();
    }

    private static void QueueAdminEvent(SqlConnection connection, SqlTransaction transaction, string key, string kind, object payload)
    {
        var body = JsonSerializer.SerializeToNode(payload, CheckoutJson)!.AsObject();
        body["occurredAt"] = DateTimeOffset.UtcNow;
        using var command = CheckoutCommand(connection, transaction, """
            IF NOT EXISTS(SELECT 1 FROM admin_events WITH(UPDLOCK,HOLDLOCK) WHERE event_key=@key)
              INSERT INTO admin_events(event_key,kind,payload) VALUES(@key,@kind,@payload);
            """, ("@key", key), ("@kind", kind), ("@payload", body.ToJsonString()));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<AdminEvent> ReadAdminEvents(long? afterId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        // Chỉ các sự kiện vận hành; không đưa giao dịch ngân hàng chưa khớp đơn hoặc dữ liệu cấu hình vào luồng.
        command.CommandText = afterId.HasValue ? """
            SELECT TOP(100) id,kind,payload FROM admin_events WHERE id>@after
              AND kind IN ('order:created','order:paid','review:created','support:created') ORDER BY id;
            """ : """
            SELECT id,kind,payload FROM (
              SELECT TOP(20) id,kind,payload FROM admin_events
              WHERE kind IN ('order:created','order:paid','review:created','support:created') ORDER BY id DESC
            ) recent ORDER BY id;
            """;
        if (afterId.HasValue) command.Parameters.AddWithValue("@after", afterId.Value);
        var events = new List<AdminEvent>();
        using var reader = command.ExecuteReader();
        while (reader.Read()) events.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2)));
        return events;
    }
}
