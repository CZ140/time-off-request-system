// lib/supabase/auth-server.ts
// Supabase Auth client for Server Components, Server Actions, and Route Handlers.
// Separate from lib/supabase/server.ts (which uses the service-role key, bypasses RLS,
// and is not used for user authentication).
//
// This client uses the anon/publishable key and synchronises the session cookie
// via @supabase/ssr. Safe to call from any Node.js server context — do NOT import
// from middleware.ts (middleware runs in the Edge Runtime; use auth-middleware.ts).
import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createAuthClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // setAll can throw in Server Components (where cookies are read-only).
          // That's expected: in a Server Component context we have no way to set
          // cookies anyway — middleware refreshes them on the next request.
          // Swallow the error so callers don't have to special-case the context.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // No-op in read-only contexts (Server Components).
          }
        },
      },
    }
  )
}
