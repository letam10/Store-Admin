using System.Text.Json.Serialization;

namespace StoreApi.Models;

public sealed record CheckoutLine([property: JsonPropertyName("id")] string Id, [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("quantity")] int Quantity, [property: JsonPropertyName("price")] long Price);
public sealed record BankAccount(string BankName, string BankBin, string AccountNumber, string AccountName);
public sealed record CheckoutDraft(
    long CustomerId, string RequestId, string RequestHash, IReadOnlyList<CheckoutLine> Items,
    string Recipient, string Phone, string Address, string Fulfillment, string Region, int DistanceKm, double WeightKg,
    int Subtotal, int Discount, int GoodsTotal, int ShippingFee, int Total, IReadOnlyList<string> VoucherCodes,
    string Tier, string PaymentMethod, string ScheduledAt, BankAccount? Bank);

public sealed record CheckoutIntent(
    string OrderId, long CustomerId, string State, DateTimeOffset? ExpiresAt, string? ReportReference,
    DateTimeOffset? ReportedAt, BankAccount? Bank, string? PaymentReference, DateTimeOffset? ReceivedAt);

public sealed record NotificationJob(string Key, string Kind, string Payload, int Attempts);

public sealed class CheckoutAlreadyOpenException(string orderId) : InvalidOperationException("CHECKOUT_ALREADY_OPEN")
{
    public string OrderId { get; } = orderId;
}
