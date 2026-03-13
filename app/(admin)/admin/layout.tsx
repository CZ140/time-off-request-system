// app/(admin)/admin/layout.tsx
// Simple passthrough — wraps all /admin/* routes including /admin/login.
// Auth checking is handled by the nested (protected) layout so the login page
// is accessible without a session.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
