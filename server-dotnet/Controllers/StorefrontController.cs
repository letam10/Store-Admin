/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Controllers/StorefrontController.cs
 * Mục đích: Endpoint catalog/view storefront của API C#.
 * Thành phần chính: StorefrontController.
 * Liên kết trực tiếp: Microsoft.AspNetCore.Mvc, StoreApi.Data.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using Microsoft.AspNetCore.Mvc;
using StoreApi.Data;

namespace StoreApi.Controllers;

[ApiController]
[Route("api/storefront")]
// Vai trò kiểu StorefrontController: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed class StorefrontController(StoreDb db) : ControllerBase
{
    [HttpGet("catalog")]
    // Chức năng Catalog: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Catalog() => Ok(new { products = db.Catalog() });

    [HttpGet("appearance")]
    // Chức năng Appearance: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult Appearance() => Ok(new { appearance = db.Appearance() });

    [HttpPost("products/{id}/view")]
    // Chức năng ViewProduct: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public IActionResult ViewProduct(string id) => Ok(new { id, viewCount = db.IncrementView(id) });
}
