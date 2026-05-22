// lib/supabase/auth-middleware.ts
// Edge-runtime Supabase Auth client for middleware.ts.
//
// CRITICAL: This file MUST NOT import 'server-only' or anything that does
// (e.g., lib/supabase/server.ts, lib/config.ts). Middleware runs in the
// Edge Runtime where 'server-only' will throw at module load.
//
// The companion to lib/supabase/auth-server.ts (Node-only). Both wrap
// @supabase/ssr's createServerClient with cookie adapters appropriate to
// their runtime: this one reads/writes via NextRequest/NextResponse.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export function createMiddlewareClient(request: NextRequest) {
  // The response is mutable: each setAll() invocation appends cookies that
  // will be returned to the browser. Callers must return THIS response (or
  // a redirect derived from it) so session refresh cookies are not lost.
  let response = NextResponse.next({ request })

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getResponse() is a closure over the mutable `response` so callers can
  // grab the latest version after auth.getUser() has potentially refreshed cookies.
  return { client, getResponse: () => response }
}
