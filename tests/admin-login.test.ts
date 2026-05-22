// tests/admin-login.test.ts
// Verifies that the admin login action checks the password against the right
// env var depending on DEMO_MODE — DEMO_ADMIN_PASSWORD in demo, ADMIN_PASSWORD in real.
// Critical so a demo deployment cannot accept (or expose) the production password.
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

describe('loginAdmin — real mode', () => {
  beforeEach(() => {
    delete process.env.DEMO_MODE
    process.env.ADMIN_PASSWORD = 'real-admin-password-32chars-ok'
    process.env.DEMO_ADMIN_PASSWORD = 'demo2026'
  })

  it('accepts the production password and creates a session', async () => {
    const result = await loginAdmin({}, makeFormData('real-admin-password-32chars-ok'))
    expect(createSessionMock).toHaveBeenCalledOnce()
    expect(redirectMock).toHaveBeenCalledWith('/admin')
    expect(result).toBeUndefined()
  })

  it('rejects the demo password even though it is set in env', async () => {
    // CRITICAL: a real deployment must not accept the demo password (which
    // could leak from a demo .env, a code review screenshot, etc.).
    const result = await loginAdmin({}, makeFormData('demo2026'))
    expect(result?.error).toBe('Incorrect password. Please try again.')
    expect(createSessionMock).not.toHaveBeenCalled()
  })

  it('rejects a wrong password', async () => {
    const result = await loginAdmin({}, makeFormData('wrong'))
    expect(result?.error).toBe('Incorrect password. Please try again.')
  })
})
