/**
 * @codex-vn-doc
 * Tệp: src/components/ui/customerSupportState.js
 * Mục đích: State helper cho lịch sử chat, streaming, retry và phục hồi giao diện hỗ trợ.
 * Thành phần chính: mapServerMessages, createRestoreGuard, applyRestore.
 * Liên kết trực tiếp: không có import/using trực tiếp được phát hiện.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
// Chức năng mapServerMessages: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function mapServerMessages(messages) {
  return messages.map((message) => ({
    id: 'server-' + message.id,
    role: message.role,
    content: message.content,
    sources: message.sources || [],
    verified: message.verified || null,
    report: message.report || null,
    status: message.status || 'complete',
    requestId: message.requestId,
    retryContent: message.retryContent,
    error: message.error || '',
  }))
}

// Chức năng createRestoreGuard: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function createRestoreGuard(initialConversationId = '') {
  let version = 0
  const initialId = initialConversationId
  return {
    begin() {
      version += 1
      return { version, conversationId: initialId }
    },
    invalidate() {
      version += 1
    },
    canApply(token, { requestActive, currentConversationId }) {
      return Boolean(
        token &&
        token.version === version &&
        token.conversationId === initialId &&
        currentConversationId === initialId &&
        !requestActive,
      )
    },
  }
}

// Chức năng applyRestore: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
export function applyRestore(currentMessages, restoredMessages, { canApply }) {
  return canApply ? mapServerMessages(restoredMessages) : currentMessages
}
