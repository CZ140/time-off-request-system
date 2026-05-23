// app/expired/page.tsx
// Distinct from /invalid so an admin clicking an old link gets actionable copy
// ("ask the teacher to resubmit") rather than the generic "invalid" treatment.
import Link from 'next/link'
import { Wordmark } from '@/app/_components/Wordmark'
import { ClockIcon } from '@/app/_components/icons'

export default function ExpiredPage() {
  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark sublabel="Administrator" />
        <span className="label-eyebrow">Expired link</span>
      </header>

      <div className="flex min-h-[calc(100vh-150px)] items-center justify-center px-6 sm:px-14">
        <div className="w-full max-w-xl rounded-md border border-rule bg-card p-9 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bark">
              <ClockIcon size={18} className="text-cream" />
            </span>
            <span className="label-eyebrow text-bark">This link has expired</span>
          </div>
          <h1 className="mt-4 font-display text-[36px] leading-[1.05] tracking-tight text-ink sm:text-[42px]">
            Approval links last <em className="italic">seven days</em>.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            To act on this request, head to the admin dashboard. It will still be sitting in your Pending list, ready for
            a decision.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex items-center rounded-sm bg-moss px-5 py-3 text-[14px] font-bold text-cream transition-colors hover:bg-moss-alt"
          >
            Open dashboard →
          </Link>
        </div>
      </div>
    </main>
  )
}
