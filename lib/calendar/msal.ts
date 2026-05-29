// lib/calendar/msal.ts
// Microsoft (Entra) confidential-client wrapper. Drives both the "Sign in with
// Microsoft" login and the Outlook calendar token used to write events.
//
// Token persistence uses MSAL's cache-plugin pattern (NOT raw refresh-token
// handling, which MSAL discourages): the serialized token cache is encrypted
// and stored in Supabase via lib/calendar/store. This survives Vercel's
// stateless lambdas and handles refresh-token rotation automatically.
import 'server-only'

import {
  ConfidentialClientApplication,
  type Configuration,
  type ICachePlugin,
  type TokenCacheContext,
  type AuthenticationResult,
} from '@azure/msal-node'
import { loadCacheBlob, saveCacheBlob, getConnectionSummary } from './store'

// Multitenant + personal accounts: 'common' lets BOTH work/school M365 accounts
// and personal outlook.com accounts connect. (Delegated flow only — app-only
// could not touch a personal outlook.com calendar at all.)
const AUTHORITY = 'https://login.microsoftonline.com/common'

// Requested at sign-in. openid/profile are added by MSAL automatically;
// offline_access yields the refresh token; Calendars.ReadWrite covers event
// create/delete; User.Read lets us read the signed-in account.
export const LOGIN_SCOPES = ['User.Read', 'Calendars.ReadWrite', 'offline_access']

// Narrower set used for silent renewal at event-write time.
const CALENDAR_SCOPES = ['Calendars.ReadWrite']

const cachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx: TokenCacheContext) {
    const blob = await loadCacheBlob()
    if (blob) ctx.tokenCache.deserialize(blob)
  },
  async afterCacheAccess(ctx: TokenCacheContext) {
    if (ctx.cacheHasChanged) {
      await saveCacheBlob(ctx.tokenCache.serialize())
    }
  },
}

function getCca(): ConfidentialClientApplication {
  const config: Configuration = {
    auth: {
      clientId: process.env.MS_CLIENT_ID!,
      authority: AUTHORITY,
      clientSecret: process.env.MS_CLIENT_SECRET!,
    },
    cache: { cachePlugin },
  }
  // A fresh instance per call is fine: the cache plugin rehydrates state from
  // the database on first cache access, so nothing relies on in-process memory.
  return new ConfidentialClientApplication(config)
}

// Build the authorize-redirect URL for the sign-in flow.
export function getAuthCodeUrl(state: string): Promise<string> {
  return getCca().getAuthCodeUrl({
    scopes: LOGIN_SCOPES,
    redirectUri: process.env.MS_REDIRECT_URI!,
    state,
    prompt: 'select_account',
  })
}

export interface ConnectedAccount {
  homeAccountId: string
  email: string
  name: string
}

// Exchange the auth code for tokens (persisted via the cache plugin) and return
// the identity of the account that just signed in.
export async function acquireTokenByCode(code: string): Promise<ConnectedAccount> {
  const result = await getCca().acquireTokenByCode({
    code,
    scopes: LOGIN_SCOPES,
    redirectUri: process.env.MS_REDIRECT_URI!,
  })
  const account = result?.account
  if (!account) {
    throw new Error('Microsoft sign-in returned no account')
  }
  return {
    homeAccountId: account.homeAccountId,
    email: account.username,
    name: account.name ?? account.username,
  }
}

// Remove an account's tokens from the cache (and persist the change). Used to
// clean up after an unauthorized sign-in so a non-admin's tokens are never left
// sitting in the stored cache.
export async function removeAccountFromCache(homeAccountId: string): Promise<void> {
  const cca = getCca()
  const cache = cca.getTokenCache()
  const accounts = await cache.getAllAccounts()
  const account = accounts.find((a) => a.homeAccountId === homeAccountId)
  if (account) {
    await cache.removeAccount(account)
  }
}

// Get a fresh Graph access token for the configured sync account, renewing
// silently via the stored refresh token. Throws if no sync target is set or the
// account is missing from the cache (i.e. an admin must reconnect).
export async function getSyncAccessToken(): Promise<string> {
  const summary = await getConnectionSummary()
  if (!summary?.syncHomeAccountId) {
    throw new Error('No calendar sync target configured')
  }

  const cca = getCca()
  const accounts = await cca.getTokenCache().getAllAccounts()
  const account = accounts.find((a) => a.homeAccountId === summary.syncHomeAccountId)
  if (!account) {
    throw new Error('Sync account not found in token cache — reconnect required')
  }

  let result: AuthenticationResult | null
  try {
    result = await cca.acquireTokenSilent({ account, scopes: CALENDAR_SCOPES })
  } catch (e) {
    // interaction_required / invalid_grant: the refresh token is dead. Surface
    // a clear signal so callers can show "reconnect" rather than a raw MSAL error.
    throw new Error(
      `Silent token acquisition failed — reconnect required: ${e instanceof Error ? e.message : String(e)}`
    )
  }
  if (!result?.accessToken) {
    throw new Error('Silent token acquisition returned no access token')
  }
  return result.accessToken
}
