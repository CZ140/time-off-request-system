// app/reviewed/page.tsx
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import { Wordmark } from '@/app/_components/Wordmark'
import { CheckIcon, AlertIcon } from '@/app/_components/icons'

type Props = {
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function ReviewedPage({ searchParams }: Props) {
  const params = await searchParams

  const status = params.status
  const isFirst = params.first === 'true'
  const teacherName = params.teacher_name ?? '—'
  const startDate = params.start_date ? formatDate(params.start_date) : '—'
  const endDate = params.end_date ? formatDate(params.end_date) : '—'
  const leaveType = params.leave_type
    ? (LEAVE_TYPE_LABELS[params.leave_type as keyof typeof LEAVE_TYPE_LABELS] ?? params.leave_type)
    : '—'
  const reviewedBy = params.reviewed_by ?? '—'

  const isApproved = status === 'approved'
  const isDenied = status === 'denied'

  const tone: 'moss' | 'oxblood' = isApproved ? 'moss' : 'oxblood'
  const icon = isApproved ? <CheckIcon size={18} className="text-cream" /> : <AlertIcon size={18} className="text-cream" />
  const eyebrow = isFirst ? (isApproved ? 'Request approved' : 'Request denied') : 'Already reviewed'
  const headline = isFirst
    ? isApproved
      ? { lead: 'Approved. ', italic: `${firstName(teacherName)} has been notified.` }
      : { lead: 'Denied. ', italic: `${firstName(teacherName)} has been notified.` }
    : { lead: 'No further action — ', italic: 'this one was already handled.' }
  const sub = isFirst
    ? 'Your decision has been recorded. The email confirmation is on its way.'
    : 'You may have clicked the link twice, or another admin already acted on it.'

  const dateLabel = startDate === endDate ? startDate : `${startDate} – ${endDate}`

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark sublabel="Administrator" />
        <span className="label-eyebrow">From email link</span>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16 pt-12 sm:px-14">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
              tone === 'moss' ? 'bg-moss' : 'bg-oxblood'
            }`}
          >
            {icon}
          </span>
          <span className={`label-eyebrow ${tone === 'moss' ? 'text-moss' : 'text-oxblood'}`}>{eyebrow}</span>
        </div>

        <h1 className="mt-5 font-display text-[36px] leading-[1.04] tracking-tight text-ink sm:text-[48px]">
          {headline.lead}
          <em className="italic">{headline.italic}</em>
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">{sub}</p>

        {(isApproved || isDenied || teacherName !== '—') && (
          <dl className="mt-8 grid gap-5 rounded-md border border-rule bg-card p-6 sm:grid-cols-2 sm:p-7">
            <DetailItem term="Teacher" value={teacherName} />
            <DetailItem term="Leave type" value={leaveType} />
            <DetailItem term="Dates" value={dateLabel} />
            <DetailItem term="Reviewed by" value={reviewedBy} />
          </dl>
        )}
      </div>
    </main>
  )
}

function DetailItem({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="label-eyebrow">{term}</dt>
      <dd className="mt-1 font-display text-[18px] leading-tight text-ink">{value}</dd>
    </div>
  )
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full
}
