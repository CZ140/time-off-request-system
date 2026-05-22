import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Time Off Request System",
  description: "Teacher leave request submission and admin approval system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDemo = process.env.DEMO_MODE === 'true'

  return (
    <html lang="en">
      <body className="antialiased">
        {isDemo && (
          <div className="bg-amber-400 text-amber-900 text-center text-sm font-medium py-2 px-4">
            Demo mode — form submissions are saved but no emails are sent.
            Admin login: <span className="font-mono font-bold">demo</span> password at{' '}
            <a href="/admin" className="underline hover:no-underline">/admin</a>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
