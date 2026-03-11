// lib/auth/session.ts
// iron-session wrapper for the admin password-protected session.
// Called by: admin login route handler, admin layout, middleware (Phase 4).
//
// CRITICAL Next.js 15 requirement:
// cookies() is async in Next.js 15. It MUST be awaited before passing to
// getIronSession(). Forgetting this causes silent malfunction (session data
// appears undefined, session.save() throws unexpectedly).
import 'server-only'

import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'

export interface AdminSessionData {
  isLoggedIn: boolean
}

const sessionOptions = {
  // SESSION_SECRET must be at least 32 characters (iron-session AES-256 requirement).
  // Generate with: openssl rand -base64 32
  password: process.env.SESSION_SECRET!,
  cookieName: 'admin-session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
}

export async function getSession() {
  const cookieStore = await cookies() // Next.js 15: cookies() is async — must await
  return getIronSession<AdminSessionData>(cookieStore, sessionOptions)
}

export async function createSession() {
  const session = await getSession()
  session.isLoggedIn = true
  await session.save()
}

export async function destroySession() {
  const session = await getSession()
  session.destroy()
}
