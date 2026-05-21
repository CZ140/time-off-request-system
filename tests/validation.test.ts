// tests/validation.test.ts
// Unit tests for submitRequest validation logic.
// Calls the server action directly — 'use server' is a compiler directive Vitest ignores.
// Supabase and next/navigation are mocked to isolate validation from I/O.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation so redirect() doesn't throw NEXT_REDIRECT in tests
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Mock Supabase to return no duplicate and successful insert by default
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

// Mock email modules — we're testing validation only, not email delivery
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

describe('submitRequest validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    // Valid form passes validation and hits redirect — action returns undefined
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
})
