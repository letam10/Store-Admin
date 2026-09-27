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
  assert.equal(process.versions.node, '24.19.0', 'Use the project Node runtime; do not bypass the version requirement.')
  for (const prefix of ['', 'server/']) {
    const pkg = JSON.parse(readFileSync(new URL('../' + prefix + 'package.json', import.meta.url), 'utf8'))
    const lock = JSON.parse(readFileSync(new URL('../' + prefix + 'package-lock.json', import.meta.url), 'utf8'))
    assert.deepEqual(pkg.engines, { node: '24.19.0', npm: '11.17.0' })
    assert.deepEqual(lock.packages[''].engines, pkg.engines)
    assert.equal(pkg.packageManager, 'npm@11.17.0')
  }
  assert.equal(readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim(), '24.19.0')
})
