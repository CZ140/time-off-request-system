import type { Metadata } from 'next'
import { Manrope, Instrument_Serif } from 'next/font/google'
import { DemoBanner } from './_components/DemoBanner'
import './globals.css'

const isDemoBuild = process.env.DEMO_MODE === 'true'

// Wired through CSS vars so globals.css can expose them as Tailwind v4 theme
// tokens (--font-sans / --font-display).
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})
const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Time Off Request System',
  description: 'Teacher leave request submission and admin approval system',
  // Production instances must not be indexed by search engines — the form
  // includes teacher PII and approval link URLs that should not be public.
  // The demo deployment IS indexable (it's a portfolio piece meant to be found).
  robots: isDemoBuild ? undefined : { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDemo = process.env.DEMO_MODE === 'true'

  return (
    <html lang="en" className={`${manrope.variable} ${instrument.variable}`}>
      <body className="bg-cream text-ink antialiased">
        {isDemo && <DemoBanner />}
        {children}
      </body>
    </html>
  )
}
