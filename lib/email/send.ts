// lib/email/send.ts
// Sole Resend email entry point for the entire application.
// server-only: email sending requires the RESEND_API_KEY which must never reach the browser.
import 'server-only'

import { Resend } from 'resend'

interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
}

interface BatchEmailItem {
  to: string
  subject: string
  html: string
}

function resendClient() {
  return new Resend(process.env.RESEND_API_KEY)
}

function fromAddress() {
  return process.env.RESEND_FROM ?? 'Time Off System <noreply@example.com>'
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  return resendClient().emails.send({ from: fromAddress(), to, subject, html })
}

export async function sendBatch(emails: BatchEmailItem[]) {
  const from = fromAddress()
  return resendClient().batch.send(
    emails.map(e => ({ from, to: [e.to], subject: e.subject, html: e.html }))
  )
}
