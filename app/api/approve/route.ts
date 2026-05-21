// app/api/approve/route.ts
// Backward-compatibility shim for old approval URLs (format: /api/approve?action=...&id=...&token=...&admin=...).
// New emails use /approve/[id]?action=...&token=...&admin=... which shows a confirmation page before acting.
// This handler redirects old links to the new confirmation page so emails sent before the migration still work.
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id     = searchParams.get('id')
  const action = searchParams.get('action')
  const token  = searchParams.get('token')
  const admin  = searchParams.get('admin')

  if (!id || !action || !token) {
    return NextResponse.redirect(new URL('/invalid', request.url))
  }

  const dest = new URL(`/approve/${id}`, request.url)
  dest.searchParams.set('action', action)
  dest.searchParams.set('token', token)
  if (admin) dest.searchParams.set('admin', admin)

  return NextResponse.redirect(dest)
}
