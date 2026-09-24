import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { gunzipSync } from 'node:zlib'

const storeRoot = resolve(import.meta.dirname, '..', '..', '..', 'Store')
const snapshotPath = resolve(storeRoot, 'src', 'data', 'imported-products.json')
const galleryDir = resolve(storeRoot, 'public', 'products', 'gallery')
const metadataUrl = 'https://amazon-berkeley-objects.s3.us-east-1.amazonaws.com/images/metadata/images.csv.gz'
const imageRoot = 'https://amazon-berkeley-objects.s3.us-east-1.amazonaws.com/images/small/'
const apiRoot = 'https://store.halukaksoy.dev/api/products/'
const products = JSON.parse(readFileSync(snapshotPath, 'utf8'))

async function rangedMetadata() {
  const head = await fetch(metadataUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
  if (!head.ok) throw new Error('Không đọc được metadata ảnh')
  const size = Number(head.headers.get('content-length'))
  if (!Number.isInteger(size) || size < 1000 || size > 20000000) throw new Error('Kích thước metadata ảnh không hợp lệ')
  const chunk = 524288
  const parts = await Promise.all(Array.from({ length: Math.ceil(size / chunk) }, async (_, index) => {
    const start = index * chunk
    const end = Math.min(size - 1, start + chunk - 1)
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(metadataUrl, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) })
        const bytes = Buffer.from(await response.arrayBuffer())
        if (response.status !== 206 || bytes.length !== end - start + 1) throw new Error('Metadata ảnh thiếu dữ liệu')
        return bytes
      } catch (error) { if (attempt === 2) throw error }
    }
  }))
  return gunzipSync(Buffer.concat(parts)).toString('utf8')
}

async function productDetail(product) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(apiRoot + product.sourceId, { signal: AbortSignal.timeout(20000) })
      if (response.status === 429) { await new Promise((resolve) => setTimeout(resolve, 15000)); continue }
      if (!response.ok) throw new Error('Không đọc được chi tiết sản phẩm')
      const data = (await response.json()).data
      if (data.uuid !== product.sourceId) throw new Error('Mã sản phẩm không khớp')
      return data
    } catch { if (attempt === 2) return null }
  }
}

async function imageBytes(path) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(imageRoot + path, { signal: AbortSignal.timeout(20000) })
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null
      const bytes = Buffer.from(await response.arrayBuffer())
      return bytes.length > 100 && bytes.length < 1000000 ? bytes : null
    } catch { /* Try once more. */ }
  }
  return null
}

async function main() {
  if (products.length !== 500) throw new Error('Cần đúng 500 sản phẩm nhập trước khi bổ sung ảnh')
  const needed = products.filter((product) => product.description.startsWith('Sản phẩm mẫu nhóm'))
  const details = new Map()
  for (let start = 0; start < needed.length; start += 8) {
    const batch = needed.slice(start, start + 8)
    const loaded = await Promise.all(batch.map(productDetail))
    loaded.forEach((item, index) => { if (item) details.set(batch[index].sourceId, item) })
    if (start + 8 < needed.length) await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  const ids = new Set()
  for (const detail of details.values()) for (const id of (detail.other_image_ids || []).slice(0, 8)) ids.add(id)
  const paths = new Map()
  for (const line of (await rangedMetadata()).split(/\r?\n/)) {
    const [id, , , path] = line.split(',')
    if (ids.has(id) && /^[0-9a-f]{2}\/[0-9a-f]{8}\.(jpg|png)$/.test(path || '')) paths.set(id, path)
  }
  const updates = []
  for (const product of products) {
    const detail = details.get(product.sourceId)
    if (!detail) { updates.push({ ...product, images: product.images || [product.image] }); continue }
    const candidates = (detail.other_image_ids || []).slice(0, 8).filter((id) => paths.has(id))
    const gallery = []
    for (let index = 0; index < candidates.length && gallery.length < 3; index += 4) {
      const batch = candidates.slice(index, index + 4)
      const loaded = await Promise.all(batch.map(async (id) => ({ id, bytes: await imageBytes(paths.get(id)) })))
      for (const item of loaded) if (item.bytes && gallery.length < 3) gallery.push(item)
    }
    const features = Array.isArray(detail.bullet_points)
      ? detail.bullet_points.filter((point) => typeof point === 'string' && point.trim() && point.length <= 300).slice(0, 5)
      : []
    updates.push({ ...product,
      description: typeof detail.description === 'string' && detail.description.trim() ? detail.description.trim() : product.description,
      features: features.length ? features : product.features,
      images: [product.image, ...gallery.map((item, index) => `/products/gallery/${product.sourceId}-${index + 1}${extname(paths.get(item.id))}`)],
    })
    gallery.forEach((item, index) => {
      item.destination = resolve(galleryDir, `${product.sourceId}-${index + 1}${extname(paths.get(item.id))}`)
    })
    if (gallery.length) updates[updates.length - 1].galleryFiles = gallery
  }
  mkdirSync(galleryDir, { recursive: true })
  let imageCount = 0
  for (const item of updates) {
    for (const image of item.galleryFiles || []) { writeFileSync(image.destination, image.bytes); imageCount += 1 }
    delete item.galleryFiles
  }
  writeFileSync(snapshotPath, JSON.stringify(updates, null, 2) + '\n', 'utf8')
  console.log(`Đã bổ sung ${imageCount} ảnh phụ cho ${updates.filter((item) => item.images.length > 1).length}/500 sản phẩm.`)
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 })
