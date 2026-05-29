'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, sendBatch } from '@/lib/email/send'
import { autoDenialTemplate } from '@/lib/email/templates/auto-denial'
import { adminNotificationTemplate } from '@/lib/email/templates/admin-notification'
import type { LeaveType, RequestStatus } from '@/types/database'
import { generateApprovalToken, defaultApprovalExpiry } from '@/lib/auth/tokens'
import { isAllowedEmail } from '@/lib/auth/allowed-email'
import { checkAndLogRateLimit, getCallerIp } from '@/lib/rate-limit'
import { getAdminRecipients, NoAdminRecipientsError } from '@/lib/admin-recipients'

// Validates email structure: requires local-part, @, domain, dot, TLD — no whitespace.
// Simple regex intentionally: catches obvious invalids without over-constraining exotic valid addresses.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type FormState = {
  errors?: {
    teacher_name?: string[]
    teacher_email?: string[]
    start_date?: string[]
    end_date?: string[]
    leave_type?: string[]
    is_blockout?: string[]
  }
  message?: string
  // Return submitted values so form inputs can be restored via defaultValue on validation failure.
  // Next.js 15 resets uncontrolled inputs after a server action completes — this prevents frustrating data loss.
  values?: {
    teacher_name: string
    teacher_email: string
    start_date: string
    end_date: string
    leave_type: string
    reason: string
  }
}

export async function submitRequest(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  // 1. Extract fields
  const teacher_name = formData.get('teacher_name') as string
  const teacher_email = formData.get('teacher_email') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string
  const leave_type = formData.get('leave_type') as LeaveType
  // Note: the client-supplied is_blockout is intentionally NOT read here.
  // The blockout determination is made server-side from the blockout_dates table
  // (see serverBlockout below). The form field is only used to require the user
  // to acknowledge the blockout question — the answer itself is ignored.
  const reason = (formData.get('reason') as string) || null

  // 2. Server-side validation — collect all errors before returning
  const errors: FormState['errors'] = {}

  if (!teacher_name?.trim()) {
    errors.teacher_name = ['Full name is required.']
  }

  // Form-supplied email (no session — the form is open per the trust model of a
  // small, known cohort). The allowlist below is the only server-side gate on
  // who can submit. Demo mode skips the allowlist so portfolio reviewers can use it.
  const isDemo = process.env.DEMO_MODE === 'true'

  if (!teacher_email?.trim()) {
    errors.teacher_email = ['Work email is required.']
  } else if (!EMAIL_REGEX.test(teacher_email)) {
    errors.teacher_email = ['Please enter a valid email address.']
  } else if (!isDemo && !isAllowedEmail(teacher_email)) {
    errors.teacher_email = ["This email isn't authorized to submit requests."]
  }

  if (!start_date) {
    errors.start_date = ['Start date is required.']
  } else {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDateObj = new Date(start_date + 'T00:00:00')
    if (startDateObj < today) {
      errors.start_date = ['Start date cannot be in the past.']
    }
  }

  if (!end_date) {
    errors.end_date = ['End date is required.']
  } else if (start_date && !errors.start_date) {
    const startDateObj = new Date(start_date + 'T00:00:00')
    const endDateObj = new Date(end_date + 'T00:00:00')
    if (endDateObj < startDateObj) {
      errors.end_date = ['End date cannot be before start date.']
    }
  }

  if (!leave_type) {
    errors.leave_type = ['Please select a leave type.']
  }

  // is_blockout unselected: formData.get('is_blockout') === null means teacher did not pick either radio
  if (formData.get('is_blockout') === null) {
    errors.is_blockout = ['Please indicate whether this falls on a blockout period.']
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      values: {
        teacher_name: teacher_name ?? '',
        teacher_email: teacher_email ?? '',
        start_date: start_date ?? '',
        end_date: end_date ?? '',
        leave_type: leave_type ?? '',
        reason: reason ?? '',
      },
    }
  }

  // Duplicate guard: query for a matching row submitted within the last 60 seconds.
  // Covers both blockout and non-blockout submissions.
  // redirect() here is outside try/catch — NEXT_REDIRECT propagates correctly.
  const supabase = createClient()

  // Rate limit — runs after validation passes (so we don't count malformed
  // attempts against the user) and before any other DB work or email send.
  // Two dimensions:
  //   - per claimed email (10/hr): prevents a single victim's inbox from being
  //     spammed with auto-denial / confirmation emails
  //   - per source IP (100/hr): catches the "attacker rotates emails to bypass
  //     the per-email limit" case
  // Demo mode is NOT exempted: 10/hr is plenty for portfolio reviewers.
  const requestHeaders = await headers()
  const callerIp = getCallerIp(requestHeaders)
  const emailLimit = await checkAndLogRateLimit(`submit:email:${teacher_email.toLowerCase()}`, 10, 3600)
  if (!emailLimit.allowed) {
    return { message: 'Too many requests from this email address. Please try again in an hour.' }
  }
  const ipLimit = await checkAndLogRateLimit(`submit:ip:${callerIp}`, 100, 3600)
  if (!ipLimit.allowed) {
    return { message: 'Too many requests from your network. Please try again in an hour.' }
  }

  // 3. Server-side blockout check — overrides the client-supplied is_blockout field (SEC-01).
  // A teacher who selects "No" on the blockout question for dates in the blockout table
  // is still auto-denied. The client value is never trusted for status determination.
  const { data: blockoutRows, error: blockoutError } = await supabase
    .from('blockout_dates')
    .select('id')
    .lte('start_date', end_date)   // blockout row starts on or before request end date
    .gte('end_date', start_date)   // blockout row ends on or after request start date
    .limit(1)                       // existence check only — one hit is enough

  if (blockoutError) {
    // Fail closed: if the blockout check fails, do not proceed.
    // Returning an error is safer than silently using the client-supplied value.
    return { message: 'Unable to verify blockout dates. Please try again.' }
  }

  const serverBlockout = (blockoutRows?.length ?? 0) > 0

  // Status is derived from the server-computed blockout result, not the form field.
  const status: RequestStatus = serverBlockout ? 'auto_denied' : 'pending'

  const windowStart = new Date(Date.now() - 60_000).toISOString()
  const { data: duplicate } = await supabase
    .from('requests')
    .select('id')
    .eq('teacher_email', teacher_email)
    .eq('start_date', start_date)
    .eq('end_date', end_date)
    .gte('submitted_at', windowStart)
    .maybeSingle()

  if (duplicate) {
    redirect(`/confirmation?status=${status}`)
  }

  // 4. Insert into Supabase. DB insert is separated from email so a Resend failure
  // does not produce the same error message as a DB failure (REL-01).
  const { data: inserted, error: dbError } = await supabase
    .from('requests')
    .insert({
      teacher_name,
      teacher_email,
      start_date,
      end_date,
      leave_type,
      is_blockout: serverBlockout,
      reason,
      status,
    })
    .select('id')
    .single()

  if (dbError || !inserted) {
    return { message: 'Something went wrong saving your request. Please try again.' }
  }

  // 5. Send emails AFTER confirmed DB insert. Each email path has its own try/catch
  // so a Resend failure does not orphan the already-inserted row (REL-01).
  if (serverBlockout) {
    try {
      await sendEmail({
        to: teacher_email,
        subject: 'Your time-off request — blockout period',
        html: autoDenialTemplate({
          teacherName: teacher_name,
          leaveType: leave_type,
          startDate: start_date,
          endDate: end_date,
        }),
      })
    } catch (emailErr) {
      // Request is saved — log and redirect to confirmation anyway.
      console.error(`[REL-01] Auto-denial email failed for request ${inserted.id}:`, emailErr)
    }
  } else {
    let adminEmails: string[]
    try {
      // Recipient list lives in the admin_recipients table now (replaces the
      // old ADMIN_EMAILS env var). If the table is empty, NoAdminRecipientsError
      // is thrown and surfaced as a user-facing error instead of silently
      // sending zero emails.
      adminEmails = await getAdminRecipients()
    } catch (recipientErr) {
      console.error(`[REL-01] Failed to load admin recipients for request ${inserted.id}:`, recipientErr)
      return {
        message:
          recipientErr instanceof NoAdminRecipientsError
            ? 'We can’t send your request right now — no administrator is configured. Please contact the school office.'
            : 'Your request was received, but we could not look up the administrator. Please contact them directly.',
      }
    }

    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
      // Per-admin tokens: each admin gets a token bound to their own email so
      // a leaked link can't be used by a different admin. Expiry is shared
      // across all recipients (single issue-time timestamp).
      const exp = defaultApprovalExpiry()
      const secret = process.env.APPROVAL_HMAC_SECRET!
      await sendBatch(adminEmails.map(adminEmail => {
        const approveToken = generateApprovalToken(secret, inserted.id, 'approve', adminEmail, exp)
        const denyToken    = generateApprovalToken(secret, inserted.id, 'deny', adminEmail, exp)
        const adminParam   = encodeURIComponent(adminEmail)
        return {
          to: adminEmail,
          subject: `New leave request: ${teacher_name}`,
          html: adminNotificationTemplate({
            teacherName: teacher_name,
            teacherEmail: teacher_email,
            leaveType: leave_type,
            startDate: start_date,
            endDate: end_date,
            reason,
            approveUrl: `${base}/approve/${inserted.id}?action=approve&token=${approveToken}&admin=${adminParam}&exp=${exp}`,
            denyUrl:    `${base}/approve/${inserted.id}?action=deny&token=${denyToken}&admin=${adminParam}&exp=${exp}`,
          }),
        }
      }))
    } catch (emailErr) {
      // DB row exists but admins were not notified — return a distinct message (REL-01).
      console.error(`[REL-01] Admin notification failed for request ${inserted.id}:`, emailErr)
      return {
        message: 'Your request was received, but we could not notify the administrator. Please contact them directly.',
      }
    }
  }

  // 6. Redirect MUST be outside try/catch — redirect() throws NEXT_REDIRECT internally.
  redirect(`/confirmation?status=${status}`)
}
