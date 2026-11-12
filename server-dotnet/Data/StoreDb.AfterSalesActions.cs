using System.Text.Json;
using Microsoft.Data.SqlClient;
using StoreApi.Models;
using StoreApi.Security;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    public object CustomerAfterSalesAction(long customerId, string id, AfterSalesActionRequest request)
    {
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        var item = ReadAfterSalesCase(connection, transaction, id, customerId);
        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        var key = Tokens.Sha256("customer:" + customerId + ":" + JsonSerializer.Serialize(request, CheckoutJson));
        if (action != "renew_payment" && item.CompletedActions.Contains(key)) { transaction.Commit(); return AfterSalesView(item); }
        var now = DateTimeOffset.UtcNow;
        if (action == "confirm" && item.Status == "awaiting_confirmation")
        {
            var order = ReadAfterSalesOrder(connection, transaction, item.OrderId, customerId);
            AfterSalesPolicy.Validate(item.Kind, order.Status, order.Delivery, order.DeliveredAt, order.Schedule, item.ScheduledAt, now);
            item.Status = "pending";
        }
        else if (action == "cancel" && item.Status is "awaiting_confirmation" or "pending" or "awaiting_return"
            && item.GoodsReceivedAt is null && item.FeePaidAt is null && item.FeeReportedAt is null)
        {
            ReleaseReplacement(connection, transaction, item);
            item.Status = "cancelled";
        }
        else if (action == "renew_payment" && item.Status == "awaiting_payment" && item.FeeReportedAt is null && item.FeePaidAt is null)
        {
            var order = ReadAfterSalesOrder(connection, transaction, item.OrderId, customerId);
            if (order.Method != "bank_transfer" || item.FeePaymentExpiresAt is null || item.FeePaymentCreatedAt is null)
                throw new InvalidOperationException("ACTION_NOT_ALLOWED");
            if (item.FeePaymentExpiresAt > now) { transaction.Commit(); return AfterSalesView(item); }
            // Giữ mọi hạn cũ để tiền đã vào đúng hạn vẫn đối soát được sau khi mở QR mới.
            if (item.FeePaymentPeriods.Count == 0) item.FeePaymentPeriods.Add(new(item.FeePaymentCreatedAt.Value, item.FeePaymentExpiresAt.Value));
            item.FeePaymentCreatedAt = now;
            item.FeePaymentExpiresAt = now.AddMinutes(2);
            item.FeePaymentPeriods.Add(new(now, item.FeePaymentExpiresAt.Value));
        }
        else if (action == "payment_report" && item.Status == "awaiting_payment")
        {
            var order = ReadAfterSalesOrder(connection, transaction, item.OrderId, customerId);
            if (order.Method != "bank_transfer" || item.FeePaymentExpiresAt is null) throw new InvalidOperationException("ACTION_NOT_ALLOWED");
            var reference = (request.Reference ?? "").Trim();
            if (reference.Length is < 3 or > 100) throw new InvalidOperationException("PAYMENT_REFERENCE_REQUIRED");
            item.FeeReportedAt ??= now;
            item.FeePaymentReportedReference = reference;
        }
        else throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        if (action != "renew_payment") item.CompletedActions.Add(key);
        item.Events.Add(new(action, "Khách hàng", action switch
        {
            "confirm" => "Đã đồng ý bảng phí và gửi yêu cầu", "cancel" => "Đã hủy yêu cầu", "renew_payment" => "Khách đã yêu cầu mở phiên thanh toán khoản bù mới",
            _ => "Đã báo chuyển khoản phí; cửa hàng chưa xác nhận nhận tiền"
        }, now));
        SaveAfterSalesCase(connection, transaction, item);
        transaction.Commit();
        return AfterSalesView(item);
    }

    public object AdminAfterSalesAction(AdminActor actor, string id, AfterSalesActionRequest request)
    {
        var action = (request.Action ?? "").Trim().ToLowerInvariant();
        if (actor.Role is not ("admin" or "staff"))
            throw new InvalidOperationException("FORBIDDEN");
        if ((request.Note ?? "").Length > 1000) throw new InvalidOperationException("INVALID_AFTER_SALES");
        using var connection = Open();
        using var transaction = connection.BeginTransaction();
        LockCheckout(connection, transaction);
        var item = ReadAfterSalesCase(connection, transaction, id);
        var order = ReadAfterSalesOrder(connection, transaction, item.OrderId);
        var key = Tokens.Sha256("admin:" + actor.Id + ":" + JsonSerializer.Serialize(request, CheckoutJson));
        if (item.CompletedActions.Contains(key)) { transaction.Commit(); return AfterSalesView(item); }
        var now = DateTimeOffset.UtcNow;
        if (action == "approve" && item.Status == "pending")
        {
            // Quyền trả hàng tính tại lúc khách gửi, không mất quyền vì cửa hàng xử lý chậm.
            AfterSalesPolicy.Validate(item.Kind, order.Status, order.Delivery, order.DeliveredAt, order.Schedule,
                item.ScheduledAt, item.Kind is "return" or "exchange" or "merchant_fault" ? item.CreatedAt : now);
            if (item.Kind == "reschedule")
            {
                using var schedule = CheckoutCommand(connection, transaction,
                    "UPDATE customer_orders SET scheduled_at=@schedule WHERE id=@id", ("@schedule", item.ScheduledAt), ("@id", item.OrderId));
                schedule.ExecuteNonQuery();
                item.Status = "resolved";
            }
            else if (item.Kind == "cancel") item.Status = "awaiting_refund";
            else
            {
                if (item.Kind == "exchange") ReserveReplacement(connection, transaction, item);
                item.Status = "awaiting_return";
            }
        }
        else if (action == "reject" && item.Status is "pending" or "awaiting_return" && item.GoodsReceivedAt is null)
        {
            if ((request.Note ?? "").Trim().Length < 5) throw new InvalidOperationException("REJECTION_REASON_REQUIRED");
            ReleaseReplacement(connection, transaction, item);
            item.Status = "rejected";
        }
        else if (action == "receive_return" && item.Status == "awaiting_return")
        {
            if (request.Received != true) throw new InvalidOperationException("RETURN_RECEIVED_REQUIRED");
            item.GoodsReceivedAt = now;
            if (request.Restock == true)
            {
                PutBackItems(connection, transaction, item.OriginalItems);
                item.Restocked = true;
            }
            item.Status = item.Kind != "exchange" || item.Quote.RefundAmount > 0 ? "awaiting_refund"
                : item.Quote.AdditionalDue > 0 ? "awaiting_payment" : "awaiting_exchange";
        }
        else if (action == "fee_paid" && item.Status == "awaiting_payment")
        {
            ConfirmAfterSalesFee(connection, transaction, item, order, request);
        }
        else if (action == "complete_refund" && item.Status == "awaiting_refund")
        {
            ConfirmAfterSalesRefund(connection, transaction, item, order, request);
        }
        else if (action == "ship_exchange" && item.Status == "awaiting_exchange" && order.Fulfillment == "delivery")
        {
            var reference = (request.Reference ?? "").Trim();
            if (reference.Length is < 3 or > 100) throw new InvalidOperationException("TRACKING_REFERENCE_REQUIRED");
            item.TrackingReference = reference;
            item.ReplacementReserved = false;
            item.Status = "exchange_shipped";
        }
        else if (action == "complete_exchange" && (item.Status == "exchange_shipped"
            || (item.Status == "awaiting_exchange" && order.Fulfillment == "pickup")))
        {
            if (request.Received != true) throw new InvalidOperationException("EXCHANGE_RECEIVED_REQUIRED");
            CompleteExchange(connection, transaction, item, order);
        }
        else throw new InvalidOperationException("ACTION_NOT_ALLOWED");
        item.Note = string.IsNullOrWhiteSpace(request.Note) ? item.Note : request.Note.Trim();
        item.CompletedActions.Add(key);
        item.Events.Add(new(action, actor.Role == "admin" ? "Quản trị viên" : "Nhân viên", action switch
        {
            "approve" => "Cửa hàng đã duyệt yêu cầu", "reject" => "Đã từ chối: " + item.Note,
            "receive_return" => item.Restocked ? "Đã nhận, kiểm tra và nhập lại hàng trả" : "Đã nhận hàng trả, chưa nhập lại tồn kho bán được",
            "fee_paid" => "Đã đối soát khoản tiền cần bù", "complete_refund" => "Đã hoàn tất đối soát khoản hoàn tiền",
            "ship_exchange" => "Đã gửi hàng thay thế", _ => "Đã giao hàng thay thế cho khách"
        }, now));
        SaveAfterSalesCase(connection, transaction, item);
        transaction.Commit();
        return AfterSalesView(item);
    }
}
