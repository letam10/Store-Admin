/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Program.cs
 * Mục đích: Điểm khởi động ASP.NET Core C# và đăng ký DI, CORS, Swagger, controllers.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: Microsoft.OpenApi.Models, StoreApi.Data.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using Microsoft.OpenApi.Models;
using StoreApi.Data;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => options.SwaggerDoc("v1", new OpenApiInfo
{
    Title = "Store API (ASP.NET Core)", Version = "v1",
    Description = "C# migration backend for Store and Store-Admin."
}));
builder.Services.AddSingleton<StoreDb>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddCors(options => options.AddPolicy("local-frontends", policy => policy
    .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174")
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Store API v1"));
}
app.UseCors("local-frontends");
app.MapControllers();
app.Run();
