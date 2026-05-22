// tests/login-action.test.ts
// Unit tests for sendMagicLink. Mocks createAuthClient so signInWithOtp is observable.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtpMock = vi.fn()

vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: vi.fn(async () => ({
    auth: { signInWithOtp: signInWithOtpMock },
  })),
}))

import { sendMagicLink } from '@/app/login/actions'

function makeFormData(data: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) fd.append(k, v)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'
  signInWithOtpMock.mockResolvedValue({ error: null })
})

describe('sendMagicLink', () => {
  it('rejects missing email', async () => {
    const result = await sendMagicLink({}, makeFormData({}))
    expect(result.error).toBe('Enter a valid email address.')
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('rejects malformed email', async () => {
    const result = await sendMagicLink({}, makeFormData({ email: 'not-an-email' }))
    expect(result.error).toBe('Enter a valid email address.')
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('normalises email to lowercase and trims whitespace', async () => {
    await sendMagicLink({}, makeFormData({ email: '  Jane@SCHOOL.edu  ' }))
    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@school.edu' })
    )
  })

  it('builds emailRedirectTo from NEXT_PUBLIC_BASE_URL + /auth/callback with encoded next', async () => {
    await sendMagicLink({}, makeFormData({ email: 'jane@school.edu', next: '/foo/bar' }))
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'jane@school.edu',
      options: {
        emailRedirectTo: 'https://example.com/auth/callback?next=%2Ffoo%2Fbar',
        shouldCreateUser: true,
      },
    })
  })

  it('sanitises absolute URLs in next to "/"', async () => {
    await sendMagicLink({}, makeFormData({ email: 'jane@school.edu', next: 'https://evil.com/x' }))
    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://example.com/auth/callback?next=%2F',
        }),
      })
    )
  })

  it('sanitises protocol-relative URLs in next to "/"', async () => {
    await sendMagicLink({}, makeFormData({ email: 'jane@school.edu', next: '//evil.com' }))
    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: 'https://example.com/auth/callback?next=%2F',
        }),
      })
    )
  })

  it('returns { sent: true, email } on success', async () => {
    const result = await sendMagicLink({}, makeFormData({ email: 'jane@school.edu' }))
    expect(result).toEqual({ sent: true, email: 'jane@school.edu' })
  })

  it('returns a user-safe error when signInWithOtp fails', async () => {
    signInWithOtpMock.mockResolvedValueOnce({ error: { message: 'rate limited' } })
    const result = await sendMagicLink({}, makeFormData({ email: 'jane@school.edu' }))
    expect(result.error).toBe('Could not send the magic link. Please try again.')
    expect(result.sent).toBeUndefined()
  })
})
