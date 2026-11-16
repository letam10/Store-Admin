/*
 * Tệp: server-dotnet/Program.cs
 * Mục đích: Điểm khởi động ASP.NET Core C# và đăng ký DI, EF Core SQL Server, CORS, Swagger, controllers và Menu quản lý.
 */
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using StoreApi.Data;
using StoreApi.Middlewares;
using StoreApi.UI;
using System.IO.Compression;

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

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    kvp => System.Text.Json.JsonNamingPolicy.CamelCase.ConvertName(kvp.Key),
                    kvp => kvp.Value!.Errors.Select(e =>
                    {
                        var msg = e.ErrorMessage;
                        if (string.IsNullOrWhiteSpace(msg))
                            msg = "Dữ liệu trường này không hợp lệ.";
                        else if (msg.Contains("is required", StringComparison.OrdinalIgnoreCase))
                            msg = "Trường này là bắt buộc.";
                        else if (msg.Contains("could not be converted", StringComparison.OrdinalIgnoreCase))
                            msg = "Định dạng dữ liệu không đúng kiểu quy định.";
                        return msg;
                    }).ToArray()
                );

            var response = new
            {
                ok = false,
                error = "INVALID_INPUT",
                message = "Dữ liệu nhập vào chưa hợp lệ. Vui lòng kiểm tra lại các trường thông tin.",
                errors,
                traceId = System.Diagnostics.Activity.Current?.Id ?? context.HttpContext.TraceIdentifier
            };

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(response);
        };
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "OmniCart Backend API",
        Version = "v1",
        Description = "ASP.NET Core Web API kết nối SQL Server với Entity Framework Core, phục vụ storefront và trang quản trị.",
        Contact = new OpenApiContact
        {
            Name = "OmniCart Engineering Team",
            Email = "support@omnicart.local"
        }
    });

    options.TagActionsBy(api =>
    {
        if (api.GroupName != null) return new[] { api.GroupName };
        var controllerName = api.ActionDescriptor.RouteValues["controller"];
        return new[]
        {
            controllerName switch
            {
                "Storefront" => "1. Storefront (Danh mục & Cửa hàng)",
                "Customer" => "2. Customer (Khách hàng & Đơn hàng)",
                "Products" => "3. Products (Quản lý hàng hóa EF Core)",
                "Support" => "4. Support & AI (Hỗ trợ khách & Ollama)",
                "Health" => "5. Health Checks (Giám sát hệ thống)",
                "Admin" => "6. Admin (Quản trị vận hành)",
                "AdminAccounts" => "6. Admin - Tài khoản",
                "AdminOperationalExports" => "6. Admin - Xuất dữ liệu",
                "AdminReports" => "6. Admin - Báo cáo",
                "AdminSePay" => "6. Admin - SePay",
                "AdminUnmatchedPayments" => "6. Admin - Đối soát thanh toán",
                "AdminVouchers" => "6. Admin - Khuyến mãi & Voucher",
                _ => controllerName ?? "General"
            }
        };
    });
    options.DocInclusionPredicate((docName, api) => true);
});

builder.Services.AddSingleton<StoreDb>();
builder.Services.AddSingleton<StoreApi.Services.EmailService>();
builder.Services.AddHostedService<StoreApi.Services.NotificationWorker>();
builder.Services.AddHttpClient<StoreApi.Services.SePayClient>(client => client.Timeout = TimeSpan.FromSeconds(15))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddHostedService<StoreApi.Services.SePayWorker>();
builder.Services.AddSingleton<StoreApi.Services.AiChatService>();
builder.Services.AddSingleton<StoreApi.Services.OllamaChatClient>();
builder.Services.AddSingleton<StoreApi.Services.OllamaRuntime>();
builder.Services.AddSingleton<StoreApi.Services.ChatStreamService>();

builder.Services.AddHttpContextAccessor();

// Đăng ký Response Compression (Brotli + Gzip) để giảm payload JSON/SVG tải về cho Frontend
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/json",
        "text/json",
        "image/svg+xml"
    });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options => options.Level = CompressionLevel.Fastest);

// Đăng ký Memory Cache và Cache chuyên dụng cho Storefront
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<StoreApi.Services.StorefrontCache>();

var frontendUrl = (builder.Configuration["FRONTEND_URL"] ?? Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "http://127.0.0.1:5173").TrimEnd('/');

// Rà soát CORS: Cho phép rõ ràng http://127.0.0.1:5174, http://localhost:5174, http://127.0.0.1:5173, http://localhost:5173
builder.Services.AddCors(options => options.AddPolicy("local-frontends", policy =>
{
    var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174"
    };

    if (!string.IsNullOrWhiteSpace(frontendUrl))
    {
        allowedOrigins.Add(frontendUrl);
    }

    policy.SetIsOriginAllowed(origin =>
    {
        if (string.IsNullOrWhiteSpace(origin)) return false;
        if (allowedOrigins.Contains(origin)) return true;
        try
        {
            var uri = new Uri(origin);
            return uri.Host is "localhost" or "127.0.0.1";
        }
        catch { return false; }
    })
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()
    .WithExposedHeaders("x-csrf-token", "Content-Disposition");
}));

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseResponseCompression();
app.UseMiddleware<RequestTimingMiddleware>();

app.UseStatusCodePages(async statusCodeContext =>
{
    var response = statusCodeContext.HttpContext.Response;
    var request = statusCodeContext.HttpContext.Request;

    if (response.StatusCode == StatusCodes.Status404NotFound)
    {
        var acceptHeader = request.Headers.Accept.ToString();
        var isApi = request.Path.StartsWithSegments("/api");

        if (acceptHeader.Contains("text/html") && !isApi)
        {
            response.ContentType = "text/html; charset=utf-8";
            await response.WriteAsync(BackendViews.RenderNotFoundHtml(request.Path));
        }
    }
});

app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "OmniCart API v1 (Development)");
        options.DocumentTitle = "OmniCart API Documentation";
        options.InjectStylesheet("/swagger/custom-swagger.css");
        options.DefaultModelsExpandDepth(-1);
        options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.None);
    });
}

app.UseCors("local-frontends");

app.MapGet("/", () => Results.Content(BackendViews.RenderRootDashboardHtml(), "text/html; charset=utf-8"));

app.MapGet("/health", () => Results.Ok(new
{
    ok = true,
    status = "ok",
    service = "OmniCart Backend API",
    runtime = ".NET 8.0",
    timestamp = DateTimeOffset.UtcNow
}));

app.MapControllers();

// Tự dựng StoreDb cho máy mới pull về: tạo database + tables + seed nếu rỗng.
// Chạy idempotent nên máy đã có DB không bị mất dữ liệu.
try
{
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.EnsureCreatedAsync();

    var storeDb = scope.ServiceProvider.GetRequiredService<StoreDb>();
    try
    {
        storeDb.SeedDefaultProducts(force: false);
        var catalogUpdate = storeDb.ApplyVietnameseCatalogText();
        if (catalogUpdate.Renamed > 0)
            Console.WriteLine($"[StoreDb] Đã cập nhật tên tiếng Việt cho {catalogUpdate.Renamed} sản phẩm.");
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
    Environment.ExitCode = 1;
    return;
}

var isInteractive = Environment.UserInteractive && !Console.IsInputRedirected && !args.Contains("--no-menu") && !args.Contains("--server");
var db = app.Services.GetRequiredService<StoreDb>();

if (isInteractive)
{
    await ConsoleMenu.RunAsync(db, app, openBrowser: !args.Contains("--no-browser"));
}
else
{
    await app.RunAsync();
}
