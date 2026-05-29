// tests/calendar-grid.test.ts
import { describe, it, expect } from 'vitest'
import {
  monthGrid,
  isoLocal,
  indexByDay,
  shiftMonth,
  lastNameOf,
  monthYearLabel,
} from '@/lib/calendar-grid'
import type { Database, LeaveType, RequestStatus } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlockoutDateRow = Database['public']['Tables']['blockout_dates']['Row']

function r(overrides: Partial<RequestRow>): RequestRow {
  return {
    id: 'id',
    teacher_name: 'Test',
    teacher_email: 't@school.edu',
    leave_type: 'sick' as LeaveType,
    start_date: '2026-05-01',
    end_date: '2026-05-01',
    reason: null,
    is_blockout: false,
    status: 'approved' as RequestStatus,
    submitted_at: '2026-04-01T00:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    calendar_event_id: null,
    calendar_provider: null,
    ...overrides,
  }
}

function b(overrides: Partial<BlockoutDateRow>): BlockoutDateRow {
  return {
    id: 'b',
    label: 'Range',
    start_date: '2026-05-01',
    end_date: '2026-05-01',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('monthGrid', () => {
  it('returns 6 rows × 7 cols', () => {
    const grid = monthGrid(2026, 4) // May 2026
    expect(grid).toHaveLength(6)
    grid.forEach((row) => expect(row).toHaveLength(7))
  })

  it('starts the visible week before the 1st when needed', () => {
    // May 1, 2026 is a Friday — the first row should start on Sunday Apr 26.
    const grid = monthGrid(2026, 4)
    expect(grid[0][0].iso).toBe('2026-04-26')
    expect(grid[0][0].inMonth).toBe(false)
  })

  it('marks today only when it equals the actual current date', () => {
    const fakeToday = new Date(2026, 4, 13)
    const grid = monthGrid(2026, 4, fakeToday)
    const flat = grid.flat()
    const todays = flat.filter((c) => c.isToday)
    expect(todays).toHaveLength(1)
    expect(todays[0].iso).toBe('2026-05-13')
  })

  it('handles a month that starts on Sunday with no overflow row', () => {
    // March 2026 starts on Sunday — grid still has 6 rows for layout consistency.
    const grid = monthGrid(2026, 2, new Date(2026, 2, 1))
    expect(grid[0][0].iso).toBe('2026-03-01')
    expect(grid[0][0].inMonth).toBe(true)
    expect(grid).toHaveLength(6)
  })

  it('handles a month that ends on Saturday cleanly', () => {
    // August 2026 ends on Sunday — covers the trailing-edge case.
    const grid = monthGrid(2026, 7, new Date(2026, 7, 1))
    const last = grid[grid.length - 1][6]
    // Last cell is in September (overflow), not August.
    expect(last.inMonth).toBe(false)
    expect(last.date.getMonth()).toBe(8)
  })

  it('handles February in a leap year', () => {
    // 2028 is a leap year — Feb has 29 days.
    const grid = monthGrid(2028, 1, new Date(2028, 1, 1))
    const flat = grid.flat()
    const inFeb = flat.filter((c) => c.inMonth)
    expect(inFeb).toHaveLength(29)
  })
})

describe('indexByDay', () => {
  it('puts a single-day request on that one day', () => {
    const idx = indexByDay([r({ start_date: '2026-05-10', end_date: '2026-05-10' })], [])
    expect(idx.get('2026-05-10')?.requests).toHaveLength(1)
    expect(idx.get('2026-05-09')).toBeUndefined()
    expect(idx.get('2026-05-11')).toBeUndefined()
  })

  it('puts a multi-day request inclusively on every day in the range', () => {
    const idx = indexByDay([r({ start_date: '2026-05-10', end_date: '2026-05-12' })], [])
    expect(idx.get('2026-05-10')?.requests).toHaveLength(1)
    expect(idx.get('2026-05-11')?.requests).toHaveLength(1)
    expect(idx.get('2026-05-12')?.requests).toHaveLength(1)
    expect(idx.get('2026-05-13')).toBeUndefined()
  })

  it('skips denied and auto-denied — they will not happen', () => {
    const idx = indexByDay(
      [
        r({ status: 'denied' as RequestStatus }),
        r({ status: 'auto_denied' as RequestStatus }),
      ],
      [],
    )
    expect(idx.size).toBe(0)
  })

  it('includes pending alongside approved', () => {
    const idx = indexByDay(
      [r({ status: 'pending' as RequestStatus }), r({ status: 'approved' as RequestStatus })],
      [],
    )
    expect(idx.get('2026-05-01')?.requests).toHaveLength(2)
  })

  it('indexes blockout date ranges the same way', () => {
    const idx = indexByDay([], [b({ start_date: '2026-05-20', end_date: '2026-05-22' })])
    expect(idx.get('2026-05-20')?.blockouts).toHaveLength(1)
    expect(idx.get('2026-05-22')?.blockouts).toHaveLength(1)
    expect(idx.get('2026-05-23')).toBeUndefined()
  })

  it('ignores ranges where end < start (defensive)', () => {
    const idx = indexByDay([], [b({ start_date: '2026-05-20', end_date: '2026-05-15' })])
    expect(idx.size).toBe(0)
  })
})

describe('isoLocal', () => {
  it('returns YYYY-MM-DD for a date with one-digit month and day', () => {
    expect(isoLocal(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})

describe('shiftMonth', () => {
  it('handles year rollover going forward', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
  })
  it('handles year rollover going backward', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('lastNameOf', () => {
  it('returns the last token of a multi-word name', () => {
    expect(lastNameOf('Maya Okafor')).toBe('Okafor')
  })
  it('returns the full string for a single-word name', () => {
    expect(lastNameOf('Plato')).toBe('Plato')
  })
  it('handles extra whitespace', () => {
    expect(lastNameOf('   Maya   Okafor  ')).toBe('Okafor')
  })
})

describe('monthYearLabel', () => {
  it('returns "May 2026" for May 2026', () => {
    expect(monthYearLabel(2026, 4)).toBe('May 2026')
  })
})
