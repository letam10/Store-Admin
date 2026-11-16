using System.Diagnostics;

namespace StoreApi.Middlewares;

/// <summary>
/// Middleware ghi nhận thời gian thực thi (latency) của request API và log gọn gàng trên console.
/// Tuyệt đối không log dữ liệu nhạy cảm (mật khẩu, token, session cookie).
/// </summary>
public sealed class RequestTimingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimingMiddleware> _logger;

    public RequestTimingMiddleware(RequestDelegate next, ILogger<RequestTimingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Bỏ qua tài nguyên tĩnh hoặc swagger assets để console phát triển không bị rác
        if (path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".css", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".svg", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ||
            path.EndsWith(".ico", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            var statusCode = context.Response.StatusCode;
            var elapsedMs = sw.ElapsedMilliseconds;
            var method = context.Request.Method;

            if (statusCode >= 500)
            {
                _logger.LogError("[API] {Method} {Path} -> {StatusCode} ({Elapsed}ms)", method, path, statusCode, elapsedMs);
            }
            else if (statusCode >= 400)
            {
                _logger.LogWarning("[API] {Method} {Path} -> {StatusCode} ({Elapsed}ms)", method, path, statusCode, elapsedMs);
            }
            else
            {
                _logger.LogInformation("[API] {Method} {Path} -> {StatusCode} ({Elapsed}ms)", method, path, statusCode, elapsedMs);
            }
        }
    }
}
