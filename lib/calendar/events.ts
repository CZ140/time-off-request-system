// lib/calendar/events.ts
// Microsoft Graph calendar operations for the connected sync account.
// All write paths are suppressed in demo mode (mirrors lib/email/send.ts), so
// the portfolio demo never needs real Azure credentials.
import 'server-only'

import { Client } from '@microsoft/microsoft-graph-client'
import { getSyncAccessToken } from './msal'

function isDemoMode() {
  return process.env.DEMO_MODE === 'true'
}

function graphClient(accessToken: string): Client {
  return Client.init({ authProvider: (done) => done(null, accessToken) })
}

// Graph all-day events use an EXCLUSIVE end date: a leave block whose last day
// off is the 17th must send end = the 18th. This is the single most common
// calendar off-by-one bug, so it lives in one tested pure function.
export function exclusiveEndDate(inclusiveEndYmd: string): string {
  const d = new Date(`${inclusiveEndYmd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Resolve the Graph path for a calendar — the default calendar or a specific one.
function eventsPath(calendarId: string | null | undefined): string {
  return calendarId ? `/me/calendars/${calendarId}/events` : '/me/events'
}

export interface CalendarSummary {
  id: string
  name: string
}

// List the calendars the connected account can write to (for the picker).
// Returns [] in demo mode.
export async function listCalendars(): Promise<CalendarSummary[]> {
  if (isDemoMode()) return []
  const token = await getSyncAccessToken()
  const res = await graphClient(token).api('/me/calendars').select('id,name').get()
  const value = (res?.value ?? []) as Array<{ id: string; name: string }>
  return value.map((c) => ({ id: c.id, name: c.name }))
}

export interface CreateEventArgs {
  summary: string
  // Inclusive calendar dates (YYYY-MM-DD) exactly as stored on the request row.
  startDate: string
  endDate: string
  description?: string
  calendarId?: string | null
}

// Create an all-day, possibly multi-day event. Returns the Graph event id to
// persist on the request, or null when suppressed in demo mode.
export async function createTimeOffEvent(args: CreateEventArgs): Promise<string | null> {
  if (isDemoMode()) {
    console.log(`[DEMO] Calendar event suppressed — "${args.summary}" ${args.startDate}…${args.endDate}`)
    return null
  }
  const token = await getSyncAccessToken()
  const event = await graphClient(token)
    .api(eventsPath(args.calendarId))
    .post({
      subject: args.summary,
      isAllDay: true,
      showAs: 'oof', // shows as "Out of Office" on the calendar
      start: { dateTime: `${args.startDate}T00:00:00`, timeZone: 'UTC' },
      end: { dateTime: `${exclusiveEndDate(args.endDate)}T00:00:00`, timeZone: 'UTC' },
      body: { contentType: 'text', content: args.description ?? '' },
    })
  return (event?.id as string) ?? null
}

// Delete a previously-created event. Best-effort: a 404 (already gone) is
// swallowed so reversing an approval is idempotent. No-op in demo mode.
export async function deleteTimeOffEvent(
  eventId: string,
  calendarId?: string | null
): Promise<void> {
  if (isDemoMode()) {
    console.log(`[DEMO] Calendar event delete suppressed — ${eventId}`)
    return
  }
  const token = await getSyncAccessToken()
  try {
    await graphClient(token).api(`${eventsPath(calendarId)}/${eventId}`).delete()
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode
    if (status === 404 || status === 410) return // already deleted — fine
    throw e
  }
}
