import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    globals: false,
    alias: {
      // server-only throws on import outside Next.js server context.
      // Replace with an empty stub so Server Action logic can be unit-tested.
      'server-only': new URL('./__mocks__/server-only.ts', import.meta.url).pathname,
    },
    coverage: { provider: 'v8' },
  },
})
