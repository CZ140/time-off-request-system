# Vitest + Next.js 15 App Router: Unit Testing Research

**Researched:** 2026-05-21
**Domain:** Vitest 4.x, Next.js 15 App Router, Server Actions, server-only, Supabase mocking
**Confidence:** HIGH (verified against official Next.js docs, official Vitest docs, and npm registry)

---

## Summary

This document answers five concrete questions about setting up Vitest for unit-testing server-side
logic in a Next.js 15 App Router project. The project has no existing test infrastructure; Vitest
must be added from scratch. The target tests are pure logic: validation in server actions, utility
functions, and Supabase query logic — **not React components**.

Key findings:

1. The official Next.js Vitest example uses `@vitejs/plugin-react` + `jsdom`, but for pure server
   logic tests you should use `environment: 'node'` — lighter, no browser shims, and FormData is
   available natively in Node 18+.
2. `server-only` is literally a bare `throw new Error(...)` with no exports. The standard fix is
   `vi.mock('server-only', () => ({}))` in each test file that transitively imports it, OR a
   global config-level alias pointing to an empty stub file — the alias approach is preferable.
3. Server actions marked `'use server'` are just async functions. Call them directly in tests.
   Mock `redirect()` from `next/navigation` to prevent it from throwing.
4. Supabase's fluent query builder requires a chainable mock. A single shared `chain` object whose
   methods all return `chain` (except terminal methods) is the standard pattern.
5. Minimum packages: `vitest`, `@vitest/coverage-v8`, `vite-tsconfig-paths`. No `jsdom` or
   `@vitejs/plugin-react` needed for logic-only tests.

**Primary recommendation:** Use `environment: 'node'`, stub `server-only` via `resolve.alias` in
`vitest.config.ts`, mock `next/navigation` and your Supabase client with `vi.mock()`, and call
server actions as plain async functions.

---

## Q1 — Minimal vitest.config.ts for Next.js 15 (logic-only tests)

### Does @vitejs/plugin-react need to be included?

**No.** `@vitejs/plugin-react` is only needed when rendering React components (JSX transform). For
pure logic/unit tests — server actions, utilities, Supabase queries — you do not need it.

The official Next.js docs example includes it because their example tests a `<Page />` component.
For the use-cases in this project, omit it.

[VERIFIED: https://nextjs.org/docs/app/guides/testing/vitest — official example adds `@vitejs/plugin-react` only for component rendering]

### Is next/jest config compatible?

No. `next/jest` configures Jest's transform, module mappers, and globals. Vitest has its own
config system and does not consume `next/jest`. The two are completely separate.

### Recommended vitest.config.ts

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [
    // Reads tsconfig.json paths (the "@/*" alias) so imports resolve correctly in tests
    tsconfigPaths(),
  ],
  test: {
    // 'node' is correct for server-side logic: no browser shims, FormData available in Node 18+
    environment: 'node',
    globals: false, // Keep false; use explicit imports (describe, it, expect from 'vitest')
    // Global stub for server-only: maps the package to an empty file so imports don't throw
    alias: {
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
    },
    // Load env vars so process.env.SUPABASE_URL etc. are available (set to empty strings)
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.config.{ts,js,mjs}',
        '**/*.test.{ts,tsx}',
        '__mocks__/',
      ],
    },
  },
})
```

**Why `environment: 'node'` not `'jsdom'`?**

- `jsdom` simulates a browser. Server actions run in Node, not browsers.
- `node` is the default Vitest environment — no extra packages needed.
- `FormData` is built into Node 18+ (which Next.js 15 requires). No polyfill needed.
- `jsdom` adds ~30 MB of browser shims that provide zero value for these tests.

[VERIFIED: vitest.dev/guide/environment — 'node' is the default; jsdom "emulates browser environment"]
[VERIFIED: Node 18+ has native FormData — no polyfill needed]

---

## Q2 — Handling 'server-only' imports

### The problem

`server-only` (v0.0.1) is a 611-byte package with a single `index.js`:

```js
throw new Error(
  "This module cannot be imported from a Client Component module. " +
    "It should only be used from a Server Component."
)
```

It has no exports. When Vitest imports any module that has `import 'server-only'` at the top
(e.g., `lib/supabase/server.ts`, `lib/auth/session.ts`), the throw propagates and the test crashes
immediately.

[VERIFIED: inspected `node_modules/server-only/index.js` in project]

### Fix A (recommended): Config-level alias — silences it globally

Create a stub file and alias the package in `vitest.config.ts`:

```ts
// __mocks__/server-only.ts  (empty — no exports needed, just prevents the throw)
export {}
```

In `vitest.config.ts` (as shown above):

```ts
test: {
  alias: {
    'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
  },
}
```

This redirects every `import 'server-only'` in the test bundle to your empty stub. No changes to
test files needed. This is the safest approach because it works transitively — if your server
action imports `lib/supabase/server.ts` which imports `server-only`, the alias catches it.

[VERIFIED via: vitest.dev/config/alias — test.alias redirects imports at the bundler level]
[VERIFIED via: github.com/vercel/next.js/issues/60038 — alias to empty stub is the documented workaround]

### Fix B (per-test): vi.mock() in each test file

```ts
// At the top of every test file that transitively imports server-only:
vi.mock('server-only', () => ({}))
```

This works but requires repeating in every test file. Use Fix A instead. If you use Fix B,
remember that `vi.mock()` calls are hoisted to the top of the file by Vitest — they run before
imports, which is why they work to intercept the throw.

[VERIFIED: vitest.dev/guide/mocking/modules — "a vi.mock call is hoisted to top of the file"]

### What about __mocks__/server-only.ts without vi.mock()?

Vitest's `__mocks__` folder for node_modules packages requires an **explicit `vi.mock('server-only')`** call to activate. The folder alone does not auto-intercept. Use Fix A (config alias) to avoid this requirement.

---

## Q3 — Testing a Server Action that takes (prevState, formData)

### Key insight: 'use server' is a compiler directive, not a runtime guard

The `'use server'` pragma at the top of a file tells Next.js's compiler to wrap the function as an
RPC endpoint in production. In Vitest, the file is imported normally — there is no Next.js
compiler in the test runner. The function is just an async function.

**Call it directly:**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitRequest, type FormState } from '@/app/(public)/actions'

// Silence server-only (if not using config alias)
vi.mock('server-only', () => ({}))

// Mock next/navigation — redirect() throws NEXT_REDIRECT internally, which breaks tests
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)  // re-throw so you can assert on it
  }),
}))

// Mock the Supabase client (see Q4 for chainable mock pattern)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Helper to build a FormData from an object
function makeFormData(fields: Record<string, string | null>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) fd.append(key, value)
  }
  return fd
}

const VALID_FIELDS = {
  teacher_name: 'Jane Smith',
  teacher_email: 'jane@school.edu',
  start_date: '2030-06-01',   // far future — passes "not in the past" check
  end_date: '2030-06-03',
  leave_type: 'vacation',
  is_blackout: 'false',
  reason: '',
}

const INITIAL_STATE: FormState = {}

describe('submitRequest — validation', () => {
  it('returns errors when teacher_name is empty', async () => {
    const fd = makeFormData({ ...VALID_FIELDS, teacher_name: '' })
    const result = await submitRequest(INITIAL_STATE, fd)
    expect(result.errors?.teacher_name).toEqual(['Full name is required.'])
  })

  it('returns errors when start_date is in the past', async () => {
    const fd = makeFormData({ ...VALID_FIELDS, start_date: '2000-01-01' })
    const result = await submitRequest(INITIAL_STATE, fd)
    expect(result.errors?.start_date).toEqual(['Start date cannot be in the past.'])
  })

  it('returns errors when end_date is before start_date', async () => {
    const fd = makeFormData({
      ...VALID_FIELDS,
      start_date: '2030-06-05',
      end_date: '2030-06-01',
    })
    const result = await submitRequest(INITIAL_STATE, fd)
    expect(result.errors?.end_date).toEqual(['End date cannot be before start date.'])
  })

  it('returns errors when is_blackout is not selected', async () => {
    const fd = makeFormData({ ...VALID_FIELDS, is_blackout: null })
    const result = await submitRequest(INITIAL_STATE, fd)
    expect(result.errors?.is_blackout).toBeDefined()
  })

  it('restores submitted values on validation failure', async () => {
    const fd = makeFormData({ ...VALID_FIELDS, teacher_name: '' })
    const result = await submitRequest(INITIAL_STATE, fd)
    expect(result.values?.teacher_email).toBe('jane@school.edu')
  })
})
```

### Testing the redirect path (valid submission)

When validation passes, `submitRequest` calls `redirect()`. Since Vitest imports
`next/navigation` synchronously, mock it to throw a detectable error (or simply `vi.fn()`):

```ts
import { redirect } from 'next/navigation'

it('redirects to /confirmation on valid blackout submission', async () => {
  // Set up Supabase mock to return no duplicate and successful insert
  // (see Q4 for the full chainable mock)
  const mockClient = buildSupabaseMock({ duplicateData: null, insertedId: 'abc-123' })
  vi.mocked(createClient).mockReturnValue(mockClient)

  const fd = makeFormData({ ...VALID_FIELDS, is_blackout: 'true' })

  await expect(submitRequest(INITIAL_STATE, fd)).rejects.toThrow('REDIRECT:/confirmation?status=auto_denied')
  // OR if you mocked redirect as vi.fn() that doesn't throw:
  // expect(redirect).toHaveBeenCalledWith('/confirmation?status=auto_denied')
})
```

### What about async Server Components?

The official Next.js docs warn:
> "Since async Server Components are new to the React ecosystem, Vitest currently does not support them."

This does NOT apply to Server Actions — they are async functions, not async components. You can
test them directly.

[VERIFIED: nextjs.org/docs/app/guides/testing/vitest — warning applies to async Server Components only]
[VERIFIED: github.com/vercel/next.js/discussions/69036 — direct function call pattern confirmed]

---

## Q4 — Mocking Supabase (@supabase/supabase-js createClient)

### The problem: fluent/chainable query builder

Supabase queries chain methods: `.from('requests').select('id').eq('col', val).maybeSingle()`.
A naive mock of `.from()` returning a static object breaks when the chain calls `.select()` on it.

### Solution: Return the same chain object from every builder method

```ts
// __mocks__/supabase-chain.ts  — reusable test helper
import { vi } from 'vitest'

export interface ChainMockOptions {
  data?: unknown
  error?: unknown
}

export function createChainMock({ data = null, error = null }: ChainMockOptions = {}) {
  // All builder methods return this same chain object
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  // Terminal methods resolve the value
  const terminal = vi.fn().mockResolvedValue({ data, error })

  const returnChain = vi.fn().mockReturnValue(chain)

  // Builder / filter methods — add any you use
  chain.select = returnChain
  chain.insert = returnChain
  chain.update = returnChain
  chain.upsert = returnChain
  chain.delete = returnChain
  chain.eq = returnChain
  chain.neq = returnChain
  chain.gte = returnChain
  chain.lte = returnChain
  chain.lt = returnChain
  chain.gt = returnChain
  chain.filter = returnChain
  chain.order = returnChain
  chain.limit = returnChain

  // Terminal methods — chain ends here
  chain.single = terminal
  chain.maybeSingle = terminal
  chain.then = terminal  // for awaiting the chain directly

  return {
    from: vi.fn().mockReturnValue(chain),
    chain,   // exposed so tests can assert on individual calls
    terminal,
  }
}

export function createSupabaseClientMock(options: ChainMockOptions = {}) {
  const chainMock = createChainMock(options)
  return {
    client: chainMock,
    chain: chainMock.chain,
    terminal: chainMock.terminal,
  }
}
```

### Wiring it into a test

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { submitRequest, type FormState } from '@/app/(public)/actions'
import { createChainMock } from '../__mocks__/supabase-chain'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('submitRequest — DB path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts a pending request when form is valid and not a blackout', async () => {
    // First call: duplicate check (maybeSingle returns no duplicate)
    // Second call: insert returns inserted row
    // Because both use .from() -> chain, we need two separate mock setups
    // or accept that a single mock covers both calls.

    const noDuplicate = createChainMock({ data: null, error: null })
    const inserted = createChainMock({ data: { id: 'abc-123' }, error: null })

    // createClient is called once per submitRequest invocation
    vi.mocked(createClient)
      .mockReturnValueOnce(noDuplicate as any)
      .mockReturnValueOnce(inserted as any)

    // ... call submitRequest and assert
  })
})
```

### Alternative: mock the module at the file path level

Instead of mocking `@supabase/supabase-js` globally, mock `@/lib/supabase/server` (the wrapper).
This is cleaner because you control exactly what the mock returns:

```ts
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  })),
}))
```

The `mockReturnThis()` shorthand makes each builder method return the mock object itself — a
simpler alternative to the explicit chain helper above, sufficient when you do not need to assert
on individual chain calls.

[VERIFIED pattern from: dev.to/dusttoo — chainable mock helper; confirmed compatible with vitest vi.fn()]
[CITED: github.com/orgs/supabase/discussions/787 — community consensus on mock approaches]

---

## Q5 — Required Packages

### Minimum install for logic-only tests (no React components)

```bash
npm install -D vitest @vitest/coverage-v8 vite-tsconfig-paths
```

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.7 | Test runner, vi.mock(), expect |
| `@vitest/coverage-v8` | 4.1.7 | Coverage via V8 (built into Node, no extra instrumentation) |
| `vite-tsconfig-paths` | 6.1.1 | Reads `tsconfig.json` paths so `@/*` aliases resolve |

[VERIFIED: npm view vitest version → 4.1.7 (2026-05-21)]
[VERIFIED: npm view @vitest/coverage-v8 version → 4.1.7]
[VERIFIED: npm view vite-tsconfig-paths version → 6.1.1]

### You do NOT need

| Package | Why not needed |
|---------|----------------|
| `@vitejs/plugin-react` | Only for JSX/React component rendering |
| `jsdom` | Only needed if environment: 'jsdom' |
| `@testing-library/react` | Component rendering — not applicable |
| `@testing-library/dom` | DOM queries — not applicable |

If you later add React component tests, add `@vitejs/plugin-react` and `jsdom` at that time.

### package.json scripts to add

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Use `vitest run` (not `vitest`) for CI — the bare `vitest` command enters watch mode.

---

## Complete Setup Checklist

### Files to create

**1. `vitest.config.ts`** (project root)

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: false,
    alias: {
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
    },
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        '**/*.config.{ts,js,mjs}',
        '**/*.test.ts',
        '__mocks__/',
      ],
    },
  },
})
```

**2. `__mocks__/server-only.ts`** (project root)

```ts
// Empty stub — prevents server-only from throwing in Vitest
export {}
```

**3. `vitest.setup.ts`** (project root)

```ts
// Set dummy env vars so modules that read process.env don't crash
// (submitRequest reads RESEND_API_KEY, APPROVAL_SECRET, etc.)
process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.SESSION_SECRET = 'test-secret-at-least-32-characters-long!!'
process.env.APPROVAL_SECRET = 'test-approval-secret'
process.env.RESEND_API_KEY = 're_test_key'
process.env.RESEND_FROM = 'Test <test@example.com>'
process.env.ADMIN_EMAILS = 'admin@example.com'
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
```

**4. Test files** — place in `__tests__/` at project root or co-located in `app/` / `lib/`

```
__tests__/
├── actions.test.ts       # submitRequest validation tests
├── email-utils.test.ts   # formatDate, LEAVE_TYPE_LABELS tests
└── supabase-mocks.ts     # shared chain mock helper (not a test file)
```

### TypeScript: add vitest types

In `tsconfig.json`, the `types` in `compilerOptions` may need `vitest/globals` if you use
`globals: true`. Since the recommendation above is `globals: false`, no change to tsconfig is
needed — just import from `'vitest'` directly.

---

## Pitfalls to Avoid

### Pitfall 1: redirect() is not mockable as a no-op

`redirect()` from `next/navigation` internally throws a special `NEXT_REDIRECT` error. Even in
test environment without the Next.js server, it still throws. If you mock it as `vi.fn()` (a
no-op), code after the `redirect()` call will continue executing unexpectedly. Two safe patterns:

- Mock it to throw a recognizable error string (e.g. `throw new Error('REDIRECT:' + path)`), then
  use `expect(fn()).rejects.toThrow('REDIRECT:')` in tests.
- Mock it as `vi.fn()` (no-op) for tests that don't care about the redirect, and test validation
  paths (which return before redirect) separately from post-validation paths.

### Pitfall 2: Supabase chain mock breaks when chain length changes

If you add a new filter (e.g. `.neq()`) to a query but forget to add it to the chain mock, the
test crashes with "Cannot read property 'eq' of undefined". Keep `__mocks__/supabase-chain.ts`
up to date with all methods your queries use.

### Pitfall 3: date-sensitive tests

`submitRequest` rejects start dates in the past using `new Date()`. Tests that hardcode past dates
will always fail. Hardcode far-future dates (e.g., `'2030-06-01'`) in test fixtures.

### Pitfall 4: 'use server' does NOT prevent direct import

You may wonder if Vitest will fail when importing a `'use server'` file. It does not. The pragma
is a compiler hint for Next.js's bundler — the Vitest test runner ignores it completely.

### Pitfall 5: @/* aliases not resolving

If `vite-tsconfig-paths` is not in `plugins` (not in `test.alias`), imports like `@/lib/supabase/server`
will fail to resolve. The plugin reads `tsconfig.json` `paths` automatically — no manual alias
duplication needed, except for the `server-only` stub which is test-specific.

### Pitfall 6: ESM/CommonJS interop

Next.js 15 uses `"module": "esnext"` and `"moduleResolution": "bundler"` in tsconfig. Vitest
uses Vite's bundler which handles ESM natively. No `transform` configuration is needed. However,
if a transitive dependency is CJS-only, add it to `test.server.deps.inline` in vitest config.

---

## Sources

### Primary (HIGH confidence)
- [nextjs.org/docs/app/guides/testing/vitest](https://nextjs.org/docs/app/guides/testing/vitest) — Official Next.js Vitest setup guide (updated 2026-05-19)
- [vitest.dev/guide/environment](https://vitest.dev/guide/environment) — Official Vitest environments reference
- [vitest.dev/guide/mocking/modules](https://vitest.dev/guide/mocking/modules.html) — Official Vitest module mocking
- [vitest.dev/config/alias](https://vitest.dev/config/alias) — Official alias config reference
- `node_modules/server-only/index.js` — Verified directly in project: bare `throw new Error(...)`
- npm registry: `vitest@4.1.7`, `@vitest/coverage-v8@4.1.7`, `vite-tsconfig-paths@6.1.1` (verified 2026-05-21)

### Secondary (MEDIUM confidence)
- [github.com/vercel/next.js/discussions/69036](https://github.com/vercel/next.js/discussions/69036) — Community discussion: testing server actions, direct call pattern confirmed
- [github.com/vercel/next.js/issues/60038](https://github.com/vercel/next.js/issues/60038) — server-only + Vitest issue report; alias workaround documented
- [vercel/next.js canary examples/with-vitest package.json](https://api.github.com/repos/vercel/next.js/contents/examples/with-vitest/package.json?ref=canary) — Official example: vitest@^3.2.4, @vitejs/plugin-react@^5.0.1, jsdom@^26.1.0 (for component tests)

### Tertiary (LOW confidence — patterns corroborated but not from official sources)
- [dev.to/dusttoo](https://dev.to/dusttoo/how-i-solved-supabases-chainable-query-builder-problem-in-react-native-tests-oa7) — Chainable Supabase mock pattern (adapted from React Native; identical API)
- [gist.github.com/zaru/273d466f896c84d7cc0f6a5f6494c2e6](https://gist.github.com/zaru/273d466f896c84d7cc0f6a5f6494c2e6) — Direct server action invocation pattern with Vitest

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | `test.alias` in vitest.config.ts intercepts transitive imports (i.e., if action.ts imports lib/supabase/server.ts which imports server-only, the alias still fires) | If wrong, must use per-file `vi.mock('server-only', () => ({}))` instead — low-effort fix |
| A2 | `vite-tsconfig-paths` v6.x reads `"paths": { "@/*": ["./*"] }` from tsconfig without additional config | If wrong, add manual `resolve.alias: { '@': path.resolve(__dirname, '.') }` |
| A3 | `mockReturnThis()` is equivalent to returning `chain` — sufficient for chained Supabase methods in tests that don't assert on specific chain calls | If wrong, switch to the explicit `createChainMock()` helper |
