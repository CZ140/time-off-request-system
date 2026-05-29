import Link from 'next/link'
import LoginForm from './LoginForm'
import { Wordmark } from '@/app/_components/Wordmark'

const ERROR_MESSAGES: Record<string, string> = {
  signin: 'Sign-in didn’t complete. Please try again.',
  unauthorized: 'That Microsoft account isn’t authorized for this dashboard. Ask an administrator to add your email.',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const isDemo = process.env.DEMO_MODE === 'true'
  const { error } = await searchParams
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined

  // Demo mode keeps the password login (portfolio reviewers can't sign into the
  // real Microsoft tenant). The hint reflects DEMO_ADMIN_PASSWORD specifically.
  if (isDemo) {
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? undefined
    return <LoginForm demoPassword={demoPassword} />
  }

  // Production: "Sign in with Microsoft" is the only login.
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md rounded-md border border-rule bg-card p-9 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)]">
        <Wordmark />
        <h1 className="mt-7 font-display text-[36px] leading-tight tracking-tight text-ink sm:text-[40px]">
          Administrator
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
          Sign in with your school Microsoft account. Only authorized addresses can enter.
        </p>

        {errorMessage && (
          <p
            className="mt-6 rounded-sm border border-oxblood/30 bg-oxblood/10 px-3 py-2 text-sm text-oxblood"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <Link
          href="/api/auth/microsoft/login"
          prefetch={false}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-sm bg-moss px-4 py-3.5 text-[15px] font-bold tracking-wide text-cream transition-colors hover:bg-moss-alt focus:outline-none focus:ring-2 focus:ring-moss/40 focus:ring-offset-2 focus:ring-offset-card"
        >
          <MicrosoftLogo />
          Sign in with Microsoft
        </Link>

        <p className="mt-5 text-[12px] text-ink-3">
          Signing in also connects this account so approved time off can sync to its Outlook calendar.
        </p>
      </div>
    </main>
  )
}

function MicrosoftLogo() {
  // The four-square Microsoft mark, kept on-brand cream so it reads on moss.
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="0" y="0" width="7" height="7" fill="currentColor" />
      <rect x="9" y="0" width="7" height="7" fill="currentColor" opacity="0.7" />
      <rect x="0" y="9" width="7" height="7" fill="currentColor" opacity="0.7" />
      <rect x="9" y="9" width="7" height="7" fill="currentColor" opacity="0.45" />
    </svg>
  )
}
