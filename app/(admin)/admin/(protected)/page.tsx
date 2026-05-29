import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import TabSwitcher from '../_components/TabSwitcher'
import { logoutAdmin } from '../actions'
import { getConnectionSummary, type ConnectionSummary } from '@/lib/calendar/store'
import { Wordmark } from '@/app/_components/Wordmark'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlockoutDateRow = Database['public']['Tables']['blockout_dates']['Row']
type AdminRecipientRow = Database['public']['Tables']['admin_recipients']['Row']

export default async function AdminDashboardPage() {
  const supabase = createClient()
  let requests: RequestRow[] = []
  let blockoutDates: BlockoutDateRow[] = []
  let recipients: AdminRecipientRow[] = []
  let calendarConnection: ConnectionSummary | null = null
  let fetchError = false
  const isDemo = process.env.DEMO_MODE === 'true'

  try {
    const [
      { data: requestsRaw, error: reqErr },
      { data: blockoutDatesRaw, error: bdErr },
      { data: recipientsRaw, error: recErr },
    ] = await Promise.all([
      supabase.from('requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('blockout_dates').select('*').order('start_date', { ascending: true }),
      supabase.from('admin_recipients').select('*').order('created_at', { ascending: true }),
    ])
    if (reqErr || bdErr || recErr) {
      // Surface the underlying Supabase error so misconfiguration (missing env
      // vars, paused project, RLS surprise, missing tables) shows up in the
      // server log instead of silently producing an empty dashboard.
      console.error('[admin/dashboard] fetch failed', { reqErr, bdErr, recErr })
      throw new Error('db')
    }
    requests = (requestsRaw ?? []) as RequestRow[]
    blockoutDates = (blockoutDatesRaw ?? []) as BlockoutDateRow[]
    recipients = (recipientsRaw ?? []) as AdminRecipientRow[]
  } catch (e) {
    console.error('[admin/dashboard] caught', e)
    fetchError = true
  }

  // Calendar connection is non-critical to the dashboard — load it separately so
  // a missing table / unconfigured sync never blanks the whole page.
  try {
    calendarConnection = await getConnectionSummary()
  } catch (e) {
    console.error('[admin/dashboard] calendar connection load failed', e)
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
        <TabSwitcher
          requests={requests}
          blockoutDates={blockoutDates}
          recipients={recipients}
          calendarConnection={calendarConnection}
          isDemo={isDemo}
        />
      </main>
    </div>
  )
}
