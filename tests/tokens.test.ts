// tests/tokens.test.ts
// Unit tests for HMAC-SHA256 approval token generation and verification.
// Uses node:crypto directly — no mocking needed, this is pure logic.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  generateApprovalToken,
  verifyApprovalToken,
  defaultApprovalExpiry,
} from '@/lib/auth/tokens'

const SECRET   = 'test-secret-at-least-32-chars-ok'
const ID       = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890'
const APPROVER = 'admin@school.edu'

// 1 hour from now — always a valid future time in tests.
function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600
}

describe('generateApprovalToken', () => {
  it('returns a 64-character lowercase hex string', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, futureExp())
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('approve and deny tokens for the same request differ', () => {
    const exp = futureExp()
    const a = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    const d = generateApprovalToken(SECRET, ID, 'deny',    APPROVER, exp)
    expect(a).not.toBe(d)
  })

  it('same inputs always produce the same token (deterministic)', () => {
    const exp = futureExp()
    const t1 = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    const t2 = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    expect(t1).toBe(t2)
  })

  it('different request IDs produce different tokens', () => {
    const exp = futureExp()
    const t1 = generateApprovalToken(SECRET, 'id-aaa', 'approve', APPROVER, exp)
    const t2 = generateApprovalToken(SECRET, 'id-bbb', 'approve', APPROVER, exp)
    expect(t1).not.toBe(t2)
  })

  it('different approver emails produce different tokens', () => {
    const exp = futureExp()
    const t1 = generateApprovalToken(SECRET, ID, 'approve', 'admin-a@school.edu', exp)
    const t2 = generateApprovalToken(SECRET, ID, 'approve', 'admin-b@school.edu', exp)
    expect(t1).not.toBe(t2)
  })

  it('different expiry timestamps produce different tokens', () => {
    const t1 = generateApprovalToken(SECRET, ID, 'approve', APPROVER, 1700000000)
    const t2 = generateApprovalToken(SECRET, ID, 'approve', APPROVER, 1700000001)
    expect(t1).not.toBe(t2)
  })
})

describe('verifyApprovalToken — valid cases', () => {
  it('returns valid:true for a correctly-issued token', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, exp, token)).toEqual({ valid: true })
  })
})

describe('verifyApprovalToken — invalid cases', () => {
  it('rejects cross-action forgery (approve token used to deny)', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    expect(verifyApprovalToken(SECRET, ID, 'deny', APPROVER, exp, token)).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects cross-request forgery (token for id-A used on id-B)', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, 'id-aaa', 'approve', APPROVER, exp)
    expect(verifyApprovalToken(SECRET, 'id-bbb', 'approve', APPROVER, exp, token)).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects cross-approver forgery (token for admin-A used by admin-B)', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', 'admin-a@school.edu', exp)
    expect(verifyApprovalToken(SECRET, ID, 'approve', 'admin-b@school.edu', exp, token)).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects a tampered token', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    const tampered = token.slice(0, -2) + '00'
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, exp, tampered)).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects an empty token', () => {
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, futureExp(), '')).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects a short token (length mismatch, does not throw)', () => {
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, futureExp(), 'abc123')).toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects a wrong secret', () => {
    const exp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, exp)
    expect(verifyApprovalToken('different-secret-32-chars-pad!!', ID, 'approve', APPROVER, exp, token))
      .toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects when the exp value differs from issue time (replay with a later exp)', () => {
    const originalExp = futureExp()
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, originalExp)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, originalExp + 1, token))
      .toEqual({ valid: false, reason: 'invalid' })
  })
})

describe('verifyApprovalToken — expiry', () => {
  it('returns expired:true when exp is in the past', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 1
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, pastExp)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, pastExp, token))
      .toEqual({ valid: false, reason: 'expired' })
  })

  it('returns expired:true exactly at exp (boundary is exclusive)', () => {
    const nowExp = Math.floor(Date.now() / 1000)
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, nowExp)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, nowExp, token))
      .toEqual({ valid: false, reason: 'expired' })
  })

  it('rejects an invalid exp value (NaN) as "invalid"', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, 1700000000)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, NaN, token))
      .toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects a negative exp value as "invalid"', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, 1700000000)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, -1, token))
      .toEqual({ valid: false, reason: 'invalid' })
  })

  it('rejects zero exp as "invalid"', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve', APPROVER, 1700000000)
    expect(verifyApprovalToken(SECRET, ID, 'approve', APPROVER, 0, token))
      .toEqual({ valid: false, reason: 'invalid' })
  })
})

describe('defaultApprovalExpiry', () => {
  beforeEach(() => {
    delete process.env.APPROVAL_LINK_EXPIRY_DAYS
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to 7 days when env var is unset', () => {
    vi.useFakeTimers()
    const now = new Date('2026-01-01T00:00:00Z')
    vi.setSystemTime(now)
    const expected = Math.floor(now.getTime() / 1000) + 7 * 86400
    expect(defaultApprovalExpiry()).toBe(expected)
  })

  it('honours APPROVAL_LINK_EXPIRY_DAYS when set to a positive integer', () => {
    process.env.APPROVAL_LINK_EXPIRY_DAYS = '3'
    vi.useFakeTimers()
    const now = new Date('2026-01-01T00:00:00Z')
    vi.setSystemTime(now)
    const expected = Math.floor(now.getTime() / 1000) + 3 * 86400
    expect(defaultApprovalExpiry()).toBe(expected)
  })

  it('falls back to 7 days when env var is a malformed value', () => {
    process.env.APPROVAL_LINK_EXPIRY_DAYS = 'forever'
    vi.useFakeTimers()
    const now = new Date('2026-01-01T00:00:00Z')
    vi.setSystemTime(now)
    const expected = Math.floor(now.getTime() / 1000) + 7 * 86400
    expect(defaultApprovalExpiry()).toBe(expected)
  })

  it('falls back to 7 days when env var is zero or negative', () => {
    process.env.APPROVAL_LINK_EXPIRY_DAYS = '0'
    vi.useFakeTimers()
    const now = new Date('2026-01-01T00:00:00Z')
    vi.setSystemTime(now)
    const expected = Math.floor(now.getTime() / 1000) + 7 * 86400
    expect(defaultApprovalExpiry()).toBe(expected)
  })
})
