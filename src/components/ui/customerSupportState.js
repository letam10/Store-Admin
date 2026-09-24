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

export function applyRestore(currentMessages, restoredMessages, { canApply }) {
  return canApply ? mapServerMessages(restoredMessages) : currentMessages
}
