// lib/calendar-grid.ts
// Pure helpers for the admin Calendar tab. No I/O, no React.

import type { Database } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']

// A single cell on the calendar grid.
export type GridCell = {
  date: Date
  iso: string // YYYY-MM-DD (local)
  inMonth: boolean
  isToday: boolean
}

// Build a 6×7 grid of dates anchored to `year`/`month`. Always 6 rows so the
// visual layout doesn't jump between 5-row and 6-row months. Week starts on
// Sunday to match US school-calendar convention.
//
// `month` is 0-indexed (matches Date#getMonth).
export function monthGrid(year: number, month: number, today: Date = new Date()): GridCell[][] {
  const firstOfMonth = new Date(year, month, 1)
  const weekdayOfFirst = firstOfMonth.getDay() // 0=Sun .. 6=Sat
  const gridStart = new Date(year, month, 1 - weekdayOfFirst)

  const todayKey = isoLocal(today)

  const rows: GridCell[][] = []
  for (let r = 0; r < 6; r++) {
    const row: GridCell[] = []
    for (let c = 0; c < 7; c++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + r * 7 + c)
      const iso = isoLocal(d)
      row.push({
        date: d,
        iso,
        inMonth: d.getMonth() === month,
        isToday: iso === todayKey,
      })
    }
    rows.push(row)
  }
  return rows
}

// Local-date ISO key (YYYY-MM-DD), independent of timezone offsets. Used as
// the map key when grouping requests/blackouts per cell.
export function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Build a date-keyed index of which requests and blackouts overlap each day.
// Inclusive overlap on both ends — a request from 2026-05-10 → 2026-05-12
// covers all three of those days.
//
// Statuses considered for the calendar: only 'approved' and 'pending'. The
// other statuses ('denied', 'auto_denied') represent leave that is NOT going
// to happen, so they would only confuse coverage planning.
export type DayBucket = {
  requests: RequestRow[]
  blackouts: BlackoutDateRow[]
}

export function indexByDay(
  requests: RequestRow[],
  blackouts: BlackoutDateRow[],
): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>()
  const bucketFor = (iso: string): DayBucket => {
    let b = map.get(iso)
    if (!b) {
      b = { requests: [], blackouts: [] }
      map.set(iso, b)
    }
    return b
  }

  for (const r of requests) {
    if (r.status !== 'approved' && r.status !== 'pending') continue
    for (const iso of datesInRange(r.start_date, r.end_date)) {
      bucketFor(iso).requests.push(r)
    }
  }
  for (const b of blackouts) {
    for (const iso of datesInRange(b.start_date, b.end_date)) {
      bucketFor(iso).blackouts.push(b)
    }
  }
  return map
}

// Inclusive date range iterator yielding YYYY-MM-DD strings.
function* datesInRange(start: string, end: string): Generator<string> {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (e < s) return // Defensive: don't iterate backwards.
  const cur = new Date(s)
  while (cur <= e) {
    yield isoLocal(cur)
    cur.setDate(cur.getDate() + 1)
  }
}

// "May 2026"
export function monthYearLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Step a (year, month) tuple by +1 or -1 month, handling year rollover.
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

// Last name extracted from a "Firstname Lastname" or single-name string.
export function lastNameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1] || fullName
}
