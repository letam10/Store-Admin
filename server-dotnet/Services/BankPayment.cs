using System.Text.Json;
using System.Text.RegularExpressions;
using StoreApi.Models;

namespace StoreApi.Services;

public static class BankPayment
{
    public static BankAccount ReadSettings(object settings)
    {
        var json = JsonSerializer.SerializeToElement(settings);
        string Text(string name) => json.TryGetProperty(name, out var value) ? value.GetString() ?? "" : "";
        if (Text("mode") != "manual") throw new InvalidOperationException("INVALID_PAYMENT_SETTINGS");
        var account = new BankAccount(Text("bankName"), Text("bankBin"), Text("accountNumber"), Text("accountName"));
        Validate(account);
        return account;
    }

    public static void Validate(BankAccount account)
    {
        if (string.IsNullOrWhiteSpace(account.BankName) || account.BankName.Length > 100
            || !Regex.IsMatch(account.BankBin, "^[0-9]{6}$") || !Regex.IsMatch(account.AccountNumber, "^[0-9]{6,25}$")
            || string.IsNullOrWhiteSpace(account.AccountName) || account.AccountName.Length > 100)
            throw new InvalidOperationException("INVALID_PAYMENT_SETTINGS");
    }

    public static object Info(BankAccount account, string reference, int amount)
    {
        Validate(account);
        if (amount <= 0) throw new InvalidOperationException("INVALID_PAYMENT_AMOUNT");
        return new
        {
            amount, reference, bankName = account.BankName, bankBin = account.BankBin,
            accountNumber = account.AccountNumber, accountName = account.AccountName, mode = "manual",
            purpose = "Thanh toán " + reference,
            qrImage = $"https://img.vietqr.io/image/{account.BankBin}-{account.AccountNumber}-compact2.png?amount={amount}&addInfo={Uri.EscapeDataString(reference)}&accountName={Uri.EscapeDataString(account.AccountName)}"
        };
    }
}
