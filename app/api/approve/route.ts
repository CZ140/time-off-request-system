// app/api/approve/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Approval handler — coming in Phase 3' })
}
