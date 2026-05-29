// lib/calendar/store.ts
// Persistence for the single-row calendar_connections record. Encrypts the
// MSAL token cache blob on write and decrypts on read. server-only.
import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from './crypto'
import type { Database } from '@/types/database'

const ROW_ID = 'default'

export type CalendarConnection = Database['public']['Tables']['calendar_connections']['Row']

// Public-facing view of the connection (no secrets). Used by the UI.
export interface ConnectionSummary {
  accountEmail: string | null
  syncHomeAccountId: string | null
  calendarId: string | null
  calendarName: string | null
  connectedAt: string
}

// ── MSAL cache blob (the credential) ───────────────────────────────────────

// Load the decrypted MSAL cache blob, or null if no connection exists yet.
// A decrypt failure (tampered/wrong key) is treated as "no usable cache" so a
// corrupted row forces a clean reconnect rather than crashing the caller.
export async function loadCacheBlob(): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('cache_cipher')
    .eq('id', ROW_ID)
    .maybeSingle()

  if (error || !data?.cache_cipher) return null
  try {
    return decrypt(data.cache_cipher)
  } catch (e) {
    console.error('[calendar/store] cache decrypt failed — connection unusable:', e)
    return null
  }
}

// Persist the serialized MSAL cache blob. Upserts ONLY the cache + timestamp so
// it never clobbers the sync-target metadata written by saveSyncTarget().
export async function saveCacheBlob(serialized: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('calendar_connections')
    .upsert(
      { id: ROW_ID, cache_cipher: encrypt(serialized), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  if (error) {
    console.error('[calendar/store] failed to persist MSAL cache:', error)
    throw new Error('Failed to persist calendar credentials')
  }
}

// ── Connection metadata (no secrets) ───────────────────────────────────────

// Set (or replace) which account owns the calendar writes. Called on first
// sign-in and when an admin deliberately switches the sync target.
export async function saveSyncTarget(args: {
  accountEmail: string
  homeAccountId: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('calendar_connections')
    .update({
      account_email: args.accountEmail,
      sync_home_account_id: args.homeAccountId,
      // Reset the calendar selection — a new target may have different calendars.
      calendar_id: null,
      calendar_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ROW_ID)
  if (error) {
    console.error('[calendar/store] failed to set sync target:', error)
    throw new Error('Failed to set sync target')
  }
}

export async function saveSelectedCalendar(args: {
  calendarId: string
  calendarName: string
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('calendar_connections')
    .update({
      calendar_id: args.calendarId,
      calendar_name: args.calendarName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ROW_ID)
  if (error) {
    console.error('[calendar/store] failed to save calendar selection:', error)
    throw new Error('Failed to save calendar selection')
  }
}

// Returns the secret-free summary, or null if nothing is connected / no sync
// target has been established yet.
export async function getConnectionSummary(): Promise<ConnectionSummary | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('calendar_connections')
    .select('account_email, sync_home_account_id, calendar_id, calendar_name, connected_at')
    .eq('id', ROW_ID)
    .maybeSingle()

  if (error || !data || !data.sync_home_account_id) return null
  return {
    accountEmail: data.account_email,
    syncHomeAccountId: data.sync_home_account_id,
    calendarId: data.calendar_id,
    calendarName: data.calendar_name,
    connectedAt: data.connected_at,
  }
}

// Full deletion — used by the Disconnect action. Removes the whole row,
// dropping both the credential and the sync target.
export async function deleteConnection(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('calendar_connections').delete().eq('id', ROW_ID)
  if (error) {
    console.error('[calendar/store] failed to delete connection:', error)
    throw new Error('Failed to disconnect calendar')
  }
}
