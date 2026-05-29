// tests/validation.test.ts
// Unit tests for submitRequest validation logic.
// Calls the server action directly — 'use server' is a compiler directive Vitest ignores.
// Supabase and next/navigation are mocked to isolate validation from I/O.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

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
  defaultApprovalExpiry: vi.fn(() => 1700000000),
}))

// Replaces the old process.env.ADMIN_EMAILS read. Tests that exercise the
// "request was inserted and admins are being notified" path need this so
// getAdminRecipients() doesn't throw on the empty Supabase mock.
vi.mock('@/lib/admin-recipients', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-recipients')>('@/lib/admin-recipients')
  return {
    ...actual,
    getAdminRecipients: vi.fn(async () => ['admin@school.edu']),
  }
})

// Rate limiter is exercised end-to-end in tests/rate-limit.test.ts.
// Mock here so submitRequest validation tests don't hit the real DB or change
// behaviour across runs.
vi.mock('@/lib/rate-limit', () => ({
  checkAndLogRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getCallerIp: vi.fn(() => '127.0.0.1'),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
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
    is_blockout: 'false',
    reason: '',
  }
  const data = { ...defaults, ...overrides }
  const fd = new FormData()
  for (const [k, v] of Object.entries(data)) {
    if (v !== null) fd.append(k, v)
  }
  return fd
}

// Validation logic — name, date ordering, leave-type required, etc. — is shared
// between demo and real modes, so we cover it once under demo mode where the
// allowlist is skipped (so any test email works).
describe('submitRequest validation (demo mode — allowlist skipped)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DEMO_MODE = 'true'
    process.env.APPROVAL_HMAC_SECRET = 'test-secret-32-chars-long-padding'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    process.env.RESEND_FROM = 'noreply@school.edu'
    delete process.env.ALLOWED_EMAIL_DOMAINS
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

  it('returns is_blockout error when blockout radio is not selected', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ is_blockout: null }))
    expect(result.errors?.is_blockout?.[0]).toMatch(/blockout period/)
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

  it('demo mode: accepts an email outside the allowlist (allowlist skipped)', async () => {
    // Even if the allowlist is set, demo mode must not enforce it.
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.edu'
    const { redirect } = await import('next/navigation')
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'visitor@gmail.com' }))
    expect(result).toBeUndefined()
    expect(redirect).toHaveBeenCalled()
  })
})

describe('submitRequest validation (real mode — allowlist enforced)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DEMO_MODE
    process.env.APPROVAL_HMAC_SECRET = 'test-secret-32-chars-long-padding'
    process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
    process.env.RESEND_FROM = 'noreply@school.edu'
    process.env.ALLOWED_EMAIL_DOMAINS = 'school.edu'
  })

  it('accepts an email on the allowlist', async () => {
    const { redirect } = await import('next/navigation')
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'teacher@school.edu' }))
    expect(result).toBeUndefined()
    expect(redirect).toHaveBeenCalled()
  })

  it('rejects an email on a disallowed domain', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'attacker@evil.com' }))
    expect(result.errors?.teacher_email?.[0]).toBe("This email isn't authorized to submit requests.")
  })

  it('rejects when ALLOWED_EMAIL_DOMAINS is unset (fail-closed)', async () => {
    delete process.env.ALLOWED_EMAIL_DOMAINS
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'teacher@school.edu' }))
    expect(result.errors?.teacher_email?.[0]).toBe("This email isn't authorized to submit requests.")
  })

  it('format error takes precedence over allowlist error (clearer feedback)', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'not-an-email' }))
    expect(result.errors?.teacher_email?.[0]).toBe('Please enter a valid email address.')
  })

  it('still runs name/date validation when allowlist passes', async () => {
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'teacher@school.edu', teacher_name: '' }))
    expect(result.errors?.teacher_name?.[0]).toBe('Full name is required.')
  })

  it('returns a per-email rate-limit message when the email bucket is full', async () => {
    const { checkAndLogRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkAndLogRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'teacher@school.edu' }))
    expect(result.message).toMatch(/Too many requests from this email/)
  })

  it('returns a per-IP rate-limit message when the IP bucket is full', async () => {
    const { checkAndLogRateLimit } = await import('@/lib/rate-limit')
    // First call (per-email) allowed, second call (per-IP) denied
    vi.mocked(checkAndLogRateLimit)
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })
    const result = await submitRequest(INITIAL_STATE, makeFormData({ teacher_email: 'teacher@school.edu' }))
    expect(result.message).toMatch(/Too many requests from your network/)
  })
})
