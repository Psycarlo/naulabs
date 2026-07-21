import { v } from 'convex/values'
import Stripe from 'stripe'

import { internal } from './_generated/api'
import {
  action,
  internalMutation,
  internalQuery,
  query
} from './_generated/server'
import { requireUserId } from './authz'
import { ACTIVE_STATUSES } from './entitlements'
import {
  DEFAULT_PLAN_KEY,
  planForPriceId,
  priceIdFor,
  publicPlans
} from './plans'

// V8-isolate-safe Stripe client (uses fetch, not Node http).
const stripe = (): Stripe =>
  new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    httpClient: Stripe.createFetchHttpClient()
  })

// Fail fast rather than silently redirecting users to localhost — an unset
// SITE_URL in prod would otherwise "work" until checkout completes.
const siteUrl = (): string => {
  const url = process.env.SITE_URL
  if (!url) {
    throw new Error('SITE_URL is not set')
  }
  return url
}

// ---- App-facing queries -------------------------------------------------

export const listPlans = query({
  args: {},
  handler: () => publicPlans()
})

export const getMySubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const sub = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first()
    if (!sub) {
      return null
    }
    return {
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      hasBilling: Boolean(sub.stripeCustomerId),
      period: sub.period,
      planKey: sub.planKey,
      status: sub.status
    }
  }
})

// ---- Stripe actions -----------------------------------------------------

export const createCheckout = action({
  args: {
    period: v.union(v.literal('monthly'), v.literal('annual')),
    planKey: v.string()
  },
  handler: async (ctx, { planKey, period }): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }
    const priceId = priceIdFor(planKey, period)
    if (!priceId) {
      throw new Error(`No Stripe price configured for ${planKey}/${period}`)
    }

    const s = stripe()
    const existing = await ctx.runQuery(internal.billing.getSubByUser, {
      userId: identity.subject
    })
    // A second Checkout on an already-subscribed customer creates a SECOND
    // Stripe subscription (double-billing). Plan changes go through the portal.
    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      throw new Error(
        'You already have an active subscription — change plans from Settings → Billing.'
      )
    }
    let customerId = existing?.stripeCustomerId
    if (!customerId) {
      // Idempotency key: concurrent checkouts (double-click) would otherwise
      // create two Stripe customers, and the losing one's webhook events would
      // never match our row. Same key -> Stripe returns the same customer.
      const customer = await s.customers.create(
        {
          email: identity.email ?? undefined,
          metadata: { userId: identity.subject }
        },
        { idempotencyKey: `customer-create-${identity.subject}` }
      )
      customerId = customer.id
      await ctx.runMutation(internal.billing.ensureCustomer, {
        customerId,
        userId: identity.subject
      })
    }

    const session = await s.checkout.sessions.create({
      allow_promotion_codes: true,
      cancel_url: `${siteUrl()}/pricing?status=cancel`,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { planKey, userId: identity.subject },
      mode: 'subscription',
      success_url: `${siteUrl()}/settings/billing?status=success`
    })
    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }
    return session.url
  }
})

export const customerPortal = action({
  args: {},
  handler: async (ctx): Promise<string> => {
    const userId = await requireUserId(ctx)
    const existing = await ctx.runQuery(internal.billing.getSubByUser, {
      userId
    })
    if (!existing?.stripeCustomerId) {
      throw new Error('No billing account yet')
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${siteUrl()}/settings/billing`
    })
    return session.url
  }
})

// ---- Internal (used by actions + webhook) -------------------------------

export const getSubByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
})

// Create or update the user's subscription row with their Stripe customer id
// before checkout completes.
export const ensureCustomer = internalMutation({
  args: { customerId: v.string(), userId: v.string() },
  handler: async (ctx, { userId, customerId }) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()
    await (existing
      ? ctx.db.patch(existing._id, { stripeCustomerId: customerId })
      : ctx.db.insert('subscriptions', {
          planKey: DEFAULT_PLAN_KEY,
          status: 'incomplete',
          stripeCustomerId: customerId,
          userId
        }))
  }
})

export const upsertSubscriptionFromStripe = internalMutation({
  args: {
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
    customerId: v.string(),
    eventCreated: v.number(),
    priceId: v.string(),
    status: v.string(),
    subscriptionId: v.string()
  },
  handler: async (ctx, args) => {
    const mapping = planForPriceId(args.priceId)
    if (!mapping && args.priceId) {
      // The customer paid for a price we can't map — they'd silently stay on
      // free entitlements. Almost always a missing/typo'd STRIPE_PRICE_* env.
      console.error(
        `No plan mapping for Stripe price ${args.priceId} — check STRIPE_PRICE_* env`
      )
    }
    const row = await ctx.db
      .query('subscriptions')
      .withIndex('by_stripe_customer', (q) =>
        q.eq('stripeCustomerId', args.customerId)
      )
      .first()

    if (!row) {
      // No row from checkout (e.g. subscription created out of band). Without a
      // userId we can't key it; log and skip rather than insert an orphan.
      console.warn(
        `Stripe subscription for unknown customer ${args.customerId}; no local row to update`
      )
      return
    }

    // Stripe does not guarantee delivery order — drop events older than the
    // last one applied (a stale `active` after a `deleted` must not revive).
    if (
      row.lastStripeEventCreated !== undefined &&
      args.eventCreated < row.lastStripeEventCreated
    ) {
      return
    }

    // Event for a different subscription than the one we track: adopt it only
    // when it's live (the user replaced their sub); ignore terminal events for
    // foreign subs so canceling an old sub can't stomp the active one.
    if (
      row.stripeSubscriptionId &&
      row.stripeSubscriptionId !== args.subscriptionId &&
      !ACTIVE_STATUSES.has(args.status)
    ) {
      return
    }

    await ctx.db.patch(row._id, {
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd,
      lastStripeEventCreated: args.eventCreated,
      period: mapping?.period,
      planKey: mapping?.planKey ?? row.planKey,
      priceId: args.priceId,
      status: args.status,
      stripeSubscriptionId: args.subscriptionId
    })
  }
})
