export function loadJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function cartCount(cart) {
  return cart.reduce((total, item) => total + Number(item.quantity || 0), 0)
}

export function cartTotal(cart) {
  return cart.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0)
}

export function addCartItem(cart, product) {
  const found = cart.find((item) => String(item.id) === String(product.id))
  if (!found) return [...cart, { ...product, quantity: 1 }]
  return cart.map((item) => String(item.id) === String(product.id)
    ? { ...item, quantity: item.quantity + 1 }
    : item)
}

export function setCartQuantity(cart, productId, quantity) {
  const nextQuantity = Math.max(0, Math.min(99, Number(quantity) || 0))
  if (nextQuantity === 0) return cart.filter((item) => String(item.id) !== String(productId))
  return cart.map((item) => String(item.id) === String(productId)
    ? { ...item, quantity: nextQuantity }
    : item)
}

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

export function productIdFromPath(pathname) {
  const match = pathname.match(/^\/products\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (match) => match === 'Đ' ? 'D' : 'd')
    .toLocaleLowerCase('vi')
}

export function productMatches(product, query) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return normalizeSearch([product.name, product.category, product.label].join(' ')).includes(needle)
}

export function filterProducts(products, { category = 'Tất cả', query = '', maxPrice = 0 } = {}) {
  const limit = Number(maxPrice) || 0
  return products.filter((product) =>
    (category === 'Tất cả' || product.category === category)
    && productMatches(product, query)
    && (!limit || Number(product.price) <= limit))
}

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

export function orderMatches(order, query) {
  const needle = normalizeSearch(query).trim()
  if (!needle) return true
  return normalizeSearch([order.id, order.status, order.fulfillment, order.itemCount, order.voucherCode, order.membershipTier].join(' ')).includes(needle)
}
