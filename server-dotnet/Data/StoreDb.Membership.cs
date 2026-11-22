/*
  FILE NOTE
  - Mục đích: Lưu và đọc cấu hình Thẻ Thành Viên (membership.policy.v1) từ bảng settings trong SQL Server.
*/
using System.Text.Json;
using StoreApi.Services;

namespace StoreApi.Data;

public sealed partial class StoreDb
{
    private const string MembershipPolicySettingKey = "membership.policy.v1";

    public MembershipPolicyConfig GetMembershipPolicy()
    {
        var raw = GetSetting(MembershipPolicySettingKey);
        if (string.IsNullOrWhiteSpace(raw)) return LoyaltyPolicy.DefaultPolicy();
        try
        {
            var parsed = JsonSerializer.Deserialize<MembershipPolicyConfig>(raw, CheckoutJson);
            return LoyaltyPolicy.NormalizeAndValidate(parsed);
        }
        catch
        {
            return LoyaltyPolicy.DefaultPolicy();
        }
    }

    public MembershipPolicyConfig SaveMembershipPolicy(MembershipPolicyConfig input)
    {
        var normalized = LoyaltyPolicy.NormalizeAndValidate(input);
        SetSetting(MembershipPolicySettingKey, JsonSerializer.Serialize(normalized, CheckoutJson));
        return normalized;
    }

    public MembershipPolicyConfig ResetMembershipPolicy()
    {
        var defaults = LoyaltyPolicy.DefaultPolicy() with { UpdatedAt = DateTimeOffset.UtcNow.ToString("O") };
        SetSetting(MembershipPolicySettingKey, JsonSerializer.Serialize(defaults, CheckoutJson));
        return defaults;
    }
}
