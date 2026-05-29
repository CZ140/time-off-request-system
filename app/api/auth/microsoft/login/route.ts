// app/api/auth/microsoft/login/route.ts
// Entry point for "Sign in with Microsoft". Generates a CSRF state value, stores
// it in a short-lived cookie, and redirects to the Microsoft consent screen.
// The same consent grants both login identity and Outlook calendar access.
import 'server-only'
import '@/lib/config'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getAuthCodeUrl } from '@/lib/calendar/msal'

export async function GET() {
  // Demo mode has no Azure app — fall back to the password login page.
  if (process.env.DEMO_MODE === 'true') {
    redirect('/admin/login')
  }

  const state = randomBytes(16).toString('hex')

  const jar = await cookies()
  jar.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes to complete the round-trip
    path: '/',
  })

  // redirect() throws NEXT_REDIRECT — must be outside any try/catch.
  redirect(await getAuthCodeUrl(state))
}
