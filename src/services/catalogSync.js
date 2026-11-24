/*
  FILE NOTE
  - Mục đích: Phát tín hiệu đồng bộ danh mục hàng hóa (thêm/sửa/xóa sản phẩm) tới các tab Storefront khách hàng qua BroadcastChannel và localStorage.
  - Liên kết trực tiếp: Store-Admin/src/pages/AdminModules.jsx, Store-Admin/src/pages/AdminSocialPowerPanels.jsx
  - Vùng ảnh hưởng khi sửa: Tốc độ và cơ chế đồng bộ danh mục tức thì giữa Admin và Storefront.
*/

export function notifyCatalogChange() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('store_catalog_version', Date.now().toString())
      if ('BroadcastChannel' in window) {
        const channel = new window.BroadcastChannel('omnicart_catalog')
        channel.postMessage({ type: 'CATALOG_UPDATED', timestamp: Date.now() })
        channel.close()
      }
    }
  } catch {}
}
