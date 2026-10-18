/*
 * Tệp: server-dotnet/Data/StoreDb.cs
 * Mục đích: Lớp truy cập Microsoft SQL Server bằng Microsoft.Data.SqlClient cho API C#.
 */
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;

namespace StoreApi.Data;

public sealed class StoreDb
{
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customer_orders') AND name = 'payment_method')
                ALTER TABLE customer_orders ADD payment_method NVARCHAR(100) NOT NULL DEFAULT 'bank_transfer';

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customer_orders') AND name = 'scheduled_at')
                ALTER TABLE customer_orders ADD scheduled_at NVARCHAR(100) NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customer_orders') AND name = 'weight_kg')
                ALTER TABLE customer_orders ADD weight_kg FLOAT NOT NULL DEFAULT 1;


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

    private static readonly Dictionary<string, string> DefaultAppearance = new(StringComparer.OrdinalIgnoreCase)
    {
        ["brandName"] = "store",
        ["brandTagline"] = "EVERYDAY",
        ["headerSearchPlaceholder"] = "Tìm sản phẩm, danh mục…",
        ["navHome"] = "Trang chủ",
        ["navProducts"] = "Hàng hóa",
        ["navFavorites"] = "Yêu thích",
        ["navRewards"] = "May mắn",
        ["navMembership"] = "Thành viên",
        ["navContact"] = "Địa chỉ & liên hệ",
        ["heroTitle"] = "Chọn món bạn yêu. Sống theo cách riêng.",
        ["heroDescription"] = "Khám phá sản phẩm nổi bật, ưu đãi và các nhóm hàng dễ tìm.",
        ["heroButton"] = "Khám phá cửa hàng",
        ["footerText"] = "Những điều nhỏ, cho một ngày tốt hơn.",
        ["footerSupport"] = "Đội ngũ Store luôn sẵn sàng hỗ trợ bạn.",
        ["footerInfo"] = "Giá và ưu đãi được cập nhật tại cửa hàng. Điểm thành viên được cộng sau khi xác nhận thanh toán.",
        ["footerShopTitle"] = "Mua sắm",
        ["footerProducts"] = "Hàng hóa",
        ["footerCart"] = "Giỏ hàng",
        ["footerMembership"] = "Thành viên",
        ["footerRewards"] = "Vòng quay may mắn",
        ["footerSupportTitle"] = "Hỗ trợ",
        ["footerContact"] = "Địa chỉ & liên hệ",
        ["footerAccount"] = "Tài khoản của bạn",
        ["footerInfoTitle"] = "Thông tin",
        ["footerCopyright"] = "© 2026 Store",
        ["accentColor"] = "#4f8b67",
        ["bannerLabel"] = "STORE EVERYDAY",
        ["contactAddress"] = "123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        ["contactPhone"] = "0901234567",
        ["contactEmail"] = "support@store.vn",
        ["contactHours"] = "08:00 - 21:00 mỗi ngày"
    };

    private static readonly JsonSerializerOptions ThemeJsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex HexColor = new("^#[0-9a-f]{6}$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static StoreTheme DefaultTheme() => new(
        1,
        "light",
        "forest",
        new ThemeVariant(
            new ThemeColors("#f5f8f4", "#ffffff", "#edf4ed", "#183227", "#617268", "#d6e3d8", "#4f8b67", "#2f6949", "#d8eadc", "#ffffff", "#eaf4eb", "#b33f3f", "#3d8a59"),
            new ThemeRadius(18, 10, 24),
            14),
        new ThemeVariant(
            new ThemeColors("#0e1c15", "#14281f", "#1d3528", "#edf7ef", "#a8c4af", "#355943", "#76b98a", "#9bd3a8", "#254b31", "#193127", "#28543a", "#ee8b83", "#75c995"),
            new ThemeRadius(18, 10, 24),
            32));

    private static JsonElement Property(JsonElement source, string name)
    {
        if (source.ValueKind != JsonValueKind.Object) return default;
        foreach (var property in source.EnumerateObject())
        {
            if (property.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) return property.Value;
        }
        return default;
    }

    private static string ReadString(JsonElement source, string name, string fallback)
    {
        var value = Property(source, name);
        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : fallback;
    }

    private static int ReadInt(JsonElement source, string name, int fallback, int minimum, int maximum)
    {
        var value = Property(source, name);
        return value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var parsed)
            && parsed >= minimum
            && parsed <= maximum
            ? parsed
            : fallback;
    }

    private static string ReadColor(JsonElement source, string name, string fallback)
    {
        var value = ReadString(source, name, fallback);
        return HexColor.IsMatch(value) ? value.ToLowerInvariant() : fallback;
    }

    private static ThemeColors NormalizeColors(JsonElement source, ThemeColors fallback) => new(
        ReadColor(source, "page", fallback.Page),
        ReadColor(source, "surface", fallback.Surface),
        ReadColor(source, "surfaceAlt", fallback.SurfaceAlt),
        ReadColor(source, "text", fallback.Text),
        ReadColor(source, "muted", fallback.Muted),
        ReadColor(source, "border", fallback.Border),
        ReadColor(source, "accent", fallback.Accent),
        ReadColor(source, "accentStrong", fallback.AccentStrong),
        ReadColor(source, "accentSoft", fallback.AccentSoft),
        ReadColor(source, "control", fallback.Control),
        ReadColor(source, "controlActive", fallback.ControlActive),
        ReadColor(source, "danger", fallback.Danger),
        ReadColor(source, "success", fallback.Success));

    private static ThemeVariant NormalizeVariant(JsonElement source, ThemeVariant fallback)
    {
        var colors = NormalizeColors(Property(source, "colors"), fallback.Colors);
        var radius = Property(source, "radius");
        return new ThemeVariant(
            colors,
            new ThemeRadius(
                ReadInt(radius, "card", fallback.Radius.Card, 0, 24),
                ReadInt(radius, "control", fallback.Radius.Control, 0, 24),
                ReadInt(radius, "panel", fallback.Radius.Panel, 0, 24)),
            ReadInt(source, "shadowStrength", fallback.ShadowStrength, 0, 100));
    }

    private static StoreTheme NormalizeThemeJson(JsonElement source)
    {
        var fallback = DefaultTheme();
        var mode = ReadString(source, "defaultMode", fallback.DefaultMode).ToLowerInvariant();
        var preset = ReadString(source, "presetId", fallback.PresetId).ToLowerInvariant();
        var presetId = preset is "forest" or "terracotta" or "olive" ? preset : fallback.PresetId;
        return new StoreTheme(
            1,
            mode is "light" or "dark" ? mode : fallback.DefaultMode,
            presetId,
            NormalizeVariant(Property(source, "light"), fallback.Light),
            NormalizeVariant(Property(source, "dark"), fallback.Dark));
    }

    public StoreTheme Theme()
    {
        var raw = GetSetting("appearance.theme");
        if (string.IsNullOrWhiteSpace(raw)) return DefaultTheme();
        try
        {
            using var document = JsonDocument.Parse(raw);
            return NormalizeThemeJson(document.RootElement);
        }
        catch (JsonException)
        {
            return DefaultTheme();
        }
    }

    private IReadOnlyDictionary<string, string> LegacyAppearance()
    {
        var result = new Dictionary<string, string>(DefaultAppearance, StringComparer.OrdinalIgnoreCase);
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = "SELECT [key],[value] FROM settings WHERE [key] LIKE 'appearance.%' OR [key] = 'storefront_appearance'";
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var k = reader.GetString(0);
            var v = reader.GetString(1);
            if (k.Equals("storefront_appearance", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    var map = JsonSerializer.Deserialize<Dictionary<string, string>>(v);
                    if (map is not null)
                    {
                        foreach (var (mk, mv) in map) if (!string.IsNullOrWhiteSpace(mv)) result[mk] = mv;
                    }
                }
                catch { }
            }
            else if (k.StartsWith("appearance.", StringComparison.OrdinalIgnoreCase))
            {
                var key = k[11..];
                if (!key.Equals("theme", StringComparison.OrdinalIgnoreCase)) result[key] = v;
            }
        }
        return result;
    }

    public IReadOnlyDictionary<string, object?> Appearance()
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in LegacyAppearance()) result[key] = value;
        result["theme"] = Theme();
        return result;
    }

    public void SaveAppearance(IReadOnlyDictionary<string, string> dict, JsonElement? theme = null)
    {
        var merged = new Dictionary<string, string>(LegacyAppearance(), StringComparer.OrdinalIgnoreCase);
        foreach (var (k, v) in dict) merged[k] = v ?? "";
        var json = JsonSerializer.Serialize(merged);
        SetSetting("storefront_appearance", json);
        var normalizedTheme = theme.HasValue ? NormalizeThemeJson(theme.Value) : Theme();
        SetSetting("appearance.theme", JsonSerializer.Serialize(normalizedTheme, ThemeJsonOptions));
        using var db = Open();
        foreach (var (k, v) in merged)
        {
            using var cmd = db.CreateCommand();
            cmd.CommandText = """
                IF EXISTS (SELECT 1 FROM settings WHERE [key] = @key)
                    UPDATE settings SET [value] = @val, [updated_at] = @now WHERE [key] = @key;
                ELSE
                    INSERT INTO settings([key], [value], [updated_at]) VALUES(@key, @val, @now);
                """;
            cmd.Parameters.AddWithValue("@key", "appearance." + k);
            cmd.Parameters.AddWithValue("@val", v ?? "");
            cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
            cmd.ExecuteNonQuery();
        }
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

    public void CreateCustomerOrder(
        string id, long customerId, string itemsJson, string recipient, string phone, string address,
        string fulfillment, string region, int distanceKm, double weightKg,
        int subtotal, int discount, int goodsTotal, int shippingFee, int total,
        string voucherCodesJson, string tier, string paymentMethod, string? scheduledAt, string createdAt, int pointsEarned)
    {
        using var db = Open();
        using var command = db.CreateCommand();
        command.CommandText = """
            INSERT INTO customer_orders
            (id, customer_id, items_json, recipient, phone, address, fulfillment, region, distance_km, weight_kg,
             subtotal, discount, goods_total, shipping_fee, total, voucher_codes_json, tier, status, points_earned,
             created_at, payment_method, scheduled_at)
            VALUES
            (@id, @customerId, @itemsJson, @recipient, @phone, @address, @fulfillment, @region, @distanceKm, @weightKg,
             @subtotal, @discount, @goodsTotal, @shippingFee, @total, @voucherCodesJson, @tier, 'pending', @pointsEarned,
             @createdAt, @paymentMethod, @scheduledAt);
            """;
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@customerId", customerId);
        command.Parameters.AddWithValue("@itemsJson", itemsJson);
        command.Parameters.AddWithValue("@recipient", recipient);
        command.Parameters.AddWithValue("@phone", phone);
        command.Parameters.AddWithValue("@address", address);
        command.Parameters.AddWithValue("@fulfillment", fulfillment);
        command.Parameters.AddWithValue("@region", region);
        command.Parameters.AddWithValue("@distanceKm", distanceKm);
        command.Parameters.AddWithValue("@weightKg", weightKg);
        command.Parameters.AddWithValue("@subtotal", subtotal);
        command.Parameters.AddWithValue("@discount", discount);
        command.Parameters.AddWithValue("@goodsTotal", goodsTotal);
        command.Parameters.AddWithValue("@shippingFee", shippingFee);
        command.Parameters.AddWithValue("@total", total);
        command.Parameters.AddWithValue("@voucherCodesJson", voucherCodesJson);
        command.Parameters.AddWithValue("@tier", tier);
        command.Parameters.AddWithValue("@pointsEarned", pointsEarned);
        command.Parameters.AddWithValue("@createdAt", createdAt);
        command.Parameters.AddWithValue("@paymentMethod", paymentMethod);
        command.Parameters.AddWithValue("@scheduledAt", (object?)scheduledAt ?? DBNull.Value);
        command.ExecuteNonQuery();
    }

    public void ConsumeCustomerVouchers(long customerId, IEnumerable<string> codes)
    {
        using var db = Open();
        foreach (var code in codes)
        {
            using var cmd = db.CreateCommand();
            cmd.CommandText = "DELETE FROM customer_vouchers WHERE code = @code AND customer_id = @customerId";
            cmd.Parameters.AddWithValue("@code", code);
            cmd.Parameters.AddWithValue("@customerId", customerId);
            cmd.ExecuteNonQuery();
        }
    }

    public void AddCustomerPoints(long customerId, int points)
    {
        if (points <= 0) return;
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE customers SET points = points + @points WHERE id = @customerId";
        cmd.Parameters.AddWithValue("@points", points);
        cmd.Parameters.AddWithValue("@customerId", customerId);
        cmd.ExecuteNonQuery();
    }

    public int DeductSpinCredit(long customerId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE customers SET spin_credits = CASE WHEN spin_credits > 0 THEN spin_credits - 1 ELSE 0 END WHERE id = @id; SELECT spin_credits FROM customers WHERE id = @id;";
        cmd.Parameters.AddWithValue("@id", customerId);
        var res = cmd.ExecuteScalar();
        return res != null && res != DBNull.Value ? Convert.ToInt32(res) : 0;
    }

    public void UpdateOrderStatus(string orderId, string status, string? paidAt = null)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE customer_orders SET status = @status, paid_at = COALESCE(@paidAt, paid_at) WHERE id = @id";
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@paidAt", (object?)paidAt ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@id", orderId);
        cmd.ExecuteNonQuery();
    }

    public object? FindCustomerOrder(string orderId, long? customerId = null)
    {
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = customerId.HasValue
                ? "SELECT id,items_json,recipient,phone,address,fulfillment,region,subtotal,discount,goods_total,shipping_fee,total,tier,status,payment_method,scheduled_at,created_at,paid_at FROM customer_orders WHERE id=@id AND customer_id=@customerId"
                : "SELECT id,items_json,recipient,phone,address,fulfillment,region,subtotal,discount,goods_total,shipping_fee,total,tier,status,payment_method,scheduled_at,created_at,paid_at FROM customer_orders WHERE id=@id";
            command.Parameters.AddWithValue("@id", orderId);
            if (customerId.HasValue) command.Parameters.AddWithValue("@customerId", customerId.Value);

            using var reader = command.ExecuteReader();
            if (!reader.Read()) return null;
            return ReadOrderObject(reader);
        }
        catch { return null; }
    }

    public IReadOnlyList<object> Orders(long customerId)
    {
        try
        {
            using var db = Open();
            using var command = db.CreateCommand();
            command.CommandText = "SELECT id,items_json,recipient,phone,address,fulfillment,region,subtotal,discount,goods_total,shipping_fee,total,tier,status,payment_method,scheduled_at,created_at,paid_at FROM customer_orders WHERE customer_id=@id ORDER BY created_at DESC";
            command.Parameters.AddWithValue("@id", customerId);
            using var reader = command.ExecuteReader();
            var result = new List<object>();
            while (reader.Read())
            {
                result.Add(ReadOrderObject(reader));
            }
            return result;
        }
        catch { return Array.Empty<object>(); }
    }

    private static object ReadOrderObject(SqlDataReader reader)
    {
        string S(int i) => reader.IsDBNull(i) ? "" : reader.GetString(i);
        var itemsJson = S(1);
        object items = Array.Empty<object>();
        int itemCount = 0;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(itemsJson) ? "[]" : itemsJson);
            items = JsonSerializer.Deserialize<List<object>>(itemsJson) ?? [];
            itemCount = doc.RootElement.GetArrayLength();
        }
        catch { }

        var st = S(13);
        var deliveryStatus = st == "cancelled" ? "cancelled"
            : st is "delivered" or "completed" ? "delivered"
            : st == "shipped" ? "shipped"
            : st == "ready" ? "ready"
            : "processing";

        var username = reader.FieldCount > 18 && !reader.IsDBNull(18) ? reader.GetString(18) : "";

        return new
        {
            id = S(0),
            items,
            itemCount,
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
            status = st,
            deliveryStatus,
            paymentMethod = S(14),
            paymentMode = "demo",
            scheduledAt = reader.IsDBNull(15) ? null : reader.GetString(15),
            createdAt = S(16),
            paidAt = reader.IsDBNull(17) ? null : reader.GetString(17),
            username = string.IsNullOrWhiteSpace(username) ? S(2) : username,
            extraPaid = 0,
            refundAmount = 0
        };
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
        var manifestPath = Environment.GetEnvironmentVariable("CATALOG_MANIFEST_PATH");
        var candidates = new[]
        {
            manifestPath,
            Path.Combine(Directory.GetCurrentDirectory(), "shared", "catalog-manifest.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "shared", "catalog-manifest.json"),
            Path.Combine(AppContext.BaseDirectory, "shared", "catalog-manifest.json"),
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "shared", "catalog-manifest.json")
        };
        var resolved = candidates.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && File.Exists(path));
        if (string.IsNullOrWhiteSpace(resolved)) throw new FileNotFoundException("Không tìm thấy shared/catalog-manifest.json");

        using var document = JsonDocument.Parse(File.ReadAllText(resolved));
        if (!document.RootElement.TryGetProperty("products", out var productsElement) || productsElement.ValueKind != JsonValueKind.Array || productsElement.GetArrayLength() != 1000)
        {
            throw new InvalidOperationException("Manifest catalog phải có đúng 1000 sản phẩm.");
        }

        var manifest = productsElement.EnumerateArray().Select(product => new
        {
            Id = product.GetProperty("id").GetString() ?? "",
            Name = product.GetProperty("name").GetString() ?? "",
            Category = product.GetProperty("category").GetString() ?? "",
            Price = product.GetProperty("price").GetInt64(),
            Description = product.GetProperty("description").GetString() ?? "",
            Image = product.GetProperty("image").GetString() ?? "",
            Features = product.TryGetProperty("features", out var features) && features.ValueKind == JsonValueKind.Array ? features.EnumerateArray().Select(item => item.GetString() ?? "").ToList() : [],
            Tone = product.TryGetProperty("tone", out var tone) ? tone.GetString() ?? "green" : "green",
            Symbol = product.TryGetProperty("symbol", out var symbol) ? symbol.GetString() ?? "✦" : "✦",
            Label = product.TryGetProperty("label", out var label) ? label.GetString() ?? "Nguồn mẫu" : "Nguồn mẫu",
            Source = product.TryGetProperty("source", out var source) ? source.GetString() ?? "" : "",
            SourceId = product.TryGetProperty("sourceId", out var sourceId) ? sourceId.GetString() ?? "" : "",
            SourceUrl = product.TryGetProperty("sourceUrl", out var sourceUrl) ? sourceUrl.GetString() ?? "" : "",
            SourcePriceCents = product.TryGetProperty("sourcePriceCents", out var cents) && cents.ValueKind == JsonValueKind.Number ? cents.GetInt64() : 0,
            SourceCurrency = product.TryGetProperty("sourceCurrency", out var currency) ? currency.GetString() ?? "VND" : "VND",
            ImportedAt = product.TryGetProperty("importedAt", out var importedAt) ? importedAt.GetString() ?? DateTimeOffset.UtcNow.ToString("O") : DateTimeOffset.UtcNow.ToString("O"),
            DiscountPercent = product.TryGetProperty("discountPercent", out var discount) && discount.ValueKind == JsonValueKind.Number ? Math.Clamp(discount.GetInt32(), 0, 90) : 0,
            StockCount = product.TryGetProperty("stockCount", out var stock) && stock.ValueKind == JsonValueKind.Number ? Math.Max(0, stock.GetInt32()) : 20
        }).Where(product => !string.IsNullOrWhiteSpace(product.Id)).ToList();
        var allowedIds = manifest.Select(product => product.Id).ToHashSet(StringComparer.Ordinal);
        var backfillNeeded = !string.Equals(GetSetting("catalog.manifest.backfill.v1"), "completed", StringComparison.OrdinalIgnoreCase);

        using var db = Open();
        using var transaction = db.BeginTransaction();
        using (var delete = db.CreateCommand())
        {
            delete.Transaction = transaction;
            delete.CommandText = "SELECT id FROM catalog_products";
            var existingIds = new List<string>();
            using var reader = delete.ExecuteReader();
            while (reader.Read()) existingIds.Add(reader.GetString(0));
            reader.Close();
            foreach (var id in existingIds.Where(id => !allowedIds.Contains(id)))
            {
                delete.CommandText = "DELETE FROM catalog_products WHERE id=@id";
                delete.Parameters.Clear();
                delete.Parameters.AddWithValue("@id", id);
                delete.ExecuteNonQuery();
            }
        }

        foreach (var product in manifest)
        {
            using var upsert = db.CreateCommand();
            upsert.Transaction = transaction;
            upsert.CommandText = """
                IF EXISTS (SELECT 1 FROM catalog_products WHERE id=@id)
                BEGIN
                    UPDATE catalog_products SET
                        source=@source, source_id=@sourceId, name=@name, category=@category, price=@price,
                        description=@description, image=@image, features_json=@features, tone=@tone, symbol=@symbol,
                        label=@label, source_url=@sourceUrl, source_price_cents=@sourcePriceCents,
                        source_currency=@sourceCurrency, imported_at=@importedAt,
                        discount_percent=CASE WHEN @backfill=1 AND discount_percent=0 AND @discount>0 THEN @discount ELSE discount_percent END,
                        stock_count=CASE WHEN @backfill=1 AND stock_count=20 AND @stock<>20 THEN @stock ELSE stock_count END
                    WHERE id=@id;
                END
                ELSE
                BEGIN
                    INSERT INTO catalog_products (id,source,source_id,name,category,price,description,image,features_json,tone,symbol,label,source_url,source_price_cents,source_currency,imported_at,discount_percent,stock_count)
                    VALUES (@id,@source,@sourceId,@name,@category,@price,@description,@image,@features,@tone,@symbol,@label,@sourceUrl,@sourcePriceCents,@sourceCurrency,@importedAt,@discount,@stock);
                END
                """;
            upsert.Parameters.AddWithValue("@id", product.Id);
            upsert.Parameters.AddWithValue("@source", product.Source);
            upsert.Parameters.AddWithValue("@sourceId", product.SourceId);
            upsert.Parameters.AddWithValue("@name", product.Name);
            upsert.Parameters.AddWithValue("@category", product.Category);
            upsert.Parameters.AddWithValue("@price", product.Price);
            upsert.Parameters.AddWithValue("@description", product.Description);
            upsert.Parameters.AddWithValue("@image", product.Image);
            upsert.Parameters.AddWithValue("@features", JsonSerializer.Serialize(product.Features));
            upsert.Parameters.AddWithValue("@tone", product.Tone);
            upsert.Parameters.AddWithValue("@symbol", product.Symbol);
            upsert.Parameters.AddWithValue("@label", product.Label);
            upsert.Parameters.AddWithValue("@sourceUrl", product.SourceUrl);
            upsert.Parameters.AddWithValue("@sourcePriceCents", product.SourcePriceCents);
            upsert.Parameters.AddWithValue("@sourceCurrency", product.SourceCurrency);
            upsert.Parameters.AddWithValue("@importedAt", product.ImportedAt);
            upsert.Parameters.AddWithValue("@discount", product.DiscountPercent);
            upsert.Parameters.AddWithValue("@stock", product.StockCount);
            upsert.Parameters.AddWithValue("@backfill", backfillNeeded ? 1 : 0);
            upsert.ExecuteNonQuery();
        }
        if (backfillNeeded)
        {
            using var marker = db.CreateCommand();
            marker.Transaction = transaction;
            marker.CommandText = """
                IF EXISTS (SELECT 1 FROM settings WHERE [key]='catalog.manifest.backfill.v1')
                    UPDATE settings SET [value]='completed', [updated_at]=@now WHERE [key]='catalog.manifest.backfill.v1';
                ELSE
                    INSERT INTO settings([key],[value],[updated_at]) VALUES('catalog.manifest.backfill.v1','completed',@now);
                """;
            marker.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
            marker.ExecuteNonQuery();
        }
        transaction.Commit();
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

    public void SetSetting(string key, string value)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            IF EXISTS (SELECT 1 FROM settings WHERE [key] = @key)
                UPDATE settings SET [value] = @val, [updated_at] = @now WHERE [key] = @key;
            ELSE
                INSERT INTO settings([key], [value], [updated_at]) VALUES(@key, @val, @now);
            """;
        cmd.Parameters.AddWithValue("@key", key);
        cmd.Parameters.AddWithValue("@val", value);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        cmd.ExecuteNonQuery();
    }

    public string? GetSetting(string key)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT TOP 1 [value] FROM settings WHERE [key] = @key";
        cmd.Parameters.AddWithValue("@key", key);
        var res = cmd.ExecuteScalar();
        return res is null || res is DBNull ? null : Convert.ToString(res);
    }

    public object GetPaymentSettings()
    {
        var raw = GetSetting("payment_settings");
        if (!string.IsNullOrWhiteSpace(raw))
        {
            try
            {
                var doc = JsonSerializer.Deserialize<Dictionary<string, string>>(raw);
                if (doc is not null)
                {
                    return new
                    {
                        mode = doc.GetValueOrDefault("mode", "demo"),
                        bankName = doc.GetValueOrDefault("bankName", "Vietcombank"),
                        bankBin = doc.GetValueOrDefault("bankBin", "970436"),
                        accountNumber = doc.GetValueOrDefault("accountNumber", "0123456789"),
                        accountName = doc.GetValueOrDefault("accountName", "CONG TY TNHH STORE")
                    };
                }
            }
            catch { }
        }
        return new
        {
            mode = "demo",
            bankName = "Vietcombank",
            bankBin = "970436",
            accountNumber = "0123456789",
            accountName = "CONG TY TNHH STORE"
        };
    }

    public object SavePaymentSettings(string mode, string? bankName, string? bankBin, string? accountNumber, string? accountName)
    {
        var settings = new Dictionary<string, string>
        {
            ["mode"] = mode ?? "demo",
            ["bankName"] = bankName ?? "",
            ["bankBin"] = bankBin ?? "",
            ["accountNumber"] = accountNumber ?? "",
            ["accountName"] = accountName ?? ""
        };
        SetSetting("payment_settings", JsonSerializer.Serialize(settings));
        return settings;
    }

    public IReadOnlyList<object> ListAdminRecords(string? module = null)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = string.IsNullOrWhiteSpace(module)
            ? "SELECT id, module, title, data_json, status, created_at, updated_at FROM admin_records ORDER BY id DESC"
            : "SELECT id, module, title, data_json, status, created_at, updated_at FROM admin_records WHERE module = @m ORDER BY id DESC";
        if (!string.IsNullOrWhiteSpace(module)) cmd.Parameters.AddWithValue("@m", module);
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            var rawData = reader.IsDBNull(3) ? "{}" : reader.GetString(3);
            object dataObj;
            try { dataObj = JsonSerializer.Deserialize<Dictionary<string, object?>>(rawData) ?? []; }
            catch { dataObj = new Dictionary<string, object?>(); }
            list.Add(new
            {
                id = Convert.ToInt32(reader.GetValue(0)),
                module = reader.GetString(1),
                title = reader.GetString(2),
                data = dataObj,
                status = reader.GetString(4),
                createdAt = reader.GetString(5),
                updatedAt = reader.GetString(6)
            });
        }
        return list;
    }

    public object CreateAdminRecord(string module, string title, string status, string dataJson)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO admin_records(module, title, data_json, status, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES(@module, @title, @dataJson, @status, @now, @now);
            """;
        cmd.Parameters.AddWithValue("@module", module);
        cmd.Parameters.AddWithValue("@title", title);
        cmd.Parameters.AddWithValue("@dataJson", dataJson);
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@now", now);
        var id = Convert.ToInt32(cmd.ExecuteScalar());
        object dataObj;
        try { dataObj = JsonSerializer.Deserialize<Dictionary<string, object?>>(dataJson) ?? []; }
        catch { dataObj = new Dictionary<string, object?>(); }
        return new { id, module, title, data = dataObj, status, createdAt = now, updatedAt = now };
    }

    public object? UpdateAdminRecord(int id, string? module, string title, string status, string dataJson)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE admin_records
            SET title = @title, status = @status, data_json = @dataJson, updated_at = @now
            WHERE id = @id;
            SELECT module, created_at FROM admin_records WHERE id = @id;
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@title", title);
        cmd.Parameters.AddWithValue("@status", status);
        cmd.Parameters.AddWithValue("@dataJson", dataJson);
        cmd.Parameters.AddWithValue("@now", now);
        using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return null;
        var actualModule = reader.GetString(0);
        var createdAt = reader.GetString(1);
        object dataObj;
        try { dataObj = JsonSerializer.Deserialize<Dictionary<string, object?>>(dataJson) ?? []; }
        catch { dataObj = new Dictionary<string, object?>(); }
        return new { id, module = actualModule, title, data = dataObj, status, createdAt, updatedAt = now };
    }

    public bool DeleteAdminRecord(int id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM admin_records WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    public IReadOnlyList<object> ListAdminCustomers()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "SELECT id, username, email, points, paid_goods_total, spin_credits, created_at FROM customers ORDER BY points DESC, id ASC";
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            var pts = Convert.ToInt32(reader.GetValue(3));
            list.Add(new
            {
                id = Convert.ToInt64(reader.GetValue(0)),
                username = reader.GetString(1),
                email = reader.GetString(2),
                points = pts,
                paidGoodsTotal = Convert.ToInt32(reader.GetValue(4)),
                spinCredits = Convert.ToInt32(reader.GetValue(5)),
                createdAt = reader.GetString(6),
                tier = pts >= 10000 ? "diamond" : pts >= 1000 ? "gold" : pts >= 100 ? "silver" : "bronze"
            });
        }
        return list;
    }

    public IReadOnlyList<object> ListAdminVouchers()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT v.code, v.label, v.type, v.value, v.scope, v.expires_at, v.source, v.created_at, c.id, c.username, c.email
            FROM customer_vouchers v
            JOIN customers c ON c.id = v.customer_id
            ORDER BY v.created_at DESC
            """;
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            list.Add(new
            {
                code = reader.GetString(0),
                label = reader.GetString(1),
                type = reader.GetString(2),
                value = Convert.ToInt32(reader.GetValue(3)),
                scope = reader.GetString(4),
                expiresAt = reader.GetString(5),
                source = reader.GetString(6),
                createdAt = reader.GetString(7),
                customerId = Convert.ToInt64(reader.GetValue(8)),
                username = reader.GetString(9),
                email = reader.GetString(10),
                active = true
            });
        }
        return list;
    }

    public object CreateAdminVoucher(string code, long customerId, string label, string type, int value, string scope, string expiresAt, string source)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            IF NOT EXISTS (SELECT 1 FROM voucher_codes WHERE code = @code)
                INSERT INTO voucher_codes(code, created_at) VALUES(@code, @now);
            INSERT INTO customer_vouchers(code, customer_id, label, type, value, scope, expires_at, source, created_at)
            VALUES(@code, @cid, @label, @type, @val, @scope, @exp, @src, @now);
            """;
        cmd.Parameters.AddWithValue("@code", code);
        cmd.Parameters.AddWithValue("@cid", customerId);
        cmd.Parameters.AddWithValue("@label", label);
        cmd.Parameters.AddWithValue("@type", type);
        cmd.Parameters.AddWithValue("@val", value);
        cmd.Parameters.AddWithValue("@scope", scope);
        cmd.Parameters.AddWithValue("@exp", expiresAt);
        cmd.Parameters.AddWithValue("@src", source);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.ExecuteNonQuery();
        return new { code, label, type, value, scope, expiresAt, source, createdAt = now, customerId };
    }

    public bool UpdateAdminVoucher(string code, string? label, string? type, int? value, string? scope, string? expiresAt)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE customer_vouchers
            SET label = COALESCE(@label, label),
                type = COALESCE(@type, type),
                value = COALESCE(@val, value),
                scope = COALESCE(@scope, scope),
                expires_at = COALESCE(@exp, expires_at)
            WHERE code = @code
            """;
        cmd.Parameters.AddWithValue("@code", code);
        cmd.Parameters.AddWithValue("@label", (object?)label ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@type", (object?)type ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@val", (object?)value ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@scope", (object?)scope ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@exp", (object?)expiresAt ?? DBNull.Value);
        return cmd.ExecuteNonQuery() > 0;
    }

    public bool DeleteAdminVoucher(string code)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "DELETE FROM customer_vouchers WHERE code = @c; DELETE FROM voucher_codes WHERE code = @c;";
        cmd.Parameters.AddWithValue("@c", code);
        return cmd.ExecuteNonQuery() > 0;
    }


    public IReadOnlyList<object> ListAdminFavorites()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT f.product_id, COUNT(*) AS cnt, p.name, p.image, p.symbol
            FROM customer_favorites f
            LEFT JOIN catalog_products p ON p.id = f.product_id
            GROUP BY f.product_id, p.name, p.image, p.symbol
            ORDER BY cnt DESC, f.product_id ASC
            """;
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            var pid = reader.GetString(0);
            list.Add(new
            {
                id = pid,
                count = Convert.ToInt32(reader.GetValue(1)),
                name = reader.IsDBNull(2) ? pid : reader.GetString(2),
                image = reader.IsDBNull(3) ? null : reader.GetString(3),
                symbol = reader.IsDBNull(4) ? "✦" : reader.GetString(4)
            });
        }
        return list;
    }

    public IReadOnlyList<object> ListAdminReviews()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT r.id, r.product_id, r.rating, r.comment, r.admin_reply, r.created_at, c.username, p.name
            FROM product_reviews r
            JOIN customers c ON c.id = r.customer_id
            LEFT JOIN catalog_products p ON p.id = r.product_id
            ORDER BY r.created_at DESC
            """;
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            var pid = reader.GetString(1);
            list.Add(new
            {
                id = Convert.ToInt64(reader.GetValue(0)),
                productId = pid,
                rating = Convert.ToInt32(reader.GetValue(2)),
                comment = reader.GetString(3),
                adminReply = reader.IsDBNull(4) ? "" : reader.GetString(4),
                createdAt = reader.GetString(5),
                username = reader.GetString(6),
                productName = reader.IsDBNull(7) ? pid : reader.GetString(7)
            });
        }
        return list;
    }

    public bool ReplyAdminReview(long id, string reply)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE product_reviews SET admin_reply = @reply, replied_at = @now WHERE id = @id";
        cmd.Parameters.AddWithValue("@reply", reply);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        cmd.Parameters.AddWithValue("@id", id);
        return cmd.ExecuteNonQuery() > 0;
    }

    public IReadOnlyList<object> ListProductReviews(string productId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT r.id, r.product_id, r.customer_id, r.customer_name, r.rating, r.comment, r.admin_reply, r.created_at, r.replied_at
            FROM product_reviews r
            WHERE r.product_id = @pid
            ORDER BY r.created_at DESC
            """;
        cmd.Parameters.AddWithValue("@pid", productId);
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            list.Add(new
            {
                id = Convert.ToInt64(reader.GetValue(0)),
                productId = reader.GetString(1),
                customerId = Convert.ToInt64(reader.GetValue(2)),
                customerName = reader.GetString(3),
                rating = Convert.ToInt32(reader.GetValue(4)),
                comment = reader.GetString(5),
                adminReply = reader.IsDBNull(6) ? "" : reader.GetString(6),
                createdAt = reader.GetString(7),
                repliedAt = reader.IsDBNull(8) ? null : reader.GetString(8)
            });
        }
        return list;
    }

    public void UpsertProductReview(string productId, long customerId, string customerName, int rating, string comment)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            IF EXISTS (SELECT 1 FROM product_reviews WHERE product_id = @pid AND customer_id = @cid)
                UPDATE product_reviews SET rating = @rating, comment = @comment, customer_name = @cname WHERE product_id = @pid AND customer_id = @cid;
            ELSE
                INSERT INTO product_reviews(product_id, customer_id, customer_name, rating, comment, admin_reply, created_at)
                VALUES(@pid, @cid, @cname, @rating, @comment, '', @now);
            """;
        cmd.Parameters.AddWithValue("@pid", productId);
        cmd.Parameters.AddWithValue("@cid", customerId);
        cmd.Parameters.AddWithValue("@cname", customerName);
        cmd.Parameters.AddWithValue("@rating", rating);
        cmd.Parameters.AddWithValue("@comment", comment);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.ExecuteNonQuery();
    }

    public IReadOnlyList<object> ListAllAdminOrders()
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT o.id, o.items_json, o.recipient, o.phone, o.address, o.fulfillment, o.region,
                   o.subtotal, o.discount, o.goods_total, o.shipping_fee, o.total, o.tier, o.status,
                   o.payment_method, o.scheduled_at, o.created_at, o.paid_at, c.username
            FROM customer_orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            ORDER BY o.created_at DESC
            """;
        using var reader = cmd.ExecuteReader();
        var list = new List<object>();
        while (reader.Read())
        {
            list.Add(ReadOrderObject(reader));
        }
        return list;
    }

    public bool MarkAdminOrderPaid(string orderId, string? reference)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE customer_orders SET status = 'paid', paid_at = COALESCE(paid_at, @now) WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", orderId);
        cmd.Parameters.AddWithValue("@now", DateTimeOffset.UtcNow.ToString("O"));
        return cmd.ExecuteNonQuery() > 0;
    }

    public bool UpdateAdminOrderFulfillment(string orderId, string fulfillmentStatus)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        var status = fulfillmentStatus == "delivered" ? "completed" : fulfillmentStatus;
        cmd.CommandText = "UPDATE customer_orders SET status = @st WHERE id = @id";
        cmd.Parameters.AddWithValue("@st", status);
        cmd.Parameters.AddWithValue("@id", orderId);
        return cmd.ExecuteNonQuery() > 0;
    }

    public bool CancelAdminOrder(string orderId)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = "UPDATE customer_orders SET status = 'cancelled' WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", orderId);
        return cmd.ExecuteNonQuery() > 0;
    }


    public CatalogProduct? GetCatalogProduct(string id)
    {
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            SELECT p.id, p.name, p.category, p.price, p.description, p.image, p.features_json, p.tone, p.symbol, p.label,
                   COALESCE(p.discount_percent,0), COALESCE(p.stock_count,20), COALESCE(v.view_count,0)
            FROM catalog_products p
            LEFT JOIN product_views v ON v.product_id = p.id
            WHERE p.id = @id
            """;
        cmd.Parameters.AddWithValue("@id", id);
        using var reader = cmd.ExecuteReader();
        return reader.Read() ? ReadProduct(reader) : null;
    }

    public CatalogProduct CreateCatalogProduct(
        string id, string name, string category, long price, string description, string image,
        IReadOnlyList<string> features, string tone, string symbol, string label, int stockCount)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var featuresJson = JsonSerializer.Serialize(features ?? []);
        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            INSERT INTO catalog_products
            (id, source, source_id, name, category, price, description, image, features_json, tone, symbol, label, source_url, source_price_cents, source_currency, imported_at, discount_percent, stock_count)
            VALUES
            (@id, 'admin-manual', @id, @name, @category, @price, @desc, @img, @feat, @tone, @sym, @label, 'local://admin-manual', @price, 'VND', @now, 0, @stock);

            INSERT INTO Products(Name, Price, Category, Description, Image)
            VALUES(@name, @price, @category, @desc, @img);
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", name);
        cmd.Parameters.AddWithValue("@category", category);
        cmd.Parameters.AddWithValue("@price", price);
        cmd.Parameters.AddWithValue("@desc", description);
        cmd.Parameters.AddWithValue("@img", image);
        cmd.Parameters.AddWithValue("@feat", featuresJson);
        cmd.Parameters.AddWithValue("@tone", tone);
        cmd.Parameters.AddWithValue("@sym", symbol);
        cmd.Parameters.AddWithValue("@label", label);
        cmd.Parameters.AddWithValue("@stock", stockCount);
        cmd.Parameters.AddWithValue("@now", now);
        cmd.ExecuteNonQuery();

        return new CatalogProduct(id, name, category, price, description, image, features ?? [], tone, symbol, label, 0, stockCount, 0);
    }

    public CatalogProduct? UpdateCatalogProduct(
        string id, string? name, string? category, long? price, string? description,
        string? image, string? label, int? stockCount, string? symbol)
    {
        var existing = GetCatalogProduct(id);
        if (existing is null) return null;

        var newName = name ?? existing.Name;
        var newCategory = category ?? existing.Category;
        var newPrice = price ?? existing.Price;
        var newDesc = description ?? existing.Description;
        var newImg = image ?? existing.Image;
        var newLabel = label ?? existing.Label;
        var newStock = stockCount ?? existing.StockCount;
        var newSym = symbol ?? existing.Symbol;

        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            UPDATE catalog_products
            SET name = @name, category = @category, price = @price, description = @desc,
                image = @img, label = @label, stock_count = @stock, symbol = @sym
            WHERE id = @id;

            UPDATE Products
            SET Name = @name, Price = @price, Category = @category, Description = @desc, Image = @img
            WHERE Name = @oldName;
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", newName);
        cmd.Parameters.AddWithValue("@category", newCategory);
        cmd.Parameters.AddWithValue("@price", newPrice);
        cmd.Parameters.AddWithValue("@desc", newDesc);
        cmd.Parameters.AddWithValue("@img", newImg);
        cmd.Parameters.AddWithValue("@label", newLabel);
        cmd.Parameters.AddWithValue("@stock", newStock);
        cmd.Parameters.AddWithValue("@sym", newSym);
        cmd.Parameters.AddWithValue("@oldName", existing.Name);
        cmd.ExecuteNonQuery();

        return new CatalogProduct(id, newName, newCategory, newPrice, newDesc, newImg, existing.Features, existing.Tone, newSym, newLabel, existing.DiscountPercent, newStock, existing.ViewCount);
    }

    public bool DeleteCatalogProduct(string id)
    {
        var existing = GetCatalogProduct(id);
        if (existing is null) return false;

        using var db = Open();
        using var cmd = db.CreateCommand();
        cmd.CommandText = """
            DELETE FROM catalog_products WHERE id = @id;
            DELETE FROM product_views WHERE product_id = @id;
            DELETE FROM Products WHERE Name = @name;
            """;
        cmd.Parameters.AddWithValue("@id", id);
        cmd.Parameters.AddWithValue("@name", existing.Name);
        return cmd.ExecuteNonQuery() > 0;
    }


    public object CalculateAdminRevenue(string from, string to)
    {
        using var db = Open();
        long custAll = 0, custInc = 0, custGross = 0, custNet = 0;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = """
                SELECT
                    COUNT(*),
                    SUM(CASE WHEN status IN ('paid', 'completed', 'delivered') THEN 1 ELSE 0 END),
                    COALESCE(SUM(CASE WHEN status IN ('paid', 'completed', 'delivered') THEN CAST(total AS BIGINT) ELSE 0 END), 0)
                FROM customer_orders
                WHERE SUBSTRING(COALESCE(paid_at, created_at), 1, 10) BETWEEN @from AND @to
                """;
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                custAll = r.IsDBNull(0) ? 0 : Convert.ToInt64(r.GetValue(0));
                custInc = r.IsDBNull(1) ? 0 : Convert.ToInt64(r.GetValue(1));
                custGross = r.IsDBNull(2) ? 0 : Convert.ToInt64(r.GetValue(2));
                custNet = custGross;
            }
        }

        long ordAll = 0, ordInc = 0, ordGross = 0, ordRefund = 0, ordNet = 0, ordDemo = 0, ordReal = 0;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = """
                SELECT
                    COUNT(*),
                    SUM(CASE WHEN status IN ('paid', 'completed') THEN 1 ELSE 0 END),
                    COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN CAST(total_amount AS BIGINT) ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN CAST(refund_amount AS BIGINT) ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN status IN ('paid', 'completed') THEN CAST(total_amount - refund_amount AS BIGINT) ELSE 0 END), 0),
                    SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END),
                    SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END)
                FROM orders
                WHERE business_date BETWEEN @from AND @to
                """;
            cmd.Parameters.AddWithValue("@from", from);
            cmd.Parameters.AddWithValue("@to", to);
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                ordAll = r.IsDBNull(0) ? 0 : Convert.ToInt64(r.GetValue(0));
                ordInc = r.IsDBNull(1) ? 0 : Convert.ToInt64(r.GetValue(1));
                ordGross = r.IsDBNull(2) ? 0 : Convert.ToInt64(r.GetValue(2));
                ordRefund = r.IsDBNull(3) ? 0 : Convert.ToInt64(r.GetValue(3));
                ordNet = r.IsDBNull(4) ? 0 : Convert.ToInt64(r.GetValue(4));
                ordDemo = r.IsDBNull(5) ? 0 : Convert.ToInt64(r.GetValue(5));
                ordReal = r.IsDBNull(6) ? 0 : Convert.ToInt64(r.GetValue(6));
            }
        }

        var allOrders = custAll + ordAll;
        var includedOrders = custInc + ordInc;
        var grossRevenue = custGross + ordGross;
        var refunds = ordRefund;
        var netRevenue = custNet + ordNet;
        var realOrders = ordReal + custAll;
        var demoOrders = ordDemo;

        var dataMode = allOrders == 0 ? "none" : demoOrders == allOrders ? "demo" : realOrders == allOrders ? "real" : "mixed";

        return new
        {
            from,
            to,
            timezone = "Asia/Ho_Chi_Minh",
            includedStatuses = new[] { "paid", "completed" },
            excludedStatuses = new[] { "cancelled" },
            allOrders,
            includedOrders,
            grossRevenue,
            refunds,
            netRevenue,
            currency = "VND",
            dataMode
        };
    }


    public object GetAdminOverview()
    {
        using var db = Open();
        long grossRev = 0;
        int incOrders = 0;
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT COALESCE(SUM(CAST(total AS BIGINT)), 0), COUNT(*) FROM customer_orders WHERE status IN ('paid', 'completed', 'delivered')";
            using var r = cmd.ExecuteReader();
            if (r.Read())
            {
                grossRev = r.IsDBNull(0) ? 0 : Convert.ToInt64(r.GetValue(0));
                incOrders = r.IsDBNull(1) ? 0 : Convert.ToInt32(r.GetValue(1));
            }
        }

        var revenueByDay = new List<object>();
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = """
                SELECT SUBSTRING(COALESCE(paid_at, created_at), 1, 10) AS dt,
                       COALESCE(SUM(CAST(total AS BIGINT)), 0) AS rev,
                       COUNT(*) AS ords
                FROM customer_orders
                WHERE status IN ('paid', 'completed', 'delivered')
                GROUP BY SUBSTRING(COALESCE(paid_at, created_at), 1, 10)
                ORDER BY dt ASC
                """;
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                revenueByDay.Add(new
                {
                    date = r.IsDBNull(0) ? "" : r.GetString(0),
                    revenue = r.IsDBNull(1) ? 0 : Convert.ToInt64(r.GetValue(1)),
                    orders = r.IsDBNull(2) ? 0 : Convert.ToInt32(r.GetValue(2))
                });
            }
        }

        var orderStatus = new List<object>();
        using (var cmd = db.CreateCommand())
        {
            cmd.CommandText = "SELECT status, COUNT(*) FROM customer_orders GROUP BY status";
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                orderStatus.Add(new
                {
                    status = r.GetString(0),
                    count = Convert.ToInt32(r.GetValue(1))
                });
            }
        }

        return new
        {
            products = ProductCount(),
            customers = CustomerCount(),
            orders = OrderCount(),
            totalViews = TotalViews(),
            favorites = ListAdminFavorites().Count,
            records = ListAdminRecords().Count,
            revenue = grossRev,
            includedOrders = incOrders,
            revenueByDay,
            orderStatus
        };
    }


}
