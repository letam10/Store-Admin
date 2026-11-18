/*
  FILE NOTE
  - Mục đích: Chuẩn hóa, tự động điền (auto-fill), tìm kiếm và xử lý logic banner hai bên trang chủ cho ThemeEditor (Store-Admin) và đồng bộ với Store (hỗ trợ tùy chỉnh từ 10 đến 30 banner mỗi bên).
  - Liên kết trực tiếp: Store-Admin/src/pages/ThemeEditor.jsx, Store-Admin/test/side-banners.test.js.
  - Vùng ảnh hưởng khi sửa: Tab Banner trong ThemeEditor, dữ liệu appearance.sideBanners lưu xuống backend và hiển thị ở Store.
*/

/**
 * @codex-vn-doc
 * Tệp: src/services/sideBanners.js
 * Mục đích: Chuẩn hóa cấu hình banner hai bên trang chủ (appearance.sideBanners) dùng chung
 * giữa ThemeEditor (nhánh Admin) và trang chủ phía khách (nhánh Store).
 * Thành phần chính: parseSideBanners, serializeSideBanners, editorSideBanners,
 * padSideBannerList, normalizeSideBannerSlot, normalizeHexColor, commonSideBannerCount,
 * autoFillSideBanners, filterCatalogProducts, sortCatalogForBanners.
 * Liên kết trực tiếp: src/pages/ThemeEditor.jsx (trạng thái chỉnh sửa), trang chủ Store (render).
 * Cẩn trọng: khi sửa hàm, schema hoặc export phải kiểm tra các tệp gọi nó; chuỗi JSON đã lưu
 * chỉ chứa slot có productId thật, ô trống chỉ tồn tại trong trạng thái chỉnh sửa.
 * Số lượng banner là CHUNG cho cả 2 bên: editor luôn đệm 2 bên tới cùng một số ô
 * (bên nhiều hơn quyết định số chung, kẹp 10-30); hỗ trợ tự động điền sản phẩm từ catalog
 * khi lưu hoặc chọn số lượng để tránh lỗi ô trống.
 */
export const SIDE_BANNER_MIN_COUNT = 10
export const SIDE_BANNER_MAX_COUNT = 30
export const SIDE_BANNER_DEFAULT_COUNT = 10
export const SIDE_BANNER_TITLE_MAX = 120
export const SIDE_BANNER_NOTE_MAX = 240

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/

// Chức năng normalizeHexColor: chỉ giữ màu #RRGGBB hợp lệ, chuẩn hóa thành chữ hoa; sai thì trả ''.
export function normalizeHexColor(value) {
  const clean = String(value ?? '').trim().toUpperCase()
  return HEX_COLOR_PATTERN.test(clean) ? clean : ''
}

// Chức năng emptySideBannerSlot: tạo một ô banner trống dùng cho trạng thái chỉnh sửa.
export function emptySideBannerSlot() {
  return { productId: '', title: '', note: '', bg: '', text: '', accent: '' }
}

function clampCount(count) {
  const parsed = Number(count)
  if (!Number.isFinite(parsed)) return SIDE_BANNER_DEFAULT_COUNT
  return Math.max(SIDE_BANNER_MIN_COUNT, Math.min(SIDE_BANNER_MAX_COUNT, Math.floor(parsed)))
}

// Chức năng normalizeSideBannerSlot: chuẩn hóa một slot, cắt title/note, chuẩn hóa màu thành chữ hoa.
export function normalizeSideBannerSlot(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptySideBannerSlot()
  return {
    productId: String(raw.productId ?? '').trim(),
    title: String(raw.title ?? '').slice(0, SIDE_BANNER_TITLE_MAX),
    note: String(raw.note ?? '').slice(0, SIDE_BANNER_NOTE_MAX),
    bg: normalizeHexColor(raw.bg),
    text: normalizeHexColor(raw.text),
    accent: normalizeHexColor(raw.accent),
  }
}

function normalizeSideList(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((slot) => normalizeSideBannerSlot(slot))
    .filter((slot) => slot.productId !== '')
    .slice(0, SIDE_BANNER_MAX_COUNT)
}

// Chức năng parseSideBanners: nhận chuỗi JSON hoặc object, trả cấu hình đã chuẩn hóa.
// Slot không có productId hợp lệ bị bỏ, mỗi bên tối đa 30 slot, không khử trùng lặp sản phẩm.
export function parseSideBanners(value) {
  let parsed = value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return { version: 1, left: [], right: [] }
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return { version: 1, left: [], right: [] }
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { version: 1, left: [], right: [] }
  return {
    version: 1,
    left: normalizeSideList(parsed.left),
    right: normalizeSideList(parsed.right),
  }
}

// Chức năng serializeSideBanners: biến cấu hình thành chuỗi JSON để lưu vào form.sideBanners.
// Nếu truyền catalog, các ô chưa chọn sản phẩm sẽ được tự động điền để không bị trống.
export function serializeSideBanners(value, catalog) {
  if (Array.isArray(catalog) && catalog.length > 0) {
    const filled = autoFillSideBanners(value, catalog)
    return JSON.stringify(parseSideBanners(filled))
  }
  return JSON.stringify(parseSideBanners(value))
}

// Chức năng padSideBannerList: đệm ô cho trạng thái chỉnh sửa.
// Không có count thì giữ số ô đã có, kẹp trong khoảng 5-30; có count thì đổi đúng số ô đó.
export function padSideBannerList(list, count) {
  const slots = Array.isArray(list) ? list.map((slot) => normalizeSideBannerSlot(slot)) : []
  const target = count === undefined ? clampCount(slots.length || SIDE_BANNER_DEFAULT_COUNT) : clampCount(count)
  const next = slots.slice(0, target)
  while (next.length < target) next.push(emptySideBannerSlot())
  return next
}

// Chức năng commonSideBannerCount: số lượng banner CHUNG cho cả 2 bên.
// Lấy bên nhiều slot hơn làm số chung (kẹp 5-30); cấu hình cũ 2 bên lệch nhau
// thì bên ít hơn được đệm ô trống tới số chung khi mở editor.
export function commonSideBannerCount(value) {
  const parsed = parseSideBanners(value)
  return clampCount(Math.max(parsed.left.length, parsed.right.length, SIDE_BANNER_DEFAULT_COUNT))
}

// Chức năng editorSideBanners: trạng thái chỉnh sửa cho ThemeEditor.
// 2 bên LUÔN cùng số ô (số lượng chung): chưa có cấu hình thì 5 ô mỗi bên;
// kẹp trong khoảng 5-30.
export function editorSideBanners(value) {
  const parsed = parseSideBanners(value)
  const count = commonSideBannerCount(parsed)
  return {
    version: 1,
    left: padSideBannerList(parsed.left, count),
    right: padSideBannerList(parsed.right, count),
  }
}

// Chức năng sideBannerProduct: tìm sản phẩm trong catalog theo id của slot.
export function sideBannerProduct(products, productId) {
  const id = String(productId ?? '').trim()
  if (!id || !Array.isArray(products)) return null
  return products.find((product) => product && String(product.id ?? '') === id) || null
}

// Chuẩn hóa loại bỏ dấu tiếng Việt để tìm kiếm sản phẩm gõ chữ thuận tiện
export function removeVietnameseTones(str) {
  if (!str) return ''
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

// Sắp xếp danh mục sản phẩm cho banner: ưu tiên còn hàng, đang giảm giá, lượt xem cao
export function sortCatalogForBanners(catalog) {
  if (!Array.isArray(catalog)) return []
  return catalog
    .filter((product) => product && product.id !== null && product.id !== undefined && String(product.id).trim() !== '')
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const stockA = a.product.stockCount === 0 ? 0 : 1
      const stockB = b.product.stockCount === 0 ? 0 : 1
      if (stockA !== stockB) return stockB - stockA
      const discountA = Number(a.product.discountPercent) || 0
      const discountB = Number(b.product.discountPercent) || 0
      const onSale = (discountB > 0) - (discountA > 0)
      if (onSale !== 0) return onSale
      if (discountB !== discountA) return discountB - discountA
      const views = (Number(b.product.viewCount) || 0) - (Number(a.product.viewCount) || 0)
      if (views !== 0) return views
      return a.index - b.index
    })
    .map(({ product }) => product)
}

// Tìm kiếm lọc sản phẩm từ catalog theo từ khóa (tên, danh mục, giá, ID)
export function filterCatalogProducts(catalog, query) {
  if (!Array.isArray(catalog)) return []
  const cleanQuery = removeVietnameseTones(query)
  if (!cleanQuery) return catalog

  const tokens = cleanQuery.split(/\s+/).filter(Boolean)

  return catalog.filter((product) => {
    if (!product) return false
    const nameNorm = removeVietnameseTones(product.name)
    const categoryNorm = removeVietnameseTones(product.category)
    const idStr = String(product.id ?? '').toLowerCase()
    const priceNum = Number(product.price)
    const priceStr = Number.isFinite(priceNum) ? String(priceNum) : ''
    const priceFormatted = Number.isFinite(priceNum)
      ? new Intl.NumberFormat('vi-VN').format(priceNum)
      : ''

    const searchable = [nameNorm, categoryNorm, idStr, priceStr, priceFormatted].join(' ')
    return tokens.every((token) => searchable.includes(token))
  })
}

// Chức năng autoFillSideBanners: tự động custom hàng loạt banner khi chưa chọn sản phẩm riêng
// Giữ nguyên các banner đã được custom riêng, chỉ tự động điền các ô trống
export function autoFillSideBanners(config, catalog, count) {
  const parsed = config && typeof config === 'object' ? config : editorSideBanners(config)
  const currentCount = count !== undefined
    ? clampCount(count)
    : clampCount(Math.max(parsed.left?.length || 0, parsed.right?.length || 0, SIDE_BANNER_DEFAULT_COUNT))
  const leftSlots = padSideBannerList(parsed.left || [], currentCount)
  const rightSlots = padSideBannerList(parsed.right || [], currentCount)
  const candidates = sortCatalogForBanners(catalog)

  if (candidates.length === 0) {
    return { version: 1, left: leftSlots, right: rightSlots }
  }

  // Đếm các sản phẩm đã được gán thủ công để ưu tiên sản phẩm khác
  const usedIds = new Set()
  for (const slot of [...leftSlots, ...rightSlots]) {
    if (slot && slot.productId && String(slot.productId).trim() !== '') {
      usedIds.add(String(slot.productId))
    }
  }

  const unusedCandidates = candidates.filter((item) => !usedIds.has(String(item.id)))
  let unusedIndex = 0
  let cycleIndex = 0

  function pickProduct() {
    if (unusedIndex < unusedCandidates.length) {
      return unusedCandidates[unusedIndex++]
    }
    const picked = candidates[cycleIndex % candidates.length]
    cycleIndex++
    return picked
  }

  const fillSlot = (slot) => {
    if (slot && slot.productId && String(slot.productId).trim() !== '') {
      return normalizeSideBannerSlot(slot)
    }
    const product = pickProduct()
    if (!product) return normalizeSideBannerSlot(slot)
    return normalizeSideBannerSlot({
      ...slot,
      productId: String(product.id),
      title: slot?.title || product.name || '',
      note: slot?.note || (product.category ? 'Danh mục ' + product.category : ''),
      bg: slot?.bg || '',
      text: slot?.text || '',
      accent: slot?.accent || '',
    })
  }

  return {
    version: 1,
    left: leftSlots.map(fillSlot),
    right: rightSlots.map(fillSlot),
  }
}
