// LEGACY NODE BACKEND: retained for rollback while server-dotnet is migrated and verified.
// Do not delete this entry point until the C# API passes the complete contract suite.
import { createApp } from './app.js'
import { config } from './config.js'

const { app, storeDb } = createApp()

try {
  await storeDb.ready
  await storeDb.claimBackend()
} catch (error) {
  await storeDb.close()
  throw error
}

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log('[Store API] PostgreSQL ecosystem ready · http://127.0.0.1:' + config.port)
  console.log('[Store API] Ollama: ' + config.ollamaUrl + ' · model: ' + config.ollamaModel)
})

server.once('error', async (error) => {
  await storeDb.close()
  console.error('[Store API] Không thể mở cổng:', error.code)
  process.exitCode = 1
})

function shutdown(signal) {
  console.log('[Store API] ' + signal + ' - stopping')
  server.close(async () => {
    await storeDb.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
