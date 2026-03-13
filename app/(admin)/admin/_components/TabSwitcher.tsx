'use client'

import { useState } from 'react'
import type { Database } from '@/types/database'
import RequestsTab from './RequestsTab'
import BlackoutDatesTab from './BlackoutDatesTab'

type RequestRow = Database['public']['Tables']['requests']['Row']
type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']

type Tab = 'requests' | 'blackout'

interface TabSwitcherProps {
  requests: RequestRow[]
  blackoutDates: BlackoutDateRow[]
}

export default function TabSwitcher({ requests, blackoutDates }: TabSwitcherProps) {
  const [activeTab, setActiveTab] = useState<Tab>('requests')

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['requests', 'blackout'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'requests' ? 'Requests' : 'Blackout Dates'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'requests' ? (
        <RequestsTab requests={requests} />
      ) : (
        <BlackoutDatesTab blackoutDates={blackoutDates} />
      )}
    </div>
  )
}
