using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/admin/stats")]
[TypeFilter(typeof(AdminAccessFilter))]
public sealed class AdminReportsController(StoreDb db) : ControllerBase
{
    [HttpGet]
    public IActionResult Stats([FromQuery] string? from, [FromQuery] string? to)
    {
        try { return Ok(new { report = Report(from, to), source = "StoreDb" }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    [HttpGet("export")]
    public IActionResult ExportStats([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string format = "xlsx")
    {
        try
        {
            var report = Report(from, to);
            if (format == "html") return Content(ReportExport.PrintableHtml(report), "text/html; charset=utf-8");
            if (format != "xlsx") return BadRequest(new { error = "INVALID_REPORT_FORMAT" });
            return File(ReportExport.Excel(report), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"store-statistics-{report.From}-{report.To}.xlsx");
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
    }

    private SalesReport Report(string? from, string? to)
    {
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        return db.CalculateAdminRevenue(from ?? today.AddDays(-30).ToString("yyyy-MM-dd"), to ?? today.ToString("yyyy-MM-dd"));
    }
}
