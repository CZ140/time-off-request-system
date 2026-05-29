'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ConnectionSummary } from '@/lib/calendar/store'
import type { CalendarSummary } from '@/lib/calendar/events'
import {
  getSyncCalendars,
  setSyncCalendar,
  disconnectCalendar,
} from '../actions'

export default function CalendarSyncTab({
  connection,
  isDemo,
}: {
  connection: ConnectionSummary | null
  isDemo: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Calendar picker state
  const [calendars, setCalendars] = useState<CalendarSummary[] | null>(null)
  const [loadingCals, setLoadingCals] = useState(false)
  const [picked, setPicked] = useState<string>(connection?.calendarId ?? '')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  function refresh() {
    router.refresh()
  }

  async function loadCalendars() {
    setLoadingCals(true)
    setError(null)
    const result = await getSyncCalendars()
    setLoadingCals(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setCalendars(result.calendars ?? [])
  }

  function saveCalendar() {
    const chosen = calendars?.find((c) => c.id === picked)
    if (!chosen) return
    startTransition(async () => {
      const result = await setSyncCalendar(chosen.id, chosen.name)
      if (result.error) {
        setError(result.error)
        return
      }
      setError(null)
      setCalendars(null)
      refresh()
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectCalendar()
      if (result.error) {
        setError(result.error)
        setConfirmDisconnect(false)
        return
      }
      setError(null)
      setConfirmDisconnect(false)
      refresh()
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink sm:text-[40px]">
          Sync to <em className="italic">Outlook</em>.
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
          Connect a Microsoft account and every approved request lands on its Outlook calendar as an
          all-day event. One-way: approvals create events, deletions remove them.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-sm border border-oxblood/30 bg-oxblood/10 px-3 py-2 text-sm text-oxblood">
          {error}
        </p>
      )}

      {isDemo ? (
        <div className="max-w-xl rounded-md border border-dashed border-rule bg-card p-8">
          <div className="label-eyebrow text-bark">Demo mode</div>
          <h2 className="mt-2 font-display text-[24px] leading-tight text-ink">
            Calendar sync is off in the demo
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            Connecting a real Microsoft account isn’t available in the portfolio demo. In production,
            the principal signs in with Microsoft and approved time off flows straight to their
            Outlook calendar.
          </p>
        </div>
      ) : !connection ? (
        <div className="max-w-xl rounded-md border border-rule bg-card p-8">
          <div className="label-eyebrow text-ink-3">Not connected</div>
          <h2 className="mt-2 font-display text-[24px] leading-tight text-ink">
            No calendar is connected
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            Sign in with Microsoft to connect an account. Approved requests will then sync to its
            Outlook calendar.
          </p>
          <a
            href="/api/auth/microsoft/login"
            className="mt-5 inline-flex items-center gap-2 rounded-sm bg-moss px-4 py-2.5 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt"
          >
            Connect Outlook
          </a>
        </div>
      ) : (
        <div className="grid gap-5">
          {/* Connection status */}
          <div className="rounded-md border border-rule bg-card p-6">
            <div className="label-eyebrow mb-2 text-moss">● Connected</div>
            <div className="font-display text-[24px] leading-tight text-ink">
              {connection.accountEmail ?? 'Microsoft account'}
            </div>
            <p className="mt-1 text-[13px] text-ink-2">
              Connected{' '}
              {new Date(connection.connectedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>

            <dl className="mt-5 border-t border-rule pt-5">
              <dt className="label-eyebrow">Syncing to calendar</dt>
              <dd className="mt-1 font-display text-[18px] text-ink">
                {connection.calendarName ?? 'Default calendar'}
              </dd>
            </dl>

            {/* Calendar picker */}
            <div className="mt-5">
              {calendars === null ? (
                <button
                  onClick={loadCalendars}
                  disabled={loadingCals}
                  className="label-eyebrow text-moss transition-colors hover:opacity-70 disabled:opacity-50"
                >
                  {loadingCals ? 'Loading calendars…' : 'Change calendar'}
                </button>
              ) : calendars.length === 0 ? (
                <p className="text-[13px] text-ink-2">No calendars found on this account.</p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor="calendar-select" className="label-eyebrow mb-1.5 block">
                      Calendar
                    </label>
                    <select
                      id="calendar-select"
                      value={picked}
                      onChange={(e) => setPicked(e.target.value)}
                      className="w-full rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
                    >
                      <option value="" disabled>
                        Select a calendar…
                      </option>
                      {calendars.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveCalendar}
                      disabled={pending || !picked}
                      className="rounded-sm bg-moss px-4 py-2 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setCalendars(null)
                        setError(null)
                      }}
                      className="text-[13px] font-semibold text-ink-2 hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Disconnect */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-oxblood/20 bg-oxblood/5 p-6">
            <div>
              <div className="label-eyebrow text-oxblood">Disconnect</div>
              <p className="mt-1 max-w-md text-[13px] text-ink-2">
                Stops syncing and removes the stored credentials. Existing calendar events are left
                in place.
              </p>
            </div>
            {confirmDisconnect ? (
              <div className="flex shrink-0 items-center gap-3">
                <button
                  onClick={handleDisconnect}
                  disabled={pending}
                  className="label-eyebrow text-oxblood transition-colors hover:opacity-70 disabled:opacity-40"
                >
                  {pending ? 'Disconnecting…' : 'Confirm?'}
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  disabled={pending}
                  className="label-eyebrow text-ink-3 transition-colors hover:text-ink-2 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="shrink-0 rounded-sm border border-oxblood/30 px-4 py-2 text-[14px] font-bold text-oxblood transition-colors hover:bg-oxblood/10"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
