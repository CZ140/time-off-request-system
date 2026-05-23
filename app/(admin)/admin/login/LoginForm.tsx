'use client'

import { useActionState } from 'react'
import { loginAdmin, type LoginState } from './actions'
import { Wordmark } from '@/app/_components/Wordmark'

const initialState: LoginState = {}

export default function LoginForm({ demoPassword }: { demoPassword?: string }) {
  const [state, formAction, pending] = useActionState(loginAdmin, initialState)

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream p-6">
      <div className="w-full max-w-md rounded-md border border-rule bg-card p-9 shadow-[0_1px_0_rgba(28,36,33,0.04),0_14px_28px_-22px_rgba(28,36,33,0.18)]">
        <Wordmark />
        <h1 className="mt-7 font-display text-[36px] leading-tight tracking-tight text-ink sm:text-[40px]">
          Administrator
        </h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
          One password keeps the dashboard private. No usernames.
        </p>

        {demoPassword && (
          <div className="mt-6 rounded-sm border border-bark/40 bg-butter/30 px-4 py-3 text-sm text-bark">
            <span className="label-eyebrow mr-2 text-bark">Demo</span>
            <span>
              Password is{' '}
              <span className="rounded-sm bg-cream-alt px-1.5 py-0.5 font-mono font-bold">{demoPassword}</span>
            </span>
          </div>
        )}

        <form action={formAction} className="mt-7">
          <div>
            <label htmlFor="password" className="label-eyebrow mb-2 block">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              required
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-sm border border-rule bg-cream px-4 py-3 font-mono text-[18px] tracking-[0.2em] text-ink focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
            />
          </div>
          {state?.error && (
            <p className="mt-3 rounded-sm border border-oxblood/30 bg-oxblood/10 px-3 py-2 text-sm text-oxblood" role="alert">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-sm bg-moss px-4 py-3.5 text-[15px] font-bold tracking-wide text-cream transition-colors hover:bg-moss-alt focus:outline-none focus:ring-2 focus:ring-moss/40 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-[12px] text-ink-3">
          Forgot it? Ask the principal — they&apos;re the only one who can reset.
        </p>
      </div>
    </main>
  )
}
