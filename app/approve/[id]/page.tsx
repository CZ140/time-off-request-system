import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyApprovalToken } from '@/lib/auth/tokens'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import { confirmApproval } from './actions'
import type { Database } from '@/types/database'
import { Wordmark } from '@/app/_components/Wordmark'

type RequestRow = Database['public']['Tables']['requests']['Row']

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ action?: string; token?: string; admin?: string; exp?: string }>
}

export default async function ApprovalConfirmationPage({ params, searchParams }: Props) {
  const { id } = await params
  const { action, token, admin, exp } = await searchParams

  // Validate params and HMAC token server-side before fetching any data.
  if (!action || !token || !admin || !exp || (action !== 'approve' && action !== 'deny')) {
    redirect('/invalid')
  }

  const expNum = Number(exp)
  const result = verifyApprovalToken(
    process.env.APPROVAL_HMAC_SECRET!,
    id,
    action,
    admin,
    expNum,
    token,
  )

  if (!result.valid) {
    // Expired tokens get a specific page so the admin understands why and can
    // request a fresh link, rather than the generic "invalid link" treatment
    // used for tampering and malformed input.
    if (result.reason === 'expired') redirect('/expired')
    redirect('/invalid')
  }

  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single<RequestRow>()

  if (error || !row) redirect('/invalid')

  // Already actioned — redirect to /reviewed without first=true (idempotent re-click).
  if (row.status !== 'pending') {
    const p = new URLSearchParams({
      status: row.status,
      teacher_name: row.teacher_name,
      start_date: row.start_date,
      end_date: row.end_date,
      leave_type: row.leave_type,
      reviewed_by: row.reviewed_by ?? '',
    })
    redirect(`/reviewed?${p.toString()}`)
  }

  const isApprove = action === 'approve'
  const verb = isApprove ? 'approve' : 'deny'
  const dateLabel =
    row.start_date === row.end_date
      ? formatDate(row.start_date)
      : `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark sublabel="Administrator" />
        <span className="label-eyebrow">From email link</span>
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-16 pt-12 sm:px-14">
        <div className="rounded-md border border-rule bg-card p-7 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)] sm:p-10">
          <div className={`label-eyebrow mb-3 ${isApprove ? 'text-moss' : 'text-oxblood'}`}>
            ● You&apos;re about to {verb}
          </div>
          <h1 className="font-display text-[36px] leading-[1.04] tracking-tight text-ink sm:text-[44px]">
            <em className="italic">{row.teacher_name}</em>&apos;s request for
            <br />
            {dateLabel}.
          </h1>

          <dl className="mt-7 grid gap-5 border-y border-dashed border-rule py-6 sm:grid-cols-3">
            <DetailItem term="Type" value={LEAVE_TYPE_LABELS[row.leave_type]} />
            <DetailItem term="Email" value={row.teacher_email} />
            <DetailItem term="Submitted" value={formatSubmittedShort(row.submitted_at)} />
          </dl>

          {row.reason && (
            <div className="mt-5 font-display text-[16px] italic text-ink-2">
              &ldquo;{row.reason}&rdquo;
            </div>
          )}

          {/* Confirmation form — hidden fields carry the verified token through to the Server Action.
              The action re-verifies the HMAC against admin + exp so a tampered hidden field still fails. */}
          <form action={confirmApproval} className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="admin" value={admin} />
            <input type="hidden" name="exp" value={exp} />

            <a
              href="/admin"
              className="rounded-sm border border-rule bg-transparent px-5 py-3 text-center text-[15px] font-bold text-ink transition-colors hover:bg-cream-alt"
            >
              Cancel
            </a>
            <button
              type="submit"
              className={`flex-1 rounded-sm px-5 py-3 text-[15px] font-bold text-cream transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-card ${
                isApprove
                  ? 'bg-moss hover:bg-moss-alt focus:ring-moss/40'
                  : 'bg-oxblood hover:opacity-90 focus:ring-oxblood/40'
              }`}
            >
              {isApprove ? `Yes, approve and notify ${firstName(row.teacher_name)}` : `Yes, deny and notify ${firstName(row.teacher_name)}`}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

function DetailItem({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="label-eyebrow">{term}</dt>
      <dd className="mt-1 font-display text-[20px] leading-tight text-ink">{value}</dd>
    </div>
  )
}

function formatSubmittedShort(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full
}
