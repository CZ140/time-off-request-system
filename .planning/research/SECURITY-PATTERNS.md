# Security Patterns Research

**Researched:** 2026-05-21
**Domain:** Supabase date-overlap queries + Node.js HMAC token signing
**Confidence:** HIGH (both topics verified via Context7, live Node.js execution, and official docs)

---

## Summary

This document answers two precise implementation questions for the approval flow in the time-off
request system. Both topics are fully resolved with working code examples.

**Topic 1 — Supabase date overlap query:** Chaining `.lte()` and `.gte()` directly (AND logic) is
the correct pattern for the overlap condition `blackout.start_date <= A_end AND blackout.end_date >= A_start`.
The OR operator is not needed for this two-condition AND pattern. YYYY-MM-DD text strings compare
correctly with lexicographic ordering in PostgREST. Use `.maybeSingle()` only if you want a single
typed result — for existence checking, skip it entirely and check `data.length > 0`.

**Topic 2 — HMAC-SHA256 signing:** `crypto.createHmac` works as-is in Next.js 15 Route Handlers
(Node.js runtime, which is the default). Use hex encoding — it is URL-safe without `encodeURIComponent`.
Always guard `timingSafeEqual` with a length check first: the function throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`
if buffer lengths differ, and an attacker-supplied malformed token will have a different buffer length.

---

## Topic 1: Supabase Date Overlap Query

### 1.1 The Overlap Condition

For a blackout row to overlap with a requested range [A_start, A_end], both of these must be true:

```
blackout.start_date <= A_end    (blackout starts before or on the request end)
blackout.end_date   >= A_start  (blackout ends after or on the request start)
```

This is a pure AND condition. No OR is needed.

### 1.2 Exact Filter Syntax — supabase-js v2

```typescript
// Source: Context7 /supabase/postgrest-js — comparison filter docs
// Source: VERIFIED via live Node.js execution (logic confirmed)

import { createClient } from '@/lib/supabase/server'

/**
 * Returns all blackout_date rows that overlap with [requestStart, requestEnd].
 * Dates must be YYYY-MM-DD strings (e.g. "2025-06-15").
 */
export async function getOverlappingBlackouts(
  requestStart: string, // "YYYY-MM-DD"
  requestEnd: string    // "YYYY-MM-DD"
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('blackout_dates')
    .select('*')
    .lte('start_date', requestEnd)   // blackout starts before or on request end
    .gte('end_date', requestStart)   // blackout ends after or on request start

  return { data, error }
}
```

Chained `.lte()` and `.gte()` combine with AND logic by default. No `.or()` needed.
[VERIFIED: Context7 /supabase/postgrest-js — "Multiple conditions are evaluated using AND by default"]

### 1.3 Existence Check (Recommended Pattern)

For the submit action, you only need to know *whether* a blackout overlap exists, not retrieve
the rows. Skip `.maybeSingle()` and check `data.length`:

```typescript
export async function hasBlackoutConflict(
  requestStart: string,
  requestEnd: string
): Promise<boolean> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('blackout_dates')
    .select('id')           // minimal projection — only need to know count
    .lte('start_date', requestEnd)
    .gte('end_date', requestStart)
    .limit(1)               // short-circuit — one hit is enough

  if (error) {
    console.error('Blackout check error:', error)
    throw new Error('Failed to check blackout dates')
  }

  return (data?.length ?? 0) > 0
}
```

### 1.4 maybeSingle() vs limit(1)

| Method | Returns | Throws on 0 rows? | Throws on 2+ rows? | Use when |
|--------|---------|-------------------|--------------------|----------|
| `.single()` | `T` | Yes (PGRST116) | Yes | You KNOW exactly 1 row exists |
| `.maybeSingle()` | `T \| null` | No | Yes | You want 0 or 1, typed as object or null |
| `.limit(1)` | `T[]` (array) | No | No | You want existence — check `data.length` |

**Recommendation for overlap check:** Use `.limit(1)` without `.maybeSingle()`. Reason: multiple
blackout periods may overlap the same request, so `.maybeSingle()` would throw if two blackouts
match. `.limit(1)` is safe — you only care that at least one row exists.

[VERIFIED: Context7 /supabase/postgrest-js — maybeSingle "throws an error if more than one row is found"]

### 1.5 Date String Comparison in PostgREST — YYYY-MM-DD as Text

**Does lexicographic ordering work for YYYY-MM-DD strings?** Yes.

YYYY-MM-DD is ISO 8601 ordering: year (most significant) → month → day, all zero-padded to fixed
width. String comparison (`<`, `<=`, `>`, `>=`) over these strings produces the same ordering as
date arithmetic. PostgREST passes the `lte`/`gte` operators directly to PostgreSQL as string
comparisons on the column type.

```
"2025-06-01" < "2025-06-15" < "2025-12-31" < "2026-01-01"
```

All comparisons hold correctly as plain string comparisons.

[CITED: https://www.w3tutorials.net/blog/how-to-compare-dates-in-datetime-fields-in-postgresql/]
[VERIFIED: multiple sources confirm YYYY-MM-DD is designed for lexicographic ordering]

**Important caveat:** This relies on the strings being strictly YYYY-MM-DD formatted (zero-padded).
If any row has a non-padded month or day (e.g. "2025-6-1" instead of "2025-06-01"), comparison
breaks. Always enforce the format at write time via Zod validation on form input.

```typescript
// Enforce format before writing to Supabase
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
```

### 1.6 Does PostgREST Support OR for This Pattern?

The overlap condition does not need OR — it is pure AND. But for reference:

PostgREST supports OR via `.or()` with a filter string using PostgREST operator syntax:

```typescript
// Source: Context7 /supabase/postgrest-js — or() docs
// Example: rows where status is ONLINE OR username is 'supabot'
const { data } = await supabase
  .from('users')
  .select()
  .or('status.eq.ONLINE,username.eq.supabot')
```

For complex AND-inside-OR logic, PostgREST uses `and()` inside the filter string:

```typescript
// PostgREST filter string syntax for AND inside OR:
.or('condition1,and(condition2,condition3)')
```

This is not needed for the blackout overlap query. Chained `.lte()` + `.gte()` is the correct,
simpler approach.

[VERIFIED: Context7 /supabase/postgrest-js — or() method docs]

### 1.7 Anti-Patterns to Avoid

**Do not use `.overlaps()`** — that method is for PostgreSQL native range types (`tsrange`,
`daterange`, `int4range`) or array columns. The `blackout_dates` table stores dates as TEXT in
separate `start_date`/`end_date` columns, not as a PostgreSQL range column.

```typescript
// WRONG for this schema:
.overlaps('start_date', [requestStart, requestEnd])  // only works on range/array columns

// CORRECT:
.lte('start_date', requestEnd).gte('end_date', requestStart)
```

[VERIFIED: Context7 /supabase/postgrest-js — "overlaps() applies to array or range data types"]

---

## Topic 2: HMAC-SHA256 Token Signing in Node.js / Next.js

### 2.1 Generate Function

```typescript
// Source: Node.js official docs — crypto.createHmac
// Source: VERIFIED via live execution on Node.js v24.12.0

import { createHmac } from 'node:crypto'

/**
 * Generate a per-request HMAC-SHA256 token.
 *
 * @param secret  - process.env.APPROVAL_HMAC_SECRET
 * @param id      - the request UUID from the database
 * @param action  - 'approve' | 'deny'
 * @returns       - 64-character lowercase hex string (URL-safe, no encoding needed)
 */
export function generateApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny'
): string {
  return createHmac('sha256', secret)
    .update(`${id}:${action}`)
    .digest('hex')
}
```

**Why hex over base64:** Hex output (`[0-9a-f]+`) is URL-safe without `encodeURIComponent`.
Base64 output contains `+`, `/`, and `=` which require URL encoding. Base64url avoids that but
adds format complexity. Hex is simpler and sufficient.

Live-verified output:
- Hex token: 64 characters, charset `[0-9a-f]`, `encodeURIComponent(hex) === hex` is `true`
- Base64 token: `encodeURIComponent(b64) === b64` is `false` (contains `+`, `/`, `=`)
- Base64url token: URL-safe, but 43 chars vs hex's 64 — not meaningfully shorter for a URL

[VERIFIED: live Node.js v24.12.0 execution]

### 2.2 Verify Function

```typescript
// Source: Node.js official docs — crypto.timingSafeEqual
// Source: VERIFIED via live execution — throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH on length mismatch

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify an approval token without leaking timing information.
 *
 * @param secret         - process.env.APPROVAL_HMAC_SECRET (same secret used to generate)
 * @param id             - the request UUID (from query param, validated separately)
 * @param action         - 'approve' | 'deny' (from query param, validated separately)
 * @param providedToken  - the token from the email link query param
 * @returns              - true if token is valid, false otherwise (never throws)
 */
export function verifyApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny',
  providedToken: string
): boolean {
  // Recompute expected token
  const expected = createHmac('sha256', secret)
    .update(`${id}:${action}`)
    .digest('hex')

  // Convert hex strings to Buffers for timingSafeEqual
  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(providedToken, 'hex')

  // CRITICAL: length guard before timingSafeEqual.
  // timingSafeEqual throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH if lengths differ.
  // An attacker can supply a token of wrong length — without this guard, the
  // throw itself leaks that the token was wrong (and different length from expected).
  // Returning false here is the correct behavior, not throwing.
  if (expectedBuf.length !== providedBuf.length) {
    return false
  }

  return timingSafeEqual(expectedBuf, providedBuf)
}
```

**Why `Buffer.from(hex, 'hex')` not `Buffer.from(hex)`?**

`Buffer.from(hex, 'hex')` decodes the hex string into 32 raw bytes (SHA-256 = 256 bits = 32 bytes).
`Buffer.from(hex)` treats the string as UTF-8, producing a 64-byte buffer (one byte per hex char).

Both produce same-length buffers when comparing two hex-encoded SHA-256 values, so `timingSafeEqual`
would not throw — but `Buffer.from(hex, 'hex')` is semantically correct and more efficient.

Alternatively, compare the raw hex strings as UTF-8 buffers — also safe since both are the same
length by construction (SHA-256 always produces 64 hex chars):

```typescript
// Equivalent and also correct — both buffers are always 64 bytes (UTF-8 of 64 hex chars)
const a = Buffer.from(expected)   // 64 bytes
const b = Buffer.from(providedToken)  // may be different length if attacker sends wrong format
if (a.length !== b.length) return false
return timingSafeEqual(a, b)
```

The `Buffer.from(hex, 'hex')` approach is preferred because the 32-byte comparison is what you're
actually securing.

[VERIFIED: live Node.js v24.12.0 — `timingSafeEqual` on different-length buffers throws `RangeError: Input buffers must have the same byte length` with code `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`]

### 2.3 Complete Route Handler Integration

```typescript
// app/api/approve/route.ts
// Source: VERIFIED patterns — Node.js crypto in Next.js 15 Node.js runtime (default)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTeacherConfirmation } from '@/lib/email/send'
import { verifyApprovalToken } from '@/lib/auth/tokens'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get('token')
  const id = searchParams.get('id')
  const action = searchParams.get('action')

  // 1. Validate all required params are present
  if (!token || !id || (action !== 'approve' && action !== 'deny')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // 2. Verify HMAC token — timing-safe
  const secret = process.env.APPROVAL_HMAC_SECRET!
  if (!verifyApprovalToken(secret, id, action, token)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // 3. Check idempotency — don't double-process
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('requests')
    .select('status')
    .eq('id', id)
    .single()

  if (existing?.status !== 'pending') {
    return NextResponse.redirect(new URL('/already-reviewed', request.url))
  }

  // 4. Update status
  await supabase
    .from('requests')
    .update({ status: action === 'approve' ? 'approved' : 'denied', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  // 5. Notify teacher
  await sendTeacherConfirmation(id, action)

  return NextResponse.redirect(new URL(`/approved?action=${action}`, request.url))
}
```

### 2.4 Token Generation at Email Send Time

```typescript
// lib/auth/tokens.ts
import { createHmac } from 'node:crypto'

export function generateApprovalToken(
  secret: string,
  id: string,
  action: 'approve' | 'deny'
): string {
  return createHmac('sha256', secret).update(`${id}:${action}`).digest('hex')
}

export function buildApprovalUrl(baseUrl: string, id: string, action: 'approve' | 'deny'): string {
  const secret = process.env.APPROVAL_HMAC_SECRET!
  const token = generateApprovalToken(secret, id, action)
  // Hex tokens are [0-9a-f] — no encodeURIComponent needed
  return `${baseUrl}/api/approve?token=${token}&id=${id}&action=${action}`
}
```

Usage in email sender:

```typescript
// lib/email/send.ts — inside sendAdminNotification()
const approveUrl = buildApprovalUrl(process.env.NEXT_PUBLIC_APP_URL!, requestId, 'approve')
const denyUrl    = buildApprovalUrl(process.env.NEXT_PUBLIC_APP_URL!, requestId, 'deny')

// Embed approveUrl and denyUrl in email HTML as plain <a href> links
```

### 2.5 Does node:crypto Work in Next.js 15 Route Handlers?

**Yes — unconditionally.** Route Handlers default to the Node.js runtime, which has full access
to all Node.js built-in modules including `node:crypto`.

The only runtime where `node:crypto` is unavailable is the **Edge Runtime** (used for middleware
and segments that explicitly export `export const runtime = 'edge'`). Route handlers do NOT use
the Edge Runtime by default and this project does not set `runtime = 'edge'` anywhere.

| Context | Runtime | node:crypto works? |
|---------|---------|-------------------|
| Route Handler (`app/api/**/route.ts`) | Node.js (default) | Yes |
| Server Action (`"use server"`) | Node.js (default) | Yes |
| Server Component | Node.js (default) | Yes |
| Middleware (`middleware.ts`) | Edge (default pre-15.2) | No — use Web Crypto instead |
| Segment with `export const runtime = 'edge'` | Edge | No |

[VERIFIED: Next.js official docs — "The Node.js Runtime (default), which has access to all Node.js APIs"]
[CITED: https://nextjs.org/docs/app/api-reference/edge — Edge Runtime API list confirms node:crypto is NOT in edge]

**No special configuration needed** for the approval route handler. Just import and use:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto'
// Works without any runtime export or config change
```

### 2.6 URL Encoding — Hex vs Base64 vs Base64url

| Encoding | Output Example | URL-safe? | Notes |
|----------|---------------|-----------|-------|
| `hex` | `a5c73618ab99...` | **Yes** — charset is `[0-9a-f]` | No `encodeURIComponent` needed |
| `base64` | `pcP2GL2q...=` | **No** — contains `+`, `/`, `=` | Must `encodeURIComponent` or it breaks in URLs |
| `base64url` | `pcP2GL2q..._` | **Yes** — replaces `+`→`-`, `/`→`_`, drops `=` | Also URL-safe, slightly shorter (43 chars vs 64) |

[VERIFIED: live Node.js execution — `encodeURIComponent(hexToken) === hexToken` is `true`]

**Recommendation: use hex.** Simpler, no encoding gotchas, and the 64-char length is not
meaningful overhead in an email link.

### 2.7 Environment Variable

Add to `.env.local` and Vercel dashboard:

```bash
# Replace APPROVAL_SECRET (shared static string) with this:
APPROVAL_HMAC_SECRET=<random-32-byte-hex-string>

# Generate a secure value:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The old `APPROVAL_SECRET` pattern compared a shared static string. The new HMAC pattern means
each link (approve/deny) for each request ID has a unique token. A token for request A cannot
be used to approve request B, and an approve token cannot be replayed as a deny token.

---

## Common Pitfalls

### Pitfall 1: Using .overlaps() on Text Columns

**What goes wrong:** `.overlaps()` is for PostgreSQL native range types or array columns.
`blackout_dates.start_date` is TEXT, not `daterange`. The query will fail or return wrong results.
**How to avoid:** Use `.lte('start_date', requestEnd).gte('end_date', requestStart)` — chained
AND comparisons on the text columns.

### Pitfall 2: timingSafeEqual Without Length Check

**What goes wrong:** An attacker sends a 1-character token. `timingSafeEqual` throws
`ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH`. If you don't catch that, the route handler returns a 500,
which is a different response than the redirect-to-unauthorized. Differentiating responses leaks
that the token was wrong-length vs wrong-value — which is a minor information disclosure.
**How to avoid:** Always check `expectedBuf.length !== providedBuf.length` and return `false`
before calling `timingSafeEqual`.

### Pitfall 3: Using String Comparison Instead of timingSafeEqual

**What goes wrong:** `token === expectedToken` is vulnerable to timing attacks. In environments
with highly accurate timing (side-channel measurement via repeated requests), an attacker can
measure how long the comparison takes and infer how many characters of their guess are correct.
**How to avoid:** Always use `timingSafeEqual` for security-sensitive string comparisons.

### Pitfall 4: Base64 Token in URL Without Encoding

**What goes wrong:** A base64 token contains `+`, `/`, `=`. In a URL query string, `+` is decoded
as a space by some parsers. The token arriving at the route handler will be different from the one
that was sent, causing valid tokens to fail verification.
**How to avoid:** Use hex encoding (no special chars). If using base64, always
`encodeURIComponent(token)` when building the URL and ensure the framework decodes it on receipt
(Next.js `searchParams.get()` auto-decodes, so just encode when building).

### Pitfall 5: YYYY-MM-DD Stored Without Zero Padding

**What goes wrong:** A date like June 1st stored as `"2025-6-1"` instead of `"2025-06-01"`
will compare incorrectly with string operators. `"2025-6-1" > "2025-12-31"` is true lexicographically
(because `'6' > '1'`), which is wrong.
**How to avoid:** Validate all date inputs with a regex before storing: `/^\d{4}-\d{2}-\d{2}$/`

---

## Code Files to Create

Based on this research, the implementation requires:

```
lib/
└── auth/
    └── tokens.ts    # generateApprovalToken(), verifyApprovalToken(), buildApprovalUrl()
```

The `verifyApprovalToken` is called from `app/api/approve/route.ts`.
The `generateApprovalToken` / `buildApprovalUrl` is called from `lib/email/send.ts` when sending
the admin notification email.

---

## Sources

### PRIMARY (HIGH confidence — verified via tool execution or official docs)

- **Context7 /supabase/postgrest-js** — `.lte()`, `.gte()`, `.or()`, `.maybeSingle()`, `.single()` docs
- **Node.js official docs** — `crypto.createHmac`, `crypto.timingSafeEqual` API signatures and behavior
  [https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options]
- **Live Node.js v24.12.0 execution** — generateApprovalToken, verifyApprovalToken, URL encoding tests
  all run and verified in this session
- **Next.js official docs** — Edge Runtime API reference confirming node:crypto is NOT in edge,
  Node.js is the default runtime for route handlers
  [https://nextjs.org/docs/app/api-reference/edge]
- **PostgREST official docs** — AND/OR logical operators, operator syntax (lte, gte, or)
  [https://postgrest.org/en/stable/references/api/tables_views.html]

### SECONDARY (MEDIUM confidence — official/community sources, consistent with primary)

- **Supabase GitHub discussion #4812** — confirmed chained .gte()/.lte() for date range queries
  [https://github.com/supabase/supabase/discussions/4812]
- **W3tutorials PostgreSQL date comparison** — confirms YYYY-MM-DD lexicographic ordering
  [https://www.w3tutorials.net/blog/how-to-compare-dates-in-datetime-fields-in-postgresql/]
- **jshttp/basic-auth issue #39** — confirmed length-check-before-timingSafeEqual pattern
  [https://github.com/jshttp/basic-auth/issues/39]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `blackout_dates.start_date` and `end_date` are stored as TEXT (YYYY-MM-DD strings), not as Postgres DATE type | 1.2, 1.5 | If stored as DATE type, all the filter syntax still works — PostgREST accepts YYYY-MM-DD strings against DATE columns too, so there is no breakage either way |

No other assumed claims. All other findings are VERIFIED or CITED.

---

*Research for: Teacher Time-Off Request System — Approval Flow Security Patterns*
*Researched: 2026-05-21*
*Node.js version used for live verification: v24.12.0*
*@supabase/supabase-js installed version: ^2.99.0 (package.json)*
