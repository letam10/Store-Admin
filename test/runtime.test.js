/**
 * @codex-vn-doc
 * Tệp: test/runtime.test.js
 * Mục đích: Tệp kiểm thử tự động cho các luồng chính và tình huống biên của module này.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: node:assert/strict, node:fs, node:test.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// Kiểm thử edge case: frontend, backend, lockfiles and runtime use the agreed Node/npm versions.
test('frontend, backend, lockfiles and runtime use the agreed Node/npm versions', () => {
  assert.ok(process.versions.node.startsWith('24.'), 'Use Node 24 runtime; do not bypass the version requirement.')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.ok(pkg.engines?.node, 'Missing node engine requirement in package.json')
  assert.equal(readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim().startsWith('24.'), true)
})
