import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import TabSwitcher from '../_components/TabSwitcher'
import { logoutAdmin } from '../actions'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']

export default async function AdminDashboardPage() {
  const supabase = createClient()
  let requests: RequestRow[] = []
  let blackoutDates: BlackoutDateRow[] = []
  let fetchError = false

  try {
    const [{ data: requestsRaw, error: reqErr }, { data: blackoutDatesRaw, error: bdErr }] =
      await Promise.all([
        supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
        supabase.from('blackout_dates').select('*').order('start_date', { ascending: true }),
      ])
    if (reqErr || bdErr) throw new Error('db')
    requests = (requestsRaw ?? []) as RequestRow[]
    blackoutDates = (blackoutDatesRaw ?? []) as BlackoutDateRow[]
  } catch {
    fetchError = true
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Time-Off Requests — Admin</h1>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Logout
          </button>
        </form>
      </header>
      <main className="px-6 py-6">
        {fetchError && (
          <p className="mb-4 text-sm text-red-600">Unable to load data. Please refresh.</p>
        )}
        <TabSwitcher
          requests={requests}
          blackoutDates={blackoutDates}
        />
      </main>
    </div>
  )
}
