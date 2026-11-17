/**
 * @codex-vn-doc
 * Tệp: test/side-banners.test.js
 * Mục đích: Kiểm thử unit cho service banner hai bên: parse chuỗi/object, cắt 20,
 * đệm ô trống cho trạng thái chỉnh sửa và loại ô trống khi lưu, giữ số ô đã lưu.
 * Thành phần chính: parseSideBanners, serializeSideBanners, editorSideBanners,
 * padSideBannerList, normalizeSideBannerSlot, normalizeHexColor.
 * Liên kết trực tiếp: src/services/sideBanners.js.
 * Cẩn trọng: khi sửa hàm, schema hoặc export phải kiểm tra các tệp gọi nó.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SIDE_BANNER_MAX_COUNT,
  editorSideBanners,
  emptySideBannerSlot,
  normalizeHexColor,
  normalizeSideBannerSlot,
  padSideBannerList,
  parseSideBanners,
  serializeSideBanners,
  sideBannerProduct,
} from '../src/services/sideBanners.js'

const slot = (productId, extra = {}) => ({ productId, title: '', note: '', bg: '', text: '', accent: '', ...extra })

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

test('parse cắt mỗi bên tối đa 20 slot và không khử trùng lặp sản phẩm', () => {
  const many = Array.from({ length: 25 }, () => slot('1'))
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

test('editor đệm ô trống: chưa có cấu hình thì 5 ô mỗi bên', () => {
  const editor = editorSideBanners(null)
  assert.equal(editor.left.length, 5)
  assert.equal(editor.right.length, 5)
  assert.deepEqual(editor.left[0], emptySideBannerSlot())
  assert.deepEqual(editorSideBanners(''), editor)
  assert.deepEqual(editorSideBanners({}), editor)
})

test('editor giữ số ô đã lưu: đã lưu 7 slot thì mở ra 7 ô', () => {
  const saved = { left: Array.from({ length: 7 }, (_, index) => slot(String(index + 1))), right: [slot('9')] }
  const editor = editorSideBanners(saved)
  assert.equal(editor.left.length, 7)
  assert.equal(editor.left[6].productId, '7')
  assert.equal(editor.right.length, 5)
  assert.equal(editor.right[0].productId, '9')
  assert.equal(editor.right[4].productId, '')
})

test('pad đổi số ô trong khoảng 5-20, kẹp giá trị ngoài khoảng', () => {
  assert.equal(padSideBannerList([slot('1')], 8).length, 8)
  assert.equal(padSideBannerList([slot('1')], 3).length, 5)
  assert.equal(padSideBannerList([slot('1')], 99).length, 20)
  assert.equal(padSideBannerList(Array.from({ length: 10 }, () => slot('1')), 6).length, 6)
  assert.equal(padSideBannerList([slot('1')]).length, 5)
})

test('serialize loại mọi ô trống khi lưu, bên đã lưu có thể ít hơn 5 slot', () => {
  const editor = editorSideBanners(null)
  editor.left[0] = slot('4', { title: 'Sản phẩm chọn' })
  const saved = JSON.parse(serializeSideBanners(editor))
  assert.deepEqual(saved, { version: 1, left: [slot('4', { title: 'Sản phẩm chọn' })], right: [] })
  assert.equal(typeof serializeSideBanners(editor), 'string')
  // Chuỗi đã lưu đọc lại vẫn giữ đúng slot thật, không tự bịa thêm.
  assert.deepEqual(parseSideBanners(serializeSideBanners(editor)), saved)
})

test('sideBannerProduct tìm đúng sản phẩm theo id dạng chuỗi', () => {
  const products = [{ id: '1', name: 'Tai nghe' }, { id: 2, name: 'Loa' }]
  assert.equal(sideBannerProduct(products, '1').name, 'Tai nghe')
  assert.equal(sideBannerProduct(products, 2).name, 'Loa')
  assert.equal(sideBannerProduct(products, '99'), null)
  assert.equal(sideBannerProduct([], '1'), null)
})
