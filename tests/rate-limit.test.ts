// tests/rate-limit.test.ts
// Unit tests for the Supabase-backed rate limiter.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { countMock, insertMock, fromMock } = vi.hoisted(() => {
  const countMock = vi.fn()
  const insertMock = vi.fn()
  // Build a chainable builder. The COUNT path resolves the chain via .gte();
  // the INSERT path resolves directly. We return a thenable on the right node.
  const fromMock = vi.fn(() => ({
    select: vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockImplementation(() => ({
        gte: vi.fn().mockImplementation(() => countMock()),
      })),
    })),
    insert: vi.fn().mockImplementation((...args) => insertMock(...args)),
  }))
  return { countMock, insertMock, fromMock }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}))

import { checkAndLogRateLimit, getCallerIp } from '@/lib/rate-limit'

beforeEach(() => {
  vi.clearAllMocks()
  insertMock.mockResolvedValue({ error: null })
})

describe('checkAndLogRateLimit', () => {
  it('allows and logs when under the limit', async () => {
    countMock.mockResolvedValueOnce({ count: 3, error: null })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result).toEqual({ allowed: true })
    expect(insertMock).toHaveBeenCalledWith({ key: 'user@x.com' })
  })

  it('denies and does NOT log when at the limit', async () => {
    countMock.mockResolvedValueOnce({ count: 10, error: null })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfterSeconds).toBe(3600)
    }
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('denies and does NOT log when over the limit', async () => {
    countMock.mockResolvedValueOnce({ count: 25, error: null })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result.allowed).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('fail-OPEN when the count query errors (preserves availability during DB issues)', async () => {
    countMock.mockResolvedValueOnce({ count: null, error: { message: 'connection failed' } })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result).toEqual({ allowed: true })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('still allows when the insert fails (logs but does not block the user)', async () => {
    countMock.mockResolvedValueOnce({ count: 1, error: null })
    insertMock.mockResolvedValueOnce({ error: { message: 'write failed' } })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result).toEqual({ allowed: true })
  })

  it('treats null count as 0 (first-ever usage)', async () => {
    countMock.mockResolvedValueOnce({ count: null, error: null })
    const result = await checkAndLogRateLimit('user@x.com', 10, 3600)
    expect(result.allowed).toBe(true)
    expect(insertMock).toHaveBeenCalled()
  })
})

describe('getCallerIp', () => {
  it('returns the first entry from x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 10.0.0.2' })
    expect(getCallerIp(h)).toBe('203.0.113.1')
  })

  it('trims whitespace in x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '  203.0.113.1  ' })
    expect(getCallerIp(h)).toBe('203.0.113.1')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.7' })
    expect(getCallerIp(h)).toBe('198.51.100.7')
  })

  it('returns "unknown" when neither header is present', () => {
    expect(getCallerIp(new Headers())).toBe('unknown')
  })

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '198.51.100.7' })
    expect(getCallerIp(h)).toBe('203.0.113.1')
  })
})
