export function createRequestGate() {
  let locked = false
  let epoch = 0
  let controller = null

  return {
    tryBegin() {
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
