using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Security;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/sepay")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminSePayController(StoreDb db) : ControllerBase
{
    [HttpGet]
    public IActionResult SePayStatus() => Ok(new { connection = db.SePayStatus(), transactions = db.SePayTransactions() });
}
