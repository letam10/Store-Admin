/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử unit test cho dịch vụ banner hai bên trang chủ (sideBanners.js) và kiểm tra CSS liên quan trong Store-Admin (hỗ trợ tùy chỉnh từ 10 đến 30 banner mỗi bên).
  - Liên kết trực tiếp: Store-Admin/src/services/sideBanners.js, Store-Admin/src/pages/ThemeEditor.css.
  - Vùng ảnh hưởng khi sửa: Quá trình chạy test npm test của Store-Admin.
*/

/**
 * @codex-vn-doc
 * Tệp: test/side-banners.test.js
 * Mục đích: Kiểm thử unit cho service banner hai bên: parse chuỗi/object, cắt 30,
 * đệm ô trống cho trạng thái chỉnh sửa và loại ô trống khi lưu, tự động điền (auto-fill),
 * tìm kiếm sản phẩm tiếng Việt và CSS đồng bộ.
 * Số lượng banner là CHUNG cho cả 2 bên: editor luôn mở 2 bên cùng số ô, bên ít hơn
 * được đệm ô tới số chung (bên nhiều hơn quyết định số chung, kẹp 10-30).
 * Thành phần chính: parseSideBanners, serializeSideBanners, editorSideBanners,
 * padSideBannerList, normalizeSideBannerSlot, normalizeHexColor, commonSideBannerCount,
 * autoFillSideBanners, filterCatalogProducts, sortCatalogForBanners.
 * Liên kết trực tiếp: src/services/sideBanners.js.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  SIDE_BANNER_MAX_COUNT,
  SIDE_BANNER_MIN_COUNT,
  autoFillSideBanners,
  commonSideBannerCount,
  editorSideBanners,
  emptySideBannerSlot,
  filterCatalogProducts,
  normalizeHexColor,
  normalizeSideBannerSlot,
  padSideBannerList,
  parseSideBanners,
  serializeSideBanners,
  sideBannerProduct,
  sortCatalogForBanners,
} from '../src/services/sideBanners.js'

const slot = (productId, extra = {}) => ({ productId, title: '', note: '', bg: '', text: '', accent: '', ...extra })

test('giới hạn số lượng banner: tối thiểu 10, tối đa 30 mỗi bên', () => {
  assert.equal(SIDE_BANNER_MIN_COUNT, 10)
  assert.equal(SIDE_BANNER_MAX_COUNT, 30)
})

test('parse chuỗi JSON và object cho cùng một cấu hình', () => {
  const config = { version: 1, left: [slot('1', { title: 'Tai nghe' })], right: [slot('2')] }
  assert.deepEqual(parseSideBanners(JSON.stringify(config)), config)
  assert.deepEqual(parseSideBanners(config), config)
})

test('parse bỏ slot không có productId, chuỗi rỗng và JSON hỏng trả cấu hình rỗng', () => {
  assert.deepEqual(parseSideBanners(''), { version: 1, left: [], right: [] })
  assert.deepEqual(parseSideBanners('{khong-phai-json'), { version: 1, left: [], right: [] })
  assert.deepEqual(parseSideBanners(null), { version: 1, left: [], right: [] })
  assert.deepEqual(parseSideBanners({ left: [slot(''), slot('3')], right: 'khong-phai-mang' }), {
    version: 1,
    left: [slot('3')],
    right: [],
  })
})

test('parse cắt mỗi bên tối đa 30 slot và không khử trùng lặp sản phẩm', () => {
  const many = Array.from({ length: 35 }, () => slot('1'))
  const parsed = parseSideBanners({ left: many, right: many })
  assert.equal(parsed.left.length, SIDE_BANNER_MAX_COUNT)
  assert.equal(parsed.right.length, SIDE_BANNER_MAX_COUNT)
  assert.equal(parsed.left.filter((item) => item.productId === '1').length, SIDE_BANNER_MAX_COUNT)
})

test('normalize cắt title 120, note 240 và chỉ giữ màu #RRGGBB chữ hoa', () => {
  const normalized = normalizeSideBannerSlot({
    productId: ' 7 ',
    title: 'x'.repeat(200),
    note: 'y'.repeat(300),
    bg: '#a1b2c3',
    text: 'red',
    accent: '#A1B2C3',
  })
  assert.equal(normalized.productId, '7')
  assert.equal(normalized.title.length, 120)
  assert.equal(normalized.note.length, 240)
  assert.equal(normalized.bg, '#A1B2C3')
  assert.equal(normalized.text, '')
  assert.equal(normalized.accent, '#A1B2C3')
  assert.equal(normalizeHexColor('#ff0000'), '#FF0000')
  assert.equal(normalizeHexColor('#FFF'), '')
  assert.equal(normalizeHexColor('  #00ff00  '), '#00FF00')
})

test('editor đệm ô trống: chưa có cấu hình thì 10 ô mỗi bên', () => {
  const editor = editorSideBanners(null)
  assert.equal(editor.left.length, 10)
  assert.equal(editor.right.length, 10)
  assert.deepEqual(editor.left[0], emptySideBannerSlot())
  assert.deepEqual(editorSideBanners(''), editor)
  assert.deepEqual(editorSideBanners({}), editor)
})

test('editor giữ số ô đã lưu và đồng bộ 2 bên: đã lưu 12 slot thì cả 2 bên mở ra 12 ô', () => {
  const saved = { left: Array.from({ length: 12 }, (_, index) => slot(String(index + 1))), right: [slot('9')] }
  const editor = editorSideBanners(saved)
  assert.equal(editor.left.length, 12)
  assert.equal(editor.left[11].productId, '12')
  assert.equal(editor.right.length, 12)
  assert.equal(editor.right[0].productId, '9')
  assert.equal(editor.right[11].productId, '')
})

test('số lượng chung: cấu hình cũ 2 bên lệch nhau thì bên ít hơn được đệm ô trống tới số chung', () => {
  assert.equal(commonSideBannerCount({ left: Array.from({ length: 14 }, () => slot('1')), right: [slot('2')] }), 14)
  assert.equal(commonSideBannerCount(null), 10)
  assert.equal(commonSideBannerCount({ left: Array.from({ length: 35 }, () => slot('1')), right: [] }), 30)
  assert.equal(commonSideBannerCount({ left: [slot('1')], right: [slot('2')] }), 10)
  const editor = editorSideBanners({
    left: Array.from({ length: 12 }, (_, index) => slot(String(index + 1))),
    right: Array.from({ length: 3 }, (_, index) => slot(String(index + 11))),
  })
  assert.equal(editor.left.length, 12)
  assert.equal(editor.right.length, 12)
  assert.equal(editor.right[3].productId, '')
  assert.equal(editor.right[11].productId, '')
  // Ô trống đệm thêm vẫn bị loại khi lưu không truyền catalog, chỉ slot thật được giữ lại.
  const saved = JSON.parse(serializeSideBanners(editor))
  assert.equal(saved.left.length, 12)
  assert.equal(saved.right.length, 3)
})

test('editor luôn trả 2 bên cùng số ô, kẹp trong khoảng 10-30', () => {
  for (const value of [null, '', {}, { left: [], right: [] }, { left: [slot('1')], right: Array.from({ length: 12 }, () => slot('2')) }]) {
    const editor = editorSideBanners(value)
    assert.equal(editor.left.length, editor.right.length)
    assert.ok(editor.left.length >= 10 && editor.left.length <= 30)
  }
})

test('pad đổi số ô trong khoảng 10-30, kẹp giá trị ngoài khoảng', () => {
  assert.equal(padSideBannerList([slot('1')], 14).length, 14)
  assert.equal(padSideBannerList([slot('1')], 3).length, 10)
  assert.equal(padSideBannerList([slot('1')], 99).length, 30)
  assert.equal(padSideBannerList(Array.from({ length: 15 }, () => slot('1')), 12).length, 12)
  assert.equal(padSideBannerList([slot('1')]).length, 10)
})

test('serialize loại mọi ô trống khi lưu nếu không có catalog', () => {
  const editor = editorSideBanners(null)
  editor.left[0] = slot('4', { title: 'Sản phẩm chọn' })
  const saved = JSON.parse(serializeSideBanners(editor))
  assert.deepEqual(saved, { version: 1, left: [slot('4', { title: 'Sản phẩm chọn' })], right: [] })
  assert.equal(typeof serializeSideBanners(editor), 'string')
  // Chuỗi đã lưu đọc lại vẫn giữ đúng slot thật, không tự bịa thêm.
  assert.deepEqual(parseSideBanners(serializeSideBanners(editor)), saved)
})

test('autoFillSideBanners tự động custom hàng loạt banner khi chưa chọn sản phẩm riêng', () => {
  const catalog = [
    { id: '10', name: 'Điện thoại Pro', category: 'Điện tử', discountPercent: 15, viewCount: 100 },
    { id: '20', name: 'Tai nghe Bluetooth', category: 'Phụ kiện', discountPercent: 0, viewCount: 50 },
    { id: '30', name: 'Đồng hồ thông minh', category: 'Công nghệ', discountPercent: 10, viewCount: 80 },
    { id: '40', name: 'Loa không dây', category: 'Âm thanh', discountPercent: 5, viewCount: 20 },
  ]
  const config = editorSideBanners(null) // 10 ô mỗi bên, tất cả đều trống
  const filled = autoFillSideBanners(config, catalog, 10)
  
  assert.equal(filled.left.length, 10)
  assert.equal(filled.right.length, 10)
  
  // Không ô nào bị rỗng productId
  for (const item of [...filled.left, ...filled.right]) {
    assert.ok(item.productId !== '')
    assert.ok(item.title !== '')
  }

  // Khi serialize kèm catalog, toàn bộ 20 slot đều được lưu mà không bị loại bỏ
  const serialized = serializeSideBanners(config, catalog)
  const parsed = JSON.parse(serialized)
  assert.equal(parsed.left.length, 10)
  assert.equal(parsed.right.length, 10)
})

test('autoFillSideBanners giữ nguyên các slot đã custom riêng', () => {
  const catalog = [
    { id: '1', name: 'SP 1' },
    { id: '2', name: 'SP 2' },
    { id: '3', name: 'SP 3' },
  ]
  const config = editorSideBanners(null)
  config.left[0] = slot('99', { title: 'Tiêu đề tùy chỉnh', note: 'Ghi chú riêng', bg: '#FF0000' })
  
  const filled = autoFillSideBanners(config, catalog, 10)
  assert.equal(filled.left[0].productId, '99')
  assert.equal(filled.left[0].title, 'Tiêu đề tùy chỉnh')
  assert.equal(filled.left[0].note, 'Ghi chú riêng')
  assert.equal(filled.left[0].bg, '#FF0000')
  
  // Các ô còn lại được tự động điền từ catalog
  assert.ok(filled.left[1].productId !== '')
  assert.ok(filled.right[0].productId !== '')
})

test('filterCatalogProducts tìm kiếm tiếng Việt không dấu và theo danh mục, giá, ID', () => {
  const catalog = [
    { id: '101', name: 'Áo sơ mi nam công sở', category: 'Thời trang nam', price: 250000 },
    { id: '102', name: 'Điện thoại thông minh siêu mỏng', category: 'Điện thoại', price: 15000000 },
    { id: '103', name: 'Bàn phím cơ không dây', category: 'Phụ kiện máy tính', price: 850000 },
  ]

  // Tìm có dấu và không dấu
  assert.equal(filterCatalogProducts(catalog, 'so mi').length, 1)
  assert.equal(filterCatalogProducts(catalog, 'sơ mi')[0].id, '101')
  assert.equal(filterCatalogProducts(catalog, 'dien thoai').length, 1)
  assert.equal(filterCatalogProducts(catalog, 'bàn phím')[0].id, '103')

  // Tìm theo danh mục
  assert.equal(filterCatalogProducts(catalog, 'Thoi trang').length, 1)

  // Tìm theo giá hoặc ID (hỗ trợ cả định dạng số có dấu chấm 250.000 hoặc viết liền 250000)
  assert.equal(filterCatalogProducts(catalog, '850000').length, 1)
  assert.equal(filterCatalogProducts(catalog, '850.000').length, 1)
  assert.equal(filterCatalogProducts(catalog, '250.000').length, 1)
  assert.equal(filterCatalogProducts(catalog, '102').length, 1)

  // Tìm chuỗi rỗng trả toàn bộ
  assert.equal(filterCatalogProducts(catalog, '').length, 3)
})

test('autoFillSideBanners xoay vòng sản phẩm mượt mà không trùng lặp liên tiếp khi số banner nhiều hơn catalog', () => {
  const catalog = [
    { id: '1', name: 'SP 1' },
    { id: '2', name: 'SP 2' },
    { id: '3', name: 'SP 3' },
  ]
  const config = {
    left: [{ productId: '1', title: 'Custom 1' }],
    right: [],
  }
  const filled = autoFillSideBanners(config, catalog, 10) // 10 mỗi bên = 20 banner
  assert.equal(filled.left.length, 10)
  assert.equal(filled.right.length, 10)
  assert.equal(filled.left[0].productId, '1')
  // Các ô còn lại lấy hết unused (2, 3) rồi xoay vòng tuần tự từ 1, 2, 3
  assert.equal(filled.left[1].productId, '2')
  assert.equal(filled.left[2].productId, '3')
  // Không có 2 ô liền kề nào cùng productId
  const allIds = [...filled.left, ...filled.right].map((s) => s.productId)
  for (let i = 0; i < allIds.length - 1; i++) {
    assert.notEqual(allIds[i], allIds[i + 1])
  }
})

test('sideBannerProduct tìm đúng sản phẩm theo id dạng chuỗi', () => {
  const products = [{ id: '1', name: 'Tai nghe' }, { id: 2, name: 'Loa' }]
  assert.equal(sideBannerProduct(products, '1').name, 'Tai nghe')
  assert.equal(sideBannerProduct(products, 2).name, 'Loa')
  assert.equal(sideBannerProduct(products, '99'), null)
  assert.equal(sideBannerProduct([], '1'), null)
})

test('CSS ô banner bằng nhau: lưới chia hàng 1fr, ô stretch đầy, ảnh/ghi chú/xem trước cao cố định', () => {
  const css = readFileSync(new URL('../src/pages/ThemeEditor.css', import.meta.url), 'utf8')
  // Lưới ô banner: các hàng bằng nhau, ô stretch đầy ô lưới.
  assert.ok(css.includes('.side-banner-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;'))
  assert.ok(css.includes('.side-banner-slot{display:grid;gap:8px;align-content:start;height:100%;'))
  // Vùng ảnh thumbnail và khung xem trước thu nhỏ: chiều cao cố định, ảnh giữ tỉ lệ.
  assert.ok(css.includes('.side-banner-thumb{display:flex;align-items:center;justify-content:center;height:72px;'))
  assert.ok(css.includes('.side-banner-thumb img{width:100%;height:100%;object-fit:contain}'))
  assert.ok(css.includes('.side-banner-mini-preview{display:flex;flex-direction:column;justify-content:center;gap:3px;height:72px;'))
  // Dòng thông tin sản phẩm và ghi chú: chiều cao cố định, nội dung dài bị cắt chứ không đẩy ô cao lên.
  assert.ok(css.includes('.side-banner-product{height:34px;'))
  assert.ok(css.includes('.side-banner-slot textarea{height:54px;resize:none}'))
  // Thẻ xem trước đồng bộ 2 cột: cao bằng nhau ở mọi ô.
  assert.ok(css.includes('.side-banner-sync-card{display:flex;align-items:center;gap:8px;height:44px;'))
})
