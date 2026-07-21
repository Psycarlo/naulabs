import { v } from 'convex/values'

import type { QueryCtx } from './_generated/server'
import { internalMutation, internalQuery, query } from './_generated/server'
import type { Entitlements } from './plans'
import { DEFAULT_PLAN_KEY, getPlan } from './plans'

// Subscription statuses that grant the paid plan's entitlements.
export const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

type Metric = 'tokens' | 'sandboxMinutes'

// Calendar-month bucket. Date.now() is deterministic within a Convex function.
const periodKey = (): string => {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const activePlanKey = async (
  ctx: QueryCtx,
  userId: string
): Promise<string> => {
  const sub = await ctx.db
    .query('subscriptions')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()
  return sub && ACTIVE_STATUSES.has(sub.status) ? sub.planKey : DEFAULT_PLAN_KEY
}

export const resolveEntitlements = async (
  ctx: QueryCtx,
  userId: string
): Promise<Entitlements> =>
  getPlan(await activePlanKey(ctx, userId)).entitlements

export const modelAllowed = (ent: Entitlements, model: string): boolean =>
  ent.models.includes('*') || ent.models.includes(model)

export const channelAllowed = (ent: Entitlements, channel: string): boolean =>
  (ent.channels as string[]).includes(channel)

const usageValue = async (
  ctx: QueryCtx,
  userId: string,
  metric: Metric
): Promise<number> => {
  const row = await ctx.db
    .query('usage')
    .withIndex('by_user_period_metric', (q) =>
      q.eq('userId', userId).eq('periodKey', periodKey()).eq('metric', metric)
    )
    .first()
  return row?.value ?? 0
}

// Hard-cap check: true if `need` more units still fit under the plan limit.
export const withinBudget = async (
  ctx: QueryCtx,
  userId: string,
  metric: Metric,
  need = 0
): Promise<boolean> => {
  const ent = await resolveEntitlements(ctx, userId)
  const limit =
    metric === 'tokens' ? ent.monthlyTokens : ent.sandbox.monthlyActiveMinutes
  if (limit === null) {
    return true
  }
  return (await usageValue(ctx, userId, metric)) + need <= limit
}

// App-facing: current plan + entitlements + this period's usage.
export const getMyEntitlements = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const userId = identity.subject
    const planKey = await activePlanKey(ctx, userId)
    return {
      entitlements: getPlan(planKey).entitlements,
      planKey,
      usage: {
        periodKey: periodKey(),
        sandboxMinutes: await usageValue(ctx, userId, 'sandboxMinutes'),
        tokens: await usageValue(ctx, userId, 'tokens')
      }
    }
  }
})

// Node-runtime actions (agent loop, sandbox driver) have no `ctx.db`, so they
// read entitlements / budget through these internal queries instead of the
// helpers above.
export const getForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => await resolveEntitlements(ctx, userId)
})

export const budgetCheck = internalQuery({
  args: {
    metric: v.union(v.literal('tokens'), v.literal('sandboxMinutes')),
    need: v.optional(v.number()),
    userId: v.string()
  },
  handler: async (ctx, { userId, metric, need }) =>
    await withinBudget(ctx, userId, metric, need)
})

// Metering — called from agent / sandbox code (Phase 2+).
export const incrementUsage = internalMutation({
  args: {
    amount: v.number(),
    metric: v.union(v.literal('tokens'), v.literal('sandboxMinutes')),
    userId: v.string()
  },
  handler: async (ctx, { userId, metric, amount }) => {
    const pk = periodKey()
    const row = await ctx.db
      .query('usage')
      .withIndex('by_user_period_metric', (q) =>
        q.eq('userId', userId).eq('periodKey', pk).eq('metric', metric)
      )
      .first()
    await (row
      ? ctx.db.patch(row._id, { value: row.value + amount })
      : ctx.db.insert('usage', {
          metric,
          periodKey: pk,
          userId,
          value: amount
        }))
  }
})
