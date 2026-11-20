/*
  FILE NOTE
  - Mục đích: Bộ kiểm thử tự động (Unit test) cho Chrome Extension OmniCart Social Bridge (Manifest V3), xác minh cấu trúc tệp, quyền kiểm soát 3 tab, thông tin tài khoản Facebook Hoàng Thái HT / TikTok @harutv666 và giao thức bridge.
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
  assert.strictEqual(manifest.version, '1.0.3', 'Đã cập nhật phiên bản extension sau khi sửa luồng đăng')
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

test('Chrome Extension: background.js và content scripts nhắm đúng Facebook Hoàng Thái HT và TikTok @harutv666', () => {
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
  assert.ok(bgCode.includes('100037782653708'), 'background.js phải định tuyến tới profile Hoàng Thái HT 100037782653708')
  assert.ok(bgCode.includes('harutv666'), 'background.js phải định tuyến tới TikTok @harutv666')
  assert.ok(bgCode.includes('AUTO_POST'), 'background.js phải xử lý thông điệp AUTO_POST')
  assert.ok(bgCode.includes('FETCH_REAL_VIRAL'), 'background.js phải xử lý thông điệp FETCH_REAL_VIRAL')

  const fbCode = readFileSync(fbPath, 'utf-8')
  assert.ok(fbCode.includes('100037782653708'), 'content-facebook.js phải chứa ID profile Hoàng Thái HT')
  assert.ok(fbCode.includes('FB_EXECUTE_POST'), 'content-facebook.js phải lắng nghe FB_EXECUTE_POST')

  const ttCode = readFileSync(ttPath, 'utf-8')
  assert.ok(ttCode.includes('harutv666'), 'content-tiktok.js phải chứa username @harutv666')
  assert.ok(ttCode.includes('TIKTOK_EXECUTE_POST'), 'content-tiktok.js phải lắng nghe TIKTOK_EXECUTE_POST')

  const popupJsCode = readFileSync(popupJsPath, 'utf-8')
  assert.ok(popupJsCode.includes('harutv666'), 'popup.js phải kiểm tra tài khoản TikTok @harutv666')
  assert.ok(popupJsCode.includes('100037782653708'), 'popup.js phải kiểm tra tài khoản Facebook Hoàng Thái HT')
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
  assert.ok(ttCode.includes('TIKTOK_PRIVACY_NOT_CONFIRMED'), 'TikTok phải dừng nếu chưa xác nhận đúng quyền riêng tư')
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

  const facebookWithoutComposer = loadContentScript(facebookPath, 'https://www.facebook.com/profile.php?id=100037782653708')
  facebookWithoutComposer.window.OmniCartMedia = { waitFor: async () => false }
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
    '<a href="/@harutv666">@harutv666</a><img class="avatar" src="profile.png">'
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

test('Facebook: nhận diện ô nội dung bài viết "Bạn đang nghĩ gì?"', () => {
  const dom = loadContentScript(
    resolve('extension/content-facebook.js'),
    'https://www.facebook.com/profile.php?id=100037782653708',
    '<div role="button" aria-label="Bạn đang nghĩ gì?">Bạn đang nghĩ gì?</div>'
  )
  dom.window.Element.prototype.getClientRects = () => [{}]

  const trigger = dom.window.findComposerTrigger()
  assert.ok(trigger, 'Phải tìm thấy nút soạn bài trên giao diện Facebook tiếng Việt')
  assert.match(trigger.textContent, /Bạn đang nghĩ gì/i)
  dom.window.close()
})

test('Facebook: không đăng khi chưa xác nhận lựa chọn quyền riêng tư', async () => {
  const person = loadContentScript(
    resolve('extension/content-facebook.js'),
    'https://www.facebook.com/profile.php?id=100037782653708',
    '<main>Hoàng Thái HT</main>'
  )
  assert.equal(await person.window.applyAudiencePrivacy(null, 'public'), null)
  person.window.close()

  assert.equal(await person.window.applyAudiencePrivacy(null, 'only_me'), null)
  person.window.close()
})

test('Facebook: khung soạn phải có ô nội dung và nút Đăng của bài viết', () => {
  const dom = loadContentScript(
    resolve('extension/content-facebook.js'),
    'https://www.facebook.com/profile.php?id=100037782653708',
    '<div role="dialog" id="thought"><div contenteditable="true"></div></div>' +
      '<div role="dialog" id="post"><div contenteditable="true"></div><div role="button">Đăng</div></div>'
  )
  assert.equal(dom.window.findComposerDialog()?.id, 'post')
  dom.window.close()
})

test('TikTok: áp dụng cùng lựa chọn quyền riêng tư Công khai hoặc Chỉ mình tôi', async () => {
  const dom = loadContentScript(
    resolve('extension/content-tiktok.js'),
    'https://www.tiktok.com/tiktokstudio/upload',
    '<select id="visibility"><option value="everyone">Everyone</option><option value="only-you">Only you</option></select>'
  )
  dom.window.OmniCartMedia = { waitFor: async predicate => Boolean(predicate()) }

  const select = dom.window.document.querySelector('#visibility')
  assert.equal(await dom.window.setRequestedPrivacy('only_me'), true)
  assert.equal(select.value, 'only-you')
  assert.equal(await dom.window.setRequestedPrivacy('public'), true)
  assert.equal(select.value, 'everyone')
  dom.window.close()
})

test('Extension: chỉ xác nhận bài khi permalink và quyền riêng tư khớp lựa chọn', () => {
  const dom = new JSDOM('', { runScripts: 'outside-only' })
  dom.window.chrome = {
    runtime: {
      getManifest: () => ({ version: '1.0.3' }),
      onMessage: { addListener() {} }
    }
  }
  runInContext(readFileSync(resolve('extension/background.js'), 'utf-8'), dom.getInternalVMContext())

  const published = {
    ok: true,
    platform: 'facebook',
    privacy: 'public',
    postUrl: 'https://www.facebook.com/profile.php?id=100037782653708&story_fbid=123456',
    realPostId: '123456'
  }
  assert.equal(dom.window.isConfirmedPostResponse(published, 'facebook', 'public'), true)
  assert.equal(dom.window.isConfirmedPostResponse(published, 'facebook', 'only_me'), false)
  dom.window.close()
})

test('Admin bridge: PING phải được Service Worker xác nhận', async () => {
  const bridgePath = resolve('extension/content-admin-bridge.js')
  const dom = new JSDOM('', { url: 'http://127.0.0.1:5174/', runScripts: 'outside-only' })
  let sentMessage = null
  dom.window.chrome = {
    runtime: {
      id: 'omnicart-test-extension',
      lastError: null,
      getManifest: () => ({ version: '1.0.3' }),
      sendMessage(message, callback) {
        sentMessage = message
        callback({ ok: true, installed: true, version: '1.0.3' })
      }
    }
  }
  runInContext(readFileSync(bridgePath, 'utf-8'), dom.getInternalVMContext())

  const responsePromise = new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.data?.source !== 'OMNICART_EXTENSION_RESPONSE') return
      dom.window.removeEventListener('message', onMessage)
      resolve(event.data)
    }
    dom.window.addEventListener('message', onMessage)
  })
  dom.window.dispatchEvent(new dom.window.MessageEvent('message', {
    data: {
      source: 'OMNICART_ADMIN_REQUEST',
      action: 'PING',
      payload: {},
      requestId: 'ping-test'
    },
    origin: dom.window.location.origin,
    source: dom.window
  }))

  const response = await responsePromise
  assert.equal(sentMessage?.type, 'PING')
  assert.equal(response.ok, true)
  assert.equal(response.data?.version, '1.0.3')
  dom.window.close()
})
