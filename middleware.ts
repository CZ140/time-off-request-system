// middleware.ts — root level (NOT inside app/)
// Edge runtime: do NOT import from lib/supabase/server.ts, lib/config.ts, or
// lib/auth/session.ts (they have 'server-only' which errors in Edge).
//
// matcher: '/' is the only teacher-gated route. If adding more (e.g., /my-requests),
// (1) add them to the matcher below AND (2) ensure the new route's Server Component
// re-checks the session via createAuthClient() + getUser(). Middleware alone is not
// sufficient — defense-in-depth requires both checks.
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AdminSessionData } from '@/lib/auth/session'
import { createMiddlewareClient } from '@/lib/supabase/auth-middleware'

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'admin-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // ── Admin branch (iron-session, existing logic, untouched) ──────────────
  if (path === '/admin' || path.startsWith('/admin/')) {
    const cookieStore = await cookies()
    const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions)

    const isLoginPage = path === '/admin/login'

    if (!session.isLoggedIn && !isLoginPage) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    if (session.isLoggedIn && isLoginPage) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    return NextResponse.next()
  }

  // ── Teacher branch (Supabase magic-link auth) ───────────────────────────
  // Demo mode is anonymous: portfolio reviewers must be able to submit
  // without setting up an email account.
  if (process.env.DEMO_MODE === 'true') {
    return NextResponse.next()
  }

  const { client, getResponse } = createMiddlewareClient(request)
  // getUser() validates the session against Supabase's auth server AND refreshes
  // cookies if needed. The refreshed cookies are written onto the response by
  // the setAll adapter — that's why we must return getResponse() (not a fresh
  // NextResponse.next()) on the pass-through path.
  const { data: { user } } = await client.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  return getResponse()
}

export const config = {
  matcher: ['/', '/admin', '/admin/:path*'],
}
