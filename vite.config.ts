import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

process.env.BROWSERSLIST_IGNORE_OLD_DATA = process.env.BROWSERSLIST_IGNORE_OLD_DATA ?? '1'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react()],
    define: {
      __APP_ENV__: JSON.stringify(env),
    },
    test: {
      environment: 'jsdom',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        'backend/dist/**',
        'tests/e2e/**',
      ],
      setupFiles: './setupTests.ts',
    },
  }
})
