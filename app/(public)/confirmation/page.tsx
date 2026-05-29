// app/(public)/confirmation/page.tsx
import Link from 'next/link'
import { Wordmark } from '@/app/_components/Wordmark'
import { CheckIcon, AlertIcon } from '@/app/_components/icons'

type Props = {
  searchParams: Promise<{ status?: string }>
}

export default async function ConfirmationPage({ searchParams }: Props) {
  const { status } = await searchParams
  const isAutoDenied = status === 'auto_denied'

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark />
        <span className="label-eyebrow">Confirmation</span>
      </header>

      <div className="mx-auto max-w-4xl px-6 pb-16 pt-12 sm:px-14 sm:pt-16">
        {isAutoDenied ? (
          <>
            <Chip tone="bark" icon={<AlertIcon size={16} className="text-cream" />}>
              Request not approved
            </Chip>
            <h1 className="mt-5 font-display text-[44px] leading-[1.04] tracking-tight text-ink sm:text-[56px]">
              These dates fall on a<br />
              <em className="italic">blockout period</em>.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
              The school calendar blocks leave during testing weeks, finals, graduation, and a few other windows. A
              confirmation email with the details is on its way to your inbox.
            </p>
          </>
        ) : (
          <>
            <Chip tone="moss" icon={<CheckIcon size={16} className="text-cream" />}>
              Request received
            </Chip>
            <h1 className="mt-5 font-display text-[44px] leading-[1.04] tracking-tight text-ink sm:text-[56px]">
              Thanks. We&apos;ve
              <br />
              <em className="italic">got it from here</em>.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2 sm:text-[18px]">
              Your request is on the principal&apos;s desk. Expect an email within a few hours — always by end of next day.
              If you need to withdraw it, just reply to your confirmation email.
            </p>
          </>
        )}

        <div className="mt-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-moss underline underline-offset-4 transition-colors hover:text-moss-alt"
          >
            Submit another request →
          </Link>
        </div>
      </div>
    </main>
  )
}

function Chip({
  tone,
  icon,
  children,
}: {
  tone: 'moss' | 'bark'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const bg = tone === 'moss' ? 'bg-moss' : 'bg-bark'
  const text = tone === 'moss' ? 'text-moss' : 'text-bark'
  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>{icon}</span>
      <span className={`label-eyebrow ${text}`}>{children}</span>
    </div>
  )
}
