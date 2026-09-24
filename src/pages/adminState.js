export function adminConversationKey(username) {
  return 'storeAdminConversationId:' + String(username || '').trim().toLocaleLowerCase('vi')
}
