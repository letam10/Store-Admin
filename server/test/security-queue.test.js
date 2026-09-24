import assert from 'node:assert/strict'
import test from 'node:test'
import { GenerationQueue } from '../src/queue.js'
import { SlidingWindowLimiter } from '../src/security.js'

test('limiter bounds key memory', () => {
  const limiter = new SlidingWindowLimiter({ limit: 2, windowMs: 60000, maxKeys: 3, sweepEvery: 1000 })
  for (let index = 0; index < 10; index += 1) limiter.consume('key-' + index)
  assert.ok(limiter.size <= 3)
})

test('queue abort while waiting releases listener/slot and later task runs', async () => {
  const queue = new GenerationQueue({ concurrency: 1, maxQueued: 1 })
  let release
  const first = queue.run(() => new Promise((resolve) => { release = resolve }))
  const controller = new AbortController()
  const second = queue.run(async () => 'never', controller.signal)
  controller.abort()
  await assert.rejects(second, (error) => error.code === 'ABORTED')
  release('first')
  await first
  assert.equal(await queue.run(async () => 'next'), 'next')
})
