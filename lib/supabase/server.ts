// lib/supabase/server.ts
// The sole Supabase entry point for the entire application.
// server-only prevents this file from being imported in Client Components.
// If imported in a 'use client' file, the build will fail with:
//   "You're importing a component that needs 'server-only'..."
import 'server-only'

import { createClient as _createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createClient() {
  return _createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Service role clients must not persist sessions.
        // Persisting a service role session would create a security risk.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
