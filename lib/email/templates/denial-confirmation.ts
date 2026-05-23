// lib/email/templates/denial-confirmation.ts
// Denial confirmation email sent to the teacher.
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

export interface DenialConfirmationTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
}

export function denialConfirmationTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: DenialConfirmationTemplateArgs): string {
  const safeName = escapeHtml(teacherName)
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const dateRange =
    startDate === endDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`

  const body = `
    ${paragraph(`Hi ${safeName} —`)}
    ${paragraph(`We've reviewed your time-off request and unfortunately can't approve it at this time. If you'd like to talk through the reason or look at alternative dates, please reply to this email.`)}
    ${detailsTable([
      ['Leave type', leaveLabel],
      ['Dates', dateRange],
    ])}
    ${signOff()}
  `

  return emailShell({
    title: 'Time-Off Request — Not Approved',
    eyebrow: 'Request not approved',
    eyebrowTone: 'oxblood',
    headline: `We <em style="font-style:italic;">couldn't approve</em> this one.`,
    body,
  })
}
