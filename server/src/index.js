/**
 * @codex-vn-doc
 * Tệp: server/src/index.js
 * Mục đích: Điểm khởi động Node API, mở cổng HTTP và kết nối ứng dụng.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: ./app.js, ./config.js.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
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

// Chức năng shutdown: xử lý dữ liệu theo hợp đồng của hàm; kiểm tra đầu vào, nhánh lỗi và kết quả trước khi trả cho nơi gọi.
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
