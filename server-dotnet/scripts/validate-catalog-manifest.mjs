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
const importedIds = ids.filter((id) => !['1', '2', '3', '4'].includes(id))
if (manifest.schemaVersion !== 1 || manifest.selectedCount !== 1000 || manifest.products.length !== 1000) throw new Error('Manifest không đúng schema hoặc số lượng 1000')
if (new Set(ids).size !== ids.length) throw new Error('Manifest có ID trùng')
if (JSON.stringify(ids.slice(0, 4)) !== JSON.stringify(['1', '2', '3', '4']) || importedIds.length !== 996) throw new Error('Manifest không có đúng 4 featured và 996 imported')
for (const product of manifest.products) {
  if (!product.name || !product.category || !product.description || !product.image) throw new Error(`Thiếu trường bắt buộc tại ${product.id}`)
}
console.log(JSON.stringify({ ok: true, count: manifest.products.length, importedCount: importedIds.length, manifestPath }, null, 2))
