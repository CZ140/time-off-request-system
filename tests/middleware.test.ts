// tests/middleware.test.ts
// Verifies the teacher-auth branch of middleware.ts:
//   - DEMO_MODE=true → always pass through
//   - Unauthenticated request to '/' → 302 to /login?next=/
//   - Authenticated request to '/' → pass through
// Admin branch is covered by existing flows and is not duplicated here.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserMock = vi.fn()

vi.mock('@/lib/supabase/auth-middleware', () => ({
  createMiddlewareClient: vi.fn(() => ({
    client: { auth: { getUser: getUserMock } },
    getResponse: vi.fn(() => ({ __passThrough: true, cookies: { get: vi.fn() } })),
  })),
}))

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(async () => ({ isLoggedIn: false })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: vi.fn(() => []) })),
}))

import { middleware } from '@/middleware'
import type { NextRequest } from 'next/server'

function makeRequest(path: string): NextRequest {
  const url = `http://localhost${path}`
  return {
    nextUrl: new URL(url),
    url,
    cookies: { getAll: vi.fn(() => []) },
  } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEMO_MODE
  process.env.SESSION_SECRET = 'a'.repeat(32)
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
})

describe('middleware — teacher branch', () => {
  it('demo mode: passes through without calling Supabase', async () => {
    process.env.DEMO_MODE = 'true'
    const response = await middleware(makeRequest('/'))
    // NextResponse.next() returns a Response with status 200
    expect(response.status).toBe(200)
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('unauthenticated: redirects to /login?next=/', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    const response = await middleware(makeRequest('/'))
    expect(response.status).toBe(307) // NextResponse.redirect default
    expect(response.headers.get('location')).toBe('http://localhost/login?next=%2F')
  })

  it('authenticated: passes through with the refreshed response from getResponse()', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 't@school.edu' } } })
    const response = await middleware(makeRequest('/')) as unknown as { __passThrough: boolean }
    expect(response.__passThrough).toBe(true)
  })
})
