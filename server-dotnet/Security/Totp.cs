/*
 * Tệp: server-dotnet/Security/Totp.cs
 * Mục đích: TOTP RFC6238 không thêm dep (dùng RandomNumberGenerator + HMACSHA1), phục vụ 2FA.
 */
using System.Security.Cryptography;
using System.Text;
using System.Linq;

namespace StoreApi.Security;

public static class Totp
{
    private const string Base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static string GenerateSecret(int bytes = 20)
    {
        var data = RandomNumberGenerator.GetBytes(bytes);
        var sb = new StringBuilder();
        int bits = 0, value = 0;
        foreach (var b in data)
        {
            value = (value << 8) | b; bits += 8;
            while (bits >= 5) { sb.Append(Base32Chars[(value >> (bits - 5)) & 31]); bits -= 5; }
        }
        if (bits > 0) sb.Append(Base32Chars[(value << (5 - bits)) & 31]);
        return sb.ToString();
    }

    public static byte[] Base32Decode(string input)
    {
        var clean = new string((input ?? "").ToUpperInvariant().Where(c => Base32Chars.Contains(c)).ToArray());
        var bytes = new List<byte>();
        int bits = 0, value = 0;
        foreach (var c in clean)
        {
            value = (value << 5) | Base32Chars.IndexOf(c); bits += 5;
            if (bits >= 8) { bytes.Add((byte)((value >> (bits - 8)) & 255)); bits -= 8; }
        }
        return bytes.ToArray();
    }

    public static string Code(string secret, DateTimeOffset? time = null, int step = 30, int digits = 6)
    {
        var counter = (long)((time ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds() / step);
        var msg = BitConverter.GetBytes(counter);
        if (BitConverter.IsLittleEndian) Array.Reverse(msg);
        using var hmac = new HMACSHA1(Base32Decode(secret));
        var hash = hmac.ComputeHash(msg);
        var offset = hash[^1] & 0x0F;
        var code = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        var mod = (int)Math.Pow(10, digits);
        return (code % mod).ToString().PadLeft(digits, '0');
    }

    public static bool Verify(string secret, string token, int window = 1)
    {
        var clean = (token ?? "").Replace(" ", "");
        if (clean.Length < 6 || clean.Length > 10 || !clean.All(char.IsLetterOrDigit)) return false;
        if (Base32Decode(secret).Length == 0) return false;
        var now = DateTimeOffset.UtcNow;
        for (var d = -window; d <= window; d++)
        {
            var expected = Code(secret, now.AddSeconds(d * 30));
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(clean))) return true;
        }
        return false;
    }

    public static string OtpauthUrl(string secret, string email, string issuer = "Store")
        => "otpauth://totp/" + Uri.EscapeDataString(issuer + ":" + email) + "?secret=" + Uri.EscapeDataString(secret) + "&issuer=" + Uri.EscapeDataString(issuer) + "&digits=6&period=30";

    public static List<string> BackupCodes(int count = 10)
    {
        var list = new List<string>();
        for (var i = 0; i < count; i++) list.Add(Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToUpperInvariant()[..8]);
        return list;
    }
}
