import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  // Demo mode bypasses teacher auth entirely. If someone lands on /login
  // (e.g., a stale link), bounce them to the form.
  if (process.env.DEMO_MODE === 'true') {
    redirect('/')
  }

  const params = await searchParams
  const next = sanitiseNext(params.next ?? '/')

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <LoginForm next={next} />
    </main>
  )
}

// Mirrors the sanitiser in app/login/actions.ts. Same rules: reject absolute
// URLs, protocol-relative URLs, and anything not starting with '/'.
function sanitiseNext(raw: string): string {
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  if (raw.includes('://')) return '/'
  return raw
}
