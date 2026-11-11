using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace StoreApi.Services;

public static class VoucherPolicy
{
    public static string NewCode() => new(Enumerable.Range(0, 8)
        .Select(_ => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[RandomNumberGenerator.GetInt32(36)]).ToArray());

    public static string NormalizeCode(string? code) => (code ?? "").Trim().ToUpperInvariant();

    public static void ValidateCode(string code)
    {
        if (!Regex.IsMatch(code, "^[A-Z0-9]{8}$")) throw new InvalidOperationException("INVALID_VOUCHER_CODE");
    }

    public static string Validate(string label, string type, int value, string scope, string expiresAt)
    {
        if (string.IsNullOrWhiteSpace(label) || label.Length > 255 || type is not ("amount" or "percent")
            || scope is not ("goods" or "shipping") || value < 1 || value > (type == "percent" ? 100 : 10_000_000))
            throw new InvalidOperationException("INVALID_VOUCHER");
        // Hạn chỉ có ngày được tính hết ngày tại Việt Nam, không phụ thuộc timezone máy chủ.
        if (DateOnly.TryParseExact(expiresAt, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day))
            expiresAt = day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T23:59:59.9999999+07:00";
        if (!DateTimeOffset.TryParse(expiresAt, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var expiry)
            || expiry <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("INVALID_VOUCHER");
        return expiry.ToUniversalTime().ToString("O");
    }
}
