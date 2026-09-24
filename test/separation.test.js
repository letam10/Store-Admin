import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

test('admin owns backend and AI without imports from the customer checkout', () => {
  for (const path of ['src/pages/Admin.jsx', 'src/pages/AdminModules.jsx', 'server/src/app.js', 'server/scripts/create-admin.js', 'ai/training/README.md']) assert.equal(existsSync(path), true, path)
  const walk = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)])
  for (const folder of ['src', 'server/src', 'shared']) {
    for (const path of walk(folder).filter((path) => /\.(jsx?|json)$/.test(path))) assert.doesNotMatch(readFileSync(path, 'utf8'), /(?:from\s+['"][^'"]*\/Store\/|D:[\\/]Học)/)
  }
  assert.doesNotMatch(readFileSync('src/App.jsx', 'utf8'), /Home|Catalog|CustomerSupport/)
})
