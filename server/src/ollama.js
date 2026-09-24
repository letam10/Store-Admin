function ollamaError(message, code = 'OLLAMA_ERROR', extra = {}) {
  const error = new Error(message)
  error.code = code
  Object.assign(error, extra)
  return error
}

function linkedAbortController(signal, timeoutMs) {
  const controller = new AbortController()
  let timedOut = false
  const onAbort = () => controller.abort()

  if (signal?.aborted) controller.abort()
  else signal?.addEventListener('abort', onAbort, { once: true })

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  return {
    signal: controller.signal,
    wasTimedOut: () => timedOut,
    cleanup() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function classifyTerminalFrame(frame, numPredict) {
  const reason = typeof frame.done_reason === 'string' ? frame.done_reason : ''
  const normalized = reason.toLocaleLowerCase('en')
  if (['length', 'max_tokens', 'token_limit', 'max_length'].includes(normalized)) {
    return { status: 'max_tokens', doneReason: reason || 'length' }
  }
  if (reason && reason !== 'stop') return { status: 'incomplete', doneReason: reason }
  if (!reason && Number.isInteger(frame.eval_count) && frame.eval_count >= numPredict) {
    return { status: 'max_tokens', doneReason: 'eval_count_reached_num_predict' }
  }
  return { status: 'complete', doneReason: reason || 'stop_or_unspecified' }
}

function validateFrame(frame, { terminalSeen, numPredict }) {
  if (!isObject(frame)) throw ollamaError('Frame Ollama phải là object JSON.', 'OLLAMA_BAD_FRAME')
  if (typeof frame.error === 'string' && frame.error) {
    throw ollamaError('Ollama báo lỗi khi sinh nội dung.', 'OLLAMA_STREAM_ERROR')
  }
  if (typeof frame.done !== 'boolean') {
    throw ollamaError('Frame Ollama thiếu trường done boolean.', 'OLLAMA_BAD_FRAME')
  }
  if (terminalSeen) throw ollamaError('Ollama gửi frame sau terminal frame.', 'OLLAMA_BAD_STREAM')

  if (frame.message !== undefined) {
    if (!isObject(frame.message)) throw ollamaError('message trong frame Ollama không hợp lệ.', 'OLLAMA_BAD_FRAME')
    if (frame.message.role !== undefined && frame.message.role !== 'assistant') {
      throw ollamaError('role trong frame Ollama không hợp lệ.', 'OLLAMA_BAD_FRAME')
    }
    if (frame.message.content !== undefined && typeof frame.message.content !== 'string') {
      throw ollamaError('content trong frame Ollama không hợp lệ.', 'OLLAMA_BAD_FRAME')
    }
    if (frame.message.thinking !== undefined && typeof frame.message.thinking !== 'string') {
      throw ollamaError('thinking trong frame Ollama không hợp lệ.', 'OLLAMA_BAD_FRAME')
    }
  } else if (!frame.done) {
    throw ollamaError('Frame Ollama chưa hoàn tất phải có message.', 'OLLAMA_BAD_FRAME')
  }

  if (!frame.done) return { type: 'delta', content: frame.message?.content || '' }

  const terminal = classifyTerminalFrame(frame, numPredict)
  return {
    type: 'terminal',
    ...terminal,
    evalCount: Number.isInteger(frame.eval_count) ? frame.eval_count : null,
    promptEvalCount: Number.isInteger(frame.prompt_eval_count) ? frame.prompt_eval_count : null,
    finalContent: frame.message?.content || '',
  }
}

export class OllamaClient {
  constructor({ baseUrl, model, timeoutMs }) {
    this.baseUrl = baseUrl
    this.model = model
    this.timeoutMs = timeoutMs
  }

  async check() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 3000))
    try {
      const response = await fetch(this.baseUrl + '/api/tags', { signal: controller.signal })
      if (!response.ok) return { connected: false, modelPresent: false, error: 'HTTP_' + response.status }
      const payload = await response.json()
      if (!isObject(payload) || !Array.isArray(payload.models)) {
        return { connected: false, modelPresent: false, error: 'INVALID_RESPONSE' }
      }
      const names = payload.models.map((item) => item?.name || item?.model).filter(Boolean)
      return { connected: true, modelPresent: names.includes(this.model), models: names }
    } catch (error) {
      return {
        connected: false,
        modelPresent: false,
        error: error?.name === 'AbortError' ? 'TIMEOUT' : 'UNREACHABLE',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async *chatStream({ messages, think, numCtx, numPredict, signal, format }) {
    const linked = linkedAbortController(signal, this.timeoutMs)
    let reader = null
    let completedRead = false
    let terminalSeen = false

    try {
      const response = await fetch(this.baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          think,
          ...(format ? { format } : {}),
          options: { num_ctx: numCtx, num_predict: numPredict },
        }),
        signal: linked.signal,
      })

      if (!response.ok) {
        const code = response.status === 404 ? 'MODEL_NOT_FOUND' : 'OLLAMA_HTTP_' + response.status
        throw ollamaError('Ollama trả về lỗi HTTP ' + response.status + '.', code)
      }
      if (!response.body) throw ollamaError('Ollama không trả về stream.', 'OLLAMA_NO_STREAM')

      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processLine = (line) => {
        const trimmed = line.trim()
        if (!trimmed) return null
        let payload
        try {
          payload = JSON.parse(trimmed)
        } catch {
          throw ollamaError('Stream Ollama chứa JSON không hợp lệ.', 'OLLAMA_BAD_STREAM')
        }
        const event = validateFrame(payload, { terminalSeen, numPredict })
        if (event.type === 'terminal') terminalSeen = true
        return event
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newline = buffer.indexOf('\n')
        while (newline >= 0) {
          const event = processLine(buffer.slice(0, newline))
          buffer = buffer.slice(newline + 1)
          if (event?.type === 'delta' && event.content) yield { type: 'delta', content: event.content }
          else if (event?.type === 'terminal') {
            if (event.finalContent) yield { type: 'delta', content: event.finalContent }
            yield { ...event, finalContent: undefined }
          }
          newline = buffer.indexOf('\n')
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        const event = processLine(buffer)
        if (event?.type === 'delta' && event.content) yield { type: 'delta', content: event.content }
        else if (event?.type === 'terminal') {
          if (event.finalContent) yield { type: 'delta', content: event.finalContent }
          yield { ...event, finalContent: undefined }
        }
      }

      completedRead = true
      if (!terminalSeen) throw ollamaError('Ollama kết thúc kết nối trước terminal frame.', 'OLLAMA_EARLY_EOF')
    } catch (error) {
      if (linked.signal.aborted) {
        if (signal?.aborted) {
          const aborted = new Error('Tác vụ đã bị hủy.')
          aborted.name = 'AbortError'
          aborted.code = 'ABORTED'
          throw aborted
        }
        if (linked.wasTimedOut()) throw ollamaError('Ollama quá thời gian chờ.', 'OLLAMA_TIMEOUT')
      }
      throw error
    } finally {
      if (reader && (!completedRead || linked.signal.aborted)) {
        try { await reader.cancel() } catch { /* best effort */ }
      }
      try { reader?.releaseLock() } catch { /* already released */ }
      linked.cleanup()
    }
  }
}
