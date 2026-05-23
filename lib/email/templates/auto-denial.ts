// lib/email/templates/auto-denial.ts
// HTML email template for blackout-period auto-denial.
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

export interface AutoDenialTemplateArgs {
  teacherName: string
  leaveType: LeaveType
  startDate: string // ISO date string e.g. "2026-04-15"
  endDate: string
}

export function autoDenialTemplate({
  teacherName,
  leaveType,
  startDate,
  endDate,
}: AutoDenialTemplateArgs): string {
  const safeName = escapeHtml(teacherName)
  const leaveLabel = LEAVE_TYPE_LABELS[leaveType]
  const dateRange =
    startDate === endDate
      ? formatDate(startDate)
      : `${formatDate(startDate)} – ${formatDate(endDate)}`

  const body = `
    ${paragraph(`Hi ${safeName} —`)}
    ${paragraph(`Thanks for submitting your request. Unfortunately the dates you picked fall on a school-wide blackout period, so the request has been automatically declined.`)}
    ${detailsTable([
      ['Leave type', leaveLabel],
      ['Dates', dateRange],
    ])}
    ${paragraph(`Blackout periods (testing weeks, finals, graduation, opening PD) are set school-wide and can't be overridden for individual requests. If you'd like to plan around them, the admin office can share the current calendar.`)}
    ${signOff()}
  `

  return emailShell({
    title: 'Time-Off Request — Blackout Period',
    eyebrow: 'Request not approved',
    eyebrowTone: 'bark',
    headline: `These dates fall on a<br /><em style="font-style:italic;">blackout period</em>.`,
    body,
  })
}
