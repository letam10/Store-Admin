import assert from 'node:assert/strict'

import test from 'node:test'

import { readFileSync, existsSync } from 'node:fs'

import { resolve } from 'node:path'



test('Chrome Extension v3.1: manifest.json chuẩn MV3, đa tài khoản, có bộ đếm trượt 5 phút & soi duyệt TikTok', () => {

  const manifest = JSON.parse(readFileSync(resolve('extension/manifest.json'), 'utf-8'))

  assert.strictEqual(manifest.manifest_version, 3)

  assert.strictEqual(manifest.version, '3.1.0')

  assert.ok(manifest.permissions.includes('alarms'))



  const files = [

    'extension/background.js',

    'extension/content-facebook.js',

    'extension/content-tiktok.js',

    'extension/vision-engine.js',

    'extension/content-media.js',

    'extension/content-admin-bridge.js'

  ]

  for (const f of files) assert.ok(existsSync(resolve(f)), `Thiếu ${f}`)



  const combined = files.map(f => readFileSync(resolve(f), 'utf-8')).join('\n')

  assert.ok(!combined.includes('100037782653708'), 'Không hardcode ID Facebook')

  assert.ok(!combined.includes('harutv666'), 'Không hardcode username TikTok')

  assert.ok(!combined.includes('Hoàng Thái HT'), 'Không hardcode tên nick')



  assert.ok(readFileSync(resolve('extension/background.js'), 'utf-8').includes('scrapeFacebookViralWithSliding5Min'))

  assert.ok(readFileSync(resolve('extension/background.js'), 'utf-8').includes('scrapeTikTokViralWithSliding5Min'))

  assert.ok(readFileSync(resolve('extension/content-facebook.js'), 'utf-8').includes('findHomeSidebarProfileAvatarLink'))

  assert.ok(readFileSync(resolve('extension/content-tiktok.js'), 'utf-8').includes('clickStudioSidebarUploadPhoto'))

})
