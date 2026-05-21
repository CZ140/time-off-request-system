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

function isDemoMode() {
  return process.env.DEMO_MODE === 'true'
}

export async function sendEmail({ to, subject, html }: SendEmailArgs) {
  if (isDemoMode()) {
    console.log(`[DEMO] Email suppressed — to: ${Array.isArray(to) ? to.join(', ') : to} | subject: ${subject}`)
    return
  }
  return resendClient().emails.send({ from: fromAddress(), to, subject, html })
}

export async function sendBatch(emails: BatchEmailItem[]) {
  if (isDemoMode()) {
    console.log(`[DEMO] Batch email suppressed — ${emails.length} recipient(s): ${emails.map(e => e.to).join(', ')}`)
    return
  }
  const from = fromAddress()
  return resendClient().batch.send(
    emails.map(e => ({ from, to: [e.to], subject: e.subject, html: e.html }))
  )
}
