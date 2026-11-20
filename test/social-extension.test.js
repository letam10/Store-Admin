/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tự động cho Chrome Extension OmniVision Bridge v3.0 (Đa tài khoản, theo dõi duyệt 3-5p, cào 2 tab viral & 5 hội nhóm FB).
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

test('Chrome Extension v3.0: manifest.json chuẩn MV3, nạp đủ vision-engine + content-media + đa tài khoản', () => {
  const manifestPath = resolve('extension/manifest.json')
  assert.ok(existsSync(manifestPath))
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  assert.strictEqual(manifest.manifest_version, 3)
  assert.strictEqual(manifest.version, '3.0.0')
  assert.ok(manifest.permissions.includes('tabs'))
  assert.ok(manifest.permissions.includes('scripting'))
  assert.ok(manifest.permissions.includes('storage'))
  assert.ok(manifest.permissions.includes('alarms'))

  const contentScripts = manifest.content_scripts || []
  assert.ok(contentScripts.some(cs => cs.js.includes('content-admin-bridge.js')))
  const fbCs = contentScripts.find(cs => cs.js.includes('content-facebook.js'))
  const ttCs = contentScripts.find(cs => cs.js.includes('content-tiktok.js'))
  assert.ok(fbCs?.js.includes('vision-engine.js') && fbCs?.js.includes('content-media.js'))
  assert.ok(ttCs?.js.includes('vision-engine.js') && ttCs?.js.includes('content-media.js'))
})

test('Chrome Extension v3.0: không hardcode tên/ID nick cố định và có đầy đủ cơ chế 24/7 + cào viral + cào 5 nhóm', () => {
  const files = [
    'extension/background.js',
    'extension/content-facebook.js',
    'extension/content-tiktok.js',
    'extension/vision-engine.js',
    'extension/content-media.js',
    'extension/content-admin-bridge.js',
    'extension/popup.html',
    'extension/popup.js'
  ]
  for (const file of files) {
    assert.ok(existsSync(resolve(file)), `Thiếu tệp ${file}`)
  }

  const combined = files.map(f => readFileSync(resolve(f), 'utf-8')).join('\n')
  assert.ok(!combined.includes('100037782653708'), 'Không được hardcode ID Facebook cố định')
  assert.ok(!combined.includes('harutv666'), 'Không được hardcode username TikTok cố định')
  assert.ok(!combined.includes('Hoàng Thái HT'), 'Không được hardcode tên tài khoản cố định')
  assert.ok(!combined.includes('robotjs') && !combined.includes('pyautogui'), 'Không dùng công cụ chiếm chuột hệ điều hành')

  const bgCode = readFileSync(resolve('extension/background.js'), 'utf-8')
  assert.ok(bgCode.includes('enqueuePendingVerification'), 'Phải có hàng đợi theo dõi duyệt bài TikTok 3-5 phút')
  assert.ok(bgCode.includes('scrapeBothViralPlatforms'), 'Phải hỗ trợ mở 2 tab cào viral FB & TikTok')
  assert.ok(bgCode.includes('scrapeFacebookGroupsJob'), 'Phải hỗ trợ tự động lấy 5 hội nhóm Facebook')

  const visionCode = readFileSync(resolve('extension/vision-engine.js'), 'utf-8')
  assert.ok(visionCode.includes('inspectPageHealth'), 'Phải có mắt kiểm tra mất mạng / đang tải / captcha')
  assert.ok(visionCode.includes('parseHumanCount'), 'Phải hỗ trợ đọc số tương tác Việt/Anh (K/N/Tr/M)')
})
