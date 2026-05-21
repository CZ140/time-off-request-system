import LoginForm from './LoginForm'

export default function AdminLoginPage() {
  const demoPassword = process.env.DEMO_MODE === 'true'
    ? (process.env.ADMIN_PASSWORD ?? undefined)
    : undefined

  return <LoginForm demoPassword={demoPassword} />
}
