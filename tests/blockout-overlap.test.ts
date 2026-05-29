// tests/blockout-overlap.test.ts
// Tests for the date-overlap logic used in the server-side blockout check.
// The Supabase query uses: .lte('start_date', requestEnd).gte('end_date', requestStart)
// This file tests the overlap condition as a pure function — the same logic
// the DB query enforces, but runnable without a live Supabase connection.
import { describe, it, expect } from 'vitest'

// The overlap condition: blockout overlaps request when
//   blockout.start_date <= request.end_date  AND  blockout.end_date >= request.start_date
function overlaps(
  blockoutStart: string,
  blockoutEnd: string,
  requestStart: string,
  requestEnd: string
): boolean {
  return blockoutStart <= requestEnd && blockoutEnd >= requestStart
}

describe('blockout date overlap detection', () => {
  it('full overlap — request is entirely within blockout', () => {
    expect(overlaps('2026-04-01', '2026-04-10', '2026-04-03', '2026-04-07')).toBe(true)
  })

  it('no overlap — request is entirely before blockout', () => {
    expect(overlaps('2026-04-10', '2026-04-20', '2026-04-01', '2026-04-05')).toBe(false)
  })

  it('no overlap — request is entirely after blockout', () => {
    expect(overlaps('2026-04-01', '2026-04-05', '2026-04-10', '2026-04-15')).toBe(false)
  })

  it('adjacent dates — request ends on blockout start day (touching, no gap)', () => {
    // blockout starts 04-10, request ends 04-10 — they share a day, so they overlap
    expect(overlaps('2026-04-10', '2026-04-20', '2026-04-05', '2026-04-10')).toBe(true)
  })

  it('adjacent dates — request starts on blockout end day (touching, no gap)', () => {
    // blockout ends 04-05, request starts 04-05 — they share a day, so they overlap
    expect(overlaps('2026-04-01', '2026-04-05', '2026-04-05', '2026-04-10')).toBe(true)
  })

  it('partial overlap — request starts before blockout but ends inside it', () => {
    expect(overlaps('2026-04-10', '2026-04-20', '2026-04-05', '2026-04-15')).toBe(true)
  })

  it('partial overlap — request starts inside blockout and extends past it', () => {
    expect(overlaps('2026-04-01', '2026-04-10', '2026-04-08', '2026-04-15')).toBe(true)
  })

  it('blockout is a single day and request includes that day', () => {
    expect(overlaps('2026-04-15', '2026-04-15', '2026-04-14', '2026-04-16')).toBe(true)
  })

  it('blockout is a single day and request is exactly that day', () => {
    expect(overlaps('2026-04-15', '2026-04-15', '2026-04-15', '2026-04-15')).toBe(true)
  })

  it('blockout is a single day and request misses it by one day (before)', () => {
    expect(overlaps('2026-04-15', '2026-04-15', '2026-04-13', '2026-04-14')).toBe(false)
  })

  it('blockout is a single day and request misses it by one day (after)', () => {
    expect(overlaps('2026-04-15', '2026-04-15', '2026-04-16', '2026-04-17')).toBe(false)
  })
})
