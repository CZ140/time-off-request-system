// app/api/auth/microsoft/callback/route.ts
// OAuth redirect target. Exchanges the auth code, verifies the account's email
// against the admin_recipients allowlist, establishes the calendar sync target
// on first connect, and opens the admin session.
import 'server-only'
import '@/lib/config'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { acquireTokenByCode, removeAccountFromCache } from '@/lib/calendar/msal'
import {
  getConnectionSummary,
  saveSyncTarget,
  deleteConnection,
} from '@/lib/calendar/store'
import { isAllowedAdmin } from '@/lib/auth/admin-allowlist'
import { createSession } from '@/lib/auth/session'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const jar = await cookies()
  const expected = jar.get('ms_oauth_state')?.value
  jar.delete('ms_oauth_state')

  // Provider error or CSRF/state mismatch — bail before touching tokens.
  if (oauthError || !code || !state || !expected || state !== expected) {
    if (oauthError) console.error('[ms/callback] provider error:', oauthError)
    redirect('/admin/login?error=signin')
  }

  // Exchange the code; the cache plugin persists the (encrypted) token cache.
  let account
  try {
    account = await acquireTokenByCode(code!)
  } catch (e) {
    console.error('[ms/callback] token exchange failed:', e)
    redirect('/admin/login?error=signin')
  }

  // Authorization gate: only emails on the allowlist may sign in.
  const allowed = await isAllowedAdmin(account.email)
  if (!allowed) {
    // Don't leave a non-admin's tokens in the stored cache.
    try {
      await removeAccountFromCache(account.homeAccountId)
      const existing = await getConnectionSummary()
      if (!existing) await deleteConnection()
    } catch (cleanupErr) {
      console.error('[ms/callback] cleanup after unauthorized sign-in failed:', cleanupErr)
    }
    redirect('/admin/login?error=unauthorized')
  }

  // First admin to connect establishes the shared sync target. Later sign-ins
  // get dashboard access without hijacking it.
  try {
    const existing = await getConnectionSummary()
    if (!existing) {
      await saveSyncTarget({ accountEmail: account.email, homeAccountId: account.homeAccountId })
    }
  } catch (e) {
    console.error('[ms/callback] failed to set initial sync target:', e)
  }

  await createSession({ adminEmail: account.email, homeAccountId: account.homeAccountId })
  redirect('/admin')
}
