/*
 * Tệp: server-dotnet/Middlewares/ExceptionHandlingMiddleware.cs
 * Mục đích: Bắt ngoại lệ chưa được xử lý toàn cục, trả về JSON chuẩn và an toàn (ẩn stack trace ở Production).
 */

using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace StoreApi.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[UnhandledException] Ngoại lệ không mong muốn tại đường dẫn: {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;

        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;

        var isDev = _env.IsDevelopment();
        var errorResponse = new
        {
            ok = false,
            error = "INTERNAL_SERVER_ERROR",
            message = "Đã xảy ra lỗi máy chủ trong quá trình xử lý. Vui lòng thử lại sau.",
            traceId,
            details = isDev ? exception.Message : null,
            stackTrace = isDev ? exception.StackTrace : null
        };

        return context.Response.WriteAsJsonAsync(errorResponse);
    }
}
