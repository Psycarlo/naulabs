import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// App domain tables. Auth tables (user/session/account) live inside the
// Better Auth component. We key app rows by the Better Auth user id string
// (identity.subject), not a Convex Id, since it lives in another component.
//
// Live token streaming (streamDeltas) + the canonical messages/threads for the
// agent are owned by the Convex Agent component's own tables — we do NOT define
// them here. The app `threads` row below is a thin per-user index that links to
// the agent component thread via `agentThreadId`.

// planKey is a free-form string keyed to the plan catalog (plans.ts) so new
// plans require no schema change.
const channel = v.union(
  v.literal('web'),
  v.literal('telegram'),
  v.literal('whatsapp')
)

export default defineSchema({
  channelLinks: defineTable({
    channel,
    externalId: v.string(),
    userId: v.string()
  })
    .index('by_user', ['userId'])
    .index('by_channel_external', ['channel', 'externalId']),

  integrations: defineTable({
    // Provider-side account identity (e.g. the Google email), for the UI only.
    accountEmail: v.optional(v.string()),
    // Encrypted at rest. Never exposed to the sandbox; calls are proxied host-side.
    encryptedTokens: v.string(),
    provider: v.string(),
    scopes: v.array(v.string()),
    status: v.string(),
    userId: v.string()
  })
    .index('by_user', ['userId'])
    .index('by_user_provider', ['userId', 'provider']),

  messages: defineTable({
    content: v.string(),
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system'),
      v.literal('tool')
    ),
    threadId: v.id('threads'),
    userId: v.string()
  }).index('by_thread', ['threadId']),

  // Short-lived CSRF state for integration OAuth flows. Bound to the initiating
  // user; consumed exactly once by the provider callback.
  oauthStates: defineTable({
    expiresAt: v.number(),
    provider: v.string(),
    services: v.array(v.string()),
    state: v.string(),
    userId: v.string()
  })
    .index('by_state', ['state'])
    .index('by_user', ['userId']),

  // Destructive tool calls (send email, create event, ...) queued for explicit
  // user approval. The agent never executes these directly — it enqueues, the
  // user confirms in the app, then an internal action fires the call.
  pendingActions: defineTable({
    expiresAt: v.number(),
    kind: v.string(),
    // JSON payload of the proposed call, shown to the user before approval.
    payload: v.string(),
    result: v.optional(v.string()),
    status: v.union(
      v.literal('pending'),
      v.literal('approved'),
      v.literal('denied'),
      v.literal('executed'),
      v.literal('failed')
    ),
    threadId: v.string(),
    userId: v.string()
  })
    .index('by_user', ['userId'])
    .index('by_user_status', ['userId', 'status']),

  // Fixed-window rate limiting (messages/min etc.). One row per user+key,
  // reset when the window rolls over.
  rateLimits: defineTable({
    count: v.number(),
    key: v.string(),
    userId: v.string(),
    windowStart: v.number()
  }).index('by_user_key', ['userId', 'key']),

  sandboxes: defineTable({
    // In-flight turns using the box right now. Incremented/decremented by
    // journaled workflow steps; the box is only paused when it reaches 0, so a
    // concurrent turn (web + Telegram at once) can't have the box yanked away.
    activeTurns: v.optional(v.number()),
    lastActiveAt: v.optional(v.number()),
    // Generic provider id (e2b | fly | ...) so the loop never assumes E2B.
    provider: v.string(),
    // Opaque, provider-scoped sandbox id (E2B sandboxId, Fly machine id, ...).
    sandboxId: v.optional(v.string()),
    status: v.union(
      v.literal('none'),
      v.literal('running'),
      v.literal('paused')
    ),
    userId: v.string()
  }).index('by_user', ['userId']),

  subscriptions: defineTable({
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()),
    // Stripe `event.created` (ms) of the last applied webhook event — Stripe
    // does not guarantee delivery order, so older events are dropped.
    lastStripeEventCreated: v.optional(v.number()),
    period: v.optional(v.union(v.literal('monthly'), v.literal('annual'))),
    planKey: v.string(),
    priceId: v.optional(v.string()),
    status: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    userId: v.string()
  })
    .index('by_user', ['userId'])
    .index('by_stripe_customer', ['stripeCustomerId'])
    .index('by_stripe_subscription', ['stripeSubscriptionId']),

  // Short-lived, single-use codes that bind a Telegram chat to a Nau user.
  // The code is the bearer of identity: issued to an authenticated web user,
  // redeemed once via `/start <code>` in the bot, then deleted.
  telegramLinkCodes: defineTable({
    code: v.string(),
    expiresAt: v.number(),
    userId: v.string()
  })
    .index('by_code', ['code'])
    .index('by_user', ['userId']),

  // Processed Telegram update ids — Telegram retries any update we don't 200
  // fast enough, so the webhook claims each id exactly once. Rows are pruned
  // by cron after a couple of days.
  telegramUpdates: defineTable({
    updateId: v.number()
  }).index('by_update_id', ['updateId']),

  threads: defineTable({
    // Links to the Convex Agent component's thread (its messages/streamDeltas).
    agentThreadId: v.optional(v.string()),
    channel,
    title: v.optional(v.string()),
    userId: v.string()
  })
    .index('by_user', ['userId'])
    .index('by_agent_thread', ['agentThreadId']),

  // Turns waiting for a free slot (maxConcurrentSessions). Drained FIFO by the
  // workflow onComplete handler as running turns finish.
  turnQueue: defineTable({
    channel: v.optional(v.string()),
    chatId: v.optional(v.string()),
    promptMessageId: v.string(),
    threadId: v.string(),
    userId: v.string()
  }).index('by_user', ['userId']),

  // Per-period metering for hard caps. periodKey = calendar month 'YYYY-MM'.
  usage: defineTable({
    metric: v.union(v.literal('tokens'), v.literal('sandboxMinutes')),
    periodKey: v.string(),
    userId: v.string(),
    value: v.number()
  }).index('by_user_period_metric', ['userId', 'periodKey', 'metric'])
})
