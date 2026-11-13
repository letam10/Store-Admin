function validationText(field) {
  const validity = field.validity
  if (validity.badInput) return 'Vui lòng nhập một giá trị hợp lệ.'
  if (validity.valueMissing) return ['checkbox', 'radio'].includes(field.type)
    ? 'Vui lòng chọn hoặc xác nhận mục này.' : 'Vui lòng điền thông tin này.'
  if (validity.typeMismatch) return field.type === 'email'
    ? 'Địa chỉ thư điện tử chưa hợp lệ.' : 'Định dạng thông tin chưa hợp lệ.'
  if (validity.tooShort) return `Vui lòng nhập ít nhất ${field.minLength} ký tự.`
  if (validity.tooLong) return `Vui lòng nhập tối đa ${field.maxLength} ký tự.`
  if (validity.rangeUnderflow) return `Giá trị phải từ ${field.min} trở lên.`
  if (validity.rangeOverflow) return `Giá trị không được vượt quá ${field.max}.`
  if (validity.stepMismatch) return field.step === '1'
    ? 'Vui lòng nhập một số nguyên.' : `Vui lòng nhập giá trị theo bước ${field.step || 1}.`
  if (validity.patternMismatch) return 'Thông tin chưa đúng định dạng yêu cầu.'
  return 'Vui lòng kiểm tra lại thông tin.'
}

// Giữ nguyên luật kiểm tra HTML, chỉ đổi thông báo do trình duyệt tạo sang tiếng Việt.
export function installVietnameseValidation(language = 'vi', root = document) {
  if (language !== 'vi') return () => {}
  const owned = new Set()
  function invalid(event) {
    const field = event.target
    if (typeof field?.setCustomValidity !== 'function' || !field.validity) return
    if (field.validity.customError && !owned.has(field)) return
    if (owned.has(field)) field.setCustomValidity('')
    if (field.validity.valid) { owned.delete(field); return }
    field.setCustomValidity(validationText(field))
    owned.add(field)
  }
  function clear(event) {
    if (!owned.has(event.target)) return
    event.target.setCustomValidity('')
    owned.delete(event.target)
  }
  root.addEventListener('invalid', invalid, true)
  root.addEventListener('input', clear, true)
  root.addEventListener('change', clear, true)
  return () => {
    root.removeEventListener('invalid', invalid, true)
    root.removeEventListener('input', clear, true)
    root.removeEventListener('change', clear, true)
    for (const field of owned) field.setCustomValidity('')
    owned.clear()
  }
}
