import { httpRouter } from 'convex/server'
import Stripe from 'stripe'

import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'
import { httpAction } from './_generated/server'
import { authComponent, createAuth } from './auth'
import { encryptJson } from './crypto'
import { exchangeGoogleCode, fetchGoogleEmail } from './googleApi'
import { sendTelegramMessage } from './telegramApi'

// Minimal shape of the Telegram update we handle: a plain text message. Edited
// messages, channel posts, and non-text content are ignored for v1.
interface TelegramUpdate {
  message?: {
    chat?: { id?: number }
    text?: string
  }
  update_id?: number
}

const TELEGRAM_REPLIES: Record<string, string> = {
  budget_blocked:
    "You've used your monthly token budget. Upgrade in the web app → Settings → Billing to keep chatting.",
  channel_blocked:
    'Telegram is not included on your current plan. Upgrade in the web app to chat here.',
  not_linked:
    'This chat is not linked. Open the Nau Labs web app → Settings → Telegram and tap the link to connect.',
  queue_full:
    'Your agent already has a backlog of messages — give it a moment to catch up.',
  rate_limited: 'Slow down a little — try again in a minute.'
}

// Constant-time string comparison for webhook secrets — a plain !== returns
// early on the first mismatching byte, leaking prefix length via timing.
const timingSafeEqual = (a: string, b: string): boolean => {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  if (aBytes.length !== bBytes.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < aBytes.length; i += 1) {
    // oxlint-disable-next-line no-bitwise -- XOR-accumulate is the standard constant-time compare; boolean ops would short-circuit
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0)
  }
  return diff === 0
}

const http = httpRouter()

// Registers the Better Auth HTTP handler (/api/auth/*) on the Convex deployment.
authComponent.registerRoutes(http, createAuth)

// current_period_end lives on the Subscription in older API versions and on the
// subscription item in newer ones — read whichever is present.
const periodEndMs = (sub: Stripe.Subscription): number | undefined => {
  const top = (sub as unknown as { current_period_end?: number })
    .current_period_end
  const item = (
    sub.items?.data?.[0] as unknown as
      | { current_period_end?: number }
      | undefined
  )?.current_period_end
  const secs = top ?? item
  return secs ? secs * 1000 : undefined
}

// Shared shape for upsertSubscriptionFromStripe from a Stripe subscription.
const subscriptionUpsertArgs = (
  sub: Stripe.Subscription,
  eventCreated: number,
  statusOverride?: string
) => {
  const [item] = sub.items.data
  return {
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    currentPeriodEnd: periodEndMs(sub),
    customerId:
      typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    eventCreated,
    priceId: item?.price.id ?? '',
    status: statusOverride ?? sub.status,
    subscriptionId: sub.id
  }
}

const handleCheckoutCompleted = async (
  ctx: ActionCtx,
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventCreated: number
): Promise<void> => {
  const userId = session.metadata?.userId
  const customerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id
  if (!(session.mode === 'subscription' && userId && customerId)) {
    return
  }
  await ctx.runMutation(internal.billing.ensureCustomer, {
    customerId,
    userId
  })
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    await ctx.runMutation(
      internal.billing.upsertSubscriptionFromStripe,
      subscriptionUpsertArgs(sub, eventCreated)
    )
  }
}

const stripeWebhook = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!(signature && secret)) {
    return new Response('Missing signature or secret', { status: 400 })
  }

  const body = await request.text()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    httpClient: Stripe.createFetchHttpClient()
  })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    )
  } catch (error) {
    return new Response(`Webhook error: ${(error as Error).message}`, {
      status: 400
    })
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    await ctx.runMutation(
      internal.billing.upsertSubscriptionFromStripe,
      subscriptionUpsertArgs(
        event.data.object,
        event.created * 1000,
        event.type === 'customer.subscription.deleted' ? 'canceled' : undefined
      )
    )
  }

  // Recovery path: the session carries our userId, so it can re-key the row
  // even if the customer id on file diverged (e.g. a concurrent checkout
  // created a second customer) — then re-apply the authoritative sub state
  // that any earlier subscription.* events would have dropped as unknown.
  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(
      ctx,
      stripe,
      event.data.object,
      event.created * 1000
    )
  }

  return new Response(null, { status: 200 })
})

http.route({ handler: stripeWebhook, method: 'POST', path: '/stripe/webhook' })

// Public, unauthenticated endpoint — Telegram posts updates here. We verify the
// secret-token header (set when registering the webhook), enqueue work, and
// always return 200 fast: a non-200 makes Telegram retry-loop the update.
// Fail closed: with no secret configured, every update is dropped.
const telegramWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const header = request.headers.get('x-telegram-bot-api-secret-token')
  if (!(secret && header && timingSafeEqual(header, secret))) {
    return new Response(null, { status: 200 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response(null, { status: 200 })
  }

  const { message } = update
  const text = message?.text
  const chatId = message?.chat?.id
  if (!(typeof text === 'string' && typeof chatId === 'number')) {
    return new Response(null, { status: 200 })
  }
  const chatIdStr = String(chatId)

  // Telegram redelivers updates it thinks we missed — claim each id once so a
  // retried update can't double-run a turn.
  if (typeof update.update_id === 'number') {
    const { fresh } = await ctx.runMutation(internal.telegram.claimUpdate, {
      updateId: update.update_id
    })
    if (!fresh) {
      return new Response(null, { status: 200 })
    }
  }

  if (text.startsWith('/start')) {
    const code = text.slice('/start'.length).trim()
    if (code) {
      const result = await ctx.runMutation(internal.telegram.consumeLinkCode, {
        chatId: chatIdStr,
        code
      })
      await sendTelegramMessage(
        chatIdStr,
        result.ok
          ? 'Linked ✅ — message me anytime and I will reply here.'
          : `Could not link (${result.reason}). Get a fresh link from the web app → Settings → Telegram.`
      )
    } else {
      await sendTelegramMessage(
        chatIdStr,
        'Open the Nau Labs web app → Settings → Telegram and tap the link to connect this chat.'
      )
    }
    return new Response(null, { status: 200 })
  }

  const routed = await ctx.runMutation(internal.telegram.routeInbound, {
    chatId: chatIdStr,
    text
  })
  if (routed.status !== 'ok') {
    await sendTelegramMessage(chatIdStr, TELEGRAM_REPLIES[routed.status])
  }
  return new Response(null, { status: 200 })
})

http.route({
  handler: telegramWebhook,
  method: 'POST',
  path: '/telegram/webhook'
})

// Send the user back to the integrations settings page with a status query.
// Fail fast on a missing SITE_URL rather than redirecting to localhost.
const integrationsRedirect = (query: string): Response => {
  const site = process.env.SITE_URL
  if (!site) {
    throw new Error('SITE_URL is not set')
  }
  return new Response(null, {
    headers: {
      location: `${site}/settings/integrations?${query}`
    },
    status: 302
  })
}

// Google OAuth callback for account integrations (Gmail/Calendar/Drive). The
// `state` param is a single-use nonce bound to the initiating user — the only
// identity we trust here. Tokens are encrypted before they touch the DB.
const googleCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)

  const errorParam = url.searchParams.get('error')
  const state = url.searchParams.get('state')
  const code = url.searchParams.get('code')
  if (errorParam || !(state && code)) {
    return integrationsRedirect('error=denied')
  }

  const consumed = await ctx.runMutation(
    internal.integrations.consumeOauthState,
    { state }
  )
  if (!consumed) {
    return integrationsRedirect('error=state')
  }

  try {
    const tokens = await exchangeGoogleCode(code)
    const accountEmail = await fetchGoogleEmail(tokens.accessToken)
    await ctx.runMutation(internal.integrations.upsertFromOauth, {
      accountEmail: accountEmail ?? undefined,
      encryptedTokens: await encryptJson(tokens),
      provider: 'google',
      scopes: tokens.scopes,
      userId: consumed.userId
    })
    return integrationsRedirect('connected=google')
  } catch {
    return integrationsRedirect('error=exchange')
  }
})

http.route({
  handler: googleCallback,
  method: 'GET',
  path: '/integrations/google/callback'
})

export default http
