'use server'

import { redirect } from 'next/navigation'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { autoDenialTemplate } from '@/lib/email/templates/auto-denial'
import { adminNotificationTemplate } from '@/lib/email/templates/admin-notification'
import type { LeaveType, RequestStatus } from '@/types/database'
import { generateApprovalToken } from '@/lib/auth/tokens'

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
    is_blackout?: string[]
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
  // All FormData values are strings — never coerce with Boolean()
  const is_blackout = formData.get('is_blackout') === 'true'
  const reason = (formData.get('reason') as string) || null

  // 2. Server-side validation — collect all errors before returning
  const errors: FormState['errors'] = {}

  if (!teacher_name?.trim()) {
    errors.teacher_name = ['Full name is required.']
  }

  if (!teacher_email?.trim()) {
    errors.teacher_email = ['Work email is required.']
  } else if (!EMAIL_REGEX.test(teacher_email)) {
    errors.teacher_email = ['Please enter a valid email address.']
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

  // is_blackout unselected: formData.get('is_blackout') === null means teacher did not pick either radio
  if (formData.get('is_blackout') === null) {
    errors.is_blackout = ['Please indicate whether this falls on a blackout period.']
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
  // Covers both blackout and non-blackout submissions.
  // redirect() here is outside try/catch — NEXT_REDIRECT propagates correctly.
  const supabase = createClient()

  // 3. Server-side blackout check — overrides the client-supplied is_blackout field (SEC-01).
  // A teacher who selects "No" on the blackout question for dates in the blackout table
  // is still auto-denied. The client value is never trusted for status determination.
  const { data: blackoutRows, error: blackoutError } = await supabase
    .from('blackout_dates')
    .select('id')
    .lte('start_date', end_date)   // blackout row starts on or before request end date
    .gte('end_date', start_date)   // blackout row ends on or after request start date
    .limit(1)                       // existence check only — one hit is enough

  if (blackoutError) {
    // Fail closed: if the blackout check fails, do not proceed.
    // Returning an error is safer than silently using the client-supplied value.
    return { message: 'Unable to verify blackout dates. Please try again.' }
  }

  const serverBlackout = (blackoutRows?.length ?? 0) > 0

  // Status is derived from the server-computed blackout result, not the form field.
  const status: RequestStatus = serverBlackout ? 'auto_denied' : 'pending'

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

  // 4 & 5. Insert into Supabase and send auto-denial email if applicable.
  // Capture outcome before try/catch so redirect can use it after.
  let outcome: 'pending' | 'auto_denied' = 'pending'
  try {
    const { data: inserted, error: dbError } = await supabase
      .from('requests')
      .insert({
        teacher_name,
        teacher_email,
        start_date,
        end_date,
        leave_type,
        is_blackout: serverBlackout,
        reason,
        status,
      })
      .select('id')
      .single()
    if (dbError || !inserted) return { message: 'Something went wrong. Please try again.' }

    // Send auto-denial email ONLY for blackout submissions, ONLY AFTER successful DB insert
    if (serverBlackout) {
      await sendEmail({
        to: teacher_email,
        subject: 'Your time-off request — blackout period',
        html: autoDenialTemplate({
          teacherName: teacher_name,
          leaveType: leave_type,
          startDate: start_date,
          endDate: end_date,
        }),
      })
    }

    if (!serverBlackout) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
      const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
      const approveToken = generateApprovalToken(process.env.APPROVAL_HMAC_SECRET!, inserted.id, 'approve')
      const denyToken    = generateApprovalToken(process.env.APPROVAL_HMAC_SECRET!, inserted.id, 'deny')
      const batch = adminEmails.map(adminEmail => ({
        from: process.env.RESEND_FROM ?? 'Time Off System <noreply@example.com>',
        to: [adminEmail],
        subject: `New leave request: ${teacher_name}`,
        html: adminNotificationTemplate({
          teacherName: teacher_name,
          teacherEmail: teacher_email,
          leaveType: leave_type,
          startDate: start_date,
          endDate: end_date,
          reason,
          approveUrl: `${base}/api/approve?action=approve&id=${inserted.id}&token=${approveToken}&admin=${encodeURIComponent(adminEmail)}`,
          denyUrl:    `${base}/api/approve?action=deny&id=${inserted.id}&token=${denyToken}&admin=${encodeURIComponent(adminEmail)}`,
        }),
      }))
      await resend.batch.send(batch)
    }

    outcome = status
  } catch {
    return { message: 'Something went wrong. Please try again.' }
  }

  // 6. Redirect MUST be outside try/catch — redirect() throws NEXT_REDIRECT internally.
  // If placed inside try/catch, the catch block swallows it and the redirect silently fails.
  redirect(`/confirmation?status=${outcome}`)
}
