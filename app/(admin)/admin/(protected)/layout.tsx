// app/(admin)/admin/(protected)/layout.tsx
// Second independent auth gate — CVE-2025-29927 mitigation.
// Runs server-side for every route under /admin/(protected)/* regardless of
// middleware state, so bypassing middleware alone cannot expose the dashboard.
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    redirect('/admin/login')
  }
  return <>{children}</>
}
