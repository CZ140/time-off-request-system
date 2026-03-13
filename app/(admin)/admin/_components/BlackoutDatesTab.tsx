'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Database } from '@/types/database'
import { addBlackoutDate, deleteBlackoutDate, type BlackoutDateState } from '../actions'
import { formatDate } from '@/lib/email/utils'

type BlackoutDateRow = Database['public']['Tables']['blackout_dates']['Row']

export default function BlackoutDatesTab({ blackoutDates }: { blackoutDates: BlackoutDateRow[] }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formKey, setFormKey] = useState(0)  // increment to force form re-mount on success

  const [addState, addAction, addPending] = useActionState(
    async (prev: BlackoutDateState | null, formData: FormData) => {
      const result = await addBlackoutDate(prev, formData)
      if (result?.success) {
        setFormKey(k => k + 1)  // reset form fields by re-mounting the form
        router.refresh()         // re-fetch server component data to show new row
      }
      return result
    },
    null
  )

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteBlackoutDate(id)
      setConfirmId(null)
      router.refresh()  // re-fetch after delete
    })
  }

  return (
    <div>
      {/* Always-visible inline add form */}
      <form key={formKey} action={addAction} className="flex flex-wrap gap-3 items-end mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input
            name="label"
            type="text"
            placeholder="e.g. Spring Break"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
          <input
            name="start_date"
            type="date"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
          <input
            name="end_date"
            type="date"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={addPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {addPending ? 'Adding...' : 'Add'}
        </button>
        {addState?.error && (
          <p className="w-full text-sm text-red-600 mt-1">{addState.error}</p>
        )}
      </form>

      {/* Blackout dates list */}
      {blackoutDates.length === 0 ? (
        <p className="text-gray-400 text-sm">No blackout dates set.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {blackoutDates.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(row.start_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(row.end_date)}</td>
                  <td className="px-4 py-3">
                    {confirmId === row.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={isPending}
                          className="text-sm text-red-600 font-medium hover:text-red-800 disabled:opacity-50"
                        >
                          Confirm?
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={isPending}
                          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(row.id)}
                        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
