// app/api/approve/route.ts
// Full approval/denial handler for the admin email workflow.
// Validates the shared APPROVAL_SECRET, applies idempotent status updates,
// and sends the correct teacher confirmation email only after a confirmed DB write.
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { approvalConfirmationTemplate } from '@/lib/email/templates/approval-confirmation'
import { denialConfirmationTemplate } from '@/lib/email/templates/denial-confirmation'
import type { Database, LeaveType } from '@/types/database'
import { verifyApprovalToken } from '@/lib/auth/tokens'

type RequestRow = Database['public']['Tables']['requests']['Row']

function buildReviewedUrl(request: NextRequest, row: RequestRow): URL {
  const reviewedUrl = new URL('/reviewed', request.url)
  reviewedUrl.searchParams.set('status', row.status)
  reviewedUrl.searchParams.set('teacher_name', row.teacher_name)
  reviewedUrl.searchParams.set('start_date', row.start_date)
  reviewedUrl.searchParams.set('end_date', row.end_date)
  reviewedUrl.searchParams.set('leave_type', row.leave_type)
  reviewedUrl.searchParams.set('reviewed_by', row.reviewed_by ?? '')
  return reviewedUrl
}

export async function GET(request: NextRequest) {
  // Step 1 — Parse query params
  const { searchParams } = request.nextUrl
  const action = searchParams.get('action')
  const id = searchParams.get('id')
  const token = searchParams.get('token')
  const admin = searchParams.get('admin')

  // Step 2 — Validate token and params
  if (!token || !id || !action) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }
  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }
  if (!verifyApprovalToken(process.env.APPROVAL_HMAC_SECRET!, id, action, token)) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }

  // Step 3 — Fetch request row from Supabase
  const supabase = createClient()
  const { data: requestRow, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single<RequestRow>()

  if (error || !requestRow) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }

  // Step 4 — Idempotency check: if already actioned, redirect without DB change or email
  if (requestRow.status !== 'pending') {
    return NextResponse.redirect(buildReviewedUrl(request, requestRow))
  }

  // Step 5 — Update DB
  const newStatus = action === 'approve' ? 'approved' : 'denied'
  const { data: updated, error: updateError } = await supabase
    .from('requests')
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin ?? '',
    })
    .eq('id', id)
    .select()
    .single<RequestRow>()

  if (updateError || !updated) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }

  // Step 6 — Send teacher confirmation email (ONLY after confirmed DB update — APPR-04)
  if (action === 'approve') {
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

  // Step 7 — Redirect to /reviewed with display data. ?first=true signals this is the
  // initial action so the page can show accurate copy rather than "Already Reviewed".
  const firstActionUrl = buildReviewedUrl(request, updated)
  firstActionUrl.searchParams.set('first', 'true')
  return NextResponse.redirect(firstActionUrl)
}
