/*
 * Tệp: server-dotnet/Program.cs
 * Mục đích: Điểm khởi động ASP.NET Core C# và đăng ký DI, EF Core SQL Server, CORS, Swagger, controllers và Menu quản lý.
 */
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using StoreApi.Data;

// Nạp các biến cấu hình từ file .env nếu có (GOOGLE_CLIENT_ID, SMTP, ...)
var envPath = Path.Combine(Directory.GetCurrentDirectory(), ".env");
if (File.Exists(envPath))
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
var connectionString = builder.Configuration.GetConnectionString("StoreDb") 
    ?? "Server=localhost;Database=StoreDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";

// Chốt cổng chuẩn: API luôn nghe http://127.0.0.1:5000 (Google callback + Vite proxy).
builder.WebHost.UseUrls("http://127.0.0.1:5000");

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
