/*
 * Tệp: server-dotnet/Data/StoreDb.cs
 * Mục đích: Lớp truy cập Microsoft SQL Server bằng Microsoft.Data.SqlClient cho API C#.
 */
using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;

namespace StoreApi.Data;

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
        if (!string.IsNullOrWhiteSpace(configured))
        {
            _connectionString = configured;
        }
        else
        {
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = Environment.GetEnvironmentVariable("SQL_SERVER") ?? "localhost",
                InitialCatalog = Environment.GetEnvironmentVariable("SQL_DATABASE") ?? "StoreDb",
                IntegratedSecurity = true,
                TrustServerCertificate = true,
                MultipleActiveResultSets = true
            };
            _connectionString = builder.ConnectionString;
        }
        EnsureCustomerTables();
    }

    private SqlConnection Open()
    {
        var connection = new SqlConnection(_connectionString);
        connection.Open();
        return connection;
    }

    private void EnsureCustomerTables()
    {
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = """
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customers')
                CREATE TABLE customers (
                  id BIGINT IDENTITY(1,1) PRIMARY KEY, username NVARCHAR(255) NOT NULL UNIQUE,
                  email NVARCHAR(255) NOT NULL UNIQUE, password_salt NVARCHAR(MAX) NOT NULL,
                  password_hash NVARCHAR(MAX) NOT NULL, points INT NOT NULL DEFAULT 0,
                  paid_goods_total INT NOT NULL DEFAULT 0, spin_credits INT NOT NULL DEFAULT 0,
                  created_at NVARCHAR(100) NOT NULL
                );
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_sessions')
                CREATE TABLE customer_sessions (
                  token_hash NVARCHAR(255) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  expires_at NVARCHAR(100) NOT NULL
                );
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_favorites')
                CREATE TABLE customer_favorites (
                  customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  product_id NVARCHAR(255) NOT NULL, created_at NVARCHAR(100) NOT NULL,
                  PRIMARY KEY(customer_id, product_id)
                );
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'voucher_codes')
                CREATE TABLE voucher_codes (code NVARCHAR(255) PRIMARY KEY, created_at NVARCHAR(100) NOT NULL);
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_vouchers')
                CREATE TABLE customer_vouchers (
                  code NVARCHAR(255) PRIMARY KEY FOREIGN KEY REFERENCES voucher_codes(code), customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  label NVARCHAR(255) NOT NULL, type NVARCHAR(50) NOT NULL, value INT NOT NULL, scope NVARCHAR(50) NOT NULL DEFAULT 'goods',
                  expires_at NVARCHAR(100) NOT NULL, source NVARCHAR(255) NOT NULL, created_at NVARCHAR(100) NOT NULL
                );
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_reviews')
                CREATE TABLE product_reviews (
                  id BIGINT IDENTITY(1,1) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  product_id NVARCHAR(255) NOT NULL, rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5), comment NVARCHAR(MAX) NOT NULL,
                  admin_reply NVARCHAR(MAX) NOT NULL DEFAULT '', created_at NVARCHAR(100) NOT NULL, replied_at NVARCHAR(100) NULL,
                  CONSTRAINT UQ_reviews_customer_product UNIQUE(customer_id, product_id)
                );
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_orders')
                CREATE TABLE customer_orders (
                  id NVARCHAR(255) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  items_json NVARCHAR(MAX) NOT NULL, recipient NVARCHAR(255) NOT NULL DEFAULT '', phone NVARCHAR(50) NOT NULL DEFAULT '', address NVARCHAR(MAX) NOT NULL DEFAULT '',
                  fulfillment NVARCHAR(100) NOT NULL, region NVARCHAR(100) NOT NULL, distance_km INT NOT NULL DEFAULT 0,
                  subtotal INT NOT NULL, discount INT NOT NULL, goods_total INT NOT NULL, shipping_fee INT NOT NULL,
                  total INT NOT NULL, voucher_codes_json NVARCHAR(MAX) NOT NULL DEFAULT '[]', tier NVARCHAR(50) NOT NULL,
                  status NVARCHAR(50) NOT NULL DEFAULT 'pending', points_earned INT NOT NULL DEFAULT 0,
                  created_at NVARCHAR(100) NOT NULL, paid_at NVARCHAR(100) NULL
                );
                """;
            command.ExecuteNonQuery();
        }
        catch
        {
            // Table creation might already be handled by schema script
        }
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

    private static CatalogProduct ReadProduct(SqlDataReader reader)
    {
        var features = new List<string>();
        try
        {
            var json = reader.IsDBNull(6) ? "[]" : reader.GetString(6);
            features = JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch { }

        return new(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            Convert.ToInt64(reader.GetValue(3)),
            reader.IsDBNull(4) ? "" : reader.GetString(4),
            reader.IsDBNull(5) ? "" : reader.GetString(5),
            features,
            reader.IsDBNull(7) ? "" : reader.GetString(7),
            reader.IsDBNull(8) ? "" : reader.GetString(8),
            reader.IsDBNull(9) ? "" : reader.GetString(9),
            Convert.ToInt32(reader.GetValue(10)),
            Convert.ToInt32(reader.GetValue(11)),
            Convert.ToInt32(reader.GetValue(12))
        );
    }

    public int IncrementView(string productId)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            MERGE product_views AS target
            USING (SELECT @id AS product_id) AS source
            ON (target.product_id = source.product_id)
            WHEN MATCHED THEN
                UPDATE SET view_count = target.view_count + 1
            WHEN NOT MATCHED THEN
                INSERT (product_id, view_count) VALUES (source.product_id, 1)
            OUTPUT inserted.view_count;
            """;
        command.Parameters.AddWithValue("@id", productId);
        var result = command.ExecuteScalar();
        return result is null ? 1 : Convert.ToInt32(result);
    }

    public (long Id, string Username, string Email, string Salt, string Hash, int Points, int SpinCredits)? FindCustomer(string usernameOrEmail)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id,username,email,password_salt,password_hash,points,spin_credits FROM customers WHERE LOWER(username)=LOWER(@value) OR LOWER(email)=LOWER(@value)";
        command.Parameters.AddWithValue("@value", usernameOrEmail.Trim());
        using var reader = command.ExecuteReader();
        return reader.Read() ? (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), Convert.ToInt32(reader.GetValue(5)), Convert.ToInt32(reader.GetValue(6))) : null;
    }

    public (long Id, string Username, string Email, int Points, int SpinCredits)? FindCustomerBySession(string tokenHash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 c.id,c.username,c.email,c.points,c.spin_credits FROM customer_sessions s JOIN customers c ON c.id=s.customer_id WHERE s.token_hash=@hash AND s.expires_at>@now";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        using var reader = command.ExecuteReader();
        return reader.Read() ? (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2), Convert.ToInt32(reader.GetValue(3)), Convert.ToInt32(reader.GetValue(4))) : null;
    }

    public long CreateCustomer(string username, string email, string salt, string hash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO customers(username,email,password_salt,password_hash,created_at) VALUES(@u,@e,@s,@h,@now); SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";
        command.Parameters.AddWithValue("@u", username.Trim());
        command.Parameters.AddWithValue("@e", email.Trim());
        command.Parameters.AddWithValue("@s", salt);
        command.Parameters.AddWithValue("@h", hash);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        return Convert.ToInt64(command.ExecuteScalar());
    }

    public void CreateSession(string tokenHash, long customerId, DateTimeOffset expiresAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO customer_sessions(token_hash,customer_id,expires_at) VALUES(@hash,@id,@expires)";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.Parameters.AddWithValue("@id", customerId);
        command.Parameters.AddWithValue("@expires", expiresAt.ToString("O"));
        command.ExecuteNonQuery();
    }

    public void DeleteSession(string tokenHash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM customer_sessions WHERE token_hash=@hash";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.ExecuteNonQuery();
    }

    public IReadOnlyDictionary<string, string> Appearance()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT [key],[value] FROM settings WHERE [key] LIKE 'appearance.%'";
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        using var reader = command.ExecuteReader();
        while (reader.Read()) result[reader.GetString(0)[11..]] = reader.GetString(1);
        return result;
    }

    public (string Salt, string Hash)? FindAdmin(string username)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 password_salt,password_hash FROM admins WHERE LOWER(username)=LOWER(@u)";
        command.Parameters.AddWithValue("@u", username.Trim());
        using var reader = command.ExecuteReader();
        return reader.Read() ? (reader.GetString(0), reader.GetString(1)) : null;
    }

    public long? AdminId(string username)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id FROM admins WHERE LOWER(username)=LOWER(@u)";
        command.Parameters.AddWithValue("@u", username.Trim());
        var value = command.ExecuteScalar();
        return value is null || value is DBNull ? null : Convert.ToInt64(value);
    }

    public void CreateAdminSession(string tokenHash, long adminId, DateTimeOffset expiresAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO admin_sessions(token_hash,admin_id,expires_at,created_at) VALUES(@hash,@id,@expires,@created)";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.Parameters.AddWithValue("@id", adminId);
        command.Parameters.AddWithValue("@expires", expiresAt.ToString("O"));
        command.Parameters.AddWithValue("@created", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }

    public (long Id, string Username)? FindAdminBySession(string tokenHash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 a.id,a.username FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=@hash AND s.expires_at>@now";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        using var reader = command.ExecuteReader();
        return reader.Read() ? (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1)) : null;
    }

    public void DeleteAdminSession(string tokenHash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM admin_sessions WHERE token_hash=@hash";
        command.Parameters.AddWithValue("@hash", tokenHash);
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<string> Favorites(long customerId)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT product_id FROM customer_favorites WHERE customer_id=@id ORDER BY created_at DESC";
        command.Parameters.AddWithValue("@id", customerId);
        using var reader = command.ExecuteReader();
        var result = new List<string>();
        while (reader.Read()) result.Add(reader.GetString(0));
        return result;
    }

    public void SetFavorite(long customerId, string productId, bool favorite)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            IF @favorite = 1
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM customer_favorites WHERE customer_id=@id AND product_id=@product)
                    INSERT INTO customer_favorites(customer_id,product_id,created_at) VALUES(@id,@product,@now);
            END
            ELSE
            BEGIN
                DELETE FROM customer_favorites WHERE customer_id=@id AND product_id=@product;
            END
            """;
        command.Parameters.AddWithValue("@favorite", favorite ? 1 : 0);
        command.Parameters.AddWithValue("@id", customerId);
        command.Parameters.AddWithValue("@product", productId);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }

    public IReadOnlyList<object> Vouchers(long customerId)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            DELETE FROM customer_vouchers WHERE expires_at <= @now;
            SELECT code,label,type,value,scope,expires_at,source FROM customer_vouchers WHERE customer_id=@id ORDER BY expires_at;
            """;
        command.Parameters.AddWithValue("@id", customerId);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        using var reader = command.ExecuteReader();
        var result = new List<object>();
        while (reader.Read())
        {
            result.Add(new
            {
                code = reader.GetString(0),
                label = reader.GetString(1),
                type = reader.GetString(2),
                value = Convert.ToInt32(reader.GetValue(3)),
                scope = reader.GetString(4),
                expiresAt = reader.GetString(5),
                source = reader.GetString(6)
            });
        }
        return result;
    }

    public int CustomerCount()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM customers";
        return Convert.ToInt32(command.ExecuteScalar());
    }

    public int OrderCount()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT (SELECT COUNT(*) FROM orders)+(SELECT COUNT(*) FROM customer_orders)";
        return Convert.ToInt32(command.ExecuteScalar());
    }

    public long ProductCount()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM catalog_products";
        return Convert.ToInt64(command.ExecuteScalar()) + BaseProducts.Count;
    }

    public long TotalViews()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COALESCE(SUM(CAST(view_count AS BIGINT)),0) FROM product_views";
        var result = command.ExecuteScalar();
        return result is null || result is DBNull ? 0 : Convert.ToInt64(result);
    }

    public bool UpdateOffer(string id, int discountPercent, int stockCount)
    {
        if (discountPercent is < 0 or > 90 || stockCount < 0) return false;
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE catalog_products SET discount_percent=@discount,stock_count=@stock WHERE id=@id";
        command.Parameters.AddWithValue("@discount", discountPercent);
        command.Parameters.AddWithValue("@stock", stockCount);
        command.Parameters.AddWithValue("@id", id);
        return command.ExecuteNonQuery() > 0;
    }

    public IReadOnlyList<object> TopViews(int limit = 20)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP (@limit) p.id,p.name,p.category,p.image,COALESCE(v.view_count,0) FROM catalog_products p LEFT JOIN product_views v ON v.product_id=p.id ORDER BY COALESCE(v.view_count,0) DESC,p.name";
        command.Parameters.AddWithValue("@limit", limit);
        using var reader = command.ExecuteReader();
        var result = new List<object>();
        var rank = 1;
        while (reader.Read())
        {
            result.Add(new
            {
                rank = rank++,
                id = reader.GetString(0),
                name = reader.GetString(1),
                category = reader.GetString(2),
                image = reader.IsDBNull(3) ? "" : reader.GetString(3),
                viewCount = Convert.ToInt32(reader.GetValue(4))
            });
        }
        return result;
    }
}
