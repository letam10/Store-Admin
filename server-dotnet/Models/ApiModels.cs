/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Models/ApiModels.cs
 * Mục đích: DTO/model request-response dùng chung cho controller C#.
 * Thành phần chính: CatalogProduct, CustomerAccount, RegisterRequest, LoginRequest, OfferRequest, RecordRequest.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
namespace StoreApi.Models;

// Vai trò kiểu CatalogProduct: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record CatalogProduct(
    string Id, string Name, string Category, long Price, string Description, string Image,
    IReadOnlyList<string> Features, string Tone, string Symbol, string Label,
    int DiscountPercent, int StockCount, int ViewCount);

// Vai trò kiểu CustomerAccount: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record CustomerAccount(
    long Id, string Username, string Email, int Points, string Tier, int SpinCredits, string CsrfToken);

// Vai trò kiểu RegisterRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record RegisterRequest(string? Username, string? Email, string? Password);
// Vai trò kiểu LoginRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record LoginRequest(string? Username, string? Password);
// Vai trò kiểu OfferRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record OfferRequest(int DiscountPercent, int StockCount);
// Vai trò kiểu PasswordForgotRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record PasswordForgotRequest(string? Email);
// Vai trò kiểu PasswordResetRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record PasswordResetRequest(string? Token, string? Password);
// Vai trò kiểu TwoFactorChallengeRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record TwoFactorChallengeRequest(string? ChallengeId, string? Code);
// Vai trò kiểu TwoFactorCodeRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record TwoFactorCodeRequest(string? Code);
// Vai trò kiểu TwoFactorDisableRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record TwoFactorDisableRequest(string? Password);
// Vai trò kiểu RecordRequest: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public sealed record RecordRequest(string? Title, string? Status, Dictionary<string, object?>? Data);

public sealed record QuoteItemRequest(string? Id, int Quantity);
public sealed record OrderQuoteRequest(
    List<QuoteItemRequest>? Items,
    string? Fulfillment,
    string? Region,
    int DistanceKm,
    double WeightKg,
    List<string>? VoucherCodes);

public sealed record CreateOrderRequest(
    List<QuoteItemRequest>? Items,
    string? Fulfillment,
    string? Region,
    int DistanceKm,
    double WeightKg,
    List<string>? VoucherCodes,
    int ExpectedTotal,
    string? PaymentMethod,
    string? ScheduledAt,
    string? Recipient,
    string? Phone,
    string? Address);

