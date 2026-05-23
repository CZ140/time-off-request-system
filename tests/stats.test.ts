// tests/stats.test.ts
// Unit tests for the pure stats compute function. No I/O, no mocks beyond
// the helper that builds synthetic request rows.
import { describe, it, expect } from 'vitest'
import { computeStats } from '@/lib/stats'
import type { Database, LeaveType, RequestStatus } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']

// Fixed clock for deterministic tests. Wednesday, 2026-05-13 noon UTC.
const NOW_MS = new Date('2026-05-13T12:00:00Z').getTime()

let counter = 0

function row(overrides: Partial<RequestRow> = {}): RequestRow {
  counter++
  const base: RequestRow = {
    id: `id-${counter}`,
    teacher_name: 'Test Teacher',
    teacher_email: `teacher${counter}@school.edu`,
    leave_type: 'sick' as LeaveType,
    start_date: '2026-05-15',
    end_date: '2026-05-15',
    reason: null,
    is_blackout: false,
    status: 'pending' as RequestStatus,
    submitted_at: new Date(NOW_MS - 86_400_000).toISOString(), // 1 day ago
    reviewed_at: null,
    reviewed_by: null,
  }
  return { ...base, ...overrides }
}

describe('computeStats', () => {
  it('returns zero/null on empty input', () => {
    const stats = computeStats([], { range: 'all', now: NOW_MS })
    expect(stats.totalRequests).toBe(0)
    expect(stats.statusCounts).toEqual({ pending: 0, approved: 0, denied: 0, auto_denied: 0 })
    expect(stats.topSubmitters).toEqual([])
    expect(stats.approvalRate).toBeNull()
    expect(stats.autoDenialRate).toBeNull()
    expect(stats.averageReviewHours).toBeNull()
    expect(stats.stalePendingCount).toBe(0)
    expect(stats.monthlyTimeline).toHaveLength(12)
  })

  it('counts statuses correctly', () => {
    const stats = computeStats(
      [
        row({ status: 'pending' }),
        row({ status: 'pending' }),
        row({ status: 'approved' }),
        row({ status: 'denied' }),
        row({ status: 'auto_denied' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.statusCounts).toEqual({ pending: 2, approved: 1, denied: 1, auto_denied: 1 })
  })

  it('computes approval rate as approved / (approved + denied), ignores auto_denied', () => {
    const stats = computeStats(
      [
        row({ status: 'approved' }),
        row({ status: 'approved' }),
        row({ status: 'approved' }),
        row({ status: 'denied' }),
        row({ status: 'auto_denied' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.approvalRate).toBeCloseTo(3 / 4)
  })

  it('returns null approval rate when denominator is zero', () => {
    const stats = computeStats(
      [row({ status: 'pending' }), row({ status: 'auto_denied' })],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.approvalRate).toBeNull()
  })

  it('computes auto-denial rate over total in range', () => {
    const stats = computeStats(
      [
        row({ status: 'auto_denied' }),
        row({ status: 'approved' }),
        row({ status: 'denied' }),
        row({ status: 'pending' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.autoDenialRate).toBeCloseTo(1 / 4)
  })

  it('ranks top submitters by count, descending, capped at 5', () => {
    const rows: RequestRow[] = []
    // 6 distinct submitters, counts 6/5/4/3/2/1
    const counts = [6, 5, 4, 3, 2, 1]
    counts.forEach((n, i) => {
      for (let k = 0; k < n; k++) {
        rows.push(row({ teacher_email: `t${i}@school.edu` }))
      }
    })
    const stats = computeStats(rows, { range: 'all', now: NOW_MS })
    expect(stats.topSubmitters).toHaveLength(5)
    expect(stats.topSubmitters[0]).toEqual({ email: 't0@school.edu', count: 6 })
    expect(stats.topSubmitters[4]).toEqual({ email: 't4@school.edu', count: 2 })
  })

  it('treats teacher_email case-insensitively for submitter ranking', () => {
    const stats = computeStats(
      [
        row({ teacher_email: 'Alice@school.edu' }),
        row({ teacher_email: 'ALICE@school.edu' }),
        row({ teacher_email: 'alice@school.edu' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.topSubmitters).toEqual([{ email: 'alice@school.edu', count: 3 }])
  })

  it('computes average review time in hours, skipping pending and auto-denied', () => {
    const stats = computeStats(
      [
        // 2 hours
        row({
          status: 'approved',
          submitted_at: new Date(NOW_MS - 4 * 3_600_000).toISOString(),
          reviewed_at: new Date(NOW_MS - 2 * 3_600_000).toISOString(),
        }),
        // 6 hours
        row({
          status: 'denied',
          submitted_at: new Date(NOW_MS - 10 * 3_600_000).toISOString(),
          reviewed_at: new Date(NOW_MS - 4 * 3_600_000).toISOString(),
        }),
        // Excluded — pending
        row({
          status: 'pending',
          submitted_at: new Date(NOW_MS - 8 * 3_600_000).toISOString(),
        }),
        // Excluded — auto-denied
        row({
          status: 'auto_denied',
          submitted_at: new Date(NOW_MS - 100 * 3_600_000).toISOString(),
          reviewed_at: new Date(NOW_MS - 50 * 3_600_000).toISOString(),
        }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.averageReviewHours).toBeCloseTo(4)
  })

  it('buckets lead time by days between submission and start_date', () => {
    const stats = computeStats(
      [
        // submitted same day as start (lead = 0)
        row({ submitted_at: '2026-05-15T08:00:00Z', start_date: '2026-05-15' }),
        // submitted 2 days before start
        row({ submitted_at: '2026-05-13T08:00:00Z', start_date: '2026-05-15' }),
        // submitted 5 days before start
        row({ submitted_at: '2026-05-10T08:00:00Z', start_date: '2026-05-15' }),
        // submitted 20 days before start
        row({ submitted_at: '2026-04-25T08:00:00Z', start_date: '2026-05-15' }),
        // submitted 60 days before start
        row({ submitted_at: '2026-03-16T08:00:00Z', start_date: '2026-05-15' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.leadTimeBuckets.same_day).toBe(1)
    expect(stats.leadTimeBuckets.d1_d3).toBe(1)
    expect(stats.leadTimeBuckets.d4_d7).toBe(1)
    expect(stats.leadTimeBuckets.w1_w4).toBe(1)
    expect(stats.leadTimeBuckets.m1_plus).toBe(1)
  })

  it('counts only pending rows older than 48 hours as stale', () => {
    const stats = computeStats(
      [
        // Pending, 72h old → stale
        row({ status: 'pending', submitted_at: new Date(NOW_MS - 72 * 3_600_000).toISOString() }),
        // Pending, 24h old → not stale
        row({ status: 'pending', submitted_at: new Date(NOW_MS - 24 * 3_600_000).toISOString() }),
        // Approved, 100h old → not pending so not counted
        row({ status: 'approved', submitted_at: new Date(NOW_MS - 100 * 3_600_000).toISOString() }),
      ],
      { range: 'all', now: NOW_MS },
    )
    expect(stats.stalePendingCount).toBe(1)
  })

  it('filters by range cutoff for in-range metrics, but stale uses all rows', () => {
    const stats = computeStats(
      [
        // 200 days old, pending — outside 90-day range but still counted as stale
        row({ status: 'pending', submitted_at: new Date(NOW_MS - 200 * 86_400_000).toISOString() }),
        // 10 days old, approved — counts in 90-day range
        row({ status: 'approved', submitted_at: new Date(NOW_MS - 10 * 86_400_000).toISOString() }),
      ],
      { range: 90, now: NOW_MS },
    )
    expect(stats.totalRequests).toBe(1)
    expect(stats.statusCounts.approved).toBe(1)
    expect(stats.stalePendingCount).toBe(1)
  })

  it('builds 12-month timeline anchored to current month', () => {
    const stats = computeStats([], { range: 'all', now: NOW_MS })
    expect(stats.monthlyTimeline).toHaveLength(12)
    // Last bucket should be the current calendar month label
    const expectedLast = new Date(NOW_MS).toLocaleDateString('en-US', { month: 'short' })
    expect(stats.monthlyTimeline[11].label).toBe(expectedLast)
  })

  it('counts submissions into their calendar-month bucket', () => {
    const stats = computeStats(
      [
        row({ submitted_at: '2026-05-01T10:00:00Z' }),
        row({ submitted_at: '2026-05-08T10:00:00Z' }),
        row({ submitted_at: '2026-04-20T10:00:00Z' }),
      ],
      { range: 'all', now: NOW_MS },
    )
    const may = stats.monthlyTimeline.find((b) => b.label === 'May')
    const apr = stats.monthlyTimeline.find((b) => b.label === 'Apr')
    expect(may?.count).toBe(2)
    expect(apr?.count).toBe(1)
  })
})
