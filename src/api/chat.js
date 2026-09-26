export class ApiStreamError extends Error {
  constructor(message, code = 'API_ERROR', extra = {}) {
    super(message)
    this.name = 'ApiStreamError'
    this.code = code
    Object.assign(this, extra)
  }
}

async function readError(response) {
  const fallbackByCode = {
    INVALID_PRODUCT: 'Du lieu san pham khong hop le.', INVALID_PRODUCT_OFFER: 'Gia tri giam gia hoac ton kho khong hop le.',
    INVALID_VOUCHER: 'Thong tin voucher khong hop le.', PRODUCT_UNAVAILABLE: 'San pham da het hang hoac khong du ton kho.',
    UNAUTHENTICATED: 'Phien dang nhap da het, vui long dang nhap lai.', CSRF_INVALID: 'Phien bao mat khong hop le, vui long tai lai trang.',
    RATE_LIMITED: 'Ban thao tac qua nhanh, vui long thu lai sau.', RECORD_NOT_FOUND: 'Khong tim thay ban ghi.',
  }
  try {
    const body = await response.json()
    const code = body.error || 'API_ERROR'
    return new ApiStreamError(fallbackByCode[code] || (body.message && !/^[A-Z0-9_ -]+$/.test(String(body.message)) ? body.message : 'Yeu cau API that bai.'), code)
  } catch {
    return new ApiStreamError('Yeu cau API that bai voi HTTP ' + response.status, 'HTTP_' + response.status)
  }
}

export async function apiJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw await readError(response)
  return response.json()
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') {
    throw new ApiStreamError('Backend trả về event không hợp lệ.', 'BAD_STREAM_EVENT')
  }
  if (event.type === 'delta' && typeof event.content !== 'string') {
    throw new ApiStreamError('Event delta thiếu content hợp lệ.', 'BAD_STREAM_EVENT')
  }
  if (event.type === 'done' && typeof event.conversationId !== 'string') {
    throw new ApiStreamError('Event done thiếu conversationId.', 'BAD_STREAM_EVENT')
  }
  if (event.type === 'error' && typeof event.code !== 'string') {
    throw new ApiStreamError('Event error thiếu code.', 'BAD_STREAM_EVENT')
  }
  return event
}

export async function streamChat({
  endpoint,
  message,
  conversationId,
  requestId,
  csrfToken,
  signal,
  onEvent,
}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    },
    body: JSON.stringify({
      message,
      requestId,
      ...(conversationId ? { conversationId } : {}),
    }),
  })

  if (!response.ok) throw await readError(response)
  if (!response.body) throw new ApiStreamError('Trình duyệt không nhận được stream.', 'NO_STREAM')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminalReceived = false
  let cleanEof = false

  const consume = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    let event
    try { event = validateEvent(JSON.parse(trimmed)) }
    catch (error) {
      if (error instanceof ApiStreamError) throw error
      throw new ApiStreamError('Backend trả về stream JSON không hợp lệ.', 'BAD_STREAM')
    }
    if (terminalReceived) throw new ApiStreamError('Backend gửi event sau done.', 'BAD_STREAM')
    onEvent?.(event)
    if (event.type === 'done') terminalReceived = true
    if (event.type === 'error') {
      const localError = { UNAUTHENTICATED: 'Phien dang nhap da het, vui long dang nhap lai.', RATE_LIMITED: 'Ban thao tac qua nhanh, vui long thu lai sau.', INCOMPLETE_STREAM: 'Ket noi ket thuc som, vui long thu lai.' }
      throw new ApiStreamError(localError[event.code] || (event.message && !/^[A-Z0-9_ -]+$/.test(String(event.message)) ? event.message : 'AI local khong the tra loi.'), event.code, {
        incomplete: Boolean(event.incomplete || event.partial),
      })
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) consume(buffer)
    cleanEof = true
    if (!terminalReceived) {
      throw new ApiStreamError('Kết nối kết thúc trước event done.', 'INCOMPLETE_STREAM', { incomplete: true })
    }
  } finally {
    if (!cleanEof || !terminalReceived || signal?.aborted) {
      try { await reader.cancel() } catch { /* best effort */ }
    }
    try { reader.releaseLock() } catch { /* already released */ }
  }
}
