'use server'

import { timingSafeEqual } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'

export type LoginState = { error?: string }

export async function loginAdmin(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Password login exists ONLY in demo mode. Production authenticates via
  // "Sign in with Microsoft" (app/api/auth/microsoft/*), gated by the
  // admin_recipients allowlist. Reject any password attempt outside demo.
  if (process.env.DEMO_MODE !== 'true') {
    return { error: 'Password login is disabled. Use “Sign in with Microsoft”.' }
  }

  const password = formData.get('password') as string

  // The demo password is held in DEMO_ADMIN_PASSWORD (never the production
  // credential). The login page openly displays it as a hint to reviewers.
  const expectedPassword = process.env.DEMO_ADMIN_PASSWORD ?? ''

  // timingSafeEqual prevents timing attacks that could leak the password length
  // or characters via response-time differences. Buffers must be the same length
  // before comparison — mismatched lengths would throw, so we check first.
  const provided = Buffer.from(password ?? '')
  const expected = Buffer.from(expectedPassword)
  const valid =
    provided.length === expected.length && timingSafeEqual(provided, expected)

  if (!valid) {
    return { error: 'Incorrect password. Please try again.' }
  }

  await createSession()
  redirect('/admin') // MUST be outside try/catch — NEXT_REDIRECT must not be swallowed
}
