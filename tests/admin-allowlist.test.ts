// tests/admin-allowlist.test.ts
// The login authorization gate: only emails present in admin_recipients may
// sign in. Fail-closed on empty list or DB error.
import { describe, it, expect, vi, beforeEach } from 'vitest'

let rows: { email: string }[] | null
let dbError: { message: string } | null

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: rows, error: dbError }),
    }),
  }),
}))

import { isAllowedAdmin } from '@/lib/auth/admin-allowlist'

beforeEach(() => {
  rows = []
  dbError = null
})

describe('isAllowedAdmin', () => {
  it('allows an email present in admin_recipients', async () => {
    rows = [{ email: 'principal@school.org' }]
    expect(await isAllowedAdmin('principal@school.org')).toBe(true)
  })

  it('is case-insensitive on both sides', async () => {
    rows = [{ email: 'Principal@School.ORG' }]
    expect(await isAllowedAdmin('principal@school.org')).toBe(true)
    expect(await isAllowedAdmin('PRINCIPAL@SCHOOL.ORG')).toBe(true)
  })

  it('trims surrounding whitespace before comparing', async () => {
    rows = [{ email: '  principal@school.org  ' }]
    expect(await isAllowedAdmin('principal@school.org')).toBe(true)
  })

  it('rejects an email not on the list', async () => {
    rows = [{ email: 'principal@school.org' }]
    expect(await isAllowedAdmin('stranger@gmail.com')).toBe(false)
  })

  it('fail-closed: empty list rejects everyone', async () => {
    rows = []
    expect(await isAllowedAdmin('principal@school.org')).toBe(false)
  })

  it('fail-closed: DB error rejects everyone', async () => {
    rows = null
    dbError = { message: 'connection lost' }
    expect(await isAllowedAdmin('principal@school.org')).toBe(false)
  })

  it('rejects malformed input (no @)', async () => {
    rows = [{ email: 'principal@school.org' }]
    expect(await isAllowedAdmin('not-an-email')).toBe(false)
  })

  it('rejects empty input', async () => {
    rows = [{ email: 'principal@school.org' }]
    expect(await isAllowedAdmin('')).toBe(false)
  })
})
