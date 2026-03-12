// lib/email/templates/denial-confirmation.ts
// Denial confirmation email sent to the teacher.
// Echoes dates and leave type. Respectful and direct — no next-steps guidance.
// Pure function — no server-side I/O. No 'server-only' import needed.

import type { LeaveType } from '@/types/database'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'

export interface DenialConfirmationTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string // ISO date string e.g. "2026-04-15"
  endDate: string
}

export function denialConfirmationTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: DenialConfirmationTemplateArgs): string {
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const formattedStart = formatDate(startDate)
  const formattedEnd = formatDate(endDate)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Time-Off Request — Denied</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #374151; line-height: 1.6;">

    <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">

      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${teacherName},</p>

      <p style="margin: 0 0 16px 0; font-size: 16px;">
        We have reviewed your time-off request and are unable to approve it at this time.
      </p>

      <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin: 24px 0; font-size: 15px;">
        <tbody>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500; width: 40%;">Leave Type</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${leaveLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">Start Date</td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formattedStart}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #6b7280; font-weight: 500;">End Date</td>
            <td style="padding: 12px 16px; color: #111827;">${formattedEnd}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin: 0; font-size: 16px;">
        Warm regards,<br />
        <strong>School Administration</strong>
      </p>

    </div>

  </div>
</body>
</html>`
}
