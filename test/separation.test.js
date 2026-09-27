/**
 * @codex-vn-doc
 * Tệp: test/separation.test.js
 * Mục đích: Tệp kiểm thử tự động cho các luồng chính và tình huống biên của module này.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: node:test, node:assert/strict, node:fs, node:path.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Kiểm thử edge case: admin owns backend and AI without imports from the customer checkout.
test('admin owns backend and AI without imports from the customer checkout', () => {
  for (const path of ['src/pages/Admin.jsx', 'src/pages/AdminModules.jsx', 'server/src/app.js', 'server/scripts/create-admin.js', 'ai/training/README.md']) assert.equal(existsSync(path), true, path)
  // Chức năng walk: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
  const walk = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)])
  for (const folder of ['src', 'server/src', 'shared']) {
    for (const path of walk(folder).filter((path) => /\.(jsx?|json)$/.test(path))) assert.doesNotMatch(readFileSync(path, 'utf8'), /(?:from\s+['"][^'"]*\/Store\/|D:[\\/]Học)/)
  }
  assert.doesNotMatch(readFileSync('src/App.jsx', 'utf8'), /Home|Catalog|CustomerSupport/)
})
