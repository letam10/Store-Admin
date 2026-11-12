using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/exports")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminOperationalExportsController(StoreDb db) : ControllerBase
{
    [HttpGet("{module}.xlsx")]
    public IActionResult ExportOperational(string module)
    {
        if (!OperationalExport.IsAllowed(module)) return NotFound(new { error = "EXPORT_MODULE_NOT_FOUND" });
        return File(OperationalExport.Excel(db, module), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"store-{module}.xlsx");
    }
}
