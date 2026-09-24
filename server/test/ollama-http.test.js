import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { OllamaClient } from '../src/ollama.js'

async function withFakeOllama(handler, run) {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  try { await run('http://127.0.0.1:' + port) } finally { await new Promise((resolve) => server.close(resolve)) }
}

async function collect(client, options = {}) {
  const events = []
  for await (const event of client.chatStream({ messages: [], think: false, numCtx: 8192, numPredict: 10, ...options })) events.push(event)
  return events
}

test('parses split chunks, unicode and terminal frame without trailing newline', async () => {
  await withFakeOllama((req, res) => {
    res.writeHead(200, { 'content-type': 'application/x-ndjson' })
    const body = '{"message":{"role":"assistant","content":"Xin chào 🌱"},"done":false}\n{"done":true,"done_reason":"stop","eval_count":3}'
    const bytes = Buffer.from(body)
    res.write(bytes.subarray(0, 17)); res.write(bytes.subarray(17, 39)); res.end(bytes.subarray(39))
  }, async (baseUrl) => {
    const client = new OllamaClient({ baseUrl, model: 'qwen3.5:4b', timeoutMs: 1000 })
    const events = await collect(client)
    assert.equal(events[0].content, 'Xin chào 🌱')
    assert.equal(events.at(-1).type, 'terminal')
    assert.equal(events.at(-1).status, 'complete')
  })
})

test('rejects malformed json, wrong payload and error frames', async () => {
  for (const body of ['not-json\n', '{"message":[],"done":false}\n', '{"error":"boom"}\n']) {
    await withFakeOllama((req, res) => { res.writeHead(200); res.end(body) }, async (baseUrl) => {
      const client = new OllamaClient({ baseUrl, model: 'm', timeoutMs: 1000 })
      await assert.rejects(() => collect(client), /Ollama|Frame|Stream/)
    })
  }
})

test('early EOF after partial content is an error', async () => {
  await withFakeOllama((req, res) => { res.writeHead(200); res.end('{"message":{"role":"assistant","content":"một phần"},"done":false}\n') }, async (baseUrl) => {
    const client = new OllamaClient({ baseUrl, model: 'm', timeoutMs: 1000 })
    await assert.rejects(() => collect(client), (error) => error.code === 'OLLAMA_EARLY_EOF')
  })
})

test('token limit is terminal but not complete', async () => {
  await withFakeOllama((req, res) => { res.writeHead(200); res.end('{"message":{"role":"assistant","content":"x"},"done":false}\n{"done":true,"done_reason":"length","eval_count":10}\n') }, async (baseUrl) => {
    const client = new OllamaClient({ baseUrl, model: 'm', timeoutMs: 1000 })
    const events = await collect(client)
    assert.equal(events.at(-1).status, 'max_tokens')
  })
})

test('thinking is never emitted', async () => {
  await withFakeOllama((req, res) => { res.writeHead(200); res.end('{"message":{"role":"assistant","content":"ok","thinking":"secret"},"done":false}\n{"done":true,"done_reason":"stop"}\n') }, async (baseUrl) => {
    const client = new OllamaClient({ baseUrl, model: 'm', timeoutMs: 1000 })
    const events = await collect(client)
    assert.equal(JSON.stringify(events).includes('secret'), false)
  })
})

test('distinguishes timeout and already-aborted signal', async () => {
  await withFakeOllama((req, res) => { void req; void res }, async (baseUrl) => {
    const client = new OllamaClient({ baseUrl, model: 'm', timeoutMs: 30 })
    await assert.rejects(() => collect(client), (error) => error.code === 'OLLAMA_TIMEOUT')
    const controller = new AbortController(); controller.abort()
    await assert.rejects(() => collect(client, { signal: controller.signal }), (error) => error.code === 'ABORTED')
  })
})
