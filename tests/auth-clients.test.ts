// tests/auth-clients.test.ts
// Verifies the three Supabase Auth client factories wire @supabase/ssr correctly.
// We're not exercising real auth here — that's an integration concern. These tests
// just guarantee the right function is called with the right env vars and cookie
// adapters that don't throw on the happy path.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createServerClientMock = vi.fn(() => ({ marker: 'server-client' }))
const createBrowserClientMock = vi.fn(() => ({ marker: 'browser-client' }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
  createBrowserClient: createBrowserClientMock,
}))

// next/headers is only used by auth-server.ts. The cookies() shape must match
// what @supabase/ssr's cookie adapter calls (getAll / set).
const cookieStoreMock = {
  getAll: vi.fn(() => [{ name: 'sb-foo', value: 'bar' }]),
  set: vi.fn(),
}
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
})

describe('createAuthClient (server)', () => {
  it('calls createServerClient with the public env vars', async () => {
    const { createAuthClient } = await import('@/lib/supabase/auth-server')
    await createAuthClient()
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({ cookies: expect.any(Object) })
    )
  })

  it('cookie adapter getAll proxies to next/headers cookies()', async () => {
    const { createAuthClient } = await import('@/lib/supabase/auth-server')
    await createAuthClient()
    const adapter = (createServerClientMock.mock.calls[0] as unknown as unknown[])[2] as {
      cookies: { getAll: () => unknown }
    }
    expect(adapter.cookies.getAll()).toEqual([{ name: 'sb-foo', value: 'bar' }])
  })

  it('cookie adapter setAll swallows errors from read-only contexts', async () => {
    const { createAuthClient } = await import('@/lib/supabase/auth-server')
    await createAuthClient()
    cookieStoreMock.set.mockImplementationOnce(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.')
    })
    const adapter = (createServerClientMock.mock.calls[0] as unknown as unknown[])[2] as {
      cookies: { setAll: (c: Array<{ name: string; value: string; options?: object }>) => void }
    }
    expect(() =>
      adapter.cookies.setAll([{ name: 'sb-x', value: 'y', options: {} }])
    ).not.toThrow()
  })
})

describe('createMiddlewareClient (edge)', () => {
  it('calls createServerClient with the public env vars and returns getResponse', async () => {
    const { createMiddlewareClient } = await import('@/lib/supabase/auth-middleware')
    const fakeRequest = {
      cookies: {
        getAll: vi.fn(() => [{ name: 'sb-x', value: 'y' }]),
        set: vi.fn(),
      },
      nextUrl: new URL('http://localhost/'),
      url: 'http://localhost/',
    } as unknown as import('next/server').NextRequest

    const result = createMiddlewareClient(fakeRequest)
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({ cookies: expect.any(Object) })
    )
    expect(typeof result.getResponse).toBe('function')
    // getResponse must return something NextResponse-shaped (has cookies API)
    expect(result.getResponse()).toHaveProperty('cookies')
  })

  it('cookie adapter setAll mutates the response so getResponse reflects new cookies', async () => {
    const { createMiddlewareClient } = await import('@/lib/supabase/auth-middleware')
    const fakeRequest = {
      cookies: {
        getAll: vi.fn(() => []),
        set: vi.fn(),
      },
      nextUrl: new URL('http://localhost/'),
      url: 'http://localhost/',
    } as unknown as import('next/server').NextRequest

    const { getResponse } = createMiddlewareClient(fakeRequest)
    const adapter = (createServerClientMock.mock.calls.at(-1) as unknown as unknown[])[2] as {
      cookies: { setAll: (c: Array<{ name: string; value: string; options?: object }>) => void }
    }
    adapter.cookies.setAll([{ name: 'sb-refreshed', value: 'abc', options: { path: '/' } }])

    const response = getResponse()
    expect(response.cookies.get('sb-refreshed')?.value).toBe('abc')
  })
})

describe('createBrowserAuthClient', () => {
  it('calls createBrowserClient with the public env vars', async () => {
    const { createBrowserAuthClient } = await import('@/lib/supabase/auth-client')
    createBrowserAuthClient()
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    )
  })
})
