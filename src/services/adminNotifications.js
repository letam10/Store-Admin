const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

export function formatAdminNotification(kind, data, eventId) {
  let text
  if (kind === 'order:created' && data.orderId) {
    text = `Đơn mới ${data.orderId}: ${money.format(Number(data.total) || 0)} · ${data.customer || 'Khách hàng'}`
  } else if (kind === 'order:paid' && data.orderId) {
    text = `Đã xác nhận thanh toán đơn ${data.orderId} · cộng ${Number(data.pointsEarned) || 0} điểm`
  } else if (kind === 'review:created' && data.productId) {
    text = `Đánh giá ${Number(data.rating) || 0} sao từ ${data.customer || 'khách hàng'} · ${data.productName || 'sản phẩm ' + data.productId}`
  } else if (kind === 'support:created' && data.requestId) {
    text = `Yêu cầu hỗ trợ ${data.requestId} · ${data.customer || 'Khách hàng'} · ${data.topic || 'Góp ý cửa hàng'}`
  } else return null
  const occurred = new Date(data.occurredAt || Date.now())
  return {
    id: eventId || kind + ':' + (data.orderId || data.requestId || data.productId) + ':' + data.occurredAt,
    text,
    time: Number.isNaN(occurred.getTime()) ? '' : occurred.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
  }
}

export function listenAdminNotifications(onEvent, EventSourceType = EventSource) {
  const source = new EventSourceType('/api/admin/events/stream')
  for (const kind of ['order:created', 'order:paid', 'review:created', 'support:created']) {
    source.addEventListener(kind, event => {
      try {
        const item = formatAdminNotification(kind, JSON.parse(event.data), event.lastEventId)
        if (item) onEvent(item)
      } catch { /* Gói thông báo lỗi không làm hỏng trang quản trị. */ }
    })
  }
  return () => source.close()
}
