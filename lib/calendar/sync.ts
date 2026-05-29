// lib/calendar/sync.ts
// Orchestrates calendar side-effects for the approval lifecycle. Called from
// BOTH the dashboard approval (app/(admin)/admin/actions.ts) and the email-link
// approval (app/approve/[id]/actions.ts) so the two paths behave identically.
//
// Callers wrap these in try/catch and continue on failure — a calendar hiccup
// must never block or reverse an approval (same contract as email side-effects).
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import { getConnectionSummary } from './store'
import { createTimeOffEvent, deleteTimeOffEvent } from './events'
import type { Database, LeaveType } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']

// Create the Outlook event for a freshly-approved request and remember its id.
// No-op (returns) when no sync calendar is connected — that's the normal state
// before an admin has connected one, not an error.
export async function syncApprovalToCalendar(request: RequestRow): Promise<void> {
  const summary = await getConnectionSummary()
  if (!summary?.syncHomeAccountId) return // nothing connected — skip silently

  // Idempotency: never create a second event for the same request.
  if (request.calendar_event_id) return

  const label = LEAVE_TYPE_LABELS[request.leave_type as LeaveType] ?? 'Time Off'
  const eventId = await createTimeOffEvent({
    summary: `${request.teacher_name} — ${label}`,
    startDate: request.start_date,
    endDate: request.end_date,
    description: request.reason ?? '',
    calendarId: summary.calendarId,
  })

  if (!eventId) return // demo mode or no id returned — nothing to persist

  const supabase = createClient()
  const { error } = await supabase
    .from('requests')
    .update({ calendar_event_id: eventId, calendar_provider: 'microsoft' })
    .eq('id', request.id)
  if (error) {
    // The event exists but we failed to record its id. Surface so the caller
    // logs it; worst case is an orphaned event that must be removed manually.
    throw new Error(`Created calendar event but failed to record id: ${error.message}`)
  }
}

// Remove the Outlook event for a request that's being deleted/reversed.
// Best-effort and idempotent (delete swallows 404/410).
export async function removeApprovalFromCalendar(request: RequestRow): Promise<void> {
  if (!request.calendar_event_id) return
  const summary = await getConnectionSummary()
  if (!summary?.syncHomeAccountId) return
  await deleteTimeOffEvent(request.calendar_event_id, summary.calendarId)
}
