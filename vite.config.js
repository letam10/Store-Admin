/**
 * @codex-vn-doc
 * Tệp: vite.config.js
 * Mục đích: Cấu hình Vite, proxy /api và cổng phát triển của frontend.
 */
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET || process.env.VITE_API_TARGET || 'http://127.0.0.1:5000'

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('scheduler')) {
                return 'vendor-react'
              }
              return 'vendor'
            }
          }
        }
      }
    },
    server: {
      host: '127.0.0.1',
      port: 5174,
      strictPort: true,
      watch: {
        ignored: [
          '**/server-dotnet/**',
          '**/.vs/**',
          '**/server/**',
          '**/ai/**',
          '**/bin/**',
          '**/obj/**',
          '**/*.vsidx'
        ]
      },
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false
        }
      }
    },
    preview: {
      host: '127.0.0.1',
      port: 4174,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false
        }
      }
    }
  }
})

