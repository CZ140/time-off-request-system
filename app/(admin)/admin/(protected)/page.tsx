import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import TabSwitcher from '../_components/TabSwitcher'
import { logoutAdmin } from '../actions'
import { Wordmark } from '@/app/_components/Wordmark'

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
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-rule bg-card px-6 py-5 sm:px-14">
        <Wordmark sublabel="Administrator" />
        <div className="flex items-center gap-5 text-[13px]">
          <span className="hidden text-ink-2 sm:inline">Signed in as the administrator</span>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="label-eyebrow text-ink-2 transition-colors hover:text-oxblood"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main>
        {fetchError && (
          <div className="mx-6 mt-6 rounded-sm border border-oxblood/30 bg-oxblood/10 px-4 py-3 text-sm text-oxblood sm:mx-14">
            Unable to load data. Please refresh.
          </div>
        )}
        <TabSwitcher requests={requests} blackoutDates={blackoutDates} />
      </main>
    </div>
  )
}
