'use server'

import { createAuthClient } from '@/lib/supabase/auth-server'

// Same regex used by app/(public)/actions.ts for consistency.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LoginState = {
  error?: string
  sent?: boolean
  email?: string
}

// TODO (Phase 3 — production-hardening): rate-limit at 5/hr per email.
// The limiter does not yet exist; when Phase 3 lands, wrap this action's body
// with a per-email check and return { error: 'Too many requests. Try again in an hour.' }
// on exceedance. See .planning/production-hardening.md, Phase 3.
export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const emailRaw = (formData.get('email') as string | null) ?? ''
  const email = emailRaw.trim().toLowerCase()
  const next = sanitiseNext((formData.get('next') as string | null) ?? '/')

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Enter a valid email address.' }
  }

  // Phase 2 will insert the domain-allowlist check here:
  //   if (!isAllowedEmail(email)) return { error: "This email isn't authorized to access this system." }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const emailRedirectTo = `${base}/auth/callback?next=${encodeURIComponent(next)}`

  const supabase = await createAuthClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  })

  if (error) {
    console.error('[login] signInWithOtp failed:', error)
    return { error: 'Could not send the magic link. Please try again.' }
  }

  return { sent: true, email }
}

// next-param sanitisation: must be a relative path on this origin.
// Reject anything starting with a protocol, a double-slash (protocol-relative URL),
// or anything that does not begin with a single '/'. Default to '/' on rejection.
function sanitiseNext(raw: string): string {
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  if (raw.includes('://')) return '/'
  return raw
}
