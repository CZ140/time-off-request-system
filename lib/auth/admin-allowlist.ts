// lib/auth/admin-allowlist.ts
// Login authorization for the "Sign in with Microsoft" flow.
//
// Semantics (FAIL-CLOSED):
//   - An email may sign in only if it appears in the admin_recipients table.
//     That table doubles as the login allowlist AND the notification list — by
//     design (see the plan); it should contain only school addresses.
//   - Case-insensitive exact-email match.
//   - Empty table / DB error rejects ALL emails.
//   - Seed it via the Supabase SQL editor before the first admin signs in
//     (this is also the break-glass recovery path).
import 'server-only'

import { createClient } from '@/lib/supabase/server'

export async function isAllowedAdmin(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return false

  const supabase = createClient()
  const { data, error } = await supabase.from('admin_recipients').select('email')
  if (error || !data) {
    console.error('[admin-allowlist] failed to load allowlist — denying:', error)
    return false
  }

  return data.some((r) => r.email.trim().toLowerCase() === normalized)
}
