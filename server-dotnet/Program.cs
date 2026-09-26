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
