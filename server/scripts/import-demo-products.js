import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from '../src/config.js'
import { StoreDb } from '../src/db.js'

const SOURCE = 'mock-store-api'
const API_ROOT = 'https://store.halukaksoy.dev/api/products'
const DEMO_VND_PER_USD = 25000
const GROUPS = [
  { slug: 'electronics', name: 'Công nghệ', quota: 60, tone: 'blue', symbol: '⌁' },
  { slug: 'home', name: 'Nhà cửa', quota: 50, tone: 'sand', symbol: '⌂' },
  { slug: 'kitchen', name: 'Nhà bếp', quota: 15, tone: 'rose', symbol: '✦' },
  { slug: 'lifestyle', name: 'Đời sống', quota: 45, tone: 'green', symbol: '✿' },
  { slug: 'outdoors', name: 'Ngoài trời', quota: 30, tone: 'blue', symbol: '☀' },
]

const storeRoot = resolve(config.serverRoot, '..', '..', 'Store')
const snapshotPath = resolve(storeRoot, 'src', 'data', 'imported-products.json')
const imageDir = resolve(storeRoot, 'public', 'products', 'imported')
const adminImageDir = resolve(config.serverRoot, '..', 'public', 'products', 'imported')

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Nguồn demo trả HTTP ${response.status}: ${url}`)
  return response.json()
}

function isUsefulProduct(item) {
  return item && /^[0-9a-f-]{36}$/i.test(item.uuid || '')
    && typeof item.name === 'string' && item.name.length >= 8 && item.name.length <= 100
    && Array.from(item.name).every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) <= 126)
    && !/\(renewed\)|drug test|diaper|incontinence|condom|pregnancy test/i.test(item.name)
    && Number.isInteger(item.price) && item.price > 0
    && typeof item.image_url === 'string'
    && item.image_url.startsWith('https://amazon-berkeley-objects.s3.amazonaws.com/images/small/')
}

async function loadCandidates(group) {
  const candidates = []
  const seenNames = new Set()
  for (let page = 1; page <= 10 && candidates.length < group.quota + 25; page += 1) {
    const url = `${API_ROOT}?category=${group.slug}&page=${page}&per_page=100`
    const payload = await fetchJson(url)
    if (!Array.isArray(payload.data)) throw new Error(`Dữ liệu nguồn không hợp lệ: ${url}`)
    for (const item of payload.data) {
      if (!isUsefulProduct(item)) continue
      const nameKey = item.name.toLocaleLowerCase('en')
      if (seenNames.has(nameKey)) continue
      seenNames.add(nameKey)
      candidates.push(item)
    }
    if (payload.data.length < 100) break
  }
  if (candidates.length < group.quota) {
    throw new Error(`Nguồn ${group.slug} chỉ có ${candidates.length}/${group.quota} sản phẩm phù hợp`)
  }
  return candidates
}

async function readImage(item) {
  const response = await fetch(item.image_url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/jpeg')) {
    throw new Error(`Ảnh không hợp lệ cho ${item.uuid}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 100 || bytes.length > 1000000) throw new Error(`Kích thước ảnh không hợp lệ cho ${item.uuid}`)
  return bytes
}

async function selectWithImages(group, candidates) {
  const selected = []
  for (let index = 0; index < candidates.length && selected.length < group.quota; index += 10) {
    const batch = candidates.slice(index, index + 10)
    const results = await Promise.all(batch.map(async (item) => {
      try { return { item, bytes: await readImage(item) } } catch { return null }
    }))
    for (const result of results) {
      if (result && selected.length < group.quota) selected.push(result)
    }
  }
  if (selected.length !== group.quota) {
    throw new Error(`Ảnh hợp lệ của ${group.slug} chỉ đủ ${selected.length}/${group.quota} sản phẩm`)
  }
  return selected
}

function toCatalogProduct(group, item, importedAt) {
  const brand = typeof item.brand === 'string' && item.brand.trim() ? item.brand.trim() : 'Không ghi'
  return {
    id: `demo-${item.uuid}`,
    source: SOURCE,
    sourceId: item.uuid,
    name: item.name.trim(),
    category: group.name,
    price: Math.max(1000, Math.round(item.price * DEMO_VND_PER_USD / 100000) * 1000),
    description: `Sản phẩm mẫu thuộc nhóm ${group.name}. Tên và ảnh từ bộ dữ liệu Amazon Berkeley Objects; giá VND được quy đổi cố định để thử giao diện, không phải giá bán thật.`,
    image: `/products/imported/${item.uuid}.jpg`,
    features: [`Thương hiệu trong dữ liệu mẫu: ${brand}`, 'Giá và tồn kho chỉ để minh họa', 'Ảnh: Amazon Berkeley Objects (CC BY 4.0)'],
    tone: group.tone,
    symbol: group.symbol,
    label: 'Demo',
    sourceUrl: `${API_ROOT}/${item.uuid}`,
    sourcePriceCents: item.price,
    sourceCurrency: 'USD',
    importedAt,
  }
}

async function main() {
  const importedAt = new Date().toISOString()
  const selectedGroups = []
  for (const group of GROUPS) {
    const candidates = await loadCandidates(group)
    const selected = await selectWithImages(group, candidates)
    selectedGroups.push({ group, selected })
    console.log(`${group.name}: ${selected.length} sản phẩm có ảnh`)
  }

  const records = selectedGroups.flatMap(({ group, selected }) =>
    selected.map(({ item }) => toCatalogProduct(group, item, importedAt)))
  if (records.length !== 200 || new Set(records.map((product) => product.id)).size !== 200) {
    throw new Error('Danh sách nhập phải có đúng 200 mã sản phẩm duy nhất')
  }

  mkdirSync(imageDir, { recursive: true })
  mkdirSync(adminImageDir, { recursive: true })
  for (const { selected } of selectedGroups) {
    for (const { item, bytes } of selected) {
      writeFileSync(resolve(imageDir, `${item.uuid}.jpg`), bytes)
      writeFileSync(resolve(adminImageDir, `${item.uuid}.jpg`), bytes)
    }
  }

  const db = new StoreDb(config.dbPath)
  try {
    db.upsertCatalogProducts(records)
  } finally {
    db.close()
  }
  writeFileSync(snapshotPath, JSON.stringify(records, null, 2) + '\n', 'utf8')
  console.log(`Đã nhập ${records.length} sản phẩm demo vào SQLite và ${snapshotPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
