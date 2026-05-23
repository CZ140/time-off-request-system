// lib/email/templates/admin-notification.ts
// Admin notification email with Approve/Deny action buttons.
// Called once per admin address — each instance has unique approve/deny URLs
// (per-admin HMAC tokens, see app/(public)/actions.ts).
// Pure function — no server-side I/O. No 'server-only' import needed.

import type { LeaveType } from '@/types/database'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import {
  emailShell,
  detailsTable,
  paragraph,
  pullQuote,
  buttonPrimary,
  buttonDanger,
  buttonRow,
  escapeHtml,
} from './_shell'

export interface AdminNotificationTemplateArgs {
  teacherName: string
  teacherEmail: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason: string | null
  approveUrl: string
  denyUrl: string
}

export function adminNotificationTemplate({
  teacherName,
  teacherEmail,
  leaveType,
  startDate,
  endDate,
  reason,
  approveUrl,
  denyUrl,
}: AdminNotificationTemplateArgs): string {
  const safeName = escapeHtml(teacherName)
  const safeEmail = escapeHtml(teacherEmail)
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const dateRange =
    startDate === endDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`

  // approveUrl / denyUrl are constructed server-side from URL-encoded inputs,
  // so they don't need extra escaping for the href attribute. The visible
  // label text is fully static.

  const body = `
    ${paragraph(`A new time-off request just landed. Approve or deny below — each link is single-use and tied to this email address.`)}
    ${detailsTable([
      ['Teacher', `${safeName}<div style="margin-top:2px;font-family:-apple-system,sans-serif;font-size:13px;color:#43504A;">${safeEmail}</div>`],
      ['Leave type', leaveLabel],
      ['Dates', dateRange],
    ])}
    ${reason ? pullQuote(escapeHtml(reason)) : ''}
    ${buttonRow(buttonPrimary(approveUrl, 'Approve'), buttonDanger(denyUrl, 'Deny'))}
    ${paragraph(`<span style="font-size:13px;color:#7A8580;">Or sign in to the admin dashboard if you'd rather act on it there.</span>`)}
  `

  return emailShell({
    title: 'Time-Off Request — Action Required',
    eyebrow: 'Action needed',
    eyebrowTone: 'moss',
    headline: `<em style="font-style:italic;">${safeName}</em> is asking for ${dateRange}.`,
    body,
  })
}
