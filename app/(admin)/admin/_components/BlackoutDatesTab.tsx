'use client'
import type { Database } from '@/types/database'
type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']
export default function BlackoutDatesTab({ blackoutDates }: { blackoutDates: BlackoutDateRow[] }) {
  return <div><p className="text-gray-500 text-sm">Blackout dates — coming in next task</p></div>
}
