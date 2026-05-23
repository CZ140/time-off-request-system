// lib/email/templates/approval-confirmation.ts
// Approval confirmation email sent to the teacher.
// Pure function — no server-side I/O. No 'server-only' import needed.
import type { LeaveType } from '@/types/database'
import { formatDate, LEAVE_TYPE_LABELS } from '@/lib/email/utils'
import {
  emailShell,
  detailsTable,
  paragraph,
  signOff,
  escapeHtml,
} from './_shell'

export interface ApprovalConfirmationTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
}

export function approvalConfirmationTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: ApprovalConfirmationTemplateArgs): string {
  const safeName = escapeHtml(teacherName)
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const dateRange =
    startDate === endDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`

  const body = `
    ${paragraph(`Hi ${safeName} —`)}
    ${paragraph(`Good news. Your time-off request has been approved.`)}
    ${detailsTable([
      ['Leave type', leaveLabel],
      ['Dates', dateRange],
    ])}
    ${paragraph(`Enjoy the time away. If anything changes before then, just reply to this email.`)}
    ${signOff()}
  `

  return emailShell({
    title: 'Time-Off Request — Approved',
    eyebrow: 'Request approved',
    eyebrowTone: 'moss',
    headline: `You're <em style="font-style:italic;">all set</em>.`,
    body,
  })
}
