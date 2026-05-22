'use server'

import { redirect } from 'next/navigation'
import { destroySession, getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { checkAndLogRateLimit } from '@/lib/rate-limit'

// 100 admin actions per session per hour. The session ID is generated at login
// time (lib/auth/session.ts) and stored in the iron-session cookie. A new login
// gets a fresh session ID and therefore a fresh budget.
const ADMIN_MAX_PER_HOUR = 100
const ADMIN_WINDOW_SECONDS = 3600

async function adminRateLimitOk(): Promise<boolean> {
  const session = await getSession()
  // No sessionId means an unauthenticated caller — let other middleware/auth
  // checks handle that (they will already have rejected the call by the time
  // we get here). Don't burn a rate-limit entry on it.
  if (!session.sessionId) return true
  const result = await checkAndLogRateLimit(
    `admin:${session.sessionId}`,
    ADMIN_MAX_PER_HOUR,
    ADMIN_WINDOW_SECONDS
  )
  return result.allowed
}

// --- Logout ---

export async function logoutAdmin() {
  await destroySession()
  redirect('/admin/login')  // outside try/catch — NEXT_REDIRECT must not be swallowed
}

// --- Blackout Date CRUD ---

export type BlackoutDateState = {
  error?: string
  success?: boolean
}

export async function addBlackoutDate(
  prevState: BlackoutDateState | null,
  formData: FormData
): Promise<BlackoutDateState> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const label = (formData.get('label') as string)?.trim()
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  if (!label || !start_date || !end_date) {
    return { error: 'All fields are required.' }
  }

  if (end_date < start_date) {
    return { error: 'End date must be on or after start date.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('blackout_dates')
    .insert({ label, start_date, end_date })

  if (error) {
    return { error: 'Failed to add blackout date. Please try again.' }
  }

  return { success: true }
}

export async function deleteBlackoutDate(id: string): Promise<{ error?: string }> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('blackout_dates').delete().eq('id', id)
  if (error) return { error: 'Failed to delete blackout date. Please try again.' }
  return {}
}
