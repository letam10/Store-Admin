/**
 * @codex-vn-doc
 * Tệp: vite.config.js
 * Mục đích: Cấu hình Vite, proxy /api và cổng phát triển của frontend.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: @vitejs/plugin-react, vite.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:5000'
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
})
