<template>
  <section class="container-narrow py-12 flex flex-col gap-6 max-w-2xl">
    <h1 class="text-2xl font-bold tracking-tight">Integrations</h1>

    <p v-if="statusNotice" class="text-sm" :class="statusNoticeClass">
      {{ statusNotice }}
    </p>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Google</UiCardTitle>
        <UiCardDescription>
          Let your agent read Gmail, Calendar, and Drive. Access tokens are
          encrypted and never enter the sandbox — every call is proxied
          server-side, and anything destructive (sending email, creating events)
          waits for your explicit approval.
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="flex flex-col gap-4 text-sm">
        <template v-if="google">
          <p
            :class="
              google.status === 'connected'
                ? 'text-green-600'
                : 'text-destructive'
            "
          >
            <template v-if="google.status === 'connected'">
              ✅ Connected<template v-if="google.accountEmail">
                as {{ google.accountEmail }}</template
              >
              · {{ google.services.join(', ') || 'no services' }}
            </template>
            <template v-else>
              ⚠️ Connection needs attention ({{ google.status }}) — reconnect
              below.
            </template>
          </p>
          <UiButton
            variant="outline"
            class="self-start"
            :disabled="disconnecting"
            @click="onDisconnect"
          >
            Disconnect
          </UiButton>
        </template>

        <template v-if="!google || google.status !== 'connected'">
          <fieldset class="flex flex-col gap-2">
            <legend class="text-muted-foreground mb-1">
              Choose what the agent may access:
            </legend>
            <label
              v-for="service in SERVICES"
              :key="service.key"
              class="flex items-center gap-2"
            >
              <input
                v-model="selected"
                type="checkbox"
                :value="service.key"
                class="accent-primary"
              />
              {{ service.label }}
            </label>
          </fieldset>
          <UiButton
            class="self-start"
            :disabled="connecting || selected.length === 0"
            @click="onConnect"
          >
            Connect Google
          </UiButton>
        </template>

        <p v-if="errorMessage" class="text-destructive">{{ errorMessage }}</p>
      </UiCardContent>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'
import { computed, ref } from 'vue'

definePageMeta({ convexAuth: true })

const SERVICES = [
  { key: 'gmail', label: 'Gmail — read and (with approval) send email' },
  {
    key: 'calendar',
    label: 'Calendar — list and (with approval) create events'
  },
  { key: 'drive', label: 'Drive — search and read files' }
] as const

const route = useRoute()
const selected = ref<string[]>(['gmail', 'calendar', 'drive'])
const errorMessage = ref('')

const { data: integrations } = await useConvexQuery(
  api.integrations.myIntegrations,
  {}
)
const { execute: authUrl, pending: connecting } = useConvexAction(
  api.integrations.googleAuthUrl
)
const { execute: disconnect, pending: disconnecting } = useConvexAction(
  api.integrations.disconnect
)

const google = computed(
  () => integrations.value?.find((row) => row.provider === 'google') ?? null
)

const statusNotice = computed(() => {
  if (route.query.connected === 'google') {
    return 'Google connected — your agent can use it now.'
  }
  if (route.query.error) {
    return `Connection failed (${route.query.error}). Try again.`
  }
  return ''
})
const statusNoticeClass = computed(() =>
  route.query.error ? 'text-destructive' : 'text-green-600'
)

const onConnect = async () => {
  errorMessage.value = ''
  try {
    const url = await authUrl({ services: selected.value })
    if (url) {
      window.location.href = url
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not start the flow'
  }
}

const onDisconnect = async () => {
  errorMessage.value = ''
  try {
    await disconnect({ provider: 'google' })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not disconnect'
  }
}
</script>
