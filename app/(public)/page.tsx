import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/supabase/auth-server'
import TeacherForm from './TeacherForm'

export default async function TeacherFormPage() {
  // Demo mode: anonymous submission, no authed email to pin.
  if (process.env.DEMO_MODE === 'true') {
    return <TeacherForm authedEmail={null} />
  }

  // Defense-in-depth: middleware already gated this route, but a future
  // middleware-bypass bug should not let an unauthenticated request reach
  // the server action. Re-check the session here.
  const supabase = await createAuthClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    redirect('/login?next=%2F')
  }

  return <TeacherForm authedEmail={user.email} />
}
