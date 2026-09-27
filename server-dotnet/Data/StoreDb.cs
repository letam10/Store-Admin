/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Data/StoreDb.cs
 * Mục đích: Lớp truy cập PostgreSQL bằng Npgsql cho API C#.
 * Thành phần chính: StoreDb.
 * Liên kết trực tiếp: System.Text.Json, Npgsql, StoreApi.Models, var db = Open(), var command = db.CreateCommand(), var db = Open(), var command = db.CreateCommand(), var reader = command.ExecuteReader().
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Text.Json;
using Npgsql;
using StoreApi.Models;

namespace StoreApi.Data;

// Vai trò kiểu StoreDb: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class StoreDb
{
    private static readonly IReadOnlyList<CatalogProduct> BaseProducts =
    [
        new("1", "Tai nghe Everyday", "Điện tử", 890000, "Tai nghe demo của Store.", "/products/headphones.svg", [], "electronic", "◉", "Được yêu thích", 0, 20, 0),
        new("2", "Túi Everyday Tote", "Trang phục", 249000, "Túi Everyday dùng hằng ngày.", "/products/bag.svg", [], "apparel", "□", "Mới", 0, 20, 0),
        new("3", "Đồng hồ Minimal", "Phụ kiện", 1290000, "Đồng hồ tối giản.", "/products/watch.svg", [], "accessories", "◷", "Tối giản", 0, 20, 0),
        new("4", "Ly cà phê Morning", "Đồ gia dụng", 159000, "Ly cà phê dùng mỗi ngày.", "/products/cup.svg", [], "home", "◌", "Mỗi ngày", 0, 20, 0),
    ];

    private readonly string _connectionString;

    public StoreDb(IConfiguration configuration)
    {
        var configured = configuration.GetConnectionString("StoreDb") ?? Environment.GetEnvironmentVariable("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(configured)) _connectionString = configured;
        else
        {
            var builder = new NpgsqlConnectionStringBuilder
            {
                Host = Environment.GetEnvironmentVariable("PGHOST") ?? "127.0.0.1",
                Port = int.TryParse(Environment.GetEnvironmentVariable("PGPORT"), out var port) ? port : 5432,
                Username = Environment.GetEnvironmentVariable("PGUSER") ?? "postgres",
                Password = Environment.GetEnvironmentVariable("PGPASSWORD") ?? string.Empty,
                Database = Environment.GetEnvironmentVariable("PGDATABASE") ?? "store_db"
            };
            _connectionString = builder.ConnectionString;
        }
        EnsureCustomerTables();
    }

    private NpgsqlConnection Open()
    {
        var connection = new NpgsqlConnection(_connectionString);
        connection.Open();
        return connection;
    }

    private void EnsureCustomerTables()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS customers (
              id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL UNIQUE,
              email TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL,
              password_hash TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
              paid_goods_total INTEGER NOT NULL DEFAULT 0, spin_credits INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS customer_sessions (
              token_hash TEXT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS customer_favorites (
              customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              product_id TEXT NOT NULL, created_at TEXT NOT NULL,
              PRIMARY KEY(customer_id, product_id)
            );
            CREATE TABLE IF NOT EXISTS voucher_codes (code TEXT PRIMARY KEY, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS customer_vouchers (
              code TEXT PRIMARY KEY REFERENCES voucher_codes(code), customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              label TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL, scope TEXT NOT NULL DEFAULT 'goods',
              expires_at TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS product_reviews (
              id BIGSERIAL PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              product_id TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL,
              admin_reply TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, replied_at TEXT,
              UNIQUE(customer_id, product_id)
            );
            CREATE TABLE IF NOT EXISTS customer_orders (
              id TEXT PRIMARY KEY, customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
              items_json TEXT NOT NULL, recipient TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
              fulfillment TEXT NOT NULL, region TEXT NOT NULL, distance_km INTEGER NOT NULL DEFAULT 0,
              subtotal INTEGER NOT NULL, discount INTEGER NOT NULL, goods_total INTEGER NOT NULL, shipping_fee INTEGER NOT NULL,
              total INTEGER NOT NULL, voucher_codes_json TEXT NOT NULL DEFAULT '[]', tier TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending', points_earned INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL, paid_at TEXT
            );
            """;
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<CatalogProduct> Catalog()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            SELECT p.id,p.name,p.category,p.price,p.description,p.image,p.features_json,p.tone,p.symbol,p.label,
                   COALESCE(p.discount_percent,0),COALESCE(p.stock_count,20),COALESCE(v.view_count,0)
            FROM catalog_products p LEFT JOIN product_views v ON v.product_id=p.id ORDER BY p.id
            """;
        var products = new List<CatalogProduct>();
        using var reader = command.ExecuteReader();
        while (reader.Read()) products.Add(ReadProduct(reader));
        for (var index = BaseProducts.Count - 1; index >= 0; index--)
        {
            var baseProduct = BaseProducts[index];
            if (products.All(product => product.Id != baseProduct.Id)) products.Insert(0, baseProduct);
        }
        return products;
    }

    private static CatalogProduct ReadProduct(NpgsqlDataReader reader)
    {
        var features = new List<string>();
        try { features = JsonSerializer.Deserialize<List<string>>(reader.GetString(6)) ?? []; } catch { }
        return new(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt64(3), reader.GetString(4), reader.GetString(5), features, reader.GetString(7), reader.GetString(8), reader.GetString(9), reader.GetInt32(10), reader.GetInt32(11), reader.GetInt32(12));
    }

    public int IncrementView(string productId)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO product_views(product_id,view_count) VALUES(@id,1) ON CONFLICT(product_id) DO UPDATE SET view_count=product_views.view_count+1 RETURNING view_count";
        command.Parameters.AddWithValue("@id", productId); return Convert.ToInt32(command.ExecuteScalar());
    }

    public (long Id, string Username, string Email, string Salt, string Hash, int Points, int SpinCredits)? FindCustomer(string usernameOrEmail)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT id,username,email,password_salt,password_hash,points,spin_credits FROM customers WHERE LOWER(username)=LOWER(@value) OR LOWER(email)=LOWER(@value) LIMIT 1";
        command.Parameters.AddWithValue("@value", usernameOrEmail.Trim()); using var reader = command.ExecuteReader();
        return reader.Read() ? (reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), reader.GetInt32(5), reader.GetInt32(6)) : null;
    }

    public (long Id, string Username, string Email, int Points, int SpinCredits)? FindCustomerBySession(string tokenHash)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT c.id,c.username,c.email,c.points,c.spin_credits FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=@hash AND s.expires_at>@now";
        command.Parameters.AddWithValue("@hash", tokenHash); command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O")); using var reader = command.ExecuteReader();
        return reader.Read() ? (reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3), reader.GetInt32(4)) : null;
    }

    public long CreateCustomer(string username, string email, string salt, string hash)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "INSERT INTO customers(username,email,password_salt,password_hash,created_at) VALUES(@u,@e,@s,@h,@now) RETURNING id";
        command.Parameters.AddWithValue("@u", username.Trim()); command.Parameters.AddWithValue("@e", email.Trim()); command.Parameters.AddWithValue("@s", salt); command.Parameters.AddWithValue("@h", hash); command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O")); return Convert.ToInt64(command.ExecuteScalar());
    }

    public void CreateSession(string tokenHash, long customerId, DateTimeOffset expiresAt)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES(@hash,@id,@expires)";
        command.Parameters.AddWithValue("@hash", tokenHash); command.Parameters.AddWithValue("@id", customerId); command.Parameters.AddWithValue("@expires", expiresAt.ToString("O")); command.ExecuteNonQuery();
    }

    public void DeleteSession(string tokenHash)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "DELETE FROM customer_sessions WHERE token_hash=@hash"; command.Parameters.AddWithValue("@hash", tokenHash); command.ExecuteNonQuery();
    }

    public IReadOnlyDictionary<string, string> Appearance()
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT key,value FROM settings WHERE key LIKE 'appearance.%'";
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); using var reader = command.ExecuteReader(); while (reader.Read()) result[reader.GetString(0)[11..]] = reader.GetString(1); return result;
    }

    public (string Salt, string Hash)? FindAdmin(string username)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT password_salt,password_hash FROM admins WHERE LOWER(username)=LOWER(@u)"; command.Parameters.AddWithValue("@u", username.Trim()); using var reader = command.ExecuteReader(); return reader.Read() ? (reader.GetString(0), reader.GetString(1)) : null;
    }

    public long? AdminId(string username)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT id FROM admins WHERE LOWER(username)=LOWER(@u)"; command.Parameters.AddWithValue("@u", username.Trim()); var value = command.ExecuteScalar(); return value is null ? null : Convert.ToInt64(value);
    }

    public void CreateAdminSession(string tokenHash, long adminId, DateTimeOffset expiresAt)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO admin_sessions(token_hash,admin_id,expires_at,created_at) VALUES(@hash,@id,@expires,@created)";
        command.Parameters.AddWithValue("@hash", tokenHash); command.Parameters.AddWithValue("@id", adminId); command.Parameters.AddWithValue("@expires", expiresAt.ToString("O")); command.Parameters.AddWithValue("@created", DateTimeOffset.UtcNow.ToString("O")); command.ExecuteNonQuery();
    }

    public (long Id, string Username)? FindAdminBySession(string tokenHash)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT a.id,a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=@hash AND s.expires_at>@now";
        command.Parameters.AddWithValue("@hash", tokenHash); command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O")); using var reader = command.ExecuteReader();
        return reader.Read() ? (reader.GetInt64(0), reader.GetString(1)) : null;
    }

    public void DeleteAdminSession(string tokenHash)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "DELETE FROM admin_sessions WHERE token_hash=@hash"; command.Parameters.AddWithValue("@hash", tokenHash); command.ExecuteNonQuery();
    }

    public IReadOnlyList<string> Favorites(long customerId)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT product_id FROM customer_favorites WHERE customer_id=@id ORDER BY created_at DESC"; command.Parameters.AddWithValue("@id", customerId); using var reader = command.ExecuteReader();
        var result = new List<string>(); while (reader.Read()) result.Add(reader.GetString(0)); return result;
    }

    public void SetFavorite(long customerId, string productId, bool favorite)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = favorite
            ? "INSERT INTO customer_favorites(customer_id,product_id,created_at) ON CONFLICT(customer_id,product_id) DO NOTHING VALUES(@id,@product,@now)"
            : "DELETE FROM customer_favorites WHERE customer_id=@id AND product_id=@product";
        command.Parameters.AddWithValue("@id", customerId); command.Parameters.AddWithValue("@product", productId); command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O")); command.ExecuteNonQuery();
    }

    public IReadOnlyList<object> Vouchers(long customerId)
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "DELETE FROM customer_vouchers WHERE expires_at <= @now; SELECT code,label,type,value,scope,expires_at,source FROM customer_vouchers WHERE customer_id=@id ORDER BY expires_at"; command.Parameters.AddWithValue("@id", customerId); command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        using var reader = command.ExecuteReader(); var result = new List<object>(); while (reader.Read()) result.Add(new { code = reader.GetString(0), label = reader.GetString(1), type = reader.GetString(2), value = reader.GetInt32(3), scope = reader.GetString(4), expiresAt = reader.GetString(5), source = reader.GetString(6) }); return result;
    }

    public int CustomerCount()
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT COUNT(*) FROM customers"; return Convert.ToInt32(command.ExecuteScalar());
    }

    public int OrderCount()
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT (SELECT COUNT(*) FROM orders)+(SELECT COUNT(*) FROM customer_orders)"; return Convert.ToInt32(command.ExecuteScalar());
    }

    public long ProductCount()
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT COUNT(*) FROM catalog_products"; return Convert.ToInt64(command.ExecuteScalar()) + BaseProducts.Count;
    }

    public long TotalViews()
    {
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "SELECT COALESCE(SUM(view_count),0) FROM product_views"; return Convert.ToInt64(command.ExecuteScalar());
    }

    public bool UpdateOffer(string id, int discountPercent, int stockCount)
    {
        if (discountPercent is < 0 or > 90 || stockCount < 0) return false;
        using var db = Open(); using var command = db.CreateCommand(); command.CommandText = "UPDATE catalog_products SET discount_percent=@discount,stock_count=@stock WHERE id=@id";
        command.Parameters.AddWithValue("@discount", discountPercent); command.Parameters.AddWithValue("@stock", stockCount); command.Parameters.AddWithValue("@id", id); return command.ExecuteNonQuery() > 0;
    }

    public IReadOnlyList<object> TopViews(int limit = 20)
    {
        using var db = Open(); using var command = db.CreateCommand();
        command.CommandText = "SELECT p.id,p.name,p.category,p.image,COALESCE(v.view_count,0) FROM catalog_products p LEFT JOIN product_views v ON v.product_id=p.id ORDER BY COALESCE(v.view_count,0) DESC,p.name LIMIT @limit"; command.Parameters.AddWithValue("@limit", limit);
        using var reader = command.ExecuteReader(); var result = new List<object>(); var rank = 1; while (reader.Read()) result.Add(new { rank = rank++, id = reader.GetString(0), name = reader.GetString(1), category = reader.GetString(2), image = reader.GetString(3), viewCount = reader.GetInt32(4) }); return result;
    }
}


