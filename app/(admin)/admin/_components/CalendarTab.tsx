'use client'

import { useMemo, useState } from 'react'
import type { Database } from '@/types/database'
import { LEAVE_TYPE_LABELS, formatDate } from '@/lib/email/utils'
import {
  monthGrid,
  indexByDay,
  monthYearLabel,
  shiftMonth,
  lastNameOf,
} from '@/lib/calendar-grid'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlockoutDateRow = Database['public']['Tables']['blockout_dates']['Row']

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_CHIPS = 3

export default function CalendarTab({
  requests,
  blockoutDates,
}: {
  requests: RequestRow[]
  blockoutDates: BlockoutDateRow[]
}) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }))
  const [selected, setSelected] = useState<{ kind: 'request'; row: RequestRow } | null>(null)

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month, today), [cursor, today])

  // Build the per-day overlap index once per (requests, blockouts) change.
  // Used by every cell lookup below.
  const dayIndex = useMemo(() => indexByDay(requests, blockoutDates), [requests, blockoutDates])

  function step(delta: number) {
    setCursor((c) => shiftMonth(c.year, c.month, delta))
    setSelected(null)
  }
  function jumpToToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() })
    setSelected(null)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink sm:text-[40px]">
            Who&apos;s out, <em className="italic">when</em>.
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-ink-2">
            Approved and pending requests, laid over the blockout calendar. Click a name for the full request.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            className="rounded-sm border border-rule bg-card px-3 py-2 text-[14px] font-bold text-ink-2 hover:bg-cream-alt"
            aria-label="Previous month"
          >
            ←
          </button>
          <div className="font-display text-[24px] leading-none text-ink min-w-[160px] text-center">
            {monthYearLabel(cursor.year, cursor.month)}
          </div>
          <button
            onClick={() => step(1)}
            className="rounded-sm border border-rule bg-card px-3 py-2 text-[14px] font-bold text-ink-2 hover:bg-cream-alt"
            aria-label="Next month"
          >
            →
          </button>
          <button
            onClick={jumpToToday}
            className="label-eyebrow ml-2 text-moss transition-colors hover:opacity-70"
          >
            Today
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink-2">
        <LegendDot color="bg-moss" label="Approved" />
        <LegendDot color="bg-chip-pending-bg ring-1 ring-bark/40" label="Pending" />
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, var(--color-butter) 0 4px, transparent 4px 8px)',
              backgroundColor: 'var(--color-cream-alt)',
            }}
          />
          Blockout
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm border-2 border-moss" />
          Today
        </span>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="label-eyebrow py-1.5">
            {w}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="overflow-hidden rounded-md border border-rule">
        <div className="grid grid-cols-7">
          {grid.flat().map((cell, idx) => {
            const bucket = dayIndex.get(cell.iso)
            const reqs = bucket?.requests ?? []
            const isBlockout = (bucket?.blockouts.length ?? 0) > 0
            const visible = reqs.slice(0, MAX_VISIBLE_CHIPS)
            const overflow = reqs.length - visible.length
            const isLastCol = (idx + 1) % 7 === 0
            const isLastRow = idx >= 35

            return (
              <div
                key={cell.iso}
                className={`relative min-h-[110px] border-rule p-2 ${
                  !isLastCol ? 'border-r' : ''
                } ${!isLastRow ? 'border-b' : ''} ${
                  cell.inMonth ? 'bg-card' : 'bg-cream-alt/50'
                } ${cell.isToday ? 'ring-2 ring-inset ring-moss' : ''}`}
                style={
                  isBlockout
                    ? {
                        backgroundImage:
                          'repeating-linear-gradient(45deg, var(--color-butter) 0 1px, transparent 1px 9px)',
                      }
                    : undefined
                }
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-[12px] font-bold ${
                      cell.inMonth ? 'text-ink' : 'text-ink-3'
                    } ${cell.isToday ? 'text-moss' : ''}`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {isBlockout && cell.inMonth && (
                    <span
                      className="label-eyebrow text-[8px] text-bark"
                      title={(bucket?.blockouts[0]?.label ?? '') + (bucket && bucket.blockouts.length > 1 ? ` (+${bucket.blockouts.length - 1})` : '')}
                    >
                      blockout
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  {visible.map((req) => {
                    const isApproved = req.status === 'approved'
                    return (
                      <button
                        key={req.id + cell.iso}
                        onClick={() => setSelected({ kind: 'request', row: req })}
                        title={`${req.teacher_name} · ${LEAVE_TYPE_LABELS[req.leave_type]}${req.reason ? ` · ${req.reason}` : ''}`}
                        className={`block w-full truncate rounded-sm px-1.5 py-0.5 text-left text-[10.5px] font-bold transition-colors ${
                          isApproved
                            ? 'bg-moss text-cream hover:opacity-90'
                            : 'border border-bark/40 bg-chip-pending-bg text-bark hover:bg-chip-pending-bg/70'
                        }`}
                      >
                        {lastNameOf(req.teacher_name)}
                      </button>
                    )
                  })}
                  {overflow > 0 && (
                    <div className="text-[10px] font-semibold text-ink-3">+{overflow} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selection drawer (renders inline beneath the calendar) */}
      {selected && (
        <div className="mt-5 rounded-md border border-rule bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className={`label-eyebrow mb-2 ${
                  selected.row.status === 'approved' ? 'text-moss' : 'text-bark'
                }`}
              >
                ● {selected.row.status === 'approved' ? 'Approved' : 'Pending'}
              </div>
              <h2 className="font-display text-[28px] leading-tight tracking-tight text-ink">
                {selected.row.teacher_name}
              </h2>
              <a
                href={`mailto:${selected.row.teacher_email}`}
                className="mt-1 inline-block text-[13px] text-ink-2 underline decoration-dotted underline-offset-2 hover:text-moss"
              >
                {selected.row.teacher_email}
              </a>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="label-eyebrow text-ink-3 transition-colors hover:text-ink-2"
              aria-label="Close request details"
            >
              Close
            </button>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="label-eyebrow">Type</dt>
              <dd className="mt-1 font-display text-[18px] text-ink">
                {LEAVE_TYPE_LABELS[selected.row.leave_type]}
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow">Dates</dt>
              <dd className="mt-1 font-display text-[18px] text-ink">
                {selected.row.start_date === selected.row.end_date
                  ? formatDate(selected.row.start_date)
                  : `${formatDate(selected.row.start_date)} – ${formatDate(selected.row.end_date)}`}
              </dd>
            </div>
            <div>
              <dt className="label-eyebrow">Submitted</dt>
              <dd className="mt-1 font-display text-[18px] text-ink">
                {new Date(selected.row.submitted_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </dd>
            </div>
          </dl>

          {selected.row.reason && (
            <div className="mt-5 font-display text-[16px] italic text-ink-2">
              &ldquo;{selected.row.reason}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  )
}
