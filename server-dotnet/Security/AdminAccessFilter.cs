using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using StoreApi.Data;
using StoreApi.Models;
using StoreApi.Services;

namespace StoreApi.Security;

// Danh sách cho phép tường minh: endpoint mới mặc định chỉ dành cho admin.
public sealed class AdminAccessFilter(StoreDb db) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var action = ((ControllerActionDescriptor)context.ActionDescriptor).ActionName;
        if (action == "Login")
        {
            await next();
            return;
        }
        var request = context.HttpContext.Request;
        var raw = request.Cookies["store_admin_session"];
        var actor = string.IsNullOrEmpty(raw) ? null : db.FindAdminActor(Tokens.Sha256(raw));
        if (actor is null)
        {
            context.Result = new UnauthorizedObjectResult(new { error = "UNAUTHENTICATED" });
            return;
        }
        context.HttpContext.Items["AdminActor"] = actor;
        context.ActionArguments.TryGetValue("module", out var moduleValue);
        context.ActionArguments.TryGetValue("request", out var requestValue);
        var module = moduleValue as string;
        var afterSales = requestValue as AfterSalesActionRequest;
        if (actor.Role != "admin" && !(actor.Role == "staff" && StaffAllowed(action, module, afterSales?.Action)))
        {
            context.Result = new ObjectResult(new { error = "FORBIDDEN" }) { StatusCode = 403 };
            return;
        }
        await next();
    }

    public static bool StaffAllowed(string action, string? module, string? afterSalesAction) => action switch
    {
        "Session" or "Logout" or "Presence" or "EventsStream" or "Products" or "Customers" or "AfterSales" or "Reviews" or "ReplyReview" => true,
        "CreateProduct" or "UpdateProduct" or "DeleteProduct" or "Offer" => true,
        "Orders" or "OrderPaid" or "OrderFulfillment" or "OrderCancel" or "OrderReceipt" => true,
        "ListUnmatchedPayments" or "RecordUnmatchedPayment" or "RefundUnmatchedPayment" => true,
        "Records" or "CreateRecord" or "UpdateRecord" => module is "support" or "inventory",
        "DeleteRecord" => module == "inventory",
        "ExportOperational" => OperationalExport.IsAllowed(module),
        // Nhân viên xử lý trọn nghiệp vụ sau mua; các điều kiện tiền/kho/chứng từ vẫn kiểm ở tầng dữ liệu.
        "AfterSalesAction" => afterSalesAction?.Trim().ToLowerInvariant() is "approve" or "reject" or "receive_return" or "fee_paid" or "complete_refund" or "ship_exchange" or "complete_exchange",
        _ => false
    };
}
