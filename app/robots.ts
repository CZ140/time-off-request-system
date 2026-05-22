// app/robots.ts
// Next.js App Router metadata file. Returns the robots.txt body.
//
// Production: disallow all crawlers (matches the noindex meta in app/layout.tsx).
// Demo: allow all (portfolio piece — meant to be discoverable).
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  if (process.env.DEMO_MODE === 'true') {
    return {
      rules: [{ userAgent: '*', allow: '/' }],
    }
  }
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
