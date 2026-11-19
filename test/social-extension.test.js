/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tự động (Unit test) cho Chrome Extension OmniCart Social Bridge (Manifest V3), xác minh cấu trúc tệp, quyền kiểm soát 3 tab, thông tin tài khoản Facebook John Harper / TikTok @harutv666 và giao thức bridge không chiếm quyền chuột bàn phím.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, Store-Admin/extension/background.js, Store-Admin/extension/content-admin-bridge.js, Store-Admin/extension/content-facebook.js, Store-Admin/extension/content-tiktok.js.
  - Vùng ảnh hưởng khi sửa: Quy trình chạy kiểm thử npm test của Store-Admin.
*/

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInContext } from 'node:vm'
import { JSDOM } from 'jsdom'

function loadContentScript(filePath, url, html = '') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' })
  dom.window.chrome = {
    runtime: {
      onMessage: { addListener() {} }
    }
  }
  runInContext(readFileSync(filePath, 'utf-8'), dom.getInternalVMContext())
  return dom
}

test('Chrome Extension: manifest.json tuân thủ chuẩn Manifest V3 và quyền host Facebook/TikTok', () => {
  const manifestPath = resolve('extension/manifest.json')
  assert.ok(existsSync(manifestPath), 'Phải có tệp extension/manifest.json')

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  assert.strictEqual(manifest.manifest_version, 3, 'Manifest phải là version 3')
  assert.ok(manifest.name.includes('OmniCart Social'), 'Tên extension phải chứa OmniCart Social')

  // Kiểm tra permissions
  const permissions = manifest.permissions || []
  assert.ok(permissions.includes('tabs'), 'Extension phải có quyền tabs để điều khiển tab')
  assert.ok(permissions.includes('scripting'), 'Extension phải có quyền scripting')
  assert.ok(permissions.includes('storage'), 'Extension phải có quyền storage')

  // Kiểm tra host permissions
  const hostPermissions = manifest.host_permissions || []
  assert.ok(hostPermissions.some(h => h.includes('facebook.com')), 'Phải có host permission cho facebook.com')
  assert.ok(hostPermissions.some(h => h.includes('tiktok.com')), 'Phải có host permission cho tiktok.com')
  assert.ok(hostPermissions.some(h => h.includes('localhost')), 'Phải có host permission cho localhost')

  // Kiểm tra content scripts
  const contentScripts = manifest.content_scripts || []
  assert.ok(contentScripts.length >= 3, 'Phải có ít nhất 3 content scripts cho Admin, Facebook và TikTok')
  assert.ok(contentScripts.some(cs => cs.js.includes('content-admin-bridge.js')), 'Phải có content-admin-bridge.js')
  assert.ok(contentScripts.some(cs => cs.js.includes('content-facebook.js')), 'Phải có content-facebook.js')
  assert.ok(contentScripts.some(cs => cs.js.includes('content-tiktok.js')), 'Phải có content-tiktok.js')
  assert.ok(contentScripts.filter(cs => cs.js.includes('content-facebook.js') || cs.js.includes('content-tiktok.js')).every(cs => cs.js.includes('content-media.js')), 'Facebook và TikTok phải nạp bộ xử lý ảnh sản phẩm')
})

test('Chrome Extension: background.js và content scripts tồn tại đầy đủ và nhắm đúng profile John Harper và @harutv666', () => {
  const bgPath = resolve('extension/background.js')
  const fbPath = resolve('extension/content-facebook.js')
  const ttPath = resolve('extension/content-tiktok.js')
  const mediaPath = resolve('extension/content-media.js')
  const popupHtmlPath = resolve('extension/popup.html')
  const popupJsPath = resolve('extension/popup.js')

  assert.ok(existsSync(bgPath), 'Phải có tệp background.js')
  assert.ok(existsSync(fbPath), 'Phải có tệp content-facebook.js')
  assert.ok(existsSync(ttPath), 'Phải có tệp content-tiktok.js')
  assert.ok(existsSync(mediaPath), 'Phải có tệp content-media.js')
  assert.ok(existsSync(popupHtmlPath), 'Phải có tệp popup.html')
  assert.ok(existsSync(popupJsPath), 'Phải có tệp popup.js')

  const bgCode = readFileSync(bgPath, 'utf-8')
  assert.ok(bgCode.includes('61580644871703'), 'background.js phải định tuyến tới profile John Harper 61580644871703')
  assert.ok(bgCode.includes('harutv666'), 'background.js phải định tuyến tới TikTok @harutv666')
  assert.ok(bgCode.includes('AUTO_POST'), 'background.js phải xử lý thông điệp AUTO_POST')
  assert.ok(bgCode.includes('FETCH_REAL_VIRAL'), 'background.js phải xử lý thông điệp FETCH_REAL_VIRAL')

  const fbCode = readFileSync(fbPath, 'utf-8')
  assert.ok(fbCode.includes('61580644871703'), 'content-facebook.js phải chứa ID profile John Harper')
  assert.ok(fbCode.includes('FB_EXECUTE_POST'), 'content-facebook.js phải lắng nghe FB_EXECUTE_POST')

  const ttCode = readFileSync(ttPath, 'utf-8')
  assert.ok(ttCode.includes('harutv666'), 'content-tiktok.js phải chứa username @harutv666')
  assert.ok(ttCode.includes('TIKTOK_EXECUTE_POST'), 'content-tiktok.js phải lắng nghe TIKTOK_EXECUTE_POST')

  const popupJsCode = readFileSync(popupJsPath, 'utf-8')
  assert.ok(popupJsCode.includes('harutv666'), 'popup.js phải kiểm tra tài khoản TikTok @harutv666')
  assert.ok(popupJsCode.includes('61580644871703'), 'popup.js phải kiểm tra tài khoản Facebook John Harper')
})

test('Chrome Extension: không sử dụng thư viện chiếm quyền chuột bàn phím hệ điều hành', () => {
  const bgCode = readFileSync(resolve('extension/background.js'), 'utf-8')
  const fbCode = readFileSync(resolve('extension/content-facebook.js'), 'utf-8')
  const ttCode = readFileSync(resolve('extension/content-tiktok.js'), 'utf-8')
  const allCode = bgCode + '\n' + fbCode + '\n' + ttCode

  // Tuyệt đối không dùng pyautogui hay robotjs chiếm quyền chuột máy tính
  assert.ok(!allCode.includes('robotjs'), 'Không được dùng robotjs')
  assert.ok(!allCode.includes('pyautogui'), 'Không được dùng pyautogui')
  assert.ok(!allCode.includes('mouse.move'), 'Không can thiệp tọa độ chuột toàn cục máy tính')
})

test('Chrome Extension: không báo đăng nếu thiếu ảnh, quyền riêng tư hoặc permalink thật', () => {
  const bgCode = readFileSync(resolve('extension/background.js'), 'utf-8')
  const bridgeCode = readFileSync(resolve('extension/content-admin-bridge.js'), 'utf-8')
  const fbCode = readFileSync(resolve('extension/content-facebook.js'), 'utf-8')
  const ttCode = readFileSync(resolve('extension/content-tiktok.js'), 'utf-8')
  const popupCode = readFileSync(resolve('extension/popup.js'), 'utf-8')

  assert.ok(bridgeCode.includes('response?.ok === true'), 'Bridge chỉ nhận phản hồi thành công rõ ràng')
  assert.ok(bgCode.includes('PRODUCT_IMAGE_REQUIRED'), 'Background phải từ chối bài không có ảnh')
  assert.ok(bgCode.includes('isConfirmedPostResponse'), 'Background phải kiểm tra permalink và mã bài thật')
  assert.ok(!bgCode.includes('postUrl: FB_PROFILE_URL'), 'Không dùng link profile Facebook làm permalink giả')
  assert.ok(!bgCode.includes('postUrl: TIKTOK_PROFILE_URL'), 'Không dùng link profile TikTok làm permalink giả')
  assert.ok(fbCode.includes('FACEBOOK_ONLY_ME_NOT_CONFIRMED'), 'Facebook phải dừng nếu chưa xác nhận Chỉ mình tôi')
  assert.ok(fbCode.includes('FACEBOOK_POST_NOT_VERIFIED'), 'Facebook phải dừng nếu chưa thấy permalink bài mới')
  assert.ok(ttCode.includes('TIKTOK_PHOTO_UPLOAD_UNAVAILABLE'), 'TikTok phải báo nếu trang không nhận ảnh')
  assert.ok(ttCode.includes('TIKTOK_ONLY_ME_NOT_CONFIRMED'), 'TikTok phải dừng nếu chưa xác nhận Chỉ mình tôi')
  assert.ok(ttCode.includes('TIKTOK_POST_NOT_VERIFIED'), 'TikTok phải dừng nếu chưa thấy permalink bài mới')
  assert.ok(!popupCode.includes("type: 'AUTO_POST'"), 'Popup không tự đăng nội dung mẫu thiếu ảnh và AI')
})

test('Chrome Extension: từ chối bài khi sai tài khoản, sai trang hoặc TikTok không có ô tải ảnh', async () => {
  const facebookPath = resolve('extension/content-facebook.js')
  const tiktokPath = resolve('extension/content-tiktok.js')
  const imagePayload = { privacy: 'only_me', imageDataUrl: 'data:image/png;base64,AA==', content: 'Caption thử' }

  const wrongFacebook = loadContentScript(facebookPath, 'https://www.facebook.com/profile.php?id=999')
  const wrongFacebookResult = await wrongFacebook.window.executeFacebookPost(imagePayload)
  assert.strictEqual(wrongFacebookResult.error, 'FACEBOOK_ACCOUNT_MISMATCH')
  wrongFacebook.window.close()

  const facebookWithoutComposer = loadContentScript(facebookPath, 'https://www.facebook.com/profile.php?id=61580644871703')
  const noComposerResult = await facebookWithoutComposer.window.executeFacebookPost(imagePayload)
  assert.strictEqual(noComposerResult.error, 'FACEBOOK_COMPOSER_NOT_FOUND')
  facebookWithoutComposer.window.close()

  const wrongTikTokPage = loadContentScript(tiktokPath, 'https://www.tiktok.com/@harutv666')
  const wrongTikTokResult = await wrongTikTokPage.window.executeTikTokPost(imagePayload)
  assert.strictEqual(wrongTikTokResult.error, 'TIKTOK_UPLOAD_PAGE_REQUIRED')
  wrongTikTokPage.window.close()

  const noImageInput = loadContentScript(
    tiktokPath,
    'https://www.tiktok.com/tiktokstudio/upload',
    '<a href="/@harutv666">@harutv666</a>'
  )
  noImageInput.window.Element.prototype.getClientRects = () => [{}]
  noImageInput.window.OmniCartMedia = {
    waitFor: async (predicate) => Boolean(predicate()),
    findImageInput: async () => null
  }
  const noImageInputResult = await noImageInput.window.executeTikTokPost(imagePayload)
  assert.strictEqual(noImageInputResult.error, 'TIKTOK_PHOTO_UPLOAD_UNAVAILABLE')
  noImageInput.window.close()
})
