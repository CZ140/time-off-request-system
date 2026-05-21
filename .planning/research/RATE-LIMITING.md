# Rate Limiting Research

**Researched:** 2026-05-21
**Domain:** Rate limiting for Next.js 15 App Router on Vercel — brute-force prevention and email flooding prevention
**Confidence:** HIGH (Vercel WAF limits verified from official docs; Upstash free tier verified from official pricing page; in-memory failure behavior is established serverless architecture fact)

---

## Summary

This project needs rate limiting for two endpoints with different threat models:

- `/admin/login` — a Server Action that checks a single shared password. Threat: brute-force guessing from one IP. Limit: ~5 attempts / 10 minutes per IP.
- `submitRequest` (teacher form POST) — a Server Action that triggers a Resend email. Threat: a single person submitting dozens of requests and flooding admin email. Limit: ~3–5 requests / hour per IP.

**Primary recommendation: Use Vercel WAF for `/admin/login` (zero code, zero cost, already available on Hobby) and Supabase Postgres for the teacher form (no new dependencies or accounts).** Upstash is the right call if Vercel WAF is insufficient or if the project ever needs programmatic rate limiting logic, but it adds a new external account. In-memory rate limiting must not be used.

---

## Option 1: Vercel WAF Rate Limiting

### What it is

Vercel's built-in Web Application Firewall, configured from the project's Firewall dashboard. Rules are applied at the CDN edge before requests reach any function — no code changes required.

[VERIFIED: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting — fetched 2026-05-21]
[VERIFIED: https://vercel.com/docs/plans/hobby — fetched 2026-05-21]

### Plan availability and limits

| Resource | Hobby (free) | Pro ($20/dev/mo) | Enterprise |
|----------|-------------|------------------|------------|
| Custom WAF rules | **Up to 3** | Up to 40 | Up to 1000 |
| Rate limiting available | **Yes** (as of May 23, 2025) | Yes | Yes |
| Counting keys | IP, JA4 Digest | IP, JA4 Digest | IP, JA4, User-Agent, custom headers |
| Counting algorithm | Fixed window only | Fixed window only | Fixed window + Token Bucket |
| Minimum window | 10 seconds | 10 seconds | 10 seconds |
| Maximum window | 10 minutes | 10 minutes | 1 hour |
| Included allowed requests | 1,000,000 / month | 1,000,000 / month | negotiated |
| Rate limit rules per project | 1 (from changelog) / 3 (from plan docs — use 3 as confirmed limit) | 40 | 1000 |

> **Note on rule count discrepancy:** The May 2025 changelog says "1 rate limit rule per project" for Hobby, but the current Hobby plan reference page (updated 2026-02-27) shows "Up to 3 custom WAF rules" with no special carve-out for rate limit rules. The plan page is more authoritative and more recent. [ASSUMED: the 3-rule count applies to rate limit rules; confirm in the Vercel dashboard before relying on this.]

### Configuration

Rules are set in the Vercel dashboard under Project > Firewall. No `vercel.json` or code changes. Each rule defines:

- **If conditions:** Path matching (e.g., path starts with `/admin/login`), method, etc.
- **Then action:** Rate Limit
- **Algorithm:** Fixed Window (Hobby/Pro)
- **Window:** 10s – 10min
- **Request limit:** e.g., 5 requests
- **Counting key:** IP Address

Rules take effect immediately on publish — no redeploy needed.

### Limitations for this project

1. **Fixed window only on Hobby/Pro.** Fixed window means a burst of requests at a window boundary can exceed the intended rate. For brute-force prevention (login), this is acceptable. For precise control, use Upstash's sliding window.
2. **Per-region counters.** The Vercel WAF tracks counts per edge region, not globally. A determined attacker using distributed IPs across regions could theoretically exceed the configured limit. For a small school use case, this is not a realistic threat.
3. **Cannot be applied to Server Actions by path alone.** Server Actions always POST to the page route (e.g., `/admin/login` for the login action, or the teacher form page URL for `submitRequest`). A WAF rule targeting `/admin/login` via POST will correctly catch the login action. For the teacher form Server Action, the POST path is the teacher form page — a WAF rule there would also block normal page loads if misconfigured. Careful path + method scoping is required.
4. **No programmatic logic.** Cannot check things like "this IP has already submitted today" — that requires application-level code.

### Cost

Free on Hobby within 1,000,000 allowed requests/month. A small school (~50 teachers) will never approach this limit.

### Verdict

**Good fit for `/admin/login`.** The login page is a single, well-defined path. A WAF rule of 5 requests / 10 minutes per IP is straightforward to configure, costs nothing, and requires zero code. Use this for v1.2.

**Questionable fit for the teacher form.** The teacher form Server Action posts to the form's page route. A WAF rule would block the entire page route on rate limit, including normal form loads. This is workable but blunt. The Supabase approach is more precise for this endpoint.

---

## Option 2: Upstash Redis + @upstash/ratelimit

### What it is

A managed serverless Redis service (Upstash) paired with `@upstash/ratelimit`, a rate limiting library designed specifically for Edge Runtime and serverless environments. The library uses Redis as shared state, solving the stateless node problem.

[VERIFIED: https://github.com/upstash/ratelimit-js — library designed for Edge Runtime, Vercel, Cloudflare Workers]
[VERIFIED: https://upstash.com/docs/redis/overall/pricing — 500K commands/month free tier]

### Setup cost

1. Create a free Upstash account and Redis database at console.upstash.com
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and Vercel dashboard
3. `npm install @upstash/ratelimit @upstash/redis`

Two new packages, one new external account.

### Free tier

| Metric | Free Tier |
|--------|-----------|
| Commands / month | 500,000 |
| Storage | 256 MB |
| Databases | 1 |
| Credit card required | No |
| Overage pricing | $0.20 / 100K commands |

For this school project: each rate-limit check costs ~2 Redis commands (read + conditional write). At 50 teachers submitting ~200 requests/year total, plus admin logins, usage will be well under 1,000 commands/month — far below the 500K free ceiling.

[VERIFIED: https://upstash.com/docs/redis/overall/pricing — fetched 2026-05-21]

### Edge Runtime compatibility

**Yes — explicitly designed for it.** The library uses the REST API (HTTP), not a TCP Redis connection, so it works in both Edge Runtime (middleware) and Node.js Runtime (Server Actions, Route Handlers).

[VERIFIED: https://upstash.com/blog/edge-rate-limiting — "specifically designed and tested for edge functions"]

### Available algorithms

| Algorithm | Use Case | Notes |
|-----------|----------|-------|
| `slidingWindow(N, "Xs")` | Smooth per-user rate limits | Best for login and form submission — no burst at window boundary |
| `fixedWindow(N, "Xs")` | Simple, lower Redis cost | Allows bursting at boundary |
| `tokenBucket(capacity, rate, "Xs")` | Traffic shaping with burst allowance | Most flexible |

### Example: middleware-based login rate limiting

```typescript
// middleware.ts — add BEFORE the iron-session check
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'), // 5 attempts per 10 minutes
  prefix: 'rl:login',
})

export async function middleware(request: NextRequest) {
  // Only rate-limit POST to the login page (Server Action submissions)
  if (
    request.nextUrl.pathname === '/admin/login' &&
    request.method === 'POST'
  ) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.ip
      ?? '127.0.0.1'

    const { success, remaining } = await loginRatelimit.limit(ip)

    if (!success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429 }
      )
    }
  }

  // ... existing iron-session check follows
}
```

### Example: Server Action-level rate limiting (teacher form)

```typescript
// app/actions/submitRequest.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { headers } from 'next/headers'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const formRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 submissions per hour per IP
  prefix: 'rl:form',
})

export async function submitRequest(formData: FormData) {
  'use server'

  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'

  const { success } = await formRatelimit.limit(ip)
  if (!success) {
    return { error: 'Too many submissions. Please wait before trying again.' }
  }

  // ... rest of form handling
}
```

> **Note on IP in Server Actions:** `headers()` in a Server Action returns the forwarded headers. On Vercel, `x-forwarded-for` contains the real client IP. This is reliable.

### Limitations

- New external account/dependency. For a simple school project, this is overhead.
- Free tier is 500K commands/month — well within limits for this use case.
- Requires environment variables in both `.env.local` and Vercel dashboard.

### Verdict

**Best technical solution if you want sliding window, programmatic control, and analytics.** The free tier is more than adequate. The cost is an Upstash account and two npm packages. Recommended for v1.2 if Vercel WAF alone feels insufficient or if you want error messages (not page-level blocks) on rate limit hits.

---

## Option 3: In-Memory Rate Limiting

### Why it fails on Vercel

In-memory rate limiting (e.g., a `Map<string, number[]>` module-level variable) works on a long-running server process. Vercel Serverless Functions and Edge Functions are stateless — each invocation may run on a different instance with its own empty memory.

- **Multiple instances run simultaneously.** A burst of 5 requests may be split across 5 instances, each seeing only 1 request — the in-memory counter never triggers.
- **Cold starts reset counters.** After a period of inactivity, the function instance is discarded. The counter returns to zero.
- **No shared state.** There is no mechanism for serverless function instances to share a module-level variable.

[VERIFIED: multiple sources confirm — each serverless instance runs in isolation with no shared memory]

### Do not use

```typescript
// THIS DOES NOT WORK ON VERCEL — do not implement
const attempts = new Map<string, number>() // resets on every cold start, not shared across instances
```

**Verdict: Never use this pattern on Vercel. Not viable for v1.x.**

---

## Option 4: Supabase Postgres Rate Limiting

### What it is

Use the existing Supabase database to track submission attempts. No new accounts, no new packages — just a table insert and a count query before processing.

### How it works

Track attempts in a Postgres table. Before processing the form or login, query the count for the IP in the last N minutes. If over the limit, reject.

### Table schema

```sql
-- Run in Supabase SQL Editor
CREATE TABLE rate_limit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key       text NOT NULL,          -- 'login:{ip}' or 'form:{ip}'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast count queries on (key, created_at)
CREATE INDEX rate_limit_log_key_time_idx ON rate_limit_log (key, created_at);

-- Auto-cleanup: delete entries older than 2 hours (run as a scheduled job or via pg_cron)
-- Without cleanup, this table grows unboundedly.
```

### Server Action pattern

```typescript
// lib/rateLimit.ts
import { createClient } from '@/lib/supabase/server'

/**
 * Returns true if the key has exceeded maxRequests in the last windowMinutes.
 * Inserts a new log entry on each call (counts the current attempt too).
 */
export async function isRateLimited(
  key: string,           // e.g. `login:${ip}` or `form:${ip}`
  maxRequests: number,   // e.g. 5 for login, 3 for form
  windowMinutes: number  // e.g. 10 for login, 60 for form
): Promise<boolean> {
  const supabase = await createClient()
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  // Count existing attempts in window
  const { count, error } = await supabase
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', windowStart)

  if (error) {
    // Fail open: if we can't check, allow the request (avoids blocking legitimate users on DB errors)
    console.error('Rate limit check failed:', error)
    return false
  }

  if ((count ?? 0) >= maxRequests) {
    return true // Rate limited — do NOT insert (don't inflate the count)
  }

  // Log this attempt
  await supabase.from('rate_limit_log').insert({ key })

  return false
}
```

```typescript
// Usage in the login Server Action
import { isRateLimited } from '@/lib/rateLimit'
import { headers } from 'next/headers'

export async function loginAction(formData: FormData) {
  'use server'

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (await isRateLimited(`login:${ip}`, 5, 10)) {
    return { error: 'Too many login attempts. Please wait 10 minutes.' }
  }

  // ... password check
}
```

```typescript
// Usage in the teacher form Server Action
export async function submitRequest(formData: FormData) {
  'use server'

  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (await isRateLimited(`form:${ip}`, 3, 60)) {
    return { error: 'You have submitted too many requests. Please wait before trying again.' }
  }

  // ... form processing
}
```

### Limitations

1. **Adds a Supabase query to every request.** Two queries per check (count + insert). This is ~20–50ms additional latency — acceptable for a form submission, trivial for a school with 50 teachers.
2. **No cleanup without a scheduled job.** Supabase's free plan does not include pg_cron. The table will grow over time. Mitigations:
   - Add a manual cleanup step in the Server Action: delete rows older than 2 hours after the insert.
   - Accept the growth (50 teachers submitting a few times per year = negligible row count).
   - Use Supabase's dashboard to manually truncate periodically.
3. **Not resistant to very high-volume attacks.** Under a DDoS, each attacker request hits your database. For a small school, this is not a realistic threat. For a public-facing consumer app, use Vercel WAF or Upstash at the edge instead.
4. **Fails open on DB errors.** The pattern above fails open (allows the request if the DB is unreachable). This is the right default for a school — better to let a submission through than to block a teacher with a DB hiccup. Change to fail closed for the login endpoint if you prefer.

### Self-cleanup variant (avoids pg_cron)

```typescript
// Add this after the insert to keep the table tidy without a cron job:
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
await supabase
  .from('rate_limit_log')
  .delete()
  .lt('created_at', twoHoursAgo)
// Fire-and-forget — don't await in the critical path:
// supabase.from('rate_limit_log').delete().lt('created_at', twoHoursAgo)
```

### Verdict

**Best fit for the teacher form (`submitRequest`).** No new accounts, no new packages — just a table and a helper function. Works in Server Actions (Node.js runtime). For a school with ~50 teachers, the table remains tiny forever. This is the recommended approach for `submitRequest` in v1.2.

**Acceptable but not ideal for `/admin/login`.** Adds DB latency to every login attempt. The Vercel WAF approach is cleaner for login since it blocks at the edge before the function runs. If you only want one approach for simplicity, the Supabase pattern covers both endpoints.

---

## Comparison Table

| Approach | Works on Vercel? | New dependency? | New account? | Edge-level block? | Sliding window? | Best for |
|----------|-----------------|-----------------|--------------|-------------------|-----------------|----------|
| Vercel WAF | Yes | No | No | Yes | No (fixed only) | `/admin/login` |
| Upstash + @upstash/ratelimit | Yes | Yes (2 packages) | Yes (Upstash) | Yes (if in middleware) | Yes | Either endpoint, with sliding window |
| In-memory Map | No — broken on Vercel | No | No | No | — | Never use |
| Supabase Postgres | Yes | No | No | No (function-level) | Approximates it | Teacher form Server Action |

---

## Concrete Recommendation for This Project

**Use both Vercel WAF and Supabase — not Upstash.**

### For `/admin/login` — Vercel WAF

Configure one WAF rule in the Vercel dashboard:

- **Condition:** Path equals `/admin/login` AND method is `POST`
- **Action:** Rate Limit
- **Algorithm:** Fixed Window
- **Window:** 10 minutes
- **Limit:** 5 requests
- **Key:** IP Address
- **Response:** 429 (default)

This runs at the CDN edge before the Server Action executes. Zero code changes. Free on Hobby. Takes 5 minutes to configure. The 1 WAF rule used here leaves 2 remaining Hobby rules for other uses.

### For `submitRequest` (teacher form) — Supabase Postgres

Add a `rate_limit_log` table and the `isRateLimited()` helper function. Call it at the top of the `submitRequest` Server Action before any email or database writes.

- **Limit:** 3 submissions per 60 minutes per IP
- **No new packages required**
- **Integrates naturally with the existing Supabase client**

### Why not Upstash?

Upstash is the right answer for a production SaaS with high traffic. For a small school with ~50 known teachers, the Supabase approach is simpler to operate, adds no new accounts, and has zero ongoing cost. The table will never be large enough to matter.

### Why not Vercel WAF for both?

WAF blocks at the route level — it returns a 429 and prevents the Server Action from running at all. For the login page, that's fine (you'd show a generic error page or the 429 response). For the teacher form, blocking the entire POST would prevent the user from seeing a friendly error message from `useActionState`. The Supabase approach returns a structured error the form can display.

---

## Implementation Checklist for v1.2

- [ ] Create `rate_limit_log` table in Supabase (SQL migration)
- [ ] Create `lib/rateLimit.ts` with `isRateLimited()` helper
- [ ] Add rate limit check to `submitRequest` Server Action (first line, before validation)
- [ ] Add rate limit check to `loginAction` Server Action (optional — WAF covers login at the edge, but defense-in-depth is fine)
- [ ] Configure Vercel WAF rule for `/admin/login` POST in Vercel dashboard
- [ ] Decide on table cleanup strategy (self-cleanup vs. accept growth vs. pg_cron on paid Supabase)
- [ ] Add `RATE_LIMIT_FAIL_OPEN=true` consideration to ops runbook

---

## Sources

### Primary (HIGH confidence — verified via official docs fetched this session)

- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) — plan limits, algorithms, counting keys, window ranges
- [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby) — confirmed "Up to 3 custom WAF rules" on Hobby; page last updated 2026-02-27
- [Rate limiting now available on Hobby](https://vercel.com/changelog/rate-limiting-now-available-on-hobby-with-higher-included-usage-on-pro) — May 23, 2025 changelog confirming feature availability
- [Upstash Redis Pricing](https://upstash.com/docs/redis/overall/pricing) — 500K commands/month free tier, 256MB storage
- [Upstash Edge Rate Limiting blog](https://upstash.com/blog/edge-rate-limiting) — middleware code pattern, Edge Runtime confirmation
- [Upstash ratelimit-js GitHub](https://github.com/upstash/ratelimit-js) — package name, environment variables, algorithm list

### Secondary (MEDIUM confidence — community/official sources, consistent with primary)

- [Vercel KB: Add Rate Limiting](https://vercel.com/kb/guide/add-rate-limiting-vercel) — WAF dashboard + `@vercel/firewall` SDK overview
- [Vercel KB: Limit Abuse with Rate Limiting](https://vercel.com/kb/guide/limit-abuse-with-rate-limiting) — login-specific WAF rule recipe (10 req / 60s per IP example)
- [Supabase Postgres rate limiting via pgheaderkit](https://blog.mansueli.com/rate-limiting-supabase-requests-with-postgresql-and-pgheaderkit) — UNLOGGED table pattern, INSERT-based tracking
- [Next.js discussion: using Upstash in Server Actions](https://github.com/vercel/next.js/discussions/62178) — `headers()` for IP in Server Actions confirmed

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | Hobby plan allows up to 3 rate limit rules (plan page says "3 custom WAF rules"; changelog says "1 rate limit rule"). The plan page (2026-02-27) is used as authoritative. | If only 1 rate limit rule is available on Hobby, the WAF approach still covers `/admin/login`; the teacher form falls back to the Supabase approach anyway. No material impact on recommendation. |
| A2 | `x-forwarded-for` is reliably set by Vercel for Server Actions running on Vercel infrastructure | If wrong, the `ip` variable falls back to `'unknown'` — all unknown-IP requests share one rate limit bucket, which is overly conservative but not broken |
| A3 | Supabase free plan does not include pg_cron | If wrong, automatic cleanup is available; the self-cleanup approach in the code is still harmless |

---

*Rate limiting research for: Teacher Time-Off Request System — v1.2 scoping*
*Researched: 2026-05-21*
