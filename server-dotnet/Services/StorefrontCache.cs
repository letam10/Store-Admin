using Microsoft.Extensions.Caching.Memory;
using StoreApi.Models;

namespace StoreApi.Services;

/// <summary>
/// Cache an toàn trong bộ nhớ (In-Memory Cache) cho các dữ liệu ít thay đổi ở Storefront.
/// Tuyệt đối KHÔNG cache giỏ hàng, thông tin khách hàng, đơn hàng hay phiên đăng nhập.
/// </summary>
public sealed class StorefrontCache(IMemoryCache cache)
{
    private const string CatalogKey = "storefront_catalog";
    private const string AppearanceKey = "storefront_appearance";

    /// <summary>
    /// Cache danh mục sản phẩm (catalog) trong 30 giây.
    /// Giúp frontend tải nhanh vượt trội và giảm tải liên tục lên SQL Server.
    /// </summary>
    public IReadOnlyList<CatalogProduct> GetCatalog(Func<IReadOnlyList<CatalogProduct>> factory)
    {
        return cache.GetOrCreate(CatalogKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30);
            return factory();
        })!;
    }

    /// <summary>
    /// Cache cấu hình hiển thị (appearance & theme) trong 5 phút.
    /// </summary>
    public object GetAppearance(Func<object> factory)
    {
        return cache.GetOrCreate(AppearanceKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return factory();
        })!;
    }

    /// <summary>
    /// Huỷ cache danh mục ngay khi Quản trị viên thêm/sửa/xoá sản phẩm.
    /// </summary>
    public void InvalidateCatalog()
    {
        cache.Remove(CatalogKey);
    }

    /// <summary>
    /// Huỷ cache giao diện ngay khi Quản trị viên cập nhật cài đặt hiển thị/theme.
    /// </summary>
    public void InvalidateAppearance()
    {
        cache.Remove(AppearanceKey);
    }
}
