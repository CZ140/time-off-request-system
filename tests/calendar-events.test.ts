// tests/calendar-events.test.ts
// The all-day exclusive-end date math (the classic off-by-one) and demo-mode
// suppression. Graph itself is never hit: demo paths short-circuit, and the
// silent-token getter is mocked to fail loudly if a demo path tries to call it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/calendar/msal', () => ({
  // If a demo-mode path ever reaches for a token, this throw fails the test.
  getSyncAccessToken: vi.fn(async () => {
    throw new Error('getSyncAccessToken should not be called in demo mode')
  }),
}))

import {
  exclusiveEndDate,
  createTimeOffEvent,
  deleteTimeOffEvent,
  listCalendars,
} from '@/lib/calendar/events'

describe('exclusiveEndDate', () => {
  it('adds one day to a single-day leave', () => {
    expect(exclusiveEndDate('2026-06-17')).toBe('2026-06-18')
  })

  it('adds one day across a multi-day leave end', () => {
    expect(exclusiveEndDate('2026-06-19')).toBe('2026-06-20')
  })

  it('rolls over month boundaries', () => {
    expect(exclusiveEndDate('2026-06-30')).toBe('2026-07-01')
  })

  it('rolls over year boundaries', () => {
    expect(exclusiveEndDate('2026-12-31')).toBe('2027-01-01')
  })

  it('handles leap day correctly', () => {
    expect(exclusiveEndDate('2028-02-28')).toBe('2028-02-29')
    expect(exclusiveEndDate('2028-02-29')).toBe('2028-03-01')
  })
})

describe('demo-mode suppression', () => {
  beforeEach(() => {
    process.env.DEMO_MODE = 'true'
  })
  afterEach(() => {
    delete process.env.DEMO_MODE
  })

  it('createTimeOffEvent returns null without creating anything', async () => {
    const id = await createTimeOffEvent({
      summary: 'Test — Sick Leave',
      startDate: '2026-09-10',
      endDate: '2026-09-12',
    })
    expect(id).toBeNull()
  })

  it('listCalendars returns an empty list', async () => {
    expect(await listCalendars()).toEqual([])
  })

  it('deleteTimeOffEvent is a no-op (does not throw)', async () => {
    await expect(deleteTimeOffEvent('evt-1')).resolves.toBeUndefined()
  })
})
