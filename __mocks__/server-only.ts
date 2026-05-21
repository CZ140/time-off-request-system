// Stub for 'server-only' package in test environment.
// The real package throws on import to prevent client-side use.
// In Vitest (Node environment) we stub it out so server action logic can be tested directly.
export {}
