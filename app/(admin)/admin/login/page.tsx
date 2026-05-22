import LoginForm from './LoginForm'

export default function AdminLoginPage() {
  // The hint shown on the demo login page reflects DEMO_ADMIN_PASSWORD, not the
  // production ADMIN_PASSWORD. This is the single point of truth for what the demo
  // user types: if DEMO_ADMIN_PASSWORD is unset, no hint is shown (and the login
  // action will also reject all attempts).
  const demoPassword = process.env.DEMO_MODE === 'true'
    ? (process.env.DEMO_ADMIN_PASSWORD ?? undefined)
    : undefined

  return <LoginForm demoPassword={demoPassword} />
}
