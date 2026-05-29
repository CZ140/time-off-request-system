'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { verifyApprovalToken } from '@/lib/auth/tokens'
import { approvalConfirmationTemplate } from '@/lib/email/templates/approval-confirmation'
import { denialConfirmationTemplate } from '@/lib/email/templates/denial-confirmation'
import { syncApprovalToCalendar } from '@/lib/calendar/sync'
import { checkAndLogRateLimit } from '@/lib/rate-limit'
import type { Database, LeaveType } from '@/types/database'

type RequestRow = Database['public']['Tables']['requests']['Row']

export async function confirmApproval(formData: FormData) {
  const id      = formData.get('id') as string
  const action  = formData.get('action') as string
  const token   = formData.get('token') as string
  const admin   = formData.get('admin') as string
  const expRaw  = formData.get('exp') as string

  // Re-validate on the server — never trust form fields alone.
  // The hidden fields could be tampered by a malicious actor.
  if (!id || !token || !admin || !expRaw || (action !== 'approve' && action !== 'deny')) {
    redirect('/invalid')
  }

  const exp = Number(expRaw)
  const result = verifyApprovalToken(
    process.env.APPROVAL_HMAC_SECRET!,
    id,
    action,
    admin,
    exp,
    token
  )

  if (!result.valid) {
    if (result.reason === 'expired') redirect('/expired')
    redirect('/invalid')
  }

  // Rate-limit by verified admin email. The email-click approval flow has no
  // iron-session, so we substitute the HMAC-verified `admin` field as the
  // identity dimension. 100/hr is plenty for an admin clearing a queue.
  // We pass this check AFTER token verification so we never log a row for
  // tampered/forged inputs.
  const adminLimit = await checkAndLogRateLimit(`approve:admin:${admin.toLowerCase()}`, 100, 3600)
  if (!adminLimit.allowed) {
    redirect('/invalid')
  }

  const supabase = createClient()
  const newStatus = action === 'approve' ? 'approved' : 'denied'

  // Atomic update: .eq('status', 'pending') means if two admins confirm simultaneously
  // only the first write succeeds. The second gets 0 rows back and takes the else branch.
  const { data: updated } = await supabase
    .from('requests')
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin || '',
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single<RequestRow>()

  if (!updated) {
    // 0 rows matched — already reviewed by another admin. Fetch current state to show /reviewed.
    const { data: existing } = await supabase
      .from('requests')
      .select('status, teacher_name, start_date, end_date, leave_type, reviewed_by')
      .eq('id', id)
      .single<Pick<RequestRow, 'status' | 'teacher_name' | 'start_date' | 'end_date' | 'leave_type' | 'reviewed_by'>>()

    if (existing) {
      const p = new URLSearchParams({
        status:       existing.status,
        teacher_name: existing.teacher_name,
        start_date:   existing.start_date,
        end_date:     existing.end_date,
        leave_type:   existing.leave_type,
        reviewed_by:  existing.reviewed_by ?? '',
      })
      redirect(`/reviewed?${p.toString()}`)
    }
    redirect('/invalid')
  }

  // Send teacher confirmation email after confirmed DB write.
  try {
    if (action === 'approve') {
      await sendEmail({
        to: updated.teacher_email,
        subject: 'Your time-off request has been approved',
        html: approvalConfirmationTemplate({
          teacherName: updated.teacher_name,
          leaveType:   updated.leave_type as LeaveType,
          startDate:   updated.start_date,
          endDate:     updated.end_date,
        }),
      })
    } else {
      await sendEmail({
        to: updated.teacher_email,
        subject: 'Your time-off request has been denied',
        html: denialConfirmationTemplate({
          teacherName: updated.teacher_name,
          leaveType:   updated.leave_type as LeaveType,
          startDate:   updated.start_date,
          endDate:     updated.end_date,
        }),
      })
    }
  } catch (emailErr) {
    console.error(`[approval] Confirmation email failed for request ${id}:`, emailErr)
    // DB write succeeded — still redirect to /reviewed so admin sees the outcome.
  }

  // Sync approved time off to the connected Outlook calendar. Non-fatal and a
  // no-op when nothing is connected (same contract as the email above).
  if (action === 'approve') {
    try {
      await syncApprovalToCalendar(updated)
    } catch (calErr) {
      console.error(`[approval] calendar sync failed for request ${id}:`, calErr)
    }
  }

  const p = new URLSearchParams({
    first:        'true',
    status:       updated.status,
    teacher_name: updated.teacher_name,
    start_date:   updated.start_date,
    end_date:     updated.end_date,
    leave_type:   updated.leave_type,
    reviewed_by:  updated.reviewed_by ?? '',
  })
  redirect(`/reviewed?${p.toString()}`)
}
