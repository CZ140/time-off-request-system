'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { autoDenialTemplate } from '@/lib/email/templates/auto-denial'
import type { LeaveType, RequestStatus } from '@/types/database'

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

  // 3. Determine status
  const status: RequestStatus = is_blackout ? 'auto_denied' : 'pending'

  // 4 & 5. Insert into Supabase and send auto-denial email if applicable.
  // Capture outcome before try/catch so redirect can use it after.
  let outcome: 'pending' | 'auto_denied' = 'pending'
  try {
    const supabase = createClient()
    const { error: dbError } = await supabase.from('requests').insert({
      teacher_name,
      teacher_email,
      start_date,
      end_date,
      leave_type,
      is_blackout,
      reason,
      status,
    })
    if (dbError) return { message: 'Something went wrong. Please try again.' }

    // Send auto-denial email ONLY for blackout submissions, ONLY AFTER successful DB insert
    if (is_blackout) {
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

    outcome = status
  } catch {
    return { message: 'Something went wrong. Please try again.' }
  }

  // 6. Redirect MUST be outside try/catch — redirect() throws NEXT_REDIRECT internally.
  // If placed inside try/catch, the catch block swallows it and the redirect silently fails.
  redirect(`/confirmation?status=${outcome}`)
}
