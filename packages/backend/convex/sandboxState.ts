import { v } from 'convex/values'

import { internalMutation, internalQuery, query } from './_generated/server'

// App-facing: the current user's sandbox status for the chat status indicator.
// 'none' when the box has never been provisioned.
export const myStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const row = await ctx.db
      .query('sandboxes')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first()
    return {
      lastActiveAt: row?.lastActiveAt,
      status: row?.status ?? 'none'
    }
  }
})

// V8-isolate state for the per-user sandbox row. The Node-runtime driver
// (sandbox.ts) calls these via runQuery/runMutation; mutations/queries can't do
// I/O so they live here, separate from the "use node" action file.

export const getByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query('sandboxes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
})

// Record that a box is awake and which provider/id backs it. `lastActiveAt`
// only advances on the paused→running transition so overlapping turns don't
// reset the metering clock mid-flight.
export const markRunning = internalMutation({
  args: {
    provider: v.string(),
    sandboxId: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { userId, provider, sandboxId }) => {
    const existing = await ctx.db
      .query('sandboxes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
    const wasRunning = existing?.status === 'running'
    const patch = {
      lastActiveAt: wasRunning
        ? (existing?.lastActiveAt ?? Date.now())
        : Date.now(),
      provider,
      sandboxId,
      status: 'running' as const
    }
    await (existing
      ? ctx.db.patch(existing._id, patch)
      : ctx.db.insert('sandboxes', { ...patch, userId }))
  }
})

// Turn accounting (activeTurns increment/decrement) lives in turnQueue.ts,
// transactionally alongside workflow start/onComplete.

export const markPaused = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query('sandboxes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'paused' })
    }
  }
})
