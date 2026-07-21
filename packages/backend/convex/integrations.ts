import { v } from 'convex/values'

import { internal } from './_generated/api'
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query
} from './_generated/server'
import { requireUserId } from './authz'
import { decryptJson, encryptJson } from './crypto'
import type { GoogleService, GoogleTokens } from './googleApi'
import {
  googleConsentUrl,
  isAllowedGoogleUrl,
  isGoogleService,
  refreshGoogleTokens,
  revokeGoogleToken,
  servicesFromScopes
} from './googleApi'

// OAuth states are single-use CSRF nonces bound to the initiating user, exactly
// like Telegram link codes: never trust a callback without one.
const STATE_TTL_MS = 10 * 60 * 1000
const STATE_BYTES = 32

// Refresh the access token when it expires within this window, so a token that
// dies mid-turn never reaches a Google call.
const REFRESH_SKEW_MS = 60_000

const RESPONSE_TRUNCATE_AT = 30_000

const generateState = (): string => {
  const bytes = new Uint8Array(STATE_BYTES)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}

// ---- App-facing (authenticated) -----------------------------------------

// Connected integrations for the settings UI. Tokens NEVER leave the server —
// this returns status + derived services only.
export const myIntegrations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const rows = await ctx.db
      .query('integrations')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .collect()
    return rows.map((row) => ({
      accountEmail: row.accountEmail,
      provider: row.provider,
      services: servicesFromScopes(row.scopes),
      status: row.status
    }))
  }
})

// Start the Google connect flow: gate on maxIntegrations, mint a state, return
// the consent URL for the client to redirect to.
export const googleAuthUrl = action({
  args: { services: v.array(v.string()) },
  handler: async (ctx, { services }): Promise<string> => {
    const userId = await requireUserId(ctx)
    const picked = services.filter(isGoogleService)
    if (picked.length === 0) {
      throw new Error('Pick at least one service (gmail, calendar, drive)')
    }

    const ent = await ctx.runQuery(internal.entitlements.getForUser, { userId })
    const existing = await ctx.runQuery(internal.integrations.listForUser, {
      userId
    })
    const isNewProvider = !existing.some((row) => row.provider === 'google')
    if (isNewProvider && existing.length >= ent.maxIntegrations) {
      throw new Error(
        'Integration limit reached on your plan — upgrade to connect more.'
      )
    }

    const state = generateState()
    await ctx.runMutation(internal.integrations.createOauthState, {
      provider: 'google',
      services: picked,
      state,
      userId
    })
    return googleConsentUrl(picked as GoogleService[], state)
  }
})

// Disconnect: best-effort revoke at Google, then delete the row (and tokens).
export const disconnect = action({
  args: { provider: v.string() },
  handler: async (ctx, { provider }): Promise<void> => {
    const userId = await requireUserId(ctx)
    const row = await ctx.runQuery(internal.integrations.getRow, {
      provider,
      userId
    })
    if (!row) {
      return
    }
    try {
      const tokens = await decryptJson<GoogleTokens>(row.encryptedTokens)
      await revokeGoogleToken(tokens.refreshToken ?? tokens.accessToken)
    } catch {
      // Revocation is best-effort; deleting the row is what matters.
    }
    await ctx.runMutation(internal.integrations.deleteRow, {
      provider,
      userId
    })
  }
})

// ---- Internal ------------------------------------------------------------

export const createOauthState = internalMutation({
  args: {
    provider: v.string(),
    services: v.array(v.string()),
    state: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { provider, services, state, userId }) => {
    // One in-flight state per user+provider: clear stale ones.
    const previous = await ctx.db
      .query('oauthStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    await Promise.all(previous.map((row) => ctx.db.delete(row._id)))
    await ctx.db.insert('oauthStates', {
      expiresAt: Date.now() + STATE_TTL_MS,
      provider,
      services,
      state,
      userId
    })
  }
})

export const consumeOauthState = internalMutation({
  args: { state: v.string() },
  handler: async (
    ctx,
    { state }
  ): Promise<{ services: string[]; userId: string } | null> => {
    const row = await ctx.db
      .query('oauthStates')
      .withIndex('by_state', (q) => q.eq('state', state))
      .first()
    if (!row) {
      return null
    }
    await ctx.db.delete(row._id)
    if (row.expiresAt < Date.now()) {
      return null
    }
    return { services: row.services, userId: row.userId }
  }
})

export const listForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query('integrations')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    // Strip tokens even on the internal surface; callers only need shape.
    return rows.map((row) => ({
      provider: row.provider,
      scopes: row.scopes,
      status: row.status
    }))
  }
})

export const getRow = internalQuery({
  args: { provider: v.string(), userId: v.string() },
  handler: async (ctx, { provider, userId }) =>
    await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider)
      )
      .first()
})

// Which Google services the agent may use for a user — drives which tools are
// mounted on a turn.
export const getGoogleStatus = internalQuery({
  args: { userId: v.string() },
  handler: async (
    ctx,
    { userId }
  ): Promise<{ connected: boolean; services: string[] }> => {
    const row = await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', 'google')
      )
      .first()
    if (!row || row.status !== 'connected') {
      return { connected: false, services: [] }
    }
    return { connected: true, services: servicesFromScopes(row.scopes) }
  }
})

export const upsertFromOauth = internalMutation({
  args: {
    accountEmail: v.optional(v.string()),
    encryptedTokens: v.string(),
    provider: v.string(),
    scopes: v.array(v.string()),
    userId: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', args.userId).eq('provider', args.provider)
      )
      .first()
    const patch = {
      accountEmail: args.accountEmail,
      encryptedTokens: args.encryptedTokens,
      scopes: args.scopes,
      status: 'connected'
    }
    await (existing
      ? ctx.db.patch(existing._id, patch)
      : ctx.db.insert('integrations', {
          ...patch,
          provider: args.provider,
          userId: args.userId
        }))
  }
})

export const updateTokens = internalMutation({
  args: {
    encryptedTokens: v.string(),
    provider: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { encryptedTokens, provider, userId }) => {
    const row = await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider)
      )
      .first()
    if (row) {
      await ctx.db.patch(row._id, { encryptedTokens })
    }
  }
})

export const setStatus = internalMutation({
  args: {
    provider: v.string(),
    status: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { provider, status, userId }) => {
    const row = await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider)
      )
      .first()
    if (row) {
      await ctx.db.patch(row._id, { status })
    }
  }
})

export const deleteRow = internalMutation({
  args: { provider: v.string(), userId: v.string() },
  handler: async (ctx, { provider, userId }) => {
    const row = await ctx.db
      .query('integrations')
      .withIndex('by_user_provider', (q) =>
        q.eq('userId', userId).eq('provider', provider)
      )
      .first()
    if (row) {
      await ctx.db.delete(row._id)
    }
  }
})

// The host-side proxy: the ONLY path from the agent to a user's Google account.
// Decrypts the token here, refreshes if stale, calls an allowlisted API URL,
// and returns the response body — the token itself never leaves this action.
export const googleFetch = internalAction({
  args: {
    body: v.optional(v.string()),
    method: v.string(),
    url: v.string(),
    userId: v.string()
  },
  handler: async (
    ctx,
    { body, method, url, userId }
  ): Promise<{ body: string; ok: boolean; status: number }> => {
    if (!isAllowedGoogleUrl(url)) {
      throw new Error(`URL not allowed through the Google proxy: ${url}`)
    }
    const row = await ctx.runQuery(internal.integrations.getRow, {
      provider: 'google',
      userId
    })
    if (!row || row.status !== 'connected') {
      throw new Error('Google is not connected for this user')
    }

    let tokens = await decryptJson<GoogleTokens>(row.encryptedTokens)
    if (tokens.expiresAt < Date.now() + REFRESH_SKEW_MS) {
      try {
        tokens = await refreshGoogleTokens(tokens)
      } catch (error) {
        await ctx.runMutation(internal.integrations.setStatus, {
          provider: 'google',
          status: 'error',
          userId
        })
        throw error
      }
      await ctx.runMutation(internal.integrations.updateTokens, {
        encryptedTokens: await encryptJson(tokens),
        provider: 'google',
        userId
      })
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${tokens.accessToken}`
    }
    const init: RequestInit = { headers, method }
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
      init.body = body
    }
    const response = await fetch(url, init)
    const text = await response.text()
    return {
      body: text.slice(0, RESPONSE_TRUNCATE_AT),
      ok: response.ok,
      status: response.status
    }
  }
})
