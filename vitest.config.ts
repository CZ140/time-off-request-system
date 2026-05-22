import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    globals: false,
    alias: {
      // server-only throws on import outside Next.js server context.
      // Replace with an empty stub so Server Action logic can be unit-tested.
      // fileURLToPath is critical on Windows: URL.pathname yields '/C:/...'
      // which Node's resolver rejects. fileURLToPath returns 'C:\\...'.
      'server-only': fileURLToPath(new URL('./__mocks__/server-only.ts', import.meta.url)),
    },
    coverage: { provider: 'v8' },
  },
})
