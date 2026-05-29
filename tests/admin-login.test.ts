// tests/admin-login.test.ts
// The password login now exists ONLY in demo mode — production authenticates via
// "Sign in with Microsoft" (gated by the admin_recipients allowlist). These
// tests verify the demo password works in demo mode and that ALL password
// attempts are rejected outside demo mode.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createSessionMock, redirectMock } = vi.hoisted(() => ({
  createSessionMock: vi.fn(),
  redirectMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('@/lib/auth/session', () => ({ createSession: createSessionMock }))

import { loginAdmin } from '@/app/(admin)/admin/login/actions'

function makeFormData(password: string): FormData {
  const fd = new FormData()
  fd.append('password', password)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  createSessionMock.mockResolvedValue(undefined)
  delete process.env.DEMO_MODE
  delete process.env.ADMIN_PASSWORD
  delete process.env.DEMO_ADMIN_PASSWORD
})

describe('loginAdmin — demo mode', () => {
  beforeEach(() => {
    process.env.DEMO_MODE = 'true'
    process.env.DEMO_ADMIN_PASSWORD = 'demo2026'
    process.env.ADMIN_PASSWORD = 'prod-secret-do-not-leak'
  })

  it('accepts the demo password and creates a session', async () => {
    const result = await loginAdmin({}, makeFormData('demo2026'))
    expect(createSessionMock).toHaveBeenCalledOnce()
    expect(redirectMock).toHaveBeenCalledWith('/admin')
    expect(result).toBeUndefined()
  })

  it('rejects the production password even though it is set in env', async () => {
    // CRITICAL: the demo deployment must never accept the production password.
    const result = await loginAdmin({}, makeFormData('prod-secret-do-not-leak'))
    expect(result?.error).toBe('Incorrect password. Please try again.')
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('rejects a wrong password', async () => {
    const result = await loginAdmin({}, makeFormData('wrong'))
    expect(result?.error).toBe('Incorrect password. Please try again.')
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('rejects an empty password', async () => {
    const result = await loginAdmin({}, makeFormData(''))
    expect(result?.error).toBe('Incorrect password. Please try again.')
  })

  it('rejects all submissions when DEMO_ADMIN_PASSWORD is unset', async () => {
    delete process.env.DEMO_ADMIN_PASSWORD
    const result = await loginAdmin({}, makeFormData('demo2026'))
    expect(result?.error).toBe('Incorrect password. Please try again.')
    expect(createSessionMock).not.toHaveBeenCalled()
  })
})

describe('loginAdmin — real mode (password login disabled)', () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE
    // Even with these set, password login must be refused outside demo mode.
    process.env.ADMIN_PASSWORD = 'real-admin-password-32chars-ok'
    process.env.DEMO_ADMIN_PASSWORD = 'demo2026'
  })

  it('refuses any password and points to Microsoft sign-in', async () => {
    const result = await loginAdmin({}, makeFormData('real-admin-password-32chars-ok'))
    expect(result?.error).toBe('Password login is disabled. Use “Sign in with Microsoft”.')
    expect(createSessionMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('refuses the demo password too (no password path in production)', async () => {
    const result = await loginAdmin({}, makeFormData('demo2026'))
    expect(result?.error).toBe('Password login is disabled. Use “Sign in with Microsoft”.')
    expect(createSessionMock).not.toHaveBeenCalled()
  })
})
