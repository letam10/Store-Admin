/**
 * @codex-vn-doc
 * Tệp: src/pages/adminState.js
 * Mục đích: State helper cho session, dashboard, module và chat của admin.
 * Thành phần chính: adminConversationKey.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
// Chức năng adminConversationKey: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function adminConversationKey(username) {
  return 'storeAdminConversationId:' + String(username || '').trim().toLocaleLowerCase('vi')
}
