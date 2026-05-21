// lib/auth/tokens.ts
// HMAC-SHA256 approval token generation and verification.
// Tokens are scoped to a specific request id + action — a token for "approve" on request A
// cannot be used to "deny" request A or to approve/deny request B.
//
// Node.js crypto is available in Route Handlers and Server Actions (Node.js runtime).
// Do NOT import this in middleware.ts — middleware runs in the Edge Runtime.
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Generate a per-request HMAC-SHA256 token.
 *
 * @param secret - process.env.APPROVAL_HMAC_SECRET
 * @param id     - the request UUID from the database
 * @param action - 'approve' | 'deny'
 * @returns      - 64-character lowercase hex string (URL-safe, no encodeURIComponent needed)
 */
export function generateApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny'
): string {
  return createHmac('sha256', secret).update(`${id}:${action}`).digest('hex')
}

/**
 * Verify an approval token using a timing-safe comparison.
 * Never throws — returns false for any invalid input including wrong-length tokens.
 *
 * @param secret        - process.env.APPROVAL_HMAC_SECRET (same secret used to generate)
 * @param id            - the request UUID (from URL query param)
 * @param action        - 'approve' | 'deny' (from URL query param, pre-validated)
 * @param providedToken - the token from the email link query param
 * @returns             - true if token is valid, false otherwise
 */
export function verifyApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny',
  providedToken: string
): boolean {
  const expected = createHmac('sha256', secret).update(`${id}:${action}`).digest('hex')

  // Decode hex strings to raw byte Buffers for timingSafeEqual.
  // Buffer.from(hex, 'hex') produces 32 bytes (SHA-256 = 256 bits).
  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(providedToken, 'hex')

  // CRITICAL: timingSafeEqual throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH if buffer lengths
  // differ. An attacker can supply a token of any length — guard here before calling it.
  if (expectedBuf.length !== providedBuf.length) {
    return false
  }

  return timingSafeEqual(expectedBuf, providedBuf)
}
