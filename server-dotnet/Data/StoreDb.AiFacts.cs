using System.Globalization;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public const int PresenceWindowSeconds = 90;
    public sealed record PublicVoucherFact(string Code, string Label, string Type, int Value, string Scope, DateTimeOffset ExpiresAt);
    public sealed record OnlineSupportFact(string DisplayName, string Role);

    public IReadOnlyList<PublicVoucherFact> PublicAiVouchers()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT code,label,type,value,scope,TRY_CONVERT(datetimeoffset,expires_at)
            FROM customer_vouchers WHERE customer_id IS NULL
              AND TRY_CONVERT(datetimeoffset,expires_at)>@now ORDER BY expires_at,code
            """;
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        using var reader = command.ExecuteReader();
        var items = new List<PublicVoucherFact>();
        while (reader.Read()) items.Add(new(reader.GetString(0), reader.GetString(1), reader.GetString(2),
            Convert.ToInt32(reader.GetValue(3)), reader.GetString(4), reader.GetDateTimeOffset(5)));
        return items;
    }

    public bool TouchAdminPresence(string tokenHash)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE s SET last_seen_at=@now FROM admin_sessions s JOIN admins a ON a.id=s.admin_id
            WHERE s.token_hash=@token AND a.active=1 AND TRY_CONVERT(datetimeoffset,s.expires_at)>@now
            """;
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow);
        command.Parameters.AddWithValue("@token", tokenHash);
        return command.ExecuteNonQuery() == 1;
    }

    public IReadOnlyList<OnlineSupportFact> OnlineSupportStaff()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT a.id,a.display_name,a.role FROM admins a JOIN admin_sessions s ON s.admin_id=a.id
            WHERE a.active=1 AND a.role IN ('staff','admin') AND s.last_seen_at>=@since
              AND TRY_CONVERT(datetimeoffset,s.expires_at)>@now
            GROUP BY a.id,a.display_name,a.role ORDER BY a.id
            """;
        var now = DateTimeOffset.UtcNow;
        command.Parameters.AddWithValue("@now", now);
        command.Parameters.AddWithValue("@since", now.AddSeconds(-PresenceWindowSeconds));
        using var reader = command.ExecuteReader();
        var people = new List<OnlineSupportFact>();
        while (reader.Read())
        {
            var role = reader.GetString(2);
            var name = reader.GetString(1).Trim();
            // Chỉ công bố tên hiển thị hỗ trợ, không đưa username/email đăng nhập vào ngữ cảnh khách.
            people.Add(new(name.Length == 0 ? role == "admin" ? "Quản trị Store" : "Nhân viên Store" : name, role));
        }
        return people;
    }

    public bool OwnsConversation(string id, string owner, string kind)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM conversations WHERE id=@id AND owner_key=@owner AND kind=@kind";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@owner", owner);
        command.Parameters.AddWithValue("@kind", kind);
        return Convert.ToInt32(command.ExecuteScalar(), CultureInfo.InvariantCulture) == 1;
    }

    public ChatStoredRequest? FindChatRequest(string owner, string requestId)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT t.conversation_id,t.kind,t.user_content,t.assistant_content,t.status,t.sources_json,t.report_json,t.verified_json
            FROM chat_turns t JOIN conversations c ON c.id=t.conversation_id
            WHERE t.owner_key=@owner AND t.request_id=@request AND c.owner_key=@owner AND c.kind=t.kind
            """;
        command.Parameters.AddWithValue("@owner", owner);
        command.Parameters.AddWithValue("@request", requestId);
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
            reader.GetString(5), reader.GetString(6), reader.GetString(7)) : null;
    }

    public sealed record ChatStoredRequest(string ConversationId, string Kind, string UserContent, string AssistantContent,
        string Status, string SourcesJson, string ReportJson, string VerifiedJson);
}
