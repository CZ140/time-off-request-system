'use client'

import { useState } from 'react'
import type { Database } from '@/types/database'
import RequestsTab from './RequestsTab'
import BlockoutDatesTab from './BlockoutDatesTab'
import RecipientsTab from './RecipientsTab'
import StatsTab from './StatsTab'
import CalendarTab from './CalendarTab'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlockoutDateRow = Database['public']['Tables']['blockout_dates']['Row']
type AdminRecipientRow = Database['public']['Tables']['admin_recipients']['Row']

type TabId = 'requests' | 'blockout' | 'recipients' | 'calendar' | 'stats'

interface TabSwitcherProps {
  requests: RequestRow[]
  blockoutDates: BlockoutDateRow[]
  recipients: AdminRecipientRow[]
}

// All five tabs now have real implementations. The SOON_TABS list is empty —
// kept as an array so a future placeholder tab can be added back without
// reshaping the rendering logic.
const SOON_TABS: TabId[] = []

const TAB_DEFS: { id: TabId; label: string }[] = [
  { id: 'requests', label: 'Requests' },
  { id: 'blockout', label: 'Blockouts' },
  { id: 'recipients', label: 'Recipients' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'stats', label: 'Stats' },
]

export default function TabSwitcher({ requests, blockoutDates, recipients }: TabSwitcherProps) {
  const [activeTab, setActiveTab] = useState<TabId>('requests')

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-rule bg-cream-alt px-6 sm:px-14">
        {TAB_DEFS.map((tab) => {
          const isActive = activeTab === tab.id
          const isSoon = SOON_TABS.includes(tab.id)
          return (
            <button
              key={tab.id}
              onClick={() => !isSoon && setActiveTab(tab.id)}
              disabled={isSoon}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px flex shrink-0 items-center gap-2 border-x border-t-2 px-5 py-3.5 text-sm font-bold transition-colors ${
                isActive
                  ? 'border-x-rule border-t-moss bg-cream text-ink'
                  : isSoon
                    ? 'cursor-not-allowed border-transparent text-ink-3'
                    : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {tab.label}
              {tab.id === 'requests' && pendingCount > 0 && (
                <span className="rounded-full bg-moss px-1.5 py-px text-[10px] font-bold text-cream">
                  {pendingCount}
                </span>
              )}
              {isSoon && (
                <span className="label-eyebrow rounded-full border border-rule px-1.5 py-px text-[9px] text-ink-3">
                  soon
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-6 py-8 sm:px-14">
        {activeTab === 'requests' && <RequestsTab requests={requests} />}
        {activeTab === 'blockout' && <BlockoutDatesTab blockoutDates={blockoutDates} />}
        {activeTab === 'recipients' && <RecipientsTab recipients={recipients} />}
        {activeTab === 'stats' && <StatsTab requests={requests} />}
        {activeTab === 'calendar' && <CalendarTab requests={requests} blockoutDates={blockoutDates} />}
        {SOON_TABS.includes(activeTab) && <ComingSoonPanel tab={activeTab} />}
      </div>
    </div>
  )
}

function ComingSoonPanel({ tab }: { tab: TabId }) {
  const copy: Record<string, { title: string; body: string }> = {
    calendar: {
      title: 'Calendar',
      body: 'A month view of who is out when — overlaid with blockout periods. So you can see coverage at a glance.',
    },
    stats: {
      title: 'Stats',
      body: 'Top submitters, leave-type breakdown, approval rate over time. Lightweight — not a dashboard product.',
    },
  }
  const c = copy[tab]
  return (
    <div className="max-w-xl rounded-md border border-dashed border-rule bg-card p-8">
      <div className="label-eyebrow text-bark">Coming soon</div>
      <h2 className="mt-2 font-display text-[32px] leading-tight text-ink">{c.title}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
    </div>
  )
}
