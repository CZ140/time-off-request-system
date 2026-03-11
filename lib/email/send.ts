// lib/email/send.ts
// Resend email wrapper. Called by route handlers in Phases 2 and 3.
// Templates are HTML strings passed in by the caller — not bundled here.
// server-only: email sending requires the RESEND_API_KEY which must never reach the browser.
import 'server-only'

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  return resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Time Off System <noreply@example.com>',
    to,
    subject,
    html,
  })
}
