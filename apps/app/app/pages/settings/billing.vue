<template>
  <section class="container-narrow py-12 flex flex-col gap-6 max-w-2xl">
    <h1 class="text-2xl font-bold tracking-tight">Billing</h1>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle class="capitalize">
          {{ ent?.planKey ?? '…' }} plan
        </UiCardTitle>
        <UiCardDescription v-if="sub">
          {{ sub.status
          }}<template v-if="sub.cancelAtPeriodEnd">
            · cancels at period end</template
          >
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="flex flex-col gap-5 text-sm">
        <div v-if="ent" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-muted-foreground">
              <span>Tokens</span>
              <span>{{
                usageText(ent.usage.tokens, ent.entitlements.monthlyTokens)
              }}</span>
            </div>
            <div class="h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full bg-primary"
                :style="{
                  width: pct(ent.usage.tokens, ent.entitlements.monthlyTokens)
                }"
              />
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-muted-foreground">
              <span>Sandbox minutes</span>
              <span>{{
                usageText(
                  ent.usage.sandboxMinutes,
                  ent.entitlements.sandbox.monthlyActiveMinutes
                )
              }}</span>
            </div>
            <div class="h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full bg-primary"
                :style="{
                  width: pct(
                    ent.usage.sandboxMinutes,
                    ent.entitlements.sandbox.monthlyActiveMinutes
                  )
                }"
              />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <UiButton as-child variant="outline">
            <NuxtLink to="/pricing">Change plan</NuxtLink>
          </UiButton>
          <UiButton
            v-if="sub?.hasBilling"
            :disabled="portalPending"
            @click="openPortal"
          >
            Manage billing
          </UiButton>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>
      </UiCardContent>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'

definePageMeta({ convexAuth: true })

const { data: ent } = await useConvexQuery(
  api.entitlements.getMyEntitlements,
  {}
)
const { data: sub } = await useConvexQuery(api.billing.getMySubscription, {})
const { execute: portal, pending: portalPending } = useConvexAction(
  api.billing.customerPortal
)
const errorMessage = ref('')

const usageText = (used: number, limit: number | null) =>
  limit === null
    ? `${used.toLocaleString()} · unlimited`
    : `${used.toLocaleString()} / ${limit.toLocaleString()}`

const pct = (used: number, limit: number | null) => {
  if (limit === null || limit === 0) {
    return '0%'
  }
  return `${Math.min(100, Math.round((used / limit) * 100))}%`
}

const openPortal = async () => {
  errorMessage.value = ''
  try {
    const url = await portal({})
    if (url) {
      window.location.href = url
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not open portal'
  }
}
</script>
