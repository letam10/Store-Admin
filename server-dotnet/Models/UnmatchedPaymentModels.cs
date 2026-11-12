namespace StoreApi.Models;

public sealed record UnmatchedPaymentRequest(string? RequestId, string? Reference, long ReceivedAmount,
    string? ReceivedAt, string? Reason, bool ReceivedConfirmed);

public sealed record UnmatchedRefundRequest(string? Reference, long Amount, string? RefundedAt, bool RefundedConfirmed);

public sealed record UnmatchedPayment(string Id, string OrderId, string Reference, long Amount,
    DateTimeOffset ReceivedAt, string Reason, string Status, string? RefundReference, DateTimeOffset? RefundedAt);
