/**
 * @codex-vn-doc
 * Tệp: src/storefront/state.js
 * Mục đích: Hàm thuần cho local state, giỏ hàng, route, tìm kiếm, lọc và tạo đơn demo.
 * Thành phần chính: loadJson, cartCount, cartTotal, addCartItem, setCartQuantity, routeName, productIdFromPath, normalizeSearch.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
// Chức năng loadJson: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

// Chức năng cartCount: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function cartCount(cart) {
  return cart.reduce((total, item) => total + Number(item.quantity || 0), 0)
}

// Chức năng cartTotal: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function cartTotal(cart) {
  return cart.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0)
}

// Chức năng addCartItem: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function addCartItem(cart, product) {
  const found = cart.find((item) => String(item.id) === String(product.id))
  if (!found) return [...cart, { ...product, quantity: 1 }]
  return cart.map((item) => String(item.id) === String(product.id)
    ? { ...item, quantity: item.quantity + 1 }
    : item)
}

// Chức năng setCartQuantity: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function setCartQuantity(cart, productId, quantity) {
  const nextQuantity = Math.max(0, Math.min(99, Number(quantity) || 0))
  // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
  if (nextQuantity === 0) return cart.filter((item) => String(item.id) !== String(productId))
  return cart.map((item) => String(item.id) === String(productId)
    ? { ...item, quantity: nextQuantity }
    : item)
}

// Chức năng routeName: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function routeName(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'home'
  if (path === '/products') return 'products'
  if (/^\/products\/[^/]+$/.test(path)) return 'product'
  if (path === '/contact') return 'contact'
  if (path === '/locations') return 'locations'
  if (path === '/cart') return 'cart'
  if (path === '/checkout') return 'checkout'
  if (path === '/membership') return 'membership'
  if (path === '/rewards') return 'rewards'
  if (path === '/login' || path === '/account') return 'account'
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin'
  return 'not-found'
}

// Chức năng productIdFromPath: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function productIdFromPath(pathname) {
  const match = pathname.match(/^\/products\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

// Chức năng normalizeSearch: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (match) => match === 'Đ' ? 'D' : 'd')
    .toLocaleLowerCase('vi')
}

// Chức năng productMatches: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function productMatches(product, query) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return normalizeSearch([product.name, product.category, product.label].join(' ')).includes(needle)
}

// Chức năng filterProducts: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function filterProducts(products, { category = 'Tất cả', query = '', maxPrice = 0 } = {}) {
  const limit = Number(maxPrice) || 0
  return products.filter((product) =>
    (category === 'Tất cả' || product.category === category)
    && productMatches(product, query)
    && (!limit || Number(product.price) <= limit))
}

// Chức năng createDemoOrder: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function createDemoOrder(cart, { owner = 'guest', fulfillment = 'delivery', now = Date.now(), voucherCode = '', discount = 0, membershipTier = 'standard' } = {}) {
  const subtotal=cartTotal(cart)
  const safeDiscount=Math.max(0,Math.min(subtotal,Number(discount)||0))
  return {
    id: 'DEMO-' + Number(now).toString(36).toUpperCase(),
    owner: normalizeSearch(owner || 'guest').trim() || 'guest',
    createdAt: new Date(now).toISOString(),
    fulfillment,
    itemCount: cartCount(cart),
    subtotal,
    discount:safeDiscount,
    total:subtotal-safeDiscount,
    voucherCode:String(voucherCode||'').toUpperCase(),
    membershipTier,
    status: 'Đơn demo · chưa gửi backend',
  }
}

// Chức năng orderMatches: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function orderMatches(order, query) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return normalizeSearch([order.id, order.status, order.fulfillment, order.itemCount, order.voucherCode, order.membershipTier].join(' ')).includes(needle)
}
