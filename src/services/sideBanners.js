/**
 * @codex-vn-doc
 * Tệp: src/services/sideBanners.js
 * Mục đích: Chuẩn hóa cấu hình banner hai bên trang chủ (appearance.sideBanners) dùng chung
 * giữa ThemeEditor (nhánh Admin) và trang chủ phía khách (nhánh Store).
 * Thành phần chính: parseSideBanners, serializeSideBanners, editorSideBanners,
 * padSideBannerList, normalizeSideBannerSlot, normalizeHexColor, commonSideBannerCount.
 * Liên kết trực tiếp: src/pages/ThemeEditor.jsx (trạng thái chỉnh sửa), trang chủ Store (render).
 * Cẩn trọng: khi sửa hàm, schema hoặc export phải kiểm tra các tệp gọi nó; chuỗi JSON đã lưu
 * chỉ chứa slot có productId thật, ô trống chỉ tồn tại trong trạng thái chỉnh sửa.
 * Số lượng banner là CHUNG cho cả 2 bên: editor luôn đệm 2 bên tới cùng một số ô
 * (bên nhiều hơn quyết định số chung, kẹp 5-20); ô trống vẫn bị loại khi lưu như cũ.
 */
export const SIDE_BANNER_MIN_COUNT = 5
export const SIDE_BANNER_MAX_COUNT = 20
export const SIDE_BANNER_DEFAULT_COUNT = 5
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
// Slot không có productId hợp lệ bị bỏ, mỗi bên tối đa 20 slot, không khử trùng lặp sản phẩm.
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
// Mọi ô trống bị loại bỏ nên một bên đã lưu có thể có ít hơn 5 slot hợp lệ.
export function serializeSideBanners(value) {
  return JSON.stringify(parseSideBanners(value))
}

// Chức năng padSideBannerList: đệm ô trống (productId '') cho trạng thái chỉnh sửa.
// Không có count thì giữ số ô đã có, kẹp trong khoảng 5-20; có count thì đổi đúng số ô đó.
export function padSideBannerList(list, count) {
  const slots = Array.isArray(list) ? list.map((slot) => normalizeSideBannerSlot(slot)) : []
  const target = count === undefined ? clampCount(slots.length || SIDE_BANNER_DEFAULT_COUNT) : clampCount(count)
  const next = slots.slice(0, target)
  while (next.length < target) next.push(emptySideBannerSlot())
  return next
}

// Chức năng commonSideBannerCount: số lượng banner CHUNG cho cả 2 bên.
// Lấy bên nhiều slot hơn làm số chung (kẹp 5-20); cấu hình cũ 2 bên lệch nhau
// thì bên ít hơn được đệm ô trống tới số chung khi mở editor.
export function commonSideBannerCount(value) {
  const parsed = parseSideBanners(value)
  return clampCount(Math.max(parsed.left.length, parsed.right.length, SIDE_BANNER_DEFAULT_COUNT))
}

// Chức năng editorSideBanners: trạng thái chỉnh sửa cho ThemeEditor.
// 2 bên LUÔN cùng số ô (số lượng chung): chưa có cấu hình thì 5 ô mỗi bên;
// đã lưu 7 slot một bên thì cả 2 bên mở ra 7 ô, bên ít hơn được đệm ô trống;
// ô trống chỉ tồn tại trong trạng thái chỉnh sửa, khi lưu vẫn bị loại như cũ.
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
