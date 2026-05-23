// lib/admin-recipients.ts
// DB-backed replacement for the legacy ADMIN_EMAILS env var.
//
// The submit flow (app/(public)/actions.ts) calls getAdminRecipients() to learn
// who should receive a new-request notification email. If the table is empty,
// the helper throws NoAdminRecipientsError so the action can surface a clear
// "no administrator configured" message to the teacher rather than silently
// sending zero emails.
import 'server-only'

import { createClient } from '@/lib/supabase/server'

export class NoAdminRecipientsError extends Error {
  constructor() {
    super('No admin recipients configured. Add one at /admin → Recipients.')
    this.name = 'NoAdminRecipientsError'
  }
}

export async function getAdminRecipients(): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('admin_recipients')
    .select('email')
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load admin recipients: ${error.message}`)
  }

  const emails = (data ?? []).map((r) => r.email).filter(Boolean)
  if (emails.length === 0) {
    throw new NoAdminRecipientsError()
  }
  return emails
}
