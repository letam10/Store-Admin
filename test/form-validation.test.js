import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { installVietnameseValidation } from '../src/services/formValidation.js'

test('thông báo nhập liệu có tiếng Việt và không giữ lỗi sau khi sửa thông tin', () => {
  const dom = new JSDOM('<form><input id="name" required><input id="email" type="email"><input id="qty" type="number" min="1" max="5" step="1"><input id="confirm" type="checkbox" required></form>')
  const { document, Event } = dom.window
  const cleanup = installVietnameseValidation('vi', document)
  const name = document.getElementById('name')
  assert.equal(name.checkValidity(), false)
  assert.equal(name.validationMessage, 'Vui lòng điền thông tin này.')
  name.value = 'Khách hàng'
  name.dispatchEvent(new Event('input', { bubbles: true }))
  assert.equal(name.checkValidity(), true)
  const email = document.getElementById('email')
  email.value = 'khong-phai-email'
  assert.equal(email.checkValidity(), false)
  assert.match(email.validationMessage, /Địa chỉ thư điện tử/)
  const quantity = document.getElementById('qty')
  quantity.value = '6'
  assert.equal(quantity.checkValidity(), false)
  assert.equal(quantity.validationMessage, 'Giá trị không được vượt quá 5.')
  quantity.value = '2'
  quantity.dispatchEvent(new Event('input', { bubbles: true }))
  assert.equal(quantity.checkValidity(), true)
  const confirmed = document.getElementById('confirm')
  assert.equal(confirmed.checkValidity(), false)
  assert.match(confirmed.validationMessage, /xác nhận/)
  confirmed.checked = true
  confirmed.dispatchEvent(new Event('change', { bubbles: true }))
  assert.equal(confirmed.checkValidity(), true)
  cleanup()
  assert.equal(email.validity.customError, false)
  assert.equal(email.validity.typeMismatch, true)
  dom.window.close()
})
