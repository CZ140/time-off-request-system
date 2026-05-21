'use server'

import { redirect } from 'next/navigation'
import { destroySession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

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
  const supabase = createClient()
  const { error } = await supabase.from('blackout_dates').delete().eq('id', id)
  if (error) return { error: 'Failed to delete blackout date. Please try again.' }
  return {}
}
