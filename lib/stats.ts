// lib/stats.ts
// Pure stats compute for the admin dashboard's Stats tab.
//
// Deviates from the original plan (which proposed a SQL RPC) — for a small-
// school dataset (a few dozen rows lifetime) the entire requests list is
// already loaded on the dashboard, so a client-side compute is faster to ship
// and easier to test. Swap to an RPC later if the row count grows past a few
// thousand and the dashboard starts paying a perf cost loading everything.
import type { Database, LeaveType, RequestStatus } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']

export type StatsRange = 30 | 90 | 365 | 'all'

export type LeadTimeBucket =
  | 'same_day'
  | 'd1_d3'
  | 'd4_d7'
  | 'w1_w4'
  | 'm1_plus'

export type Stats = {
  // How many rows the calculation considered (within the date range).
  totalRequests: number

  // Counts by status (always non-negative).
  statusCounts: Record<RequestStatus, number>

  // Counts by leave_type. Map keys are the enum literals.
  leaveTypeCounts: Record<string, number>

  // Top submitters by email, descending. Capped at top 5.
  topSubmitters: { email: string; count: number }[]

  // Approval rate = approved / (approved + denied). Null when denominator is 0.
  approvalRate: number | null

  // Auto-denied / total. Null when totalRequests is 0.
  autoDenialRate: number | null

  // Mean hours between submitted_at and reviewed_at for non-auto-denied,
  // non-pending rows. Null when there are no such rows.
  averageReviewHours: number | null

  // Buckets of days between submitted_at and start_date.
  leadTimeBuckets: Record<LeadTimeBucket, number>

  // Count of pending rows older than 48 hours from `now`.
  stalePendingCount: number

  // 12-element array (oldest → most recent month) of total submissions per
  // calendar month. Not gated by the range filter — always shows the last year.
  monthlyTimeline: { label: string; count: number }[]
}

// Cutoff in millis from "now" for each range. 'all' means no filter.
function rangeCutoffMs(range: StatsRange, now: number): number | null {
  if (range === 'all') return null
  return now - range * 86_400_000
}

const EMPTY_STATUS_COUNTS: Record<RequestStatus, number> = {
  pending: 0,
  approved: 0,
  denied: 0,
  auto_denied: 0,
}

const EMPTY_LEAD_BUCKETS: Record<LeadTimeBucket, number> = {
  same_day: 0,
  d1_d3: 0,
  d4_d7: 0,
  w1_w4: 0,
  m1_plus: 0,
}

function leadTimeBucketFor(days: number): LeadTimeBucket {
  if (days <= 0) return 'same_day'
  if (days <= 3) return 'd1_d3'
  if (days <= 7) return 'd4_d7'
  if (days <= 28) return 'w1_w4'
  return 'm1_plus'
}

// `now` is injected so the function is deterministic and testable. The dashboard
// passes Date.now() when calling at render time.
export function computeStats(
  requests: RequestRow[],
  options: { range: StatsRange; now: number },
): Stats {
  const { range, now } = options
  const cutoff = rangeCutoffMs(range, now)

  const inRange = cutoff === null
    ? requests
    : requests.filter((r) => new Date(r.submitted_at).getTime() >= cutoff)

  const statusCounts: Record<RequestStatus, number> = { ...EMPTY_STATUS_COUNTS }
  const leaveTypeCounts: Record<string, number> = {}
  const submitterMap = new Map<string, number>()
  const leadTimeBuckets: Record<LeadTimeBucket, number> = { ...EMPTY_LEAD_BUCKETS }

  let reviewHoursSum = 0
  let reviewHoursCount = 0

  for (const r of inRange) {
    statusCounts[r.status]++

    leaveTypeCounts[r.leave_type] = (leaveTypeCounts[r.leave_type] ?? 0) + 1

    const email = r.teacher_email.toLowerCase()
    submitterMap.set(email, (submitterMap.get(email) ?? 0) + 1)

    // Lead time: days between submission and the requested start_date. Use
    // calendar-day rounding rather than 24-hour chunks so 'same day' actually
    // catches submissions made the morning of the requested leave.
    const submittedDayMs = startOfDayMs(r.submitted_at)
    const startDayMs = startOfLocalDateMs(r.start_date)
    const days = Math.round((startDayMs - submittedDayMs) / 86_400_000)
    leadTimeBuckets[leadTimeBucketFor(days)]++

    if (r.reviewed_at && r.status !== 'auto_denied' && r.status !== 'pending') {
      const submittedMs = new Date(r.submitted_at).getTime()
      const reviewedMs = new Date(r.reviewed_at).getTime()
      const hours = (reviewedMs - submittedMs) / 3_600_000
      if (hours >= 0) {
        reviewHoursSum += hours
        reviewHoursCount++
      }
    }
  }

  const topSubmitters = Array.from(submitterMap.entries())
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email))
    .slice(0, 5)

  const approvedPlusDenied = statusCounts.approved + statusCounts.denied
  const approvalRate = approvedPlusDenied === 0 ? null : statusCounts.approved / approvedPlusDenied

  const autoDenialRate = inRange.length === 0 ? null : statusCounts.auto_denied / inRange.length

  const averageReviewHours = reviewHoursCount === 0 ? null : reviewHoursSum / reviewHoursCount

  // Stale pending — pending rows older than 48 hours. Surfaces admin slowness
  // regardless of selected range, so we count from the full requests list, not
  // just inRange. Reasonable for a small dataset.
  const STALE_THRESHOLD_MS = 48 * 3_600_000
  const stalePendingCount = requests.filter(
    (r) => r.status === 'pending' && now - new Date(r.submitted_at).getTime() > STALE_THRESHOLD_MS,
  ).length

  const monthlyTimeline = buildMonthlyTimeline(requests, now)

  return {
    totalRequests: inRange.length,
    statusCounts,
    leaveTypeCounts,
    topSubmitters,
    approvalRate,
    autoDenialRate,
    averageReviewHours,
    leadTimeBuckets,
    stalePendingCount,
    monthlyTimeline,
  }
}

// Convert a timestamp string to the millisecond value at local start-of-day.
function startOfDayMs(iso: string): number {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Convert a date-only string (YYYY-MM-DD) to local start-of-day ms.
// Important: 'T00:00:00' parses as LOCAL time, not UTC — same fix as formatDate.
function startOfLocalDateMs(dateOnly: string): number {
  return new Date(dateOnly + 'T00:00:00').getTime()
}

// 12 months of buckets, oldest → newest, anchored to `now`'s calendar month.
function buildMonthlyTimeline(
  requests: RequestRow[],
  now: number,
): { label: string; count: number }[] {
  const buckets: { label: string; year: number; month: number; count: number }[] = []
  const nowDate = new Date(now)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
    buckets.push({
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
      count: 0,
    })
  }

  // Oldest bucket cutoff — anything before this is irrelevant.
  const earliest = new Date(buckets[0].year, buckets[0].month, 1).getTime()

  for (const r of requests) {
    const t = new Date(r.submitted_at).getTime()
    if (t < earliest) continue
    const d = new Date(r.submitted_at)
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth())
    if (bucket) bucket.count++
  }

  return buckets.map((b) => ({ label: b.label, count: b.count }))
}

// Display label for a lead-time bucket key.
export const LEAD_TIME_LABELS: Record<LeadTimeBucket, string> = {
  same_day: 'Same day',
  d1_d3: '1–3 days',
  d4_d7: '4–7 days',
  w1_w4: '1–4 weeks',
  m1_plus: '1+ month',
}

// Display label for a leave type key. Re-export here so the StatsTab doesn't
// need to know that the canonical map lives in lib/email/utils.ts. The two are
// kept aligned by the LeaveType union.
export function leaveTypeLabel(value: LeaveType, fallback: Record<LeaveType, string>): string {
  return fallback[value] ?? value
}
