<template>
  <section
    class="container-narrow py-8 flex flex-col gap-4 h-[calc(100vh-4rem)]"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight">Chat</h1>
        <span
          class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          :title="SANDBOX_LABEL[sandboxStatus]"
        >
          <span
            class="size-2 rounded-full"
            :class="SANDBOX_DOT[sandboxStatus]"
          />
          {{ SANDBOX_LABEL[sandboxStatus] }}
        </span>
      </div>
      <UiButton size="sm" :disabled="creating" @click="onNewThread">
        New thread
      </UiButton>
    </div>

    <div class="grid grid-cols-[200px_1fr] gap-4 flex-1 min-h-0">
      <!-- Thread list -->
      <ul class="flex flex-col gap-1 overflow-y-auto border-r pr-2">
        <li v-for="t in threads" :key="t._id">
          <button
            class="w-full text-left text-sm rounded px-2 py-1.5 truncate hover:bg-muted"
            :class="{ 'bg-muted font-medium': t._id === selectedThreadId }"
            type="button"
            @click="selectedThreadId = t._id"
          >
            {{ t.title ?? 'Untitled' }}
          </button>
        </li>
        <li v-if="!threads?.length" class="text-xs text-muted-foreground px-2">
          No threads yet.
        </li>
      </ul>

      <!-- Message view -->
      <div class="flex flex-col min-h-0">
        <div
          v-if="!selectedThreadId"
          class="flex-1 grid place-items-center text-sm text-muted-foreground"
        >
          Select or create a thread to start chatting.
        </div>

        <div v-else class="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
          <div
            v-for="m in messages"
            :key="m.key"
            class="flex flex-col gap-1"
            :class="m.role === 'user' ? 'items-end' : 'items-start'"
          >
            <div
              class="rounded-lg px-3 py-2 max-w-[85%] text-sm"
              :class="
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              "
            >
              <Comark :markdown="m.text" :options="COMARK_OPTIONS" />
            </div>
          </div>

          <!-- Live stream -->
          <div v-if="isStreaming" class="flex flex-col items-start gap-1">
            <div class="rounded-lg px-3 py-2 max-w-[85%] text-sm bg-muted">
              <Comark
                :caret="true"
                :markdown="smoothed"
                :options="COMARK_OPTIONS"
                :streaming="true"
              />
            </div>
          </div>

          <p
            v-if="!(messages.length || isStreaming)"
            class="text-sm text-muted-foreground"
          >
            Send a message to wake your agent.
          </p>
        </div>

        <!-- Destructive agent actions awaiting explicit approval -->
        <PendingActions class="mt-3" />

        <!-- Composer -->
        <form
          v-if="selectedThreadId"
          class="mt-3 flex gap-2"
          @submit.prevent="onSend"
        >
          <UiInput
            v-model="draft"
            class="flex-1"
            :disabled="sending"
            placeholder="Message your agent…"
          />
          <UiButton :disabled="sending || !draft.trim()" type="submit">
            Send
          </UiButton>
        </form>
        <p v-if="blockedNotice" class="mt-1 text-xs text-destructive">
          {{ blockedNotice }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'
import { computed, ref } from 'vue'

definePageMeta({ convexAuth: true })

// SECURITY: model output is untrusted (it echoes emails/docs). html:false
// keeps raw HTML tags as text — markdown only, no `<img>`/`<form>` passthrough
// that would bypass the Prose* guards.
const COMARK_OPTIONS = { html: false }

const selectedThreadId = ref<string | undefined>()
const draft = ref('')
const blockedNotice = ref('')

const { data: threads } = await useConvexQuery(api.chat.listThreads, {})
const { data: sandbox } = await useConvexQuery(api.sandboxState.myStatus, {})
const { execute: createThread, pending: creating } = useConvexMutation(
  api.chat.createChatThread
)
const { execute: send, pending: sending } = useConvexMutation(
  api.chat.sendMessage
)

const { messages, streamingText, isStreaming } =
  await useThreadMessages(selectedThreadId)
const smoothed = useSmoothText(streamingText)

// Sandbox status for the indicator. The box is being woken whenever a turn is
// in flight but not yet reported running ('resuming'); otherwise show the DB
// status (none / running / paused).
const sandboxStatus = computed(() => {
  const status = sandbox.value?.status ?? 'none'
  const inFlight = sending.value || isStreaming.value
  return inFlight && status !== 'running' ? 'resuming' : status
})

const SANDBOX_DOT: Record<string, string> = {
  none: 'bg-muted-foreground',
  paused: 'bg-amber-500',
  resuming: 'bg-blue-500 animate-pulse',
  running: 'bg-green-500'
}
const SANDBOX_LABEL: Record<string, string> = {
  none: 'Sandbox idle',
  paused: 'Sandbox paused',
  resuming: 'Sandbox resuming…',
  running: 'Sandbox running'
}

const onNewThread = async () => {
  const id = await createThread({ title: 'New chat' })
  if (id) {
    selectedThreadId.value = id as string
  }
}

// Statuses that refuse the message; 'ok' covers started AND queued turns
// (queued ones answer when a slot frees up).
const SEND_NOTICES: Record<string, string> = {
  budget_blocked:
    'Monthly token budget reached — upgrade in Settings → Billing.',
  queue_full:
    'Your agent has a backlog of messages — give it a moment to catch up.',
  rate_limited: 'Slow down a little — try again in a minute.'
}

const onSend = async () => {
  const text = draft.value.trim()
  if (!(text && selectedThreadId.value)) {
    return
  }
  draft.value = ''
  blockedNotice.value = ''
  const result = await send({ text, threadId: selectedThreadId.value })
  const notice = result ? SEND_NOTICES[result.status] : undefined
  if (notice) {
    blockedNotice.value = notice
    // Refused messages never reach the thread — restore the draft.
    draft.value = text
  }
}
</script>
