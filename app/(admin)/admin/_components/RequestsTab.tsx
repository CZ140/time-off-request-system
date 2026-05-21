'use client'

import { useState, useMemo } from 'react'
import type { Database } from '@/types/database'
import type { RequestStatus } from '@/types/database'
import { LEAVE_TYPE_LABELS, formatDate } from '@/lib/email/utils'

type RequestRow = Database['public']['Tables']['requests']['Row']
type SortColumn = keyof RequestRow
type SortDirection = 'asc' | 'desc'

interface SortState { column: SortColumn; direction: SortDirection }

// Filter pill config — values MUST match RequestStatus literals (not display strings)
const FILTER_OPTIONS: { value: 'all' | RequestStatus; label: string }[] = [
  { value: 'all',        label: 'All' },
  { value: 'pending',    label: 'Pending' },
  { value: 'approved',   label: 'Approved' },
  { value: 'denied',     label: 'Denied' },
  { value: 'auto_denied', label: 'Auto-Denied' },
]

// Status badge color map per locked decisions
const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  pending:     { label: 'Pending',     className: 'bg-yellow-100 text-yellow-800' },
  approved:    { label: 'Approved',    className: 'bg-green-100 text-green-800' },
  denied:      { label: 'Denied',      className: 'bg-red-100 text-red-800' },
  auto_denied: { label: 'Auto-Denied', className: 'bg-gray-100 text-gray-600' },
}

const COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'teacher_name',  label: 'Teacher Name' },
  { key: 'teacher_email', label: 'Email' },
  { key: 'leave_type',    label: 'Leave Type' },
  { key: 'start_date',    label: 'Start Date' },
  { key: 'end_date',      label: 'End Date' },
  { key: 'reason',        label: 'Reason' },
  { key: 'is_blackout',   label: 'Blackout?' },
  { key: 'status',        label: 'Status' },
  { key: 'submitted_at',  label: 'Submitted' },
  { key: 'reviewed_by',   label: 'Reviewed By' },
]

export default function RequestsTab({ requests }: { requests: RequestRow[] }) {
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all')
  const [sort, setSort] = useState<SortState>({ column: 'submitted_at', direction: 'desc' })
  const [expandedReason, setExpandedReason] = useState<string | null>(null)

  function handleColumnClick(column: SortColumn) {
    setSort(prev =>
      prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' }
    )
  }

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return requests
    return requests.filter(r => r.status === statusFilter)
  }, [requests, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Use String(value ?? '') to safely handle null columns (reason, reviewed_by)
      const av = String(a[sort.column] ?? '')
      const bv = String(b[sort.column] ?? '')
      const cmp = av.localeCompare(bv)
      return sort.direction === 'asc' ? cmp : -cmp
    })
  }, [filtered, sort])

  return (
    <div>
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleColumnClick(col.key)}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors"
                >
                  {col.label}
                  {sort.column === col.key && (
                    <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-400">
                  No requests found.
                </td>
              </tr>
            ) : (
              sorted.map(row => {
                const badge = STATUS_BADGE[row.status]
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.teacher_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.teacher_email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{LEAVE_TYPE_LABELS[row.leave_type]}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(row.start_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDate(row.end_date)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                      {row.reason ? (
                        <button
                          onClick={() => setExpandedReason(expandedReason === row.id ? null : row.id)}
                          className="text-left w-full hover:text-gray-900 transition-colors"
                        >
                          <span className={expandedReason === row.id ? '' : 'truncate block'}>
                            {row.reason}
                          </span>
                          {row.reason.length > 40 && (
                            <span className="text-xs text-blue-500 mt-0.5 block">
                              {expandedReason === row.id ? 'collapse' : 'expand'}
                            </span>
                          )}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.is_blackout ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{new Date(row.submitted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{row.reviewed_by ?? '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
