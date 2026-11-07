#!/usr/bin/env node

/** Kiểm tra nhanh manifest trước khi seed/import vào catalog_products. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const adminRoot = path.resolve(scriptDirectory, '..', '..')
const manifestPath = path.join(adminRoot, 'shared', 'catalog-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const ids = manifest.products.map((product) => String(product.id))
const featuredIds = ['1', '2', '3', '4']
const importedIds = ids.filter((id) => !featuredIds.includes(id))
const expectedCategoryCounts = {
  'Điện tử': 84,
  'Đồ gia dụng': 70,
  'Làm đẹp': 57,
  Laptop: 13,
  'Linh kiện': 84,
  'Trang phục': 69,
  'Trang sức': 84,
  'Tự Thiết Kế': 39,
}
const categoryCounts = Object.fromEntries(Object.entries(expectedCategoryCounts).map(([category]) => [
  category,
  manifest.products.filter((product) => product.category === category).length,
]))
if (manifest.schemaVersion !== 1 || manifest.selectedCount !== 500 || manifest.products.length !== 500) throw new Error('Manifest không đúng schema hoặc số lượng 500')
if (new Set(ids).size !== ids.length) throw new Error('Manifest có ID trùng')
if (JSON.stringify(ids.slice(0, 4)) !== JSON.stringify(featuredIds) || importedIds.length !== 496) throw new Error('Manifest không có đúng 4 featured và 496 imported')
for (const [category, expected] of Object.entries(expectedCategoryCounts)) {
  if (categoryCounts[category] !== expected) throw new Error(`${category}: cần ${expected}, nhận ${categoryCounts[category]}`)
}
for (const product of manifest.products) {
  if (!product.name || !product.category || !product.description || !product.image) throw new Error(`Thiếu trường bắt buộc tại ${product.id}`)
}
console.log(JSON.stringify({ ok: true, count: manifest.products.length, importedCount: importedIds.length, categories: categoryCounts, manifestPath }, null, 2))
