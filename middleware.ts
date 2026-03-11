// middleware.ts — root level (NOT inside app/)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Admin auth enforcement added in Phase 4
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
