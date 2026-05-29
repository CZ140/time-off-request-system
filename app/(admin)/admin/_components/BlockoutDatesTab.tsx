'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'
import { addBlockoutDate, deleteBlockoutDate, type BlockoutDateState } from '../actions'
import { formatDate } from '@/lib/email/utils'

type BlockoutDateRow = Database['public']['Tables']['blockout_dates']['Row']

export default function BlockoutDatesTab({ blockoutDates }: { blockoutDates: BlockoutDateRow[] }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)
  const [addOpen, setAddOpen] = useState(false)

  const [addState, addAction, addPending] = useActionState(
    async (prev: BlockoutDateState | null, formData: FormData) => {
      const result = await addBlockoutDate(prev, formData)
      if (result?.success) {
        setFormKey((k) => k + 1)
        setAddOpen(false)
        router.refresh()
      }
      return result
    },
    null,
  )

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteBlockoutDate(id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmId(null)
        return
      }
      setDeleteError(null)
      setConfirmId(null)
      router.refresh()
    })
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink sm:text-[40px]">
            Days when leave is <em className="italic">auto-denied</em>.
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
            Testing weeks, finals, graduation week, opening PD. The system will reject any request that overlaps with
            these — no email is sent to the principal.
          </p>
        </div>
        {!addOpen && (
          <button
            onClick={() => setAddOpen(true)}
            className="self-start rounded-sm bg-moss px-4 py-2.5 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt sm:self-auto"
          >
            + Add range
          </button>
        )}
      </div>

      {/* Inline add form — only shown when the user explicitly opens it.
          Collapsing it makes the list the primary surface, per the brief's
          "no dense data-grid look" direction. */}
      {addOpen && (
        <form
          key={formKey}
          action={addAction}
          className="mb-6 rounded-md border border-dashed border-rule bg-card p-5"
        >
          <div className="label-eyebrow mb-3 text-moss">● New blockout range</div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label htmlFor="blockout-label" className="label-eyebrow mb-1.5 block">
                Label
              </label>
              <input
                id="blockout-label"
                name="label"
                type="text"
                placeholder="e.g. Spring testing week"
                required
                className="w-full rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </div>
            <div>
              <label htmlFor="blockout-start" className="label-eyebrow mb-1.5 block">
                Start
              </label>
              <input
                id="blockout-start"
                name="start_date"
                type="date"
                required
                className="rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </div>
            <div>
              <label htmlFor="blockout-end" className="label-eyebrow mb-1.5 block">
                End
              </label>
              <input
                id="blockout-end"
                name="end_date"
                type="date"
                required
                className="rounded-sm border border-rule bg-cream px-3 py-2 text-sm font-semibold text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={addPending}
              className="rounded-sm bg-moss px-4 py-2 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addPending ? 'Adding…' : 'Add range'}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            {addState?.error && (
              <p className="text-sm text-oxblood">{addState.error}</p>
            )}
          </div>
        </form>
      )}

      {deleteError && (
        <p className="mb-4 rounded-sm border border-oxblood/30 bg-oxblood/10 px-3 py-2 text-sm text-oxblood">
          {deleteError}
        </p>
      )}

      {blockoutDates.length === 0 ? (
        <div className="rounded-md border border-dashed border-rule bg-card p-10 text-center text-ink-3">
          <div className="label-eyebrow mb-1">No ranges yet</div>
          <p className="text-[15px] text-ink-2">
            Add a range to start auto-denying leave on specific dates.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {blockoutDates.map((row) => {
            const sameDay = row.start_date === row.end_date
            const year = row.start_date.slice(0, 4)
            return (
              <li
                key={row.id}
                className="grid grid-cols-[44px_1fr_auto] items-center gap-4 rounded-md border border-rule bg-card p-5"
              >
                <div className="rounded-sm bg-cream-alt px-2 py-1.5 text-center">
                  <div className="label-eyebrow text-[9px] text-bark">Range</div>
                  <div className="mt-0.5 font-display text-[22px] leading-none italic text-moss">×</div>
                </div>
                <div>
                  <div className="font-display text-[22px] leading-tight text-ink">{row.label}</div>
                  <div className="mt-1.5 text-[13px] font-semibold text-ink-2">
                    {sameDay ? formatDate(row.start_date) : `${formatDate(row.start_date)} → ${formatDate(row.end_date)}`}{' '}
                    <span className="text-ink-3">· {year}</span>
                  </div>
                </div>
                <div className="flex items-center">
                  {confirmId === row.id ? (
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(row.id)}
                        disabled={isPending}
                        className="label-eyebrow text-oxblood transition-colors hover:opacity-70 disabled:opacity-40"
                      >
                        Confirm?
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        disabled={isPending}
                        className="label-eyebrow text-ink-3 transition-colors hover:text-ink-2 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(row.id)}
                      className="label-eyebrow text-ink-3 transition-colors hover:text-oxblood"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
