// lib/auth/tokens.ts
// HMAC-SHA256 approval token generation and verification.
//
// Token format (Phase 3): HMAC-SHA256 over `${id}:${action}:${approver_email}:${exp}`
//   - id            — the request UUID from the database
//   - action        — 'approve' | 'deny'
//   - approver_email— the specific admin the link was sent to (binding prevents
//                     replay by a different admin if a token leaks)
//   - exp           — Unix-seconds expiry timestamp (default 7 days from issue;
//                     configurable via APPROVAL_LINK_EXPIRY_DAYS env var)
//
// Why each component:
//   - id binding: a token for request A cannot be replayed on request B
//   - action binding: a token for "approve" cannot be reused to "deny"
//   - approver binding: if an admin forwards a token (or it leaks via mail
//     archive), a different admin clicking it gets rejected
//   - exp binding: stale tokens beyond the configured window are rejected
//     even if the underlying secret is otherwise valid
//
// Node.js crypto is available in Route Handlers and Server Actions (Node.js runtime).
// Do NOT import this in middleware.ts — middleware runs in the Edge Runtime.
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Generate a per-request HMAC-SHA256 token bound to (id, action, approver, exp).
 *
 * @param secret         - process.env.APPROVAL_HMAC_SECRET
 * @param id             - the request UUID from the database
 * @param action         - 'approve' | 'deny'
 * @param approverEmail  - the email address of the admin this link is being issued to
 * @param exp            - Unix-seconds expiry timestamp
 * @returns              - 64-character lowercase hex string
 */
export function generateApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny',
  approverEmail: string,
  exp: number
): string {
  const payload = `${id}:${action}:${approverEmail}:${exp}`
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Compute the default expiry timestamp.
 * Reads APPROVAL_LINK_EXPIRY_DAYS at call time so deployment changes take effect
 * on the next email sent, without re-deploying code.
 */
export function defaultApprovalExpiry(): number {
  const raw = process.env.APPROVAL_LINK_EXPIRY_DAYS
  const days = raw && Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : 7
  return Math.floor(Date.now() / 1000) + days * 86400
}

export type ApprovalVerifyResult =
  | { valid: true }
  | { valid: false; reason: 'expired' | 'invalid' }

/**
 * Verify an approval token using a timing-safe comparison.
 * Never throws — returns a structured result for any input including
 * wrong-length tokens, missing fields, or expired timestamps.
 *
 * @param secret        - process.env.APPROVAL_HMAC_SECRET (same secret used to generate)
 * @param id            - the request UUID (from URL path param)
 * @param action        - 'approve' | 'deny' (from URL query param, pre-validated)
 * @param approverEmail - the admin email (from URL query param, must match issue-time value)
 * @param exp           - the expiry timestamp (from URL query param, must match issue-time value)
 * @param providedToken - the token from the email link query param
 */
export function verifyApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny',
  approverEmail: string,
  exp: number,
  providedToken: string
): ApprovalVerifyResult {
  // Check expiry FIRST so that a long-stale token returns a specific "expired"
  // result the UI can surface ("This link has expired — request a new one")
  // rather than the generic "invalid" message used for tampering.
  // exp must be a positive integer or the link was malformed.
  if (!Number.isFinite(exp) || exp <= 0) {
    return { valid: false, reason: 'invalid' }
  }
  const now = Math.floor(Date.now() / 1000)
  if (now >= exp) {
    return { valid: false, reason: 'expired' }
  }

  const payload = `${id}:${action}:${approverEmail}:${exp}`
  const expected = createHmac('sha256', secret).update(payload).digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(providedToken, 'hex')

  // timingSafeEqual throws if lengths differ — guard explicitly.
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: 'invalid' }
  }

  return timingSafeEqual(expectedBuf, providedBuf)
    ? { valid: true }
    : { valid: false, reason: 'invalid' }
}
