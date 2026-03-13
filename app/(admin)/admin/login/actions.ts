'use server'

import { redirect } from 'next/navigation'
import { createSession } from '@/lib/auth/session'

export type LoginState = { error?: string }

export async function loginAdmin(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get('password') as string

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return { error: 'Incorrect password. Please try again.' }
  }

  await createSession()
  redirect('/admin') // MUST be outside try/catch — NEXT_REDIRECT must not be swallowed
}
