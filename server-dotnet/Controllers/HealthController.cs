using Microsoft.AspNetCore.Mvc;

namespace StoreApi.Controllers;

[ApiController]
public sealed class HealthController : ControllerBase
{
    [HttpGet("/api/health")]
    public IActionResult Get() => Ok(new { ok = true, status = "ok", runtime = "aspnetcore-csharp" });
}
