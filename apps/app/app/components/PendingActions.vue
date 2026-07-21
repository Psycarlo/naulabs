<template>
  <div v-if="pending?.length" class="flex flex-col gap-2">
    <div
      v-for="item in pending"
      :key="item.id"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm flex flex-col gap-2"
    >
      <p class="font-medium">{{ KIND_LABEL[item.kind] ?? item.kind }}</p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <template v-for="(value, key) in parsePayload(item.payload)" :key="key">
          <dt class="text-muted-foreground capitalize">{{ key }}</dt>
          <dd class="whitespace-pre-wrap break-words">{{ value }}</dd>
        </template>
      </dl>
      <div class="flex gap-2">
        <UiButton size="sm" :disabled="busy" @click="onApprove(item.id)">
          Approve
        </UiButton>
        <UiButton
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="onDeny(item.id)"
        >
          Deny
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'
import { computed } from 'vue'

// Approval surface for the confirm gate: destructive agent actions (send
// email, create event) sit here until the user explicitly approves the exact
// payload. See packages/backend/convex/pendingActions.ts.

const KIND_LABEL: Record<string, string> = {
  calendar_create_event: 'The agent wants to create a calendar event',
  gmail_send: 'The agent wants to send an email'
}

const { data: pending } = await useConvexQuery(api.pendingActions.myPending, {})
const { execute: approve, pending: approving } = useConvexMutation(
  api.pendingActions.approve
)
const { execute: deny, pending: denying } = useConvexMutation(
  api.pendingActions.deny
)

const busy = computed(() => approving.value || denying.value)

const parsePayload = (payload: string): Record<string, string> => {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>
    const entries = Object.entries(parsed)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)] as const)
    return Object.fromEntries(entries)
  } catch {
    return { payload }
  }
}

const onApprove = async (id: string) => {
  await approve({ id })
}

const onDeny = async (id: string) => {
  await deny({ id })
}
</script>
