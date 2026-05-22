// app/auth/callback/route.ts
// Magic-link landing route. Supabase Auth redirects here with ?code=... and ?next=...
// after the teacher clicks the link in their email. We exchange the code for a
// session (which sets the auth cookies) and redirect them to `next`.
import { NextResponse, type NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase/auth-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = sanitiseNext(searchParams.get('next') ?? '/')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createAuthClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession failed:', error)
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  return NextResponse.redirect(new URL(next, origin))
}

// Same rules as app/login/actions.ts sanitiseNext.
// Re-checked on the server side because the email link's query string is
// outside our control once the email is sent (e.g., link rewriters could mangle it).
function sanitiseNext(raw: string): string {
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  if (raw.includes('://')) return '/'
  return raw
}
