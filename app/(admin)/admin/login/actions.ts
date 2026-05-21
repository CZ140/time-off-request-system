'use server'

import { timingSafeEqual } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'

export type LoginState = { error?: string }

export async function loginAdmin(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get('password') as string

  // timingSafeEqual prevents timing attacks that could leak the password length
  // or characters via response-time differences. Buffers must be the same length
  // before comparison — mismatched lengths would throw, so we check first.
  const provided = Buffer.from(password ?? '')
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? '')
  const valid =
    provided.length === expected.length && timingSafeEqual(provided, expected)

  if (!valid) {
    return { error: 'Incorrect password. Please try again.' }
  }

  await createSession()
  redirect('/admin') // MUST be outside try/catch — NEXT_REDIRECT must not be swallowed
}
