import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.jsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.tsx'],
      reporter: ['text', 'html', 'json'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
