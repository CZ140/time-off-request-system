'use server'

import { redirect } from 'next/navigation'
import { destroySession, getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { checkAndLogRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email/send'
import { approvalConfirmationTemplate } from '@/lib/email/templates/approval-confirmation'
import { denialConfirmationTemplate } from '@/lib/email/templates/denial-confirmation'
import type { Database, LeaveType, RequestStatus } from '@/types/database'

// 100 admin actions per session per hour. The session ID is generated at login
// time (lib/auth/session.ts) and stored in the iron-session cookie. A new login
// gets a fresh session ID and therefore a fresh budget.
const ADMIN_MAX_PER_HOUR = 100
const ADMIN_WINDOW_SECONDS = 3600

async function adminRateLimitOk(): Promise<boolean> {
  const session = await getSession()
  // No sessionId means an unauthenticated caller — let other middleware/auth
  // checks handle that (they will already have rejected the call by the time
  // we get here). Don't burn a rate-limit entry on it.
  if (!session.sessionId) return true
  const result = await checkAndLogRateLimit(
    `admin:${session.sessionId}`,
    ADMIN_MAX_PER_HOUR,
    ADMIN_WINDOW_SECONDS
  )
  return result.allowed
}

// --- Logout ---

export async function logoutAdmin() {
  await destroySession()
  redirect('/admin/login')  // outside try/catch — NEXT_REDIRECT must not be swallowed
}

// --- Blackout Date CRUD ---

export type BlackoutDateState = {
  error?: string
  success?: boolean
}

export async function addBlackoutDate(
  prevState: BlackoutDateState | null,
  formData: FormData
): Promise<BlackoutDateState> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const label = (formData.get('label') as string)?.trim()
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  if (!label || !start_date || !end_date) {
    return { error: 'All fields are required.' }
  }

  if (end_date < start_date) {
    return { error: 'End date must be on or after start date.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('blackout_dates')
    .insert({ label, start_date, end_date })

  if (error) {
    return { error: 'Failed to add blackout date. Please try again.' }
  }

  return { success: true }
}

export async function deleteBlackoutDate(id: string): Promise<{ error?: string }> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('blackout_dates').delete().eq('id', id)
  if (error) return { error: 'Failed to delete blackout date. Please try again.' }
  return {}
}

// --- Request CRUD ---

// Approve or deny a pending request from the dashboard.
//
// Parallel path to the email-link flow (app/approve/[id]/actions.ts). Required
// for demo mode where emails are suppressed and the link flow is therefore a
// dead-end. Also useful in production as a faster alternative to clicking
// through an email — the admin is already on the dashboard.
//
// Atomic guard via .eq('status', 'pending') prevents double-action: if two
// admins click simultaneously (or one admin clicks both dashboard and email
// link), only the first write succeeds.
export type ReviewState = { error?: string; success?: boolean }

type RequestRow = Database['public']['Tables']['requests']['Row']

export async function reviewRequest(
  id: string,
  decision: 'approve' | 'deny',
): Promise<ReviewState> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  if (decision !== 'approve' && decision !== 'deny') {
    return { error: 'Invalid decision.' }
  }

  const supabase = createClient()
  const newStatus: RequestStatus = decision === 'approve' ? 'approved' : 'denied'

  // Atomic update: .eq('status', 'pending') guarantees we only act on a row
  // that hasn't already been reviewed. If it was approved/denied between the
  // page render and this action, the update returns 0 rows and we surface an
  // error rather than overwrite the prior decision.
  const { data: updated, error } = await supabase
    .from('requests')
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'Dashboard',
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single<RequestRow>()

  if (error || !updated) {
    return {
      error:
        'This request is no longer pending — it may have been reviewed via the email link, or by another admin. Refresh to see the current status.',
    }
  }

  // Send the teacher confirmation email after the DB write is confirmed.
  // Email failures don't roll back — the DB is the source of truth and the
  // admin saw the action complete. Surfacing an email failure as an error
  // would just make the admin re-click, double-emailing the teacher.
  try {
    if (decision === 'approve') {
      await sendEmail({
        to: updated.teacher_email,
        subject: 'Your time-off request has been approved',
        html: approvalConfirmationTemplate({
          teacherName: updated.teacher_name,
          leaveType: updated.leave_type as LeaveType,
          startDate: updated.start_date,
          endDate: updated.end_date,
        }),
      })
    } else {
      await sendEmail({
        to: updated.teacher_email,
        subject: 'Your time-off request has been denied',
        html: denialConfirmationTemplate({
          teacherName: updated.teacher_name,
          leaveType: updated.leave_type as LeaveType,
          startDate: updated.start_date,
          endDate: updated.end_date,
        }),
      })
    }
  } catch (emailErr) {
    console.error(`[admin/reviewRequest] notification email failed for ${id}:`, emailErr)
  }

  return { success: true }
}

// Hard delete of a request row. Surfaces from the admin dashboard's Requests
// tab via the confirm-then-delete pattern (same as blackout dates).
//
// No status restriction: an admin can delete any row including 'approved'.
// Note that deleting a row does NOT unsend any approval/denial email already
// dispatched to the teacher — this action is intended for cleanup of test data
// or genuinely stale records, not for reversing decisions.
export async function deleteRequest(id: string): Promise<{ error?: string }> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('requests').delete().eq('id', id)
  if (error) return { error: 'Failed to delete request. Please try again.' }
  return {}
}

// --- Admin Recipients CRUD ---

// Same loose email shape check used in app/(public)/actions.ts.
// We don't require a specific domain here — the recipient list is admin-curated
// and may include non-school emails (e.g. a personal address as a backup).
const RECIPIENT_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AdminRecipientState = {
  error?: string
  success?: boolean
}

export async function addAdminRecipient(
  prevState: AdminRecipientState | null,
  formData: FormData,
): Promise<AdminRecipientState> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const labelRaw = ((formData.get('label') as string) ?? '').trim()
  const label = labelRaw.length > 0 ? labelRaw : null

  if (!email) {
    return { error: 'Email is required.' }
  }
  if (!RECIPIENT_EMAIL_REGEX.test(email)) {
    return { error: 'That doesn’t look like a valid email address.' }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('admin_recipients')
    .insert({ email, label })

  if (error) {
    // 23505 = unique_violation from Postgres. Translate to a friendly message.
    if (error.code === '23505') {
      return { error: 'That email is already on the recipient list.' }
    }
    return { error: 'Failed to add recipient. Please try again.' }
  }

  return { success: true }
}

// Removes a recipient by id. Safety rail: refuses if it would leave zero rows,
// because an empty table means the submit flow can't notify anyone.
export async function removeAdminRecipient(id: string): Promise<{ error?: string }> {
  if (!(await adminRateLimitOk())) {
    return { error: 'Too many admin actions in the last hour. Slow down and try again shortly.' }
  }

  const supabase = createClient()

  // Count first so we can refuse before deleting. Two queries instead of one,
  // but the table is tiny (handful of rows) and the safety property is worth it.
  const { count, error: countErr } = await supabase
    .from('admin_recipients')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    return { error: 'Failed to check the recipient list. Please try again.' }
  }
  if ((count ?? 0) <= 1) {
    return {
      error: 'Add another recipient before removing this one — leaving the list empty would stop all admin notifications.',
    }
  }

  const { error } = await supabase.from('admin_recipients').delete().eq('id', id)
  if (error) return { error: 'Failed to remove recipient. Please try again.' }
  return {}
}
