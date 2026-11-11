namespace StoreApi.Services;

public static class MailSettings
{
    public static string Read(IConfiguration configuration, string key, string fallback = "")
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value)) value = configuration[key];
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    public static IReadOnlyList<string> AdminRecipients(IConfiguration configuration)
    {
        var configured = Read(configuration, "ADMIN_NOTIFICATION_EMAILS",
            Read(configuration, "SUPPORT_EMAIL", Read(configuration, "SMTP_USER")));
        return configured.Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }
}
