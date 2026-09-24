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
