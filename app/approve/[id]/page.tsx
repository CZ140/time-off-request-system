import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyApprovalToken } from '@/lib/auth/tokens'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import { confirmApproval } from './actions'
import type { Database } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ action?: string; token?: string; admin?: string; exp?: string }>
}

export default async function ApprovalConfirmationPage({ params, searchParams }: Props) {
  const { id } = await params
  const { action, token, admin, exp } = await searchParams

  // Validate params and HMAC token server-side before fetching any data.
  if (!action || !token || !admin || !exp || (action !== 'approve' && action !== 'deny')) {
    redirect('/invalid')
  }

  const expNum = Number(exp)
  const result = verifyApprovalToken(
    process.env.APPROVAL_HMAC_SECRET!,
    id,
    action,
    admin,
    expNum,
    token
  )

  if (!result.valid) {
    // Expired tokens get a specific page so the admin understands why and can
    // request a fresh link, rather than the generic "invalid link" treatment
    // used for tampering and malformed input.
    if (result.reason === 'expired') redirect('/expired')
    redirect('/invalid')
  }

  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single<RequestRow>()

  if (error || !row) redirect('/invalid')

  // Already actioned — redirect to /reviewed without first=true (idempotent re-click).
  if (row.status !== 'pending') {
    const p = new URLSearchParams({
      status:       row.status,
      teacher_name: row.teacher_name,
      start_date:   row.start_date,
      end_date:     row.end_date,
      leave_type:   row.leave_type,
      reviewed_by:  row.reviewed_by ?? '',
    })
    redirect(`/reviewed?${p.toString()}`)
  }

  const isApprove = action === 'approve'
  const actionLabel = isApprove ? 'Approve' : 'Deny'
  const buttonClass = isApprove
    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-lg w-full">

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {actionLabel} Time-Off Request
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Review the request details below, then confirm your decision.
        </p>

        {/* Request details */}
        <div className="border border-gray-100 rounded-md divide-y divide-gray-100 mb-6">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Teacher</span>
            <span className="text-sm text-gray-900">{row.teacher_name}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Email</span>
            <span className="text-sm text-gray-900">{row.teacher_email}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Leave Type</span>
            <span className="text-sm text-gray-900">{LEAVE_TYPE_LABELS[row.leave_type]}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">Start Date</span>
            <span className="text-sm text-gray-900">{formatDate(row.start_date)}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm font-medium text-gray-500">End Date</span>
            <span className="text-sm text-gray-900">{formatDate(row.end_date)}</span>
          </div>
          {row.reason && (
            <div className="px-4 py-3">
              <span className="text-sm font-medium text-gray-500 block mb-1">Reason</span>
              <span className="text-sm text-gray-900">{row.reason}</span>
            </div>
          )}
        </div>

        {/* Confirmation form — hidden fields carry the verified token through to the Server Action.
            The action re-verifies the HMAC against admin + exp so a tampered hidden field still fails. */}
        <form action={confirmApproval}>
          <input type="hidden" name="id"     value={id} />
          <input type="hidden" name="action" value={action} />
          <input type="hidden" name="token"  value={token} />
          <input type="hidden" name="admin"  value={admin} />
          <input type="hidden" name="exp"    value={exp} />

          <button
            type="submit"
            className={`w-full text-white py-2.5 px-4 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
          >
            Confirm {actionLabel}
          </button>
        </form>

      </div>
    </main>
  )
}
