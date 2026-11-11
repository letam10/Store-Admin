using System.Text.Json.Serialization;

namespace StoreApi.Models;

public sealed record AfterSalesFee(string Label, long? Amount);
public sealed record AfterSalesQuote(long FeeAmount, long RefundAmount, long AdditionalDue,
    IReadOnlyList<AfterSalesFee> Breakdown, long GoodsCredit = 0, long ReplacementGoods = 0);
public sealed record AfterSalesEvent(string Action, string Actor, string Message, DateTimeOffset CreatedAt);
public sealed record AfterSalesPaymentPeriod(DateTimeOffset CreatedAt, DateTimeOffset ExpiresAt);

public sealed class AfterSalesCase
{
    [JsonIgnore] public int RecordId { get; set; }
    public int PolicyVersion { get; set; }
    public string Id { get; set; } = "";
    public long CustomerId { get; set; }
    public string OrderId { get; set; } = "";
    public string Username { get; set; } = "";
    public string Fulfillment { get; set; } = "";
    public string PaymentMethod { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Reason { get; set; } = "";
    public string? ScheduledAt { get; set; }
    public string Status { get; set; } = "awaiting_confirmation";
    public AfterSalesQuote Quote { get; set; } = new(0, 0, 0, []);
    public List<CheckoutLine> OriginalItems { get; set; } = [];
    public List<CheckoutLine> ReplacementItems { get; set; } = [];
    public bool ReplacementReserved { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? GoodsReceivedAt { get; set; }
    public DateTimeOffset? FeePaidAt { get; set; }
    public DateTimeOffset? FeeReportedAt { get; set; }
    public string? FeePaymentReportedReference { get; set; }
    public DateTimeOffset? FeePaymentCreatedAt { get; set; }
    public DateTimeOffset? FeePaymentExpiresAt { get; set; }
    public List<AfterSalesPaymentPeriod> FeePaymentPeriods { get; set; } = [];
    public BankAccount? FeeBank { get; set; }
    public string? FeePaymentReference { get; set; }
    public DateTimeOffset? RefundedAt { get; set; }
    public string? RefundReference { get; set; }
    public string? TrackingReference { get; set; }
    public bool Restocked { get; set; }
    public string Note { get; set; } = "";
    public List<AfterSalesEvent> Events { get; set; } = [];
    public List<string> CompletedActions { get; set; } = [];
}
