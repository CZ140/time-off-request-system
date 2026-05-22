// middleware.ts — root level (NOT inside app/)
// Edge runtime: do NOT import from lib/auth/session.ts (has 'server-only' which errors in Edge).
// Instead, duplicate the getIronSession() call inline with local sessionOptions.
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AdminSessionData } from '@/lib/auth/session'

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
  const cookieStore = await cookies()
  const session = await getIronSession<AdminSessionData>(cookieStore, sessionOptions)

  const isLoginPage = request.nextUrl.pathname === '/admin/login'

  if (!session.isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  if (session.isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
