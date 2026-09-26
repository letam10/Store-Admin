namespace StoreApi.Models;

public sealed record CatalogProduct(
    string Id, string Name, string Category, long Price, string Description, string Image,
    IReadOnlyList<string> Features, string Tone, string Symbol, string Label,
    int DiscountPercent, int StockCount, int ViewCount);

public sealed record CustomerAccount(
    long Id, string Username, string Email, int Points, string Tier, int SpinCredits, string CsrfToken);

public sealed record RegisterRequest(string? Username, string? Email, string? Password);
public sealed record LoginRequest(string? Username, string? Password);
public sealed record OfferRequest(int DiscountPercent, int StockCount);
public sealed record RecordRequest(string? Title, string? Status, Dictionary<string, object?>? Data);
