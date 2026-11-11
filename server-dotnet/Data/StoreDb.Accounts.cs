using Microsoft.Data.SqlClient;
using StoreApi.Security;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public sealed record AdminActor(long Id, string Username, string Role);
    public sealed record StaffAccount(long Id, string Username, string DisplayName, string Email, bool Active);

    public AdminActor? FindAdminActor(string tokenHash)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT a.id,a.username,a.role FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=@hash AND s.expires_at>@now AND a.active=1";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        using var reader = command.ExecuteReader();
        return reader.Read() ? new(Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2)) : null;
    }

    public IReadOnlyList<StaffAccount> ListStaffAccounts()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT id,username,display_name,email,active FROM admins WHERE role='staff' ORDER BY id";
        using var reader = command.ExecuteReader();
        var accounts = new List<StaffAccount>();
        while (reader.Read())
            accounts.Add(new(Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetBoolean(4)));
        return accounts;
    }

    public StaffAccount? SaveStaffAccount(long? id, string username, string displayName, string email, string? password, bool active)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        var passwordHash = string.IsNullOrEmpty(password) ? ((string Salt, string Hash)?)null : Tokens.HashPassword(password);
        // Chỉ sửa tài khoản staff: không thể truyền ID quản trị viên để hạ quyền hoặc đổi mật khẩu.
        command.CommandText = id.HasValue ? """
            UPDATE admins SET username=@username,display_name=@name,email=@email,active=@active,
              password_salt=COALESCE(@salt,password_salt),password_hash=COALESCE(@hash,password_hash)
            OUTPUT inserted.id WHERE id=@id AND role='staff';
            """ : """
            INSERT INTO admins(username,display_name,email,active,role,password_salt,password_hash,created_at)
            OUTPUT inserted.id VALUES(@username,@name,@email,@active,'staff',@salt,@hash,@now);
            """;
        command.Parameters.AddWithValue("@id", (object?)id ?? DBNull.Value);
        command.Parameters.AddWithValue("@username", username);
        command.Parameters.AddWithValue("@name", displayName);
        command.Parameters.AddWithValue("@email", email);
        command.Parameters.AddWithValue("@active", active);
        command.Parameters.AddWithValue("@salt", (object?)passwordHash?.Salt ?? DBNull.Value);
        command.Parameters.AddWithValue("@hash", (object?)passwordHash?.Hash ?? DBNull.Value);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        object? savedId;
        try { savedId = command.ExecuteScalar(); }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            throw new InvalidOperationException("ACCOUNT_EXISTS", ex);
        }
        if (savedId is null) return null;
        var accountId = Convert.ToInt64(savedId);
        if (id.HasValue)
        {
            command.Parameters.Clear();
            command.CommandText = "DELETE FROM admin_sessions WHERE admin_id=@id";
            command.Parameters.AddWithValue("@id", accountId);
            command.ExecuteNonQuery();
        }
        transaction.Commit();
        return new(accountId, username, displayName, email, active);
    }

    public bool SetCustomerPassword(long id, string password)
    {
        var (salt, hash) = Tokens.HashPassword(password);
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "UPDATE customers SET password_salt=@salt,password_hash=@hash WHERE id=@id";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@salt", salt);
        command.Parameters.AddWithValue("@hash", hash);
        if (command.ExecuteNonQuery() == 0) return false;
        // Thu hồi cả phiên đăng nhập và link đặt lại mật khẩu cũ trong cùng giao dịch.
        command.CommandText = "DELETE FROM customer_sessions WHERE customer_id=@id; DELETE FROM password_resets WHERE customer_id=@id; DELETE FROM login_challenges WHERE customer_id=@id";
        command.ExecuteNonQuery();
        transaction.Commit();
        return true;
    }
}
