export class ApiStreamError extends Error {
  constructor(message, code = 'API_ERROR', extra = {}) {
    super(message)
    this.name = 'ApiStreamError'
    this.code = code
    Object.assign(this, extra)
  }
}

async function readError(response) {
  try {
    const body = await response.json()
    return new ApiStreamError(body.message || 'Yêu cầu API thất bại.', body.error || 'API_ERROR')
  } catch {
    return new ApiStreamError('Yêu cầu API thất bại với HTTP ' + response.status, 'HTTP_' + response.status)
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
      throw new ApiStreamError(event.message || 'AI local không thể trả lời.', event.code, {
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
