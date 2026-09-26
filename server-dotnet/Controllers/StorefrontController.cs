using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/storefront")]
public sealed class StorefrontController(StoreDb db) : ControllerBase
{
    [HttpGet("catalog")]
    public IActionResult Catalog() => Ok(new { products = db.Catalog() });

    [HttpGet("appearance")]
    public IActionResult Appearance() => Ok(new { appearance = db.Appearance() });

    [HttpPost("products/{id}/view")]
    public IActionResult ViewProduct(string id) => Ok(new { id, viewCount = db.IncrementView(id) });
}
