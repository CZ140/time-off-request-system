// tests/admin-actions.test.ts
// Unit tests for the admin server actions in app/(admin)/admin/actions.ts.
// Supabase, email-send, templates, and session are mocked so each test
// exercises only the action's own logic.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module mocks (hoisted by vitest) ──────────────────────────────────────

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

vi.mock('@/lib/email/send', () => ({
  sendEmail: vi.fn().mockResolvedValue({}),
  sendBatch: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/email/templates/approval-confirmation', () => ({
  approvalConfirmationTemplate: vi.fn(() => '<html>approval</html>'),
}))

vi.mock('@/lib/email/templates/denial-confirmation', () => ({
  denialConfirmationTemplate: vi.fn(() => '<html>denial</html>'),
}))

// adminRateLimitOk() in actions.ts reads getSession() to grab sessionId.
// Default = logged-in session; tests can override per-case.
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    isLoggedIn: true,
    sessionId: 'test-session-id',
  }),
  destroySession: vi.fn(),
}))

// Rate limit defaults to allowed. Override per-test for the rate-limit case.
vi.mock('@/lib/rate-limit', () => ({
  checkAndLogRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getCallerIp: vi.fn(() => '127.0.0.1'),
}))

// Supabase mock client is swapped in per-test. createClient() returns whatever
// `mockSupabaseClient` points to at call time — letting each test customize
// the .from(...) chain without rebuilding the whole mock surface.
let mockSupabaseClient: { from: ReturnType<typeof vi.fn> }
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// ── Chainable Supabase query builder ──────────────────────────────────────
// Supabase's PostgrestFilterBuilder is itself thenable, so we can `await` it
// directly OR call a terminal `.single()` / `.maybeSingle()`. Both paths
// resolve to the same `awaited` value here. Every other builder method
// returns the same chain so any sequence (.update().eq().eq().select().single())
// resolves correctly.

interface ChainableResult<T = unknown> {
  data?: T | null
  error?: { code?: string; message?: string } | null
  count?: number | null
}

function chainable<T = unknown>(awaited: ChainableResult<T> = { data: null, error: null }) {
  const c: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'lte', 'limit']
  for (const m of methods) {
    c[m] = vi.fn(() => c)
  }
  c.single = vi.fn().mockResolvedValue(awaited)
  c.maybeSingle = vi.fn().mockResolvedValue(awaited)
  // Make the chain itself awaitable for `await supabase.from(...).delete().eq(...)`.
  // The harness only fires .then; .catch/.finally are filled in by Promise.resolve.
  c.then = (onResolve: (v: ChainableResult<T>) => unknown) =>
    Promise.resolve(awaited).then(onResolve)
  return c as unknown as Record<string, ReturnType<typeof vi.fn>>
}

// Late import so all the vi.mock() blocks above are hoisted first.
import {
  reviewRequest,
  deleteRequest,
  addAdminRecipient,
  removeAdminRecipient,
} from '@/app/(admin)/admin/actions'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── reviewRequest ─────────────────────────────────────────────────────────

describe('reviewRequest', () => {
  const validRow = {
    id: 'req-1',
    teacher_email: 'teacher@school.edu',
    teacher_name: 'Test Teacher',
    leave_type: 'sick',
    start_date: '2026-06-01',
    end_date: '2026-06-01',
    status: 'approved',
    reviewed_at: '2026-05-23T12:00:00Z',
    reviewed_by: 'Dashboard',
  }

  it('approves a pending request and returns success', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: validRow, error: null })),
    }
    const result = await reviewRequest('req-1', 'approve')
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('denies a pending request and returns success', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: { ...validRow, status: 'denied' }, error: null })),
    }
    const result = await reviewRequest('req-1', 'deny')
    expect(result.success).toBe(true)
  })

  it('records reviewed_by as "Dashboard" so the audit trail distinguishes path', async () => {
    const updateChain = chainable({ data: validRow, error: null })
    mockSupabaseClient = { from: vi.fn(() => updateChain) }
    await reviewRequest('req-1', 'approve')
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ reviewed_by: 'Dashboard' }),
    )
  })

  it('uses an atomic guard (only updates rows still pending)', async () => {
    const updateChain = chainable({ data: validRow, error: null })
    mockSupabaseClient = { from: vi.fn(() => updateChain) }
    await reviewRequest('req-1', 'approve')
    // .eq() called twice: once for id, once for status='pending'
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'req-1')
    expect(updateChain.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('returns a clear error when the row is no longer pending (0-row update)', async () => {
    // .update().eq().eq('status','pending').select().single() resolves with no data
    // because the atomic guard didn't match a row.
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: null, error: null })),
    }
    const result = await reviewRequest('req-1', 'approve')
    expect(result.success).toBeUndefined()
    expect(result.error).toMatch(/no longer pending/)
  })

  it('rejects an invalid decision value', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await reviewRequest('req-1', 'maybe' as any)
    expect(result.error).toBe('Invalid decision.')
  })

  it('returns a rate-limit error when the per-session budget is exceeded', async () => {
    const { checkAndLogRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkAndLogRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })
    mockSupabaseClient = { from: vi.fn() }
    const result = await reviewRequest('req-1', 'approve')
    expect(result.error).toMatch(/Too many admin actions/)
    // The DB should never be touched when rate-limited.
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
  })

  it('still returns success when the notification email fails', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: validRow, error: null })),
    }
    const { sendEmail } = await import('@/lib/email/send')
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Resend down'))
    const result = await reviewRequest('req-1', 'approve')
    // DB write is the source of truth — email failure should not surface as
    // a failure to the admin (they'd just click again, double-emailing).
    expect(result.success).toBe(true)
  })

  it('sends the approval template on approve', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: validRow, error: null })),
    }
    const { sendEmail } = await import('@/lib/email/send')
    await reviewRequest('req-1', 'approve')
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'teacher@school.edu',
        subject: expect.stringMatching(/approved/i),
      }),
    )
  })

  it('sends the denial template on deny', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ data: validRow, error: null })),
    }
    const { sendEmail } = await import('@/lib/email/send')
    await reviewRequest('req-1', 'deny')
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringMatching(/denied/i),
      }),
    )
  })
})

// ── deleteRequest ─────────────────────────────────────────────────────────

describe('deleteRequest', () => {
  it('returns no error on successful delete', async () => {
    mockSupabaseClient = { from: vi.fn(() => chainable({ error: null })) }
    const result = await deleteRequest('req-1')
    expect(result.error).toBeUndefined()
  })

  it('returns a friendly error when the DB delete fails', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ error: { message: 'db down' } })),
    }
    const result = await deleteRequest('req-1')
    expect(result.error).toMatch(/Failed to delete request/)
  })

  it('respects the admin rate limit', async () => {
    const { checkAndLogRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkAndLogRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })
    mockSupabaseClient = { from: vi.fn() }
    const result = await deleteRequest('req-1')
    expect(result.error).toMatch(/Too many admin actions/)
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
  })
})

// ── addAdminRecipient ─────────────────────────────────────────────────────

function recipientForm(email: string, label?: string): FormData {
  const fd = new FormData()
  fd.set('email', email)
  if (label !== undefined) fd.set('label', label)
  return fd
}

describe('addAdminRecipient', () => {
  it('rejects an empty email', async () => {
    const result = await addAdminRecipient(null, recipientForm(''))
    expect(result.error).toBe('Email is required.')
  })

  it('rejects a malformed email', async () => {
    const result = await addAdminRecipient(null, recipientForm('not-an-email'))
    expect(result.error).toMatch(/valid email/)
  })

  it('inserts a valid recipient and returns success', async () => {
    const insertChain = chainable({ error: null })
    mockSupabaseClient = { from: vi.fn(() => insertChain) }
    const result = await addAdminRecipient(
      null,
      recipientForm('principal@school.edu', 'Principal'),
    )
    expect(result.success).toBe(true)
    expect(insertChain.insert).toHaveBeenCalledWith({
      email: 'principal@school.edu',
      label: 'Principal',
    })
  })

  it('lowercases the email and trims the label before insert', async () => {
    const insertChain = chainable({ error: null })
    mockSupabaseClient = { from: vi.fn(() => insertChain) }
    await addAdminRecipient(null, recipientForm('  Principal@School.EDU  ', '  Boss  '))
    expect(insertChain.insert).toHaveBeenCalledWith({
      email: 'principal@school.edu',
      label: 'Boss',
    })
  })

  it('stores null for label when omitted (rather than empty string)', async () => {
    const insertChain = chainable({ error: null })
    mockSupabaseClient = { from: vi.fn(() => insertChain) }
    await addAdminRecipient(null, recipientForm('principal@school.edu', ''))
    expect(insertChain.insert).toHaveBeenCalledWith({
      email: 'principal@school.edu',
      label: null,
    })
  })

  it('translates Postgres unique_violation (23505) to a friendly duplicate message', async () => {
    mockSupabaseClient = {
      from: vi.fn(() =>
        chainable({ error: { code: '23505', message: 'duplicate key value' } }),
      ),
    }
    const result = await addAdminRecipient(null, recipientForm('principal@school.edu'))
    expect(result.error).toMatch(/already on the recipient list/)
  })

  it('returns a generic error for any other DB failure', async () => {
    mockSupabaseClient = {
      from: vi.fn(() => chainable({ error: { code: '08006', message: 'conn lost' } })),
    }
    const result = await addAdminRecipient(null, recipientForm('principal@school.edu'))
    expect(result.error).toMatch(/Failed to add recipient/)
  })
})

// ── removeAdminRecipient ──────────────────────────────────────────────────

describe('removeAdminRecipient', () => {
  it('refuses to remove the last remaining row (safety rail)', async () => {
    const countChain = chainable({ count: 1, error: null })
    mockSupabaseClient = { from: vi.fn().mockReturnValueOnce(countChain) }
    const result = await removeAdminRecipient('rec-1')
    expect(result.error).toMatch(/Add another recipient before removing/)
    // The delete chain must not even be requested if we're below threshold.
    expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1)
  })

  it('removes the row when count is greater than 1', async () => {
    const countChain = chainable({ count: 3, error: null })
    const deleteChain = chainable({ error: null })
    mockSupabaseClient = {
      from: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(deleteChain),
    }
    const result = await removeAdminRecipient('rec-1')
    expect(result.error).toBeUndefined()
    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 'rec-1')
  })

  it('returns an error when the count probe fails', async () => {
    const countChain = chainable({ count: null, error: { message: 'db down' } })
    mockSupabaseClient = { from: vi.fn().mockReturnValueOnce(countChain) }
    const result = await removeAdminRecipient('rec-1')
    expect(result.error).toMatch(/check the recipient list/)
  })

  it('returns an error when the delete itself fails (after passing the count guard)', async () => {
    const countChain = chainable({ count: 3, error: null })
    const deleteChain = chainable({ error: { message: 'db down' } })
    mockSupabaseClient = {
      from: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(deleteChain),
    }
    const result = await removeAdminRecipient('rec-1')
    expect(result.error).toMatch(/Failed to remove recipient/)
  })

  it('respects the admin rate limit', async () => {
    const { checkAndLogRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkAndLogRateLimit).mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })
    mockSupabaseClient = { from: vi.fn() }
    const result = await removeAdminRecipient('rec-1')
    expect(result.error).toMatch(/Too many admin actions/)
    expect(mockSupabaseClient.from).not.toHaveBeenCalled()
  })
})
