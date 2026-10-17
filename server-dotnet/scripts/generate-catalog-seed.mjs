import fs from 'node:fs'
import path from 'node:path'
const root = process.cwd()
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'shared', 'catalog-manifest.json'), 'utf8'))
const seedPath = path.join(root, 'server-dotnet', 'scripts', 'seed-data.sql')
const products = manifest.products
function sql(value, unicode = true) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').replace(/'/g, "''")
  return `${unicode ? 'N' : ''}'${text}'`
}
function row(product) {
  const features = JSON.stringify(Array.isArray(product.features) ? product.features : [])
  return `(${sql(product.id)}, ${sql(product.source)}, ${sql(product.sourceId)}, ${sql(product.name)}, ${sql(product.category)}, ${Number(product.price) || 0}, ${sql(product.description)}, ${sql(product.image, false)}, ${sql(features, false)}, ${sql(product.tone || 'green')}, ${sql(product.symbol || '✦')}, ${sql(product.label || 'Nguồn mẫu')}, ${sql(product.sourceUrl || '')}, ${Number(product.sourcePriceCents) || 0}, ${sql(product.sourceCurrency || 'VND')}, ${sql(product.importedAt || '2026-10-17')}, 0, 20)`
}
const columns = '[id], [source], [source_id], [name], [category], [price], [description], [image], [features_json], [tone], [symbol], [label], [source_url], [source_price_cents], [source_currency], [imported_at], [discount_percent], [stock_count]'
const ids = products.map((product) => sql(product.id, false)).join(', ')
const chunks = []
for (let index = 0; index < products.length; index += 500) {
  const rows = products.slice(index, index + 500).map(row).join(',\n  ')
  chunks.push(`INSERT INTO [catalog_products] (${columns})\nSELECT src.${columns.replaceAll(', ', ', src.')}\nFROM (VALUES\n  ${rows}\n) AS src(${columns})\nWHERE NOT EXISTS (SELECT 1 FROM [catalog_products] target WHERE target.[id] = src.[id]);\nGO`)
}
const block = `-- Table: catalog_products (${products.length} rows)\nDELETE FROM [catalog_products] WHERE [id] NOT IN (${ids});\nGO\n${chunks.join('\n')}`
const source = fs.readFileSync(seedPath, 'utf8')
const start = source.indexOf('-- Table: catalog_products')
const end = source.indexOf('-- Table: Products', start)
if (start < 0 || end < 0) throw new Error('Khong tim thay block catalog_products')
fs.writeFileSync(seedPath, source.slice(0, start) + block + '\n\n' + source.slice(end), 'utf8')
console.log(JSON.stringify({ ok: true, count: products.length, seedPath }, null, 2))
