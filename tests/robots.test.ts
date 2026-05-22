// tests/robots.test.ts
// Verifies the robots.txt route returns the right policy for each deployment mode.
import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  delete process.env.DEMO_MODE
})

describe('robots.ts', () => {
  it('production (DEMO_MODE unset) disallows all crawlers', async () => {
    const robots = (await import('@/app/robots')).default
    const result = robots()
    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }])
  })

  it('production (DEMO_MODE=false) disallows all crawlers', async () => {
    process.env.DEMO_MODE = 'false'
    const robots = (await import('@/app/robots')).default
    const result = robots()
    expect(result.rules).toEqual([{ userAgent: '*', disallow: '/' }])
  })

  it('demo (DEMO_MODE=true) allows all crawlers', async () => {
    process.env.DEMO_MODE = 'true'
    const robots = (await import('@/app/robots')).default
    const result = robots()
    expect(result.rules).toEqual([{ userAgent: '*', allow: '/' }])
  })
})
