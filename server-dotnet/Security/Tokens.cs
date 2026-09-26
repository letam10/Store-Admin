using System.Security.Cryptography;
using System.Text;
using CryptSharp.Utility;

namespace StoreApi.Security;

public static class Tokens
{
    public static string RandomToken(int bytes = 32) => Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public static string Sha256(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    // Node's legacy backend uses scryptSync(password, salt, 64) with the default N=16384, r=8, p=1.
    public static (string Salt, string Hash) HashPassword(string password, string? salt = null)
    {
        var actualSalt = salt ?? Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var derived = SCrypt.ComputeDerivedKey(Encoding.UTF8.GetBytes(password), Encoding.UTF8.GetBytes(actualSalt), 16_384, 8, 1, 1, 64);
        return (actualSalt, Convert.ToHexString(derived).ToLowerInvariant());
    }

    public static bool VerifyPassword(string password, string salt, string expectedHash)
    {
        try
        {
            var (_, actualHash) = HashPassword(password, salt);
            return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(actualHash), Encoding.ASCII.GetBytes(expectedHash));
        }
        catch { return false; }
    }
}
