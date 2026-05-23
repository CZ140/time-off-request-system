// lib/email/utils.ts
// Shared helpers for all Phase 3 email templates.
// Pure functions — no server-side I/O. No 'server-only' import needed.

import type { LeaveType } from '@/types/database'

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  vacation: 'Vacation',
  bereavement: 'Bereavement Leave',
  jury_duty: 'Jury Duty',
  professional_development: 'Professional Development',
  maternity_paternity: 'Maternity / Paternity Leave',
  half_day_am: 'Half Day (AM)',
  half_day_pm: 'Half Day (PM)',
}

export function formatDate(iso: string): string {
  // Append T00:00:00 to parse as LOCAL time, not UTC midnight.
  // Without this, US timezones shift the date one day back (e.g. April 15 → April 14).
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
