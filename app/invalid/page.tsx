// app/invalid/page.tsx
import { Wordmark } from '@/app/_components/Wordmark'
import { AlertIcon } from '@/app/_components/icons'

export default function InvalidPage() {
  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule px-6 py-5 sm:px-14">
        <Wordmark />
        <span className="label-eyebrow">Error</span>
      </header>

      <div className="flex min-h-[calc(100vh-150px)] items-center justify-center px-6 sm:px-14">
        <div className="w-full max-w-xl rounded-md border border-rule bg-card p-9 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-oxblood">
              <AlertIcon size={18} className="text-cream" />
            </span>
            <span className="label-eyebrow text-oxblood">This link won&apos;t work</span>
          </div>
          <h1 className="mt-4 font-display text-[36px] leading-[1.05] tracking-tight text-ink sm:text-[42px]">
            The link is <em className="italic">invalid or already used</em>.
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            This usually happens when an approval link has already been clicked once, or when the URL was copied wrong from
            the email. You can safely close this tab.
          </p>
        </div>
      </div>
    </main>
  )
}
