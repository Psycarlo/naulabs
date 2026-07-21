// Plan catalog — the single source of truth for tiers.
//
// PLACEHOLDER VALUES. Tweak freely: entitlement numbers, model slugs, and the
// set of plans can all change here without touching the rest of the code, which
// only ever reads `Entitlements`. Stripe price IDs come from env (per account /
// mode); fill them in when you create the prices in Stripe.
//
// NOTE: model ids are OpenRouter slugs — all three below verified against
// https://openrouter.ai/api/v1/models on 2026-07-21. Re-verify when editing.
//
// Object keys are kept alphabetical to satisfy the repo's sort-keys lint rule;
// human-facing plan ORDER is defined separately below.

export type Period = 'monthly' | 'annual'
export type Channel = 'web' | 'telegram' | 'whatsapp'

export interface Entitlements {
  // allowed OpenRouter model ids; ['*'] = any
  models: string[]
  defaultModel: string
  // null = unlimited
  monthlyTokens: number | null
  sandbox: { cpu: number; ramMb: number; monthlyActiveMinutes: number }
  channels: Channel[]
  maxIntegrations: number
  maxConcurrentSessions: number
}

export interface Plan {
  name: string
  description: string
  prices: Partial<Record<Period, string | undefined>>
  entitlements: Entitlements
}

export const DEFAULT_PLAN_KEY = 'free'

// Display order for the pricing page (plan keys are stored alphabetically).
export const PLAN_ORDER = ['free', 'starter', 'pro', 'max']

export const PLANS: Record<string, Plan> = {
  free: {
    description: 'Try the agent with a small monthly budget.',
    entitlements: {
      channels: ['web'],
      defaultModel: 'anthropic/claude-haiku-4.5',
      maxConcurrentSessions: 1,
      maxIntegrations: 1,
      models: ['anthropic/claude-haiku-4.5'],
      monthlyTokens: 1_000_000,
      sandbox: { cpu: 1, monthlyActiveMinutes: 300, ramMb: 1024 }
    },
    name: 'Free',
    prices: {}
  },
  max: {
    description: 'Everything, highest limits.',
    entitlements: {
      channels: ['web', 'telegram', 'whatsapp'],
      defaultModel: 'anthropic/claude-opus-4.8',
      maxConcurrentSessions: 10,
      maxIntegrations: 50,
      models: ['*'],
      monthlyTokens: null,
      sandbox: { cpu: 4, monthlyActiveMinutes: 20_000, ramMb: 8192 }
    },
    name: 'Max',
    prices: {
      annual: process.env.STRIPE_PRICE_MAX_ANNUAL,
      monthly: process.env.STRIPE_PRICE_MAX_MONTHLY
    }
  },
  pro: {
    description: 'Frontier models and bigger budgets.',
    entitlements: {
      channels: ['web', 'telegram', 'whatsapp'],
      defaultModel: 'anthropic/claude-opus-4.8',
      maxConcurrentSessions: 5,
      maxIntegrations: 10,
      models: [
        'anthropic/claude-haiku-4.5',
        'anthropic/claude-sonnet-4.6',
        'anthropic/claude-opus-4.8'
      ],
      monthlyTokens: 50_000_000,
      sandbox: { cpu: 2, monthlyActiveMinutes: 6000, ramMb: 4096 }
    },
    name: 'Pro',
    prices: {
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY
    }
  },
  starter: {
    description: 'For regular personal use.',
    entitlements: {
      channels: ['web', 'telegram'],
      defaultModel: 'anthropic/claude-sonnet-4.6',
      maxConcurrentSessions: 2,
      maxIntegrations: 3,
      models: ['anthropic/claude-haiku-4.5', 'anthropic/claude-sonnet-4.6'],
      monthlyTokens: 10_000_000,
      sandbox: { cpu: 1, monthlyActiveMinutes: 1500, ramMb: 2048 }
    },
    name: 'Starter',
    prices: {
      annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY
    }
  }
}

export const getPlan = (planKey: string): Plan =>
  PLANS[planKey] ?? PLANS[DEFAULT_PLAN_KEY]

export const priceIdFor = (
  planKey: string,
  period: Period
): string | undefined => PLANS[planKey]?.prices[period]

// Reverse lookup used by the Stripe webhook: price id -> plan + period.
export const planForPriceId = (
  priceId: string
): { planKey: string; period: Period } | null => {
  for (const [planKey, plan] of Object.entries(PLANS)) {
    for (const [period, id] of Object.entries(plan.prices)) {
      if (id && id === priceId) {
        return { period: period as Period, planKey }
      }
    }
  }
  return null
}

// Safe-for-client view of the catalog (no secrets; prices reduced to which
// periods are purchasable), returned in display order.
export const publicPlans = () =>
  PLAN_ORDER.filter((key) => PLANS[key]).map((key) => {
    const plan = PLANS[key]
    return {
      description: plan.description,
      entitlements: plan.entitlements,
      key,
      name: plan.name,
      periods: (Object.keys(plan.prices) as Period[]).filter(
        (p) => plan.prices[p]
      )
    }
  })
