/*
 * @codex-vn-doc
 * Tệp: server-dotnet/Security/Tokens.cs
 * Mục đích: Tạo và kiểm tra token/secret cho phiên API C#.
 * Thành phần chính: Tokens.
 * Liên kết trực tiếp: System.Security.Cryptography, System.Text, CryptSharp.Utility.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
using System.Security.Cryptography;
using System.Text;
using CryptSharp.Utility;

namespace StoreApi.Security;

// Vai trò kiểu Tokens: gom dữ liệu hoặc hành vi thuộc cùng một trách nhiệm.
public static class Tokens
{
    // Chức năng RandomToken: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
    public static string RandomToken(int bytes = 32) => Convert.ToBase64String(RandomNumberGenerator.GetBytes(bytes))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    // Chức năng Sha256: nhận dữ liệu đầu vào, kiểm tra nghiệp vụ và trả về kết quả cho nơi gọi.
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
        // Nhánh lỗi: chuyển ngoại lệ thành phản hồi an toàn, không làm lộ dữ liệu nhạy cảm.
        catch { return false; }
    }
}
