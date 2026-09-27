/**
 * @codex-vn-doc
 * Tệp: eslint.config.js
 * Mục đích: Cấu hình ESLint áp dụng cho mã nguồn frontend.
 * Thành phần chính: các hàm/lớp và xử lý nội bộ trong tệp.
 * Liên kết trực tiếp: @eslint/js, globals, eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint/config.
 * Cẩn trọng: khi sửa hàm, route, state, schema hoặc export phải kiểm tra các tệp gọi nó; các nhánh lỗi, dữ liệu rỗng, hủy request và dữ liệu không hợp lệ phải giữ đúng hợp đồng hiện tại.
 */
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'server/data', 'server/node_modules']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['server/**/*.js', 'shared/**/*.js', 'vite.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: 'readonly',
        AbortController: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^(req|_req)$' }],
    },
  },
])
