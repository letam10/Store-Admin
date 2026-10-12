/*
 * Tệp: server-dotnet/Data/StoreDb.cs
 * Mục đích: Lớp truy cập Microsoft SQL Server bằng Microsoft.Data.SqlClient cho API C#.
 */
using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;

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

    public string ConnectionString => _connectionString;

    public string DatabaseName
    {
        get
        {
            try
            {
                return new SqlConnectionStringBuilder(_connectionString).InitialCatalog;
            }
            catch
            {
                return Environment.GetEnvironmentVariable("SQL_DATABASE") ?? "StoreDb";
            }
        }
    }

    public StoreDb(IConfiguration configuration)
    {
        var configured = configuration.GetConnectionString("StoreDb") ?? Environment.GetEnvironmentVariable("DATABASE_URL");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            // Cho phép cấu hình thiếu TrustServerCertificate trên máy mới (sqlcmd/driver 18 mặc định encrypt).
            // Nếu connection string chưa ghi rõ TrustServerCertificate/Encrypt thì tự bổ sung để tránh lỗi SSL.
            try
            {
                var csb = new SqlConnectionStringBuilder(configured);
                var raw = configured ?? string.Empty;
                if (!raw.Contains("TrustServerCertificate", StringComparison.OrdinalIgnoreCase))
                {
                    csb.TrustServerCertificate = true;
                }
                if (!raw.Contains("Encrypt", StringComparison.OrdinalIgnoreCase))
                {
                    // LocalDB/SQL Express nội bộ: giữ Encrypt=false để tương thích máy chưa cài chứng chỉ.
                    csb.Encrypt = false;
                }
                if (!raw.Contains("MultipleActiveResultSets", StringComparison.OrdinalIgnoreCase))
                {
                    csb.MultipleActiveResultSets = true;
                }
                _connectionString = csb.ConnectionString;
            }
            catch
            {
                _connectionString = configured;
            }
        }
        else
        {
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = Environment.GetEnvironmentVariable("SQL_SERVER") ?? "localhost",
                InitialCatalog = Environment.GetEnvironmentVariable("SQL_DATABASE") ?? "StoreDb",
                IntegratedSecurity = true,
                TrustServerCertificate = true,
                Encrypt = false,
                MultipleActiveResultSets = true
            };
            _connectionString = builder.ConnectionString;
        }
        try
        {
            EnsureDatabaseExists();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StoreDb] Chưa tạo được database '{DatabaseName}': {ex.Message}");
            Console.WriteLine("[StoreDb] Hãy kiểm tra SQL Server đã Running + chạy scripts/setup-db.ps1");
        }
        try
        {
            EnsureCustomerTables();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[StoreDb] Chưa tạo được tables: {ex.Message}");
        }
    }

    /// <summary>
    /// Tự tạo database StoreDb nếu máy thành viên mới pull về chưa có.
    /// Kết nối tới `master` rồi chạy CREATE DATABASE (idempotent).
    /// </summary>
    public void EnsureDatabaseExists()
    {
        var masterBuilder = new SqlConnectionStringBuilder(_connectionString)
        {
            InitialCatalog = "master"
        };
        using var master = new SqlConnection(masterBuilder.ConnectionString);
        master.Open();
        using var command = master.CreateCommand();
        // Không tham số hoá tên DB được nên kiểm tra tên an toàn trước khi ghép chuỗi.
        // Cho phép chữ, số, gạch dưới, gạch ngang, khoảng trắng (dùng [brackets] nên an toàn).
        var dbName = DatabaseName;
        if (string.IsNullOrWhiteSpace(dbName) || dbName.IndexOfAny([';', '\'', '/', '\\']) >= 0)
        {
            throw new InvalidOperationException($"Tên database không hợp lệ: '{dbName}'");
        }
        command.CommandText = $"IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'{dbName.Replace("'", "''")}') CREATE DATABASE [{dbName}];";
        command.ExecuteNonQuery();
    }

    /// <summary>Kiểm tra kết nối DB cho endpoint /api/health/db (không ném exception).</summary>
    public (bool Ok, string Message) TryCheckHealth()
    {
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = "SELECT 1;";
            command.ExecuteScalar();
            return (true, $"Kết nối database '{DatabaseName}' thành công.");
        }
        catch (Exception ex)
        {
            return (false, $"Không kết nối được database '{DatabaseName}': {ex.Message}");
        }
    }

    public SqlConnection Open()
    {
        var connection = new SqlConnection(_connectionString);
        connection.Open();
        return connection;
    }

    public void EnsureCustomerTables()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admins')
                CREATE TABLE admins (
                  id INT IDENTITY(1,1) PRIMARY KEY,
                  username NVARCHAR(255) NOT NULL UNIQUE,
                  password_salt NVARCHAR(MAX) NOT NULL,
                  password_hash NVARCHAR(MAX) NOT NULL,
                  created_at NVARCHAR(100) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_sessions')
                CREATE TABLE admin_sessions (
                  token_hash NVARCHAR(255) PRIMARY KEY,
                  admin_id INT NOT NULL FOREIGN KEY REFERENCES admins(id) ON DELETE CASCADE,
                  expires_at NVARCHAR(100) NOT NULL,
                  created_at NVARCHAR(100) NOT NULL
                );

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

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'password_resets')
                CREATE TABLE password_resets (
                  token_hash NVARCHAR(255) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  expires_at NVARCHAR(100) NOT NULL, used_at NVARCHAR(100) NULL, created_at NVARCHAR(100) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'oauth_states')
                CREATE TABLE oauth_states (
                  state NVARCHAR(255) PRIMARY KEY, next_url NVARCHAR(500) NOT NULL DEFAULT '/account',
                  expires_at NVARCHAR(100) NOT NULL, created_at NVARCHAR(100) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'login_challenges')
                CREATE TABLE login_challenges (
                  id NVARCHAR(255) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  expires_at NVARCHAR(100) NOT NULL, created_at NVARCHAR(100) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'customer_totp_backups')
                CREATE TABLE customer_totp_backups (
                  id BIGINT IDENTITY(1,1) PRIMARY KEY, customer_id BIGINT NOT NULL FOREIGN KEY REFERENCES customers(id) ON DELETE CASCADE,
                  code_hash NVARCHAR(255) NOT NULL, used_at NVARCHAR(100) NULL, created_at NVARCHAR(100) NOT NULL
                );

                IF COL_LENGTH('customers', 'google_sub') IS NULL ALTER TABLE customers ADD google_sub NVARCHAR(255) NULL;
                IF COL_LENGTH('customers', 'totp_secret') IS NULL ALTER TABLE customers ADD totp_secret NVARCHAR(MAX) NULL;
                IF COL_LENGTH('customers', 'totp_enabled') IS NULL ALTER TABLE customers ADD totp_enabled INT NOT NULL DEFAULT 0;
                IF COL_LENGTH('customers', 'totp_pending_secret') IS NULL ALTER TABLE customers ADD totp_pending_secret NVARCHAR(MAX) NULL;
                IF COL_LENGTH('customers', 'totp_verified_at') IS NULL ALTER TABLE customers ADD totp_verified_at NVARCHAR(100) NULL;

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

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
                CREATE TABLE Products (
                  Id INT IDENTITY(1,1) PRIMARY KEY,
                  Name NVARCHAR(255) NOT NULL,
                  Price DECIMAL(18,2) NOT NULL,
                  Category NVARCHAR(255) NOT NULL,
                  Description NVARCHAR(MAX) NULL,
                  Image NVARCHAR(MAX) NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'catalog_products')
                CREATE TABLE catalog_products (
                  id NVARCHAR(255) PRIMARY KEY,
                  source NVARCHAR(100) NOT NULL DEFAULT 'local',
                  source_id NVARCHAR(255) NOT NULL DEFAULT '',
                  name NVARCHAR(500) NOT NULL,
                  category NVARCHAR(255) NOT NULL,
                  price BIGINT NOT NULL CHECK(price >= 0),
                  description NVARCHAR(MAX) NOT NULL,
                  image NVARCHAR(MAX) NOT NULL,
                  features_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
                  tone NVARCHAR(100) NOT NULL DEFAULT 'neutral',
                  symbol NVARCHAR(50) NOT NULL DEFAULT '',
                  label NVARCHAR(255) NOT NULL DEFAULT '',
                  source_url NVARCHAR(MAX) NOT NULL DEFAULT '',
                  source_price_cents INT NOT NULL DEFAULT 0 CHECK(source_price_cents >= 0),
                  source_currency NVARCHAR(20) NOT NULL DEFAULT 'VND',
                  imported_at NVARCHAR(100) NOT NULL DEFAULT '',
                  discount_percent INT NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 90),
                  stock_count INT NOT NULL DEFAULT 20 CHECK(stock_count >= 0)
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'product_views')
                CREATE TABLE product_views (
                  product_id NVARCHAR(255) PRIMARY KEY,
                  view_count INT NOT NULL DEFAULT 0 CHECK(view_count >= 0)
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'settings')
                CREATE TABLE settings (
                  [key] NVARCHAR(255) PRIMARY KEY,
                  value NVARCHAR(MAX) NOT NULL,
                  updated_at NVARCHAR(100) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'orders')
                CREATE TABLE orders (
                  id NVARCHAR(255) PRIMARY KEY,
                  business_date NVARCHAR(50) NOT NULL,
                  status NVARCHAR(50) NOT NULL,
                  total_amount INT NOT NULL CHECK(total_amount >= 0),
                  refund_amount INT NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
                  is_demo INT NOT NULL DEFAULT 0
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'backend_owner')
                CREATE TABLE backend_owner (
                  singleton INT PRIMARY KEY CHECK(singleton = 1),
                  pid INT NOT NULL,
                  token NVARCHAR(MAX) NOT NULL
                );

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'admin_records')
                CREATE TABLE admin_records (
                  id INT IDENTITY(1,1) PRIMARY KEY,
                  module NVARCHAR(255) NOT NULL,
                  title NVARCHAR(500) NOT NULL,
                  data_json NVARCHAR(MAX) NOT NULL DEFAULT '{}',
                  status NVARCHAR(100) NOT NULL DEFAULT N'Đang dùng',
                  created_at NVARCHAR(100) NOT NULL,
                  updated_at NVARCHAR(100) NOT NULL
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

    public long CreateCustomer(string username, string email, string salt, string hash, int points = 0, int spinCredits = 0)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO customers(username,email,password_salt,password_hash,points,spin_credits,created_at) VALUES(@u,@e,@s,@h,@p,@sc,@now); SELECT CAST(SCOPE_IDENTITY() AS BIGINT);";
        command.Parameters.AddWithValue("@u", username.Trim());
        command.Parameters.AddWithValue("@e", email.Trim());
        command.Parameters.AddWithValue("@s", salt);
        command.Parameters.AddWithValue("@h", hash);
        command.Parameters.AddWithValue("@p", points);
        command.Parameters.AddWithValue("@sc", spinCredits);
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

    public bool CreateAdmin(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password)) return false;
        var existing = FindAdmin(username);
        var (salt, hash) = Tokens.HashPassword(password);
        using var db = Open();
        using var command = db.CreateCommand();

        if (existing is not null)
        {
            command.CommandText = "UPDATE admins SET password_salt=@s, password_hash=@h WHERE LOWER(username)=LOWER(@u)";
        }
        else
        {
            command.CommandText = "INSERT INTO admins (username, password_salt, password_hash, created_at) VALUES (@u, @s, @h, @now)";
            command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        }
        command.Parameters.AddWithValue("@u", username.Trim());
        command.Parameters.AddWithValue("@s", salt);
        command.Parameters.AddWithValue("@h", hash);
        return command.ExecuteNonQuery() > 0;
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

    public IReadOnlyList<object> Orders(long customerId)
    {
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = "SELECT id,items_json,recipient,phone,address,fulfillment,region,subtotal,discount,goods_total,shipping_fee,total,tier,status,created_at FROM customer_orders WHERE customer_id=@id ORDER BY created_at DESC";
            command.Parameters.AddWithValue("@id", customerId);
            using var reader = command.ExecuteReader();
            var result = new List<object>();
            while (reader.Read())
            {
                string S(int i) => reader.IsDBNull(i) ? "" : reader.GetString(i);
                result.Add(new
                {
                    id = S(0),
                    items = S(1),
                    recipient = S(2),
                    phone = S(3),
                    address = S(4),
                    fulfillment = S(5),
                    region = S(6),
                    subtotal = Convert.ToInt32(reader.GetValue(7)),
                    discount = Convert.ToInt32(reader.GetValue(8)),
                    goodsTotal = Convert.ToInt32(reader.GetValue(9)),
                    shippingFee = Convert.ToInt32(reader.GetValue(10)),
                    total = Convert.ToInt32(reader.GetValue(11)),
                    tier = S(12),
                    status = S(13),
                    createdAt = S(14),
                });
            }
            return result;
        }
        catch { return Array.Empty<object>(); }
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

    public int AdminCount()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM admins";
        return Convert.ToInt32(command.ExecuteScalar());
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
        command.CommandText = "SELECT COUNT(*) FROM Products";
        return Convert.ToInt64(command.ExecuteScalar());
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

    public void SeedDefaultProducts()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            IF NOT EXISTS (SELECT 1 FROM Products)
            BEGIN
                INSERT INTO Products (Name, Price, Category, Description, Image) VALUES
                (N'Tai nghe Everyday', 890000, N'Điện tử', N'Tai nghe chống ồn công nghệ cao', N'/products/headphones.svg'),
                (N'Túi Everyday Tote', 249000, N'Trang phục', N'Túi vải Canvas phong cách tối giản', N'/products/bag.svg'),
                (N'Đồng hồ Minimal', 1290000, N'Phụ kiện', N'Đồng hồ đeo tay phong cách Bauhaus', N'/products/watch.svg'),
                (N'Ly cà phê Morning', 159000, N'Đồ gia dụng', N'Ly sứ giữ nhiệt cao cấp', N'/products/cup.svg'),
                (N'Bàn phím cơ Không Dây', 1450000, N'Điện tử', N'Bàn phím cơ layout 75% switch êm ái', N'/products/keyboard.svg'),
                (N'Bình nước thể thao 1L', 180000, N'Đồ gia dụng', N'Bình giữ nhiệt inox 304', N'/products/bottle.svg');
            END

            IF NOT EXISTS (SELECT 1 FROM catalog_products WHERE id = '1')
            BEGIN
                INSERT INTO catalog_products (id, name, category, price, description, image, features_json, tone, symbol, label, source_url, source_price_cents, source_currency, imported_at, discount_percent, stock_count)
                VALUES
                ('1', N'Tai nghe Everyday', N'Điện tử', 890000, N'Tai nghe demo của Store.', '/products/headphones.svg', '["Chống ồn","Pin 30h"]', 'electronic', N'◉', N'Được yêu thích', '', 0, 'VND', '2026-10-08', 0, 20),
                ('2', N'Túi Everyday Tote', N'Trang phục', 249000, N'Túi Everyday dùng hằng ngày.', '/products/bag.svg', '["Vải Canvas"]', 'apparel', N'□', N'Mới', '', 0, 'VND', '2026-10-08', 0, 20),
                ('3', N'Đồng hồ Minimal', N'Phụ kiện', 1290000, N'Đồng hồ tối giản.', '/products/watch.svg', '["Dây da","Chống nước 5ATM"]', 'accessories', N'◷', N'Tối giản', '', 0, 'VND', '2026-10-08', 0, 20),
                ('4', N'Ly cà phê Morning', N'Đồ gia dụng', 159000, N'Ly cà phê dùng mỗi ngày.', '/products/cup.svg', '["Gốm sứ"]', 'home', N'◌', N'Mỗi ngày', '', 0, 'VND', '2026-10-08', 0, 20);
            END
            """;
        command.ExecuteNonQuery();
    }

    public (long Id, string Username, string Email, string GoogleSub, string TotpSecret, int TotpEnabled, string PendingSecret)? FindCustomerFull(long id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id,username,email,google_sub,totp_secret,totp_enabled,totp_pending_secret FROM customers WHERE id=@id";
        command.Parameters.AddWithValue("@id", id);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        return (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2), reader.IsDBNull(3) ? "" : reader.GetString(3), reader.IsDBNull(4) ? "" : reader.GetString(4), reader.IsDBNull(5) ? 0 : Convert.ToInt32(reader.GetValue(5)), reader.IsDBNull(6) ? "" : reader.GetString(6));
    }

    public (long Id, string Username, string Email, string Salt, string Hash, string GoogleSub, string TotpSecret, int TotpEnabled, string PendingSecret)? FindCustomerAuth(string login)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id,username,email,password_salt,password_hash,google_sub,totp_secret,totp_enabled,totp_pending_secret FROM customers WHERE LOWER(username)=LOWER(@u) OR LOWER(email)=LOWER(@u)";
        command.Parameters.AddWithValue("@u", login);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        string G(int i) => reader.IsDBNull(i) ? "" : reader.GetString(i);
        return (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4), G(5), G(6), reader.IsDBNull(7) ? 0 : Convert.ToInt32(reader.GetValue(7)), G(8));
    }

    public void CreatePasswordReset(string tokenHash, long customerId, DateTimeOffset expiresAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM password_resets WHERE customer_id=@id OR expires_at<=@now; INSERT INTO password_resets(token_hash,customer_id,expires_at,created_at) VALUES(@h,@id,@exp,@now)";
        command.Parameters.AddWithValue("@h", tokenHash);
        command.Parameters.AddWithValue("@id", customerId);
        command.Parameters.AddWithValue("@exp", expiresAt.ToString("o"));
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.ExecuteNonQuery();
    }

    public (long CustomerId, string ExpiresAt, string? UsedAt)? FindPasswordReset(string tokenHash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 customer_id,expires_at,used_at FROM password_resets WHERE token_hash=@h";
        command.Parameters.AddWithValue("@h", tokenHash);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        return (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.IsDBNull(2) ? null : reader.GetString(2));
    }

    public void ConsumePasswordReset(string tokenHash, long customerId, string salt, string hash)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE customers SET password_salt=@s,password_hash=@h WHERE id=@id; UPDATE password_resets SET used_at=@now WHERE token_hash=@t; DELETE FROM customer_sessions WHERE customer_id=@id";
        command.Parameters.AddWithValue("@s", salt);
        command.Parameters.AddWithValue("@h", hash);
        command.Parameters.AddWithValue("@id", customerId);
        command.Parameters.AddWithValue("@t", tokenHash);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.ExecuteNonQuery();
    }

    public void CreateLoginChallenge(string id, long customerId, DateTimeOffset expiresAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO login_challenges(id,customer_id,expires_at,created_at) VALUES(@id,@cid,@exp,@now)";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@cid", customerId);
        command.Parameters.AddWithValue("@exp", expiresAt.ToString("o"));
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.ExecuteNonQuery();
    }

    public (long CustomerId, string ExpiresAt)? FindLoginChallenge(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 customer_id,expires_at FROM login_challenges WHERE id=@id";
        command.Parameters.AddWithValue("@id", id);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        return (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1));
    }

    public void DeleteLoginChallenge(string id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "DELETE FROM login_challenges WHERE id=@id; DELETE FROM login_challenges WHERE expires_at<=@now";
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.ExecuteNonQuery();
    }

    public void CreateOAuthState(string state, string nextUrl, DateTimeOffset expiresAt)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "INSERT INTO oauth_states(state,next_url,expires_at,created_at) VALUES(@s,@n,@exp,@now)";
        command.Parameters.AddWithValue("@s", state);
        command.Parameters.AddWithValue("@n", nextUrl);
        command.Parameters.AddWithValue("@exp", expiresAt.ToString("o"));
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.ExecuteNonQuery();
    }

    public string? ConsumeOAuthState(string state)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 next_url,expires_at FROM oauth_states WHERE state=@s";
        command.Parameters.AddWithValue("@s", state);
        string? next = null;
        using (var reader = command.ExecuteReader())
        {
            if (reader.Read())
            {
                var expires = reader.GetString(1);
                if (string.Compare(expires, DateTimeOffset.UtcNow.ToString("o"), StringComparison.Ordinal) > 0) next = reader.GetString(0);
            }
        }
        using var del = db.CreateCommand();
        del.CommandText = "DELETE FROM oauth_states WHERE state=@s";
        del.Parameters.AddWithValue("@s", state);
        del.ExecuteNonQuery();
        return next;
    }

    public (long Id, string Username, string Email)? FindCustomerByGoogleSub(string sub)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 1 id,username,email FROM customers WHERE google_sub=@s";
        command.Parameters.AddWithValue("@s", sub);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) return null;
        return (Convert.ToInt64(reader.GetValue(0)), reader.GetString(1), reader.GetString(2));
    }

    public void LinkGoogleSub(long id, string sub)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE customers SET google_sub=@s WHERE id=@id";
        command.Parameters.AddWithValue("@s", sub);
        command.Parameters.AddWithValue("@id", id);
        command.ExecuteNonQuery();
    }

    public void BeginTotpSetup(long id, string pendingSecret)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE customers SET totp_pending_secret=@s WHERE id=@id";
        command.Parameters.AddWithValue("@s", pendingSecret);
        command.Parameters.AddWithValue("@id", id);
        command.ExecuteNonQuery();
    }

    public List<string> ConfirmTotpSetup(long id, string secret)
    {
        var codes = Totp.BackupCodes(10);
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE customers SET totp_secret=@s,totp_enabled=1,totp_pending_secret='',totp_verified_at=@now WHERE id=@id; DELETE FROM customer_totp_backups WHERE customer_id=@id";
        command.Parameters.AddWithValue("@s", secret);
        command.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        command.Parameters.AddWithValue("@id", id);
        command.ExecuteNonQuery();
        foreach (var code in codes)
        {
            using var ins = db.CreateCommand();
            ins.CommandText = "INSERT INTO customer_totp_backups(customer_id,code_hash,created_at) VALUES(@id,@h,@now)";
            ins.Parameters.AddWithValue("@id", id);
            ins.Parameters.AddWithValue("@h", Tokens.Sha256(code.ToUpperInvariant()));
            ins.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
            ins.ExecuteNonQuery();
        }
        return codes;
    }

    public void DisableTotp(long id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "UPDATE customers SET totp_secret='',totp_enabled=0,totp_pending_secret='' WHERE id=@id; DELETE FROM customer_totp_backups WHERE customer_id=@id";
        command.Parameters.AddWithValue("@id", id);
        command.ExecuteNonQuery();
    }

    public bool ConsumeBackupCode(long id, string code)
    {
        using var db = Open();
        using var find = db.CreateCommand();
        find.CommandText = "SELECT TOP 1 id FROM customer_totp_backups WHERE customer_id=@id AND code_hash=@h AND used_at IS NULL";
        find.Parameters.AddWithValue("@id", id);
        find.Parameters.AddWithValue("@h", Tokens.Sha256(code.ToUpperInvariant()));
        var row = find.ExecuteScalar();
        if (row is null || row == DBNull.Value) return false;
        using var upd = db.CreateCommand();
        upd.CommandText = "UPDATE customer_totp_backups SET used_at=@now WHERE id=@bid";
        upd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("o"));
        upd.Parameters.AddWithValue("@bid", Convert.ToInt64(row));
        upd.ExecuteNonQuery();
        return true;
    }

    public int BackupCodesLeft(long id)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM customer_totp_backups WHERE customer_id=@id AND used_at IS NULL";
        command.Parameters.AddWithValue("@id", id);
        return Convert.ToInt32(command.ExecuteScalar());
    }

    public void ResetDatabase()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            DELETE FROM customer_favorites;
            DELETE FROM password_resets;
            DELETE FROM oauth_states;
            DELETE FROM login_challenges;
            DELETE FROM customer_totp_backups;
            DELETE FROM customer_vouchers;
            DELETE FROM voucher_codes;
            DELETE FROM product_reviews;
            DELETE FROM customer_orders;
            DELETE FROM customer_sessions;
            DELETE FROM customers;
            DELETE FROM admin_sessions;
            DELETE FROM admins;
            DELETE FROM product_views;
            DELETE FROM Products;
            DELETE FROM catalog_products;
            """;
        command.ExecuteNonQuery();
        SeedDefaultProducts();
    }

    public IReadOnlyList<(string Username, string CreatedAt)> ListAdmins()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT username, created_at FROM admins ORDER BY id";
        using var reader = command.ExecuteReader();
        var list = new List<(string, string)>();
        while (reader.Read()) list.Add((reader.GetString(0), reader.GetString(1)));
        return list;
    }

    public IReadOnlyList<(string Username, string Email, int Points)> ListCustomers()
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT TOP 10 username, email, points FROM customers ORDER BY id DESC";
        using var reader = command.ExecuteReader();
        var list = new List<(string, string, int)>();
        while (reader.Read()) list.Add((reader.GetString(0), reader.GetString(1), Convert.ToInt32(reader.GetValue(2))));
        return list;
    }
}
