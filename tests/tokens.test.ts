// tests/tokens.test.ts
// Unit tests for HMAC-SHA256 approval token generation and verification.
// Uses node:crypto directly — no mocking needed, this is pure logic.
import { describe, it, expect } from 'vitest'
import { generateApprovalToken, verifyApprovalToken } from '@/lib/auth/tokens'

const SECRET = 'test-secret-at-least-32-chars-ok'
const ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890'

describe('generateApprovalToken', () => {
  it('returns a 64-character lowercase hex string', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve')
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('approve and deny tokens for the same request are different', () => {
    const approveToken = generateApprovalToken(SECRET, ID, 'approve')
    const denyToken = generateApprovalToken(SECRET, ID, 'deny')
    expect(approveToken).not.toBe(denyToken)
  })

  it('same inputs always produce the same token (deterministic)', () => {
    const t1 = generateApprovalToken(SECRET, ID, 'approve')
    const t2 = generateApprovalToken(SECRET, ID, 'approve')
    expect(t1).toBe(t2)
  })

  it('different request IDs produce different tokens', () => {
    const t1 = generateApprovalToken(SECRET, 'id-aaa', 'approve')
    const t2 = generateApprovalToken(SECRET, 'id-bbb', 'approve')
    expect(t1).not.toBe(t2)
  })
})

describe('verifyApprovalToken', () => {
  it('returns true for a valid token', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve')
    expect(verifyApprovalToken(SECRET, ID, 'approve', token)).toBe(true)
  })

  it('returns false when action does not match (cross-action forgery)', () => {
    const approveToken = generateApprovalToken(SECRET, ID, 'approve')
    expect(verifyApprovalToken(SECRET, ID, 'deny', approveToken)).toBe(false)
  })

  it('returns false when request ID does not match (cross-request forgery)', () => {
    const token = generateApprovalToken(SECRET, 'id-aaa', 'approve')
    expect(verifyApprovalToken(SECRET, 'id-bbb', 'approve', token)).toBe(false)
  })

  it('returns false for a tampered token', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve')
    const tampered = token.slice(0, -2) + '00'
    expect(verifyApprovalToken(SECRET, ID, 'approve', tampered)).toBe(false)
  })

  it('returns false for an empty token (does not throw)', () => {
    expect(verifyApprovalToken(SECRET, ID, 'approve', '')).toBe(false)
  })

  it('returns false for a short token (does not throw on length mismatch)', () => {
    expect(verifyApprovalToken(SECRET, ID, 'approve', 'abc123')).toBe(false)
  })

  it('returns false for a wrong secret', () => {
    const token = generateApprovalToken(SECRET, ID, 'approve')
    expect(verifyApprovalToken('different-secret-32-chars-pad!!', ID, 'approve', token)).toBe(false)
  })
})
