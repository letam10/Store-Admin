/*
  FILE NOTE
  - Mục đích: Kiểm thử tự động tính toàn vẹn và phiên bản của Chrome Extension v3.5.0 (manifest, content scripts, quyền riêng tư).
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/background.js, Store-Admin/extension/content-facebook.js, Store-Admin/extension/content-tiktok.js
  - Vùng ảnh hưởng khi sửa: Toàn bộ bộ test CI/CD kiểm thử extension của Admin.
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('Chrome Extension v3.5: ẩn khung thao tác, có cuộn chọn Chỉ mình tôi, Reels 2026 & chủ đề Viral TikTok >=1M', () => {
  const manifest = JSON.parse(readFileSync(resolve('extension/manifest.json'), 'utf-8'))
  assert.strictEqual(manifest.manifest_version, 3)
  assert.ok(['3.2.0', '3.3.0', '3.4.0', '3.5.0'].includes(manifest.version), `Expected version 3.2.0, 3.3.0, 3.4.0 or 3.5.0, got ${manifest.version}`)

  const files = [
    'extension/background.js', 'extension/content-facebook.js', 'extension/content-tiktok.js',
    'extension/vision-engine.js', 'extension/content-media.js', 'extension/content-admin-bridge.js'
  ]
  for (const f of files) assert.ok(existsSync(resolve(f)), `Thiếu ${f}`)

  const combined = files.map(f => readFileSync(resolve(f), 'utf-8')).join('\n')
  assert.ok(!combined.includes('100037782653708'))
  assert.ok(!combined.includes('harutv666'))
  assert.ok(!combined.includes('Hoàng Thái HT'))

  assert.ok(readFileSync(resolve('extension/content-facebook.js'), 'utf-8').includes('navigateToProfileViaTopRightAvatar'))
  assert.ok(readFileSync(resolve('extension/content-facebook.js'), 'utf-8').includes('extractActiveReelPost2026'))
  assert.ok(readFileSync(resolve('extension/content-tiktok.js'), 'utf-8').includes('nội dung đang được xét duyệt'))
  assert.ok(readFileSync(resolve('extension/content-tiktok.js'), 'utf-8').includes('detectRedRejectionNoticeInRow'))
  assert.ok(readFileSync(resolve('extension/background.js'), 'utf-8').includes('VIRAL_TOPIC_PRESETS'))
})
