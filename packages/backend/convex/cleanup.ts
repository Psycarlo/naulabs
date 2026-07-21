import { internalMutation } from './_generated/server'

// Periodic garbage collection for short-lived rows (see crons.ts). Each table
// is pruned in a bounded batch so a backlog can never blow up one mutation —
// leftovers are picked up on the next run.

const BATCH = 500

const DAY_MS = 24 * 60 * 60 * 1000
const TELEGRAM_UPDATES_MAX_AGE_MS = 2 * DAY_MS
const SETTLED_PENDING_MAX_AGE_MS = 30 * DAY_MS
const RATE_LIMIT_MAX_AGE_MS = DAY_MS

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Single-use auth artifacts past their TTL.
    const states = await ctx.db
      .query('oauthStates')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .take(BATCH)
    const codes = await ctx.db
      .query('telegramLinkCodes')
      .filter((q) => q.lt(q.field('expiresAt'), now))
      .take(BATCH)

    // Dedupe markers only need to outlive Telegram's retry window.
    const updates = await ctx.db
      .query('telegramUpdates')
      .withIndex('by_creation_time', (q) =>
        q.lt('_creationTime', now - TELEGRAM_UPDATES_MAX_AGE_MS)
      )
      .take(BATCH)

    // Settled (or long-expired) approvals: keep recent ones as an audit trail,
    // drop the rest.
    const pending = await ctx.db
      .query('pendingActions')
      .withIndex('by_creation_time', (q) =>
        q.lt('_creationTime', now - SETTLED_PENDING_MAX_AGE_MS)
      )
      .take(BATCH)

    // Rate-limit windows go stale within a minute; a day is generous.
    const limits = await ctx.db
      .query('rateLimits')
      .filter((q) => q.lt(q.field('windowStart'), now - RATE_LIMIT_MAX_AGE_MS))
      .take(BATCH)

    const rows = [...states, ...codes, ...updates, ...pending, ...limits]
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
})
