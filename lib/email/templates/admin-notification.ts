// lib/email/templates/admin-notification.ts
// Admin notification email with Approve/Deny action buttons.
// Called once per admin address — each instance has unique approve/deny URLs.
// Pure function — no server-side I/O. No 'server-only' import needed.

import type { LeaveType } from '@/types/database'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'

export interface AdminNotificationTemplateArgs {
  teacherName: string
  teacherEmail: string
  leaveType: LeaveType
  startDate: string // ISO date string e.g. "2026-04-15"
  endDate: string
  reason: string | null
  approveUrl: string // full absolute URL with ?action=approve&...&admin=encoded@email
  denyUrl: string // full absolute URL with ?action=deny&...&admin=encoded@email
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
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const formattedStart = formatDate(startDate)
  const formattedEnd = formatDate(endDate)
  const reasonText = reason ?? '(none provided)'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Time-Off Request — Action Required</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #374151; line-height: 1.6;">

    <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">

      <p style="margin: 0 0 16px 0; font-size: 16px;">A new time-off request requires your review.</p>

      <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin: 24px 0; font-size: 15px;">
        <tbody>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500; width: 40%;">Teacher</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${teacherName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Email</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${teacherEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Leave Type</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${leaveLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Start Date</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formattedStart}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">End Date</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formattedEnd}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #6b7280; font-weight: 500;">Reason</td>
            <td style="padding: 12px 16px; color: #111827;">${reasonText}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 24px;">
        <a href="${approveUrl}" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">Approve</a>
        <span style="display: inline-block; width: 12px;"></span>
        <a href="${denyUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; display: inline-block;">Deny</a>
      </div>

    </div>

  </div>
</body>
</html>`
}
