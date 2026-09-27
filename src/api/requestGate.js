/**
 * @codex-vn-doc
 * Tệp: src/api/requestGate.js
 * Mục đích: Khóa request đang chạy để ngăn gửi trùng và quản lý hủy request.
 * Thành phần chính: createRequestGate.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
// Chức năng createRequestGate: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function createRequestGate() {
  let locked = false
  let epoch = 0
  let controller = null

  return {
    tryBegin() {
      // Edge case: điều kiện ngay sau chú thích là chốt bảo vệ; dữ liệu thiếu, sai, hết hạn, bị hủy hoặc không an toàn phải dừng tại đây.
      if (locked) return null
      locked = true
      epoch += 1
      controller = new AbortController()
      return { epoch, controller }
    },
    isCurrent(value) {
      return locked && value === epoch
    },
    finish(value) {
      if (value !== epoch) return
      locked = false
      controller = null
    },
    cancel() {
      epoch += 1
      controller?.abort()
      controller = null
      locked = false
    },
    get locked() {
      return locked
    },
    get epoch() {
      return epoch
    },
  }
}
