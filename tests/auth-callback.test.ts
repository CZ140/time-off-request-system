// tests/auth-callback.test.ts
// Verifies the magic-link callback route exchanges the code for a session
// and redirects safely.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exchangeCodeForSessionMock = vi.fn()

vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  })),
}))

import { GET } from '@/app/auth/callback/route'
import type { NextRequest } from 'next/server'

function makeRequest(path: string): NextRequest {
  const url = `http://localhost${path}`
  return {
    nextUrl: new URL(url),
    url,
  } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  exchangeCodeForSessionMock.mockResolvedValue({ error: null })
})

describe('GET /auth/callback', () => {
  it('redirects to /login?error=missing_code when ?code is absent', async () => {
    const response = await GET(makeRequest('/auth/callback'))
    expect(response.headers.get('location')).toBe('http://localhost/login?error=missing_code')
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled()
  })

  it('exchanges the code and redirects to next', async () => {
    const response = await GET(makeRequest('/auth/callback?code=abc123&next=%2F'))
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('abc123')
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('preserves a custom next path through the exchange', async () => {
    const response = await GET(makeRequest('/auth/callback?code=abc&next=%2Fconfirmation'))
    expect(response.headers.get('location')).toBe('http://localhost/confirmation')
  })

  it('sanitises an absolute next to "/"', async () => {
    const response = await GET(makeRequest('/auth/callback?code=abc&next=https%3A%2F%2Fevil.com%2F'))
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('sanitises a protocol-relative next to "/"', async () => {
    const response = await GET(makeRequest('/auth/callback?code=abc&next=%2F%2Fevil.com'))
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to /login?error=invalid_link when the exchange fails', async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: { message: 'bad code' } })
    const response = await GET(makeRequest('/auth/callback?code=bad'))
    expect(response.headers.get('location')).toBe('http://localhost/login?error=invalid_link')
  })
})
