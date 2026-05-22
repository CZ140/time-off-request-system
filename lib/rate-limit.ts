// lib/rate-limit.ts
// Supabase-backed rolling-window rate limiter.
//
// Why Supabase (not in-memory): Vercel functions are stateless and can scale
// horizontally — an in-memory counter would let each instance grant the full
// per-key budget independently. For a single-school deployment the practical
// impact is small, but the DB-backed version is cheap (one row per action,
// one COUNT per check) and correct under scaling.
//
// Why not Redis: requirement of the production-hardening plan was no Redis.
//
// Window semantics: rolling, not fixed bucket. We count rows where
// occurred_at > now() - interval (in seconds). Each successful check writes
// a new row. This is more forgiving than fixed buckets at boundaries (a user
// can't burn the whole budget at 00:59 and again at 01:00).
//
// Cleanup: this module does NOT delete old rows — see the migration comment
// for the recommended one-line cleanup query to run periodically.
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Check whether `key` has been used `max` or more times within the rolling
 * `windowSeconds` window. If under the limit, atomically logs this usage and
 * returns allowed:true. If over, returns allowed:false WITHOUT logging.
 *
 * Note: not transactional. Under heavy concurrent load (multiple in-flight
 * checks for the same key arriving within milliseconds) a small overshoot
 * is possible. For the threat model here (slowing down forms-spam bots and
 * an angry teacher mashing the submit button) this is acceptable.
 */
export async function checkAndLogRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const supabase = createClient()
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count, error: countError } = await supabase
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .gte('occurred_at', since)

  if (countError) {
    // Fail OPEN on rate-limit infra errors. The opposite (fail closed) would
    // mean a DB hiccup locks every user out, which is worse than letting one
    // extra request through during an outage. The error is logged and shows
    // up in Vercel logs for operators to investigate.
    console.error('[rate-limit] count query failed:', countError)
    return { allowed: true }
  }

  if ((count ?? 0) >= max) {
    // Approximate retry-after: the window length is the worst case. A more
    // precise value would require reading the oldest row in the window, but
    // for the UI message "try again in an hour" the window length is fine.
    return { allowed: false, retryAfterSeconds: windowSeconds }
  }

  const { error: insertError } = await supabase
    .from('rate_limit_log')
    .insert({ key })

  if (insertError) {
    // Fail open here too — the action proceeds, we just lose this row.
    console.error('[rate-limit] insert failed:', insertError)
  }

  return { allowed: true }
}

/**
 * Best-effort caller IP for use as a rate-limit key. Reads x-forwarded-for
 * (set by Vercel and most reverse proxies) and falls back to x-real-ip.
 * Returns 'unknown' if neither is present (local dev without a proxy).
 */
export function getCallerIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    // x-forwarded-for can be "client, proxy1, proxy2" — first entry is the
    // original client IP, last entries are intermediaries.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const xri = headers.get('x-real-ip')
  if (xri) return xri.trim()
  return 'unknown'
}
