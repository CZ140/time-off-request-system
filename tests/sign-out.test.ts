// tests/sign-out.test.ts
// Verifies the sign-out Server Action calls supabase.auth.signOut() and redirects to /login.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before vi.mock factories so the mocks can close over these refs.
const { signOutMock, redirectMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  redirectMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: vi.fn(async () => ({
    auth: { signOut: signOutMock },
  })),
}))

import { signOut } from '@/app/(public)/sign-out-action'

beforeEach(() => {
  vi.clearAllMocks()
  signOutMock.mockResolvedValue({ error: null })
})

describe('signOut server action', () => {
  it('calls supabase.auth.signOut and redirects to /login', async () => {
    await signOut()
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })

  it('redirect happens after signOut completes (order matters)', async () => {
    const callOrder: string[] = []
    signOutMock.mockImplementationOnce(async () => {
      callOrder.push('signOut')
      return { error: null }
    })
    redirectMock.mockImplementationOnce(() => {
      callOrder.push('redirect')
    })
    await signOut()
    expect(callOrder).toEqual(['signOut', 'redirect'])
  })
})
