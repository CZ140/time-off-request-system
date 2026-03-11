// lib/email/templates/auto-denial.ts
// HTML email template for blackout-period auto-denial.
// Pure function — no server-side I/O. No 'server-only' import needed.
// Imported by app/(public)/actions.ts which is already server-only.

import type { LeaveType } from '@/types/database'

export interface AutoDenialTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string // ISO date string e.g. "2026-04-15"
  endDate: string
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick Leave',
  personal: 'Personal Leave',
  vacation: 'Vacation',
  bereavement: 'Bereavement Leave',
  jury_duty: 'Jury Duty',
  professional_development: 'Professional Development',
  maternity_paternity: 'Maternity / Paternity Leave',
}

function formatDate(iso: string): string {
  // Append T00:00:00 to parse as LOCAL time, not UTC midnight.
  // Without this, US timezones shift the date one day back (e.g. April 15 → April 14).
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function autoDenialTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: AutoDenialTemplateArgs): string {
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const formattedStart = formatDate(startDate)
  const formattedEnd = formatDate(endDate)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Time-Off Request — Blackout Period</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px; color: #374151; line-height: 1.6;">

    <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; border: 1px solid #e5e7eb;">

      <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${teacherName},</p>

      <p style="margin: 0 0 16px 0; font-size: 16px;">
        Thank you for submitting your time-off request. Unfortunately, we are unable to approve this
        request because the dates you selected fall within a designated blackout period.
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

      <p style="margin: 0 0 24px 0; font-size: 16px;">
        Blackout periods are school-wide policy and cannot be overridden for individual requests.
      </p>

      <p style="margin: 0; font-size: 16px;">
        Warm regards,<br />
        <strong>School Administration</strong>
      </p>

    </div>

  </div>
</body>
</html>`
}
