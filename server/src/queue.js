function queueError(code, message) {
  const error = new Error(message)
  error.code = code
  if (code === 'ABORTED') error.name = 'AbortError'
  return error
}

export class GenerationQueue {
  constructor({ concurrency = 1, maxQueued = 4 } = {}) {
    this.concurrency = concurrency
    this.maxQueued = maxQueued
    this.active = 0
    this.waiting = []
  }

  get snapshot() {
    return { active: this.active, queued: this.waiting.length }
  }

  run(task, signal, { waitTimeoutMs = 30000 } = {}) {
    if (signal?.aborted) return Promise.reject(queueError('ABORTED', 'Tác vụ đã bị hủy.'))
    if (this.active >= this.concurrency && this.waiting.length >= this.maxQueued) {
      return Promise.reject(queueError('QUEUE_FULL', 'Hàng đợi AI đang đầy.'))
    }

    return new Promise((resolve, reject) => {
      const item = { task, signal, resolve, reject, onAbort: null, waitTimer: null, started: false }
      const cleanupWaiting = () => {
        if (item.waitTimer) clearTimeout(item.waitTimer)
        item.waitTimer = null
        signal?.removeEventListener('abort', item.onAbort)
      }
      item.onAbort = () => {
        if (item.started) return
        const index = this.waiting.indexOf(item)
        if (index >= 0) this.waiting.splice(index, 1)
        cleanupWaiting()
        reject(queueError('ABORTED', 'Tác vụ đã bị hủy khi đang chờ.'))
      }
      signal?.addEventListener('abort', item.onAbort, { once: true })

      if (this.active < this.concurrency) {
        cleanupWaiting()
        this.#start(item)
      } else {
        if (Number.isFinite(waitTimeoutMs) && waitTimeoutMs > 0) {
          item.waitTimer = setTimeout(() => {
            if (item.started) return
            const index = this.waiting.indexOf(item)
            if (index >= 0) this.waiting.splice(index, 1)
            cleanupWaiting()
            reject(queueError('QUEUE_TIMEOUT', 'Tác vụ chờ AI quá lâu.'))
          }, waitTimeoutMs)
        }
        this.waiting.push(item)
      }
    })
  }

  #start(item) {
    item.started = true
    if (item.waitTimer) clearTimeout(item.waitTimer)
    item.waitTimer = null
    item.signal?.removeEventListener('abort', item.onAbort)
    if (item.signal?.aborted) {
      item.reject(queueError('ABORTED', 'Tác vụ đã bị hủy.'))
      this.#drain()
      return
    }

    this.active += 1
    Promise.resolve()
      .then(() => item.task(item.signal))
      .then(item.resolve, item.reject)
      .finally(() => {
        this.active -= 1
        this.#drain()
      })
  }

  #drain() {
    while (this.active < this.concurrency && this.waiting.length > 0) {
      this.#start(this.waiting.shift())
    }
  }
}
