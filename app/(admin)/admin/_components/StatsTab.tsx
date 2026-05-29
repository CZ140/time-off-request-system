'use client'

import { useMemo, useState } from 'react'
import type { Database } from '@/types/database'
import { LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import {
  computeStats,
  LEAD_TIME_LABELS,
  type StatsRange,
  type LeadTimeBucket,
} from '@/lib/stats'

type RequestRow = Database['public']['Tables']['requests']['Row']

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last year' },
  { value: 'all', label: 'All time' },
]

const LEAD_TIME_ORDER: LeadTimeBucket[] = ['same_day', 'd1_d3', 'd4_d7', 'w1_w4', 'm1_plus']

export default function StatsTab({ requests }: { requests: RequestRow[] }) {
  const [range, setRange] = useState<StatsRange>(90)

  // `now` is captured once per render so all metrics are computed against the
  // same instant; otherwise the lead-time bucketer and the stale check could
  // disagree by ms.
  const stats = useMemo(() => {
    return computeStats(requests, { range, now: Date.now() })
  }, [requests, range])

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[32px] leading-tight tracking-tight text-ink sm:text-[40px]">
            How the system is <em className="italic">getting used</em>.
          </h1>
          <p className="mt-1 text-[14px] text-ink-2">
            All numbers are computed live from the request table. Pick a window to focus on.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => {
            const active = range === opt.value
            return (
              <button
                key={String(opt.value)}
                onClick={() => setRange(opt.value)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                  active
                    ? 'border-ink bg-ink text-cream'
                    : 'border-rule bg-card text-ink-2 hover:bg-cream-alt'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {stats.stalePendingCount > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-oxblood/30 bg-oxblood/5 p-4">
          <span className="label-eyebrow shrink-0 text-oxblood">Heads up</span>
          <p className="text-[14px] text-ink-2">
            <strong className="font-bold">{stats.stalePendingCount}</strong>{' '}
            {stats.stalePendingCount === 1 ? 'request has' : 'requests have'} been pending more than 48 hours. Across all
            time, not just this range.
          </p>
        </div>
      )}

      {stats.totalRequests === 0 ? (
        <div className="rounded-md border border-dashed border-rule bg-card p-10 text-center text-ink-3">
          <div className="label-eyebrow mb-1">Nothing yet</div>
          <p className="text-[15px] text-ink-2">
            No requests in this window. Try a wider range, or wait for the first submission.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total requests"
              value={String(stats.totalRequests)}
              sub={`in ${rangeWord(range)}`}
            />
            <MetricCard
              label="Approval rate"
              value={stats.approvalRate === null ? '—' : `${Math.round(stats.approvalRate * 100)}%`}
              sub={
                stats.approvalRate === null
                  ? 'no decisions yet'
                  : `of ${stats.statusCounts.approved + stats.statusCounts.denied} decisions`
              }
            />
            <MetricCard
              label="Auto-denied"
              value={stats.autoDenialRate === null ? '—' : `${Math.round(stats.autoDenialRate * 100)}%`}
              sub={`${stats.statusCounts.auto_denied} blocked by blockouts`}
              tone={stats.autoDenialRate !== null && stats.autoDenialRate > 0.1 ? 'warn' : 'default'}
            />
            <MetricCard
              label="Avg review time"
              value={
                stats.averageReviewHours === null
                  ? '—'
                  : formatDuration(stats.averageReviewHours)
              }
              sub={stats.averageReviewHours === null ? 'no reviewed rows' : 'submission → decision'}
            />
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-2">
            <Panel title="Top submitters">
              {stats.topSubmitters.length === 0 ? (
                <Empty>No submissions yet.</Empty>
              ) : (
                <BarList
                  items={stats.topSubmitters.map((s) => ({ label: s.email, count: s.count }))}
                  max={stats.topSubmitters[0]?.count ?? 1}
                />
              )}
            </Panel>

            <Panel title="Leave types">
              {Object.keys(stats.leaveTypeCounts).length === 0 ? (
                <Empty>No requests in this window.</Empty>
              ) : (
                <BarList
                  items={Object.entries(stats.leaveTypeCounts)
                    .map(([k, v]) => ({
                      label: LEAVE_TYPE_LABELS[k as keyof typeof LEAVE_TYPE_LABELS] ?? k,
                      count: v,
                    }))
                    .sort((a, b) => b.count - a.count)}
                  max={Math.max(...Object.values(stats.leaveTypeCounts))}
                />
              )}
            </Panel>
          </div>

          <div className="mb-5">
            <Panel title="Lead time before requested start">
              <BarList
                items={LEAD_TIME_ORDER.map((k) => ({
                  label: LEAD_TIME_LABELS[k],
                  count: stats.leadTimeBuckets[k],
                }))}
                max={Math.max(1, ...LEAD_TIME_ORDER.map((k) => stats.leadTimeBuckets[k]))}
              />
            </Panel>
          </div>

          <Panel title="Submissions per month — last 12 months">
            <Sparkline timeline={stats.monthlyTimeline} />
          </Panel>
        </>
      )}
    </div>
  )
}

// ── Small composable display bits ─────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div className="rounded-md border border-rule bg-card p-5">
      <div className="label-eyebrow">{label}</div>
      <div
        className={`mt-2 font-display text-[40px] leading-none tracking-tight ${
          tone === 'warn' ? 'text-oxblood' : 'text-ink'
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-ink-3">{sub}</div>}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-rule bg-card p-5">
      <div className="label-eyebrow mb-4">{title}</div>
      {children}
    </div>
  )
}

function BarList({ items, max }: { items: { label: string; count: number }[]; max: number }) {
  if (items.length === 0) return <Empty>No data.</Empty>
  const total = items.reduce((s, it) => s + it.count, 0)
  return (
    <ul className="grid gap-2.5">
      {items.map((it) => {
        const pct = max === 0 ? 0 : (it.count / max) * 100
        const share = total === 0 ? 0 : (it.count / total) * 100
        return (
          <li key={it.label} className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-semibold text-ink">{it.label}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{Math.round(share)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-alt">
                <div
                  className="h-full rounded-full bg-moss transition-[width]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="font-display text-[20px] leading-none text-moss">{it.count}</div>
          </li>
        )
      })}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] italic text-ink-3">{children}</p>
}

// Tiny inline SVG sparkline. No chart lib — the data is 12 points, this fits
// in 40 lines, and the visual matches the cream/moss aesthetic exactly.
function Sparkline({ timeline }: { timeline: { label: string; count: number }[] }) {
  const max = Math.max(1, ...timeline.map((b) => b.count))
  const width = 600
  const height = 80
  const pad = 8
  const step = (width - pad * 2) / (timeline.length - 1)

  const points = timeline.map((b, i) => {
    const x = pad + i * step
    const y = height - pad - (b.count / max) * (height - pad * 2)
    return { x, y, ...b }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${path} L ${width - pad} ${height - pad} L ${pad} ${height - pad} Z`

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: '120px' }}
        aria-label="Monthly submission counts over the past 12 months"
      >
        <path d={area} fill="var(--color-moss)" fillOpacity={0.08} />
        <path d={path} fill="none" stroke="var(--color-moss)" strokeWidth={1.5} strokeLinejoin="round" />
        {points.map((p) => (
          <circle
            key={`${p.label}-${p.x}`}
            cx={p.x}
            cy={p.y}
            r={p.count === 0 ? 2 : 3}
            fill={p.count === 0 ? 'var(--color-rule)' : 'var(--color-moss)'}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-3">
        {timeline.map((b, i) => (
          <span key={`${b.label}-${i}`} className="font-mono">{b.label}</span>
        ))}
      </div>
    </div>
  )
}

// ── Small utilities ────────────────────────────────────────────────────────

function rangeWord(range: StatsRange): string {
  if (range === 'all') return 'all time'
  if (range === 30) return 'the last 30 days'
  if (range === 90) return 'the last 90 days'
  return 'the last year'
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    const mins = Math.round(hours * 60)
    return `${mins} min`
  }
  if (hours < 48) {
    return `${hours.toFixed(1).replace(/\.0$/, '')} h`
  }
  return `${(hours / 24).toFixed(1).replace(/\.0$/, '')} d`
}
