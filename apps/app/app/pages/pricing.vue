<template>
  <section class="container-narrow py-16 flex flex-col gap-8">
    <div class="flex flex-col items-center gap-4 text-center">
      <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">Plans</h1>
      <div class="inline-flex rounded-lg border p-1 text-sm">
        <button
          type="button"
          class="px-3 py-1 rounded-md transition-colors"
          :class="
            period === 'monthly'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground'
          "
          @click="period = 'monthly'"
        >
          Monthly
        </button>
        <button
          type="button"
          class="px-3 py-1 rounded-md transition-colors"
          :class="
            period === 'annual'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground'
          "
          @click="period = 'annual'"
        >
          Annual
        </button>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UiCard v-for="plan in plans" :key="plan.key" class="flex flex-col">
        <UiCardHeader>
          <UiCardTitle class="flex items-center justify-between">
            {{ plan.name }}
            <span
              v-if="me?.planKey === plan.key"
              class="text-xs font-normal text-muted-foreground"
            >
              Current
            </span>
          </UiCardTitle>
          <UiCardDescription>{{ plan.description }}</UiCardDescription>
        </UiCardHeader>
        <UiCardContent class="flex flex-1 flex-col gap-3 text-sm">
          <ul class="flex flex-col gap-1.5 text-muted-foreground">
            <li>{{ modelLabel(plan.entitlements) }}</li>
            <li>{{ tokenLabel(plan.entitlements.monthlyTokens) }} / mo</li>
            <li>
              Sandbox: {{ plan.entitlements.sandbox.cpu }} vCPU ·
              {{ Math.round(plan.entitlements.sandbox.ramMb / 1024) }} GB
            </li>
            <li>Channels: {{ plan.entitlements.channels.join(', ') }}</li>
            <li>{{ plan.entitlements.maxIntegrations }} integrations</li>
          </ul>
          <div class="mt-auto pt-2">
            <span
              v-if="plan.key === 'free'"
              class="text-xs text-muted-foreground"
            >
              Default plan
            </span>
            <UiButton
              v-else-if="plan.periods.includes(period)"
              class="w-full"
              :disabled="pending || me?.planKey === plan.key"
              @click="subscribe(plan.key)"
            >
              {{ me?.planKey === plan.key ? 'Current plan' : 'Subscribe' }}
            </UiButton>
            <UiButton v-else class="w-full" variant="outline" disabled>
              Coming soon
            </UiButton>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <p v-if="errorMessage" class="text-center text-sm text-destructive">
      {{ errorMessage }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'

type Period = 'monthly' | 'annual'

const period = ref<Period>('monthly')
const errorMessage = ref('')

const { data: plans } = await useConvexQuery(api.billing.listPlans, {})
const { data: me } = await useConvexQuery(
  api.entitlements.getMyEntitlements,
  {}
)
const { execute: checkout, pending } = useConvexAction(
  api.billing.createCheckout
)

type Ent = NonNullable<typeof plans.value>[number]['entitlements']

const modelLabel = (ent: Ent) =>
  ent.models.includes('*') ? 'All models' : `${ent.models.length} models`

const tokenLabel = (tokens: number | null) =>
  tokens === null
    ? 'Unlimited tokens'
    : `${(tokens / 1_000_000).toLocaleString()}M tokens`

const subscribe = async (planKey: string) => {
  errorMessage.value = ''
  if (!me.value) {
    await navigateTo('/login')
    return
  }
  try {
    const url = await checkout({ period: period.value, planKey })
    if (url) {
      window.location.href = url
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Checkout failed'
  }
}
</script>
