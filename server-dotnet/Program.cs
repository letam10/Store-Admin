/*
 * Tệp: server-dotnet/Program.cs
 * Mục đích: Điểm khởi động ASP.NET Core C# và đăng ký DI, EF Core SQL Server, CORS, Swagger, controllers và Menu quản lý.
 */
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using StoreApi.Data;

// Nạp các biến cấu hình từ file .env nếu có (GOOGLE_CLIENT_ID, SMTP, ...)
var candidateEnvPaths = new[]
{
    Path.Combine(Directory.GetCurrentDirectory(), ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "server-dotnet", ".env"),
    Path.Combine(Directory.GetCurrentDirectory(), "Store-Admin", "server-dotnet", ".env"),
    Path.Combine(AppContext.BaseDirectory, ".env"),
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".env"),
    Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "server-dotnet", ".env")
};

string? envPath = candidateEnvPaths.FirstOrDefault(File.Exists);
if (envPath == null)
{
    foreach (var baseDir in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
    {
        var cur = new DirectoryInfo(baseDir);
        while (cur != null)
        {
            var p1 = Path.Combine(cur.FullName, ".env");
            if (File.Exists(p1)) { envPath = p1; break; }
            var p2 = Path.Combine(cur.FullName, "Store-Admin", "server-dotnet", ".env");
            if (File.Exists(p2)) { envPath = p2; break; }
            cur = cur.Parent;
        }
        if (envPath != null) break;
    }
}

if (!string.IsNullOrEmpty(envPath) && File.Exists(envPath))
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
        var idx = trimmed.IndexOf('=');
        if (idx > 0)
        {
            var key = trimmed.Substring(0, idx).Trim();
            var val = trimmed.Substring(idx + 1).Trim().Trim('"', '\'');
            if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            {
                Environment.SetEnvironmentVariable(key, val);
            }
        }
    }
}

var builder = WebApplication.CreateBuilder(args);

// Đăng ký Entity Framework Core với SQL Server
// Chuẩn hoá connection string cho máy mới: driver 18 mặc định Encrypt=true gây lỗi chứng chỉ
// self-signed nếu thiếu TrustServerCertificate/Encrypt. Tự bổ sung nếu cấu hình chưa ghi rõ.
static string NormalizeConnectionString(string raw)
{
    try
    {
        var csb = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(raw);
        if (!raw.Contains("TrustServerCertificate", StringComparison.OrdinalIgnoreCase))
        {
            csb.TrustServerCertificate = true;
        }
        if (!raw.Contains("Encrypt", StringComparison.OrdinalIgnoreCase))
        {
            csb.Encrypt = false;
        }
        if (!raw.Contains("MultipleActiveResultSets", StringComparison.OrdinalIgnoreCase))
        {
            csb.MultipleActiveResultSets = true;
        }
        return csb.ConnectionString;
    }
    catch
    {
        return raw;
    }
}
var connectionString = NormalizeConnectionString(builder.Configuration.GetConnectionString("StoreDb")
    ?? "Server=localhost;Database=StoreDb;Trusted_Connection=True;TrustServerCertificate=True;Encrypt=False;MultipleActiveResultSets=true;");

// Chốt cổng chuẩn: API luôn nghe http://127.0.0.1:5000 (Google callback + Vite proxy).
// Tôn trọng --urls / ASPNETCORE_URLS nếu người gọi truyền rõ (phục vụ test cổng khác);
// nếu không, ép về 5000 để launch profile / appsettings lệch cổng không làm trôi API.
static string? GetArgValue(string[] a, string name)
{
    for (var i = 0; i < a.Length; i++)
    {
        if (a[i].Equals(name, StringComparison.OrdinalIgnoreCase) && i + 1 < a.Length)
        {
            return a[i + 1];
        }
        if (a[i].StartsWith(name + "=", StringComparison.OrdinalIgnoreCase))
        {
            return a[i].Substring(name.Length + 1);
        }
    }
    return null;
}
var explicitUrls = GetArgValue(args, "--urls") ?? Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (!string.IsNullOrWhiteSpace(explicitUrls))
{
    builder.WebHost.UseUrls(explicitUrls.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}
else
{
    builder.WebHost.UseUrls("http://127.0.0.1:5000");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => options.SwaggerDoc("v1", new OpenApiInfo
{
    Title = "Store API (ASP.NET Core)",
    Version = "v1",
    Description = "ASP.NET Core Web API kết nối SQL Server với Entity Framework Core."
}));

builder.Services.AddSingleton<StoreDb>();
builder.Services.AddSingleton<StoreApi.Services.EmailService>();

builder.Services.AddHttpContextAccessor();

builder.Services.AddCors(options => options.AddPolicy("local-frontends", policy => policy
    .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:3000", "http://127.0.0.1:3000")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Store API v1"));
}

app.UseCors("local-frontends");
app.MapControllers();

// Tự dựng StoreDb cho máy mới pull về: tạo database + tables + seed nếu rỗng.
// Chạy idempotent nên máy đã có DB không bị mất dữ liệu.
try
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.EnsureCreatedAsync();

    var storeDb = scope.ServiceProvider.GetRequiredService<StoreDb>();
    try { storeDb.EnsureDatabaseExists(); } catch { /* đã log trong StoreDb ctor */ }
    storeDb.EnsureCustomerTables();
    try
    {
        storeDb.SeedDefaultProducts();
    }
    catch (Exception seedEx)
    {
        Console.WriteLine($"[StoreDb] Chưa seed được sản phẩm mẫu: {seedEx.Message}");
    }
    Console.WriteLine($"[StoreDb] Sẵn sàng database '{storeDb.DatabaseName}'. Kiểm tra: GET /api/health/db");
}
catch (Exception ex)
{
    Console.ForegroundColor = ConsoleColor.Yellow;
    Console.WriteLine($"[StoreDb] Cảnh báo khởi động: chưa đảm bảo được database. Chi tiết: {ex.Message}");
    Console.WriteLine("[StoreDb] Hãy kiểm tra SQL Server đang Running rồi chạy: powershell ./scripts/setup-db.ps1");
    Console.ResetColor();
}

var isInteractive = Environment.UserInteractive && !Console.IsInputRedirected && !args.Contains("--no-menu") && !args.Contains("--server");
var db = app.Services.GetRequiredService<StoreDb>();

if (isInteractive)
{
    await ConsoleMenu.RunAsync(db, app);
}
else
{
    await app.RunAsync();
}
