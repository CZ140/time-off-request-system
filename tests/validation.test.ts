// tests/validation.test.ts
// Unit tests for submitRequest validation logic.
// Calls the server action directly — 'use server' is a compiler directive Vitest ignores.
// Supabase, auth, and next/navigation are mocked to isolate validation from I/O.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation so redirect() doesn't throw NEXT_REDIRECT in tests
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Mock Supabase service-role client (DB inserts, blackout checks)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-uuid' }, error: null }),
    })),
  })),
}))

// Mock Supabase Auth client — controllable per-test via getUserMock
const getUserMock = vi.fn()
vi.mock('@/lib/supabase/auth-server', () => ({
  createAuthClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}))

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({}),
  sendBatch: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/email/templates/auto-denial', () => ({
  autoDenialTemplate: vi.fn(() => '<html>auto-denial</html>'),
}))

vi.mock('@/lib/email/templates/admin-notification', () => ({
  adminNotificationTemplate: vi.fn(() => '<html>admin-notification</html>'),
}))

vi.mock('@/lib/auth/tokens', () => ({
  generateApprovalToken: vi.fn(() => 'fake-hex-token'),
}))

import { submitRequest } from '@/app/(public)/actions'

const INITIAL_STATE = {}

function makeFormData(overrides: Record<string, string | null> = {}) {
  const defaults: Record<string, string | null> = {
    teacher_name: 'Jane Smith',
    teacher_email: 'jane@school.edu',
    start_date: '2099-06-01',
    end_date: '2099-06-03',
    leave_type: 'sick',
    is_blackout: 'false',
    reason: '',
  }
  const data = { ...defaults, ...overrides }
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    if (v !== null) fd.append(k, v)
  }
  return fd
}

// Tests below run in DEMO_MODE so the email comes from the form (anonymous flow).
// Validation logic — name, date ordering, leave-type required, etc. — is shared between
// demo and real modes, so we only need to cover it in one branch.
describe('submitRequest validation (demo mode — form-supplied email)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DEMO_MODE = 'true'
    process.env.APPROVAL_HMAC_SECRET = 'test-secret-32-chars-long-padding'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    process.env.ADMIN_EMAILS = 'admin@school.edu'
    process.env.RESEND_FROM = 'noreply@school.edu'
  })

  it('returns teacher_name error when name is missing', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_name: '' }))
    expect(result.errors?.teacher_name?.[0]).toBe('Full name is required.')
  })

  it('returns teacher_email error when email is missing', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: '' }))
    expect(result.errors?.teacher_email?.[0]).toBe('Work email is required.')
  })

  it('returns format error for structurally invalid email', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'notanemail' }))
    expect(result.errors?.teacher_email?.[0]).toBe('Please enter a valid email address.')
  })

  it('accepts a valid email address and passes validation (redirect called)', async () => {
    const { redirect } = await import('next/navigation')
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'valid@domain.com' }))
    expect(result).toBeUndefined()
    expect(redirect).toHaveBeenCalled()
  })

  it('returns start_date error when start date is missing', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ start_date: '' }))
    expect(result.errors?.start_date?.[0]).toBe('Start date is required.')
  })

  it('returns start_date error when start date is in the past', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ start_date: '2020-01-01', end_date: '2020-01-02' }))
    expect(result.errors?.start_date?.[0]).toBe('Start date cannot be in the past.')
  })

  it('returns end_date error when end date is before start date', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ start_date: '2099-06-05', end_date: '2099-06-01' }))
    expect(result.errors?.end_date?.[0]).toBe('End date cannot be before start date.')
  })

  it('returns leave_type error when no leave type is selected', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ leave_type: '' }))
    expect(result.errors?.leave_type?.[0]).toBe('Please select a leave type.')
  })

  it('returns is_blackout error when blackout radio is not selected', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ is_blackout: null }))
    expect(result.errors?.is_blackout?.[0]).toMatch(/blackout period/)
  })

  it('restores submitted values on validation failure', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_name: '' }))
    expect(result.values?.teacher_email).toBe('jane@school.edu')
    expect(result.values?.start_date).toBe('2099-06-01')
  })

  it('collects all errors before returning (does not short-circuit)', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({
      teacher_name: '',
      teacher_email: '',
    }))
    expect(result.errors?.teacher_name).toBeDefined()
    expect(result.errors?.teacher_email).toBeDefined()
  })

  it('does not call createAuthClient in demo mode', async () => {
    const { createAuthClient } = await import('@/lib/supabase/auth-server')
    await submitRequest(INITIAL_STATE, makeFormData())
    expect(createAuthClient).not.toHaveBeenCalled()
  })
})

describe('submitRequest (real mode — session-derived email)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DEMO_MODE
    process.env.APPROVAL_HMAC_SECRET = 'test-secret-32-chars-long-padding'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    process.env.ADMIN_EMAILS = 'admin@school.edu'
    process.env.RESEND_FROM = 'noreply@school.edu'
  })

  it('returns "session expired" when there is no authenticated user', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const result = await submitRequest(INITIAL_STATE, makeFormData())
    expect(result.message).toBe('Your session has expired. Please log in again.')
  })

  it('uses the session email and ignores any form-supplied teacher_email', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'realuser@school.edu' } },
    })
    const { createClient } = await import('@/lib/supabase/server')
    const { redirect } = await import('next/navigation')
    // Inject a malicious form value — server must ignore it.
    const result = await submitRequest(
      INITIAL_STATE,
      makeFormData({ teacher_email: 'attacker@evil.com' })
    )
    expect(result).toBeUndefined()
    expect(redirect).toHaveBeenCalled()
    // The insert call should carry the session email, not the form value.
    const fromCalls = vi.mocked(createClient).mock.results[0]?.value.from.mock.calls
    expect(fromCalls).toBeDefined()
    // Find the insert call and verify the email field
    const insertCall = vi
      .mocked(createClient)
      .mock.results[0]!.value.from.mock.results
      .find((r: { value: { insert: ReturnType<typeof vi.fn> } }) => r.value.insert.mock.calls.length > 0)
    expect(insertCall?.value.insert.mock.calls[0][0].teacher_email).toBe('realuser@school.edu')
  })

  it('still runs name/date validation (session email cannot bypass other required fields)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'realuser@school.edu' } },
    })
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_name: '' }))
    expect(result.errors?.teacher_name?.[0]).toBe('Full name is required.')
  })
})
