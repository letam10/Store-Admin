import { createApp } from './app.js'
import { config } from './config.js'

const { app, storeDb } = createApp()
try { storeDb.claimBackend() } catch (error) { storeDb.close(); throw error }

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log('[Store API] http://127.0.0.1:' + config.port)
  console.log('[Store API] Ollama: ' + config.ollamaUrl + ' · model: ' + config.ollamaModel)
})
server.once('error', (error) => {
  storeDb.close()
  console.error('[Store API] Không thể mở cổng:', error.code)
  process.exitCode = 1
})

function shutdown(signal) {
  console.log('[Store API] ' + signal + ' - stopping')
  server.close(() => {
    storeDb.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
