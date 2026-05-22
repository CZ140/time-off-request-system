// lib/supabase/auth-client.ts
// Browser-side Supabase Auth client for use in Client Components.
// Reads NEXT_PUBLIC_ env vars that are embedded in the browser bundle at build time.
//
// No 'server-only' import: this file IS intended to be imported from 'use client' components.
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
