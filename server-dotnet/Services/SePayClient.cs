using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StoreApi.Services;

public sealed record SePayTransfer(long Id, string Bank, string Account, string Content, string Reference,
    long Amount, DateTimeOffset ReceivedAt, bool Incoming);

public sealed class SePayClient(HttpClient http, IConfiguration configuration)
{
    private string? verifiedAccount;
    private DateTimeOffset verifiedAt;
    private string Token => configuration["SEPAY_API_TOKEN"]?.Trim() ?? "";
    public bool Enabled => configuration["SEPAY_ENABLED"] == "true" && Token.Length > 0;
    public const int IntervalSeconds = 10;
    public int RetryAfterSeconds { get; private set; }

    public async Task<IReadOnlyList<SePayTransfer>> ReadAsync(string account, DateTimeOffset from, CancellationToken cancellationToken)
    {
        if (!Enabled) throw new InvalidOperationException("SEPAY_NOT_CONFIGURED");
        if (verifiedAccount != account || verifiedAt < DateTimeOffset.UtcNow.AddMinutes(-1))
        {
            using var accounts = await GetAsync("https://my.sepay.vn/userapi/bankaccounts/list?limit=100", cancellationToken);
            if (!accounts.RootElement.TryGetProperty("bankaccounts", out var banks) || banks.ValueKind != JsonValueKind.Array
                || !banks.EnumerateArray().Any(bank => bank.GetProperty("account_number").ToString() == account
                    && bank.GetProperty("bank_bin").ToString() == "970422" && bank.GetProperty("active").ToString() == "1"))
                throw new InvalidOperationException("SEPAY_ACCOUNT_NOT_LINKED");
            verifiedAccount = account;
            verifiedAt = DateTimeOffset.UtcNow;
        }
        // Địa chỉ cố định: token không được gửi tới host do người dùng API/frontend truyền vào.
        var date = from.ToOffset(TimeSpan.FromHours(7)).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var url = "https://my.sepay.vn/userapi/transactions/list?account_number=" + Uri.EscapeDataString(account)
            + "&transaction_date_min=" + date + "&limit=5000";
        using var json = await GetAsync(url, cancellationToken);
        var root = json.RootElement;
        if (!root.TryGetProperty("transactions", out var list) || list.ValueKind != JsonValueKind.Array)
            throw new InvalidOperationException("SEPAY_INVALID_RESPONSE");
        // API v1 trả tối đa 5000 dòng, không có phân trang. Không tiến mốc đồng bộ nếu có thể bị cắt dữ liệu.
        if (list.GetArrayLength() >= 5000) throw new InvalidOperationException("SEPAY_BATCH_LIMIT");
        return list.EnumerateArray().Select(Parse).OrderBy(item => item.ReceivedAt).ThenBy(item => item.Id).ToArray();
    }

    private async Task<JsonDocument> GetAsync(string url, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token);
        using var response = await http.SendAsync(request, cancellationToken);
        RetryAfterSeconds = response.Headers.TryGetValues("x-sepay-userapi-retry-after", out var values)
            && int.TryParse(values.FirstOrDefault(), out var retry) ? Math.Clamp(retry, 0, 300) : 0;
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(response.StatusCode switch
            {
                System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden => "SEPAY_AUTH_FAILED",
                System.Net.HttpStatusCode.TooManyRequests => "SEPAY_RATE_LIMIT",
                _ => "SEPAY_UNAVAILABLE"
            });
        var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var root = json.RootElement;
        if (!root.TryGetProperty("status", out var status) || status.GetInt32() != 200
            || (root.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null))
        {
            json.Dispose();
            throw new InvalidOperationException("SEPAY_INVALID_RESPONSE");
        }
        return json;
    }

    public static SePayTransfer Parse(JsonElement row)
    {
        string Text(string key) => row.TryGetProperty(key, out var value) && value.ValueKind != JsonValueKind.Null ? value.ToString() : "";
        static long Money(string value)
        {
            if (!decimal.TryParse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)
                || amount < 0 || amount > long.MaxValue || decimal.Truncate(amount) != amount)
                throw new InvalidOperationException("SEPAY_INVALID_AMOUNT");
            return (long)amount;
        }
        var incoming = Money(Text("amount_in"));
        var outgoing = Money(Text("amount_out"));
        if (!long.TryParse(Text("id"), NumberStyles.None, CultureInfo.InvariantCulture, out var id) || id <= 0
            || !DateTime.TryParseExact(Text("transaction_date"), "yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local)
            || !Regex.IsMatch(Text("account_number"), "^[0-9]{6,25}$")
            || Text("transaction_content").Length > 2000 || Text("reference_number").Length > 100
            || Text("bank_brand_name").Length is 0 or > 100 || (incoming > 0 && outgoing > 0) || (incoming == 0 && outgoing == 0))
            throw new InvalidOperationException("SEPAY_INVALID_TRANSACTION");
        var received = new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), TimeSpan.FromHours(7));
        if (received > DateTimeOffset.UtcNow.AddMinutes(1)) throw new InvalidOperationException("SEPAY_INVALID_TIME");
        var reference = Text("reference_number").Trim().ToUpperInvariant();
        if (reference.Length == 0) reference = "SEPAY-" + id.ToString(CultureInfo.InvariantCulture);
        return new(id, Text("bank_brand_name"), Text("account_number"), Text("transaction_content"), reference,
            incoming > 0 ? incoming : outgoing, received, incoming > 0);
    }
}
