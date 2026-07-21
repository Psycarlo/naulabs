import { api } from '@naulabs/backend'
import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

// Subscribe to a thread's messages and live token stream WITHOUT the Agent
// component's React hooks. Two reactive queries against `chat.listMessages`:
//   - list:   finished UI messages (page) + which streams are active
//   - deltas: incremental text for active streams, advancing a per-stream cursor
// We accumulate delta text locally and expose a merged, render-ready view.

interface StreamCursor {
  cursor: number
  streamId: string
}

interface ChatMessage {
  key: string
  role: string
  streaming: boolean
  text: string
}

const PAGE = { cursor: null, numItems: 100 }

// Delta `parts` are AI SDK stream parts; pull text out defensively across the
// possible shapes (text-delta with `text`, or a raw `delta` string).
const partText = (part: unknown): string => {
  if (typeof part !== 'object' || part === null) {
    return ''
  }
  const p = part as { delta?: unknown; text?: unknown; type?: unknown }
  if (typeof p.text === 'string') {
    return p.text
  }
  if (typeof p.delta === 'string') {
    return p.delta
  }
  return ''
}

export const useThreadMessages = async (
  threadId: MaybeRefOrGetter<string | undefined>
) => {
  const cursors = ref<StreamCursor[]>([])
  const buffers = ref<Record<string, string>>({})

  const enabled = () => Boolean(toValue(threadId))

  const listQuery = await useConvexQuery(
    api.chat.listMessages,
    () => {
      const id = toValue(threadId)
      return id
        ? {
            paginationOpts: PAGE,
            streamArgs: { kind: 'list' as const },
            threadId: id
          }
        : undefined
    },
    { enabled, keepPreviousData: true }
  )

  const deltaQuery = await useConvexQuery(
    api.chat.listMessages,
    () => {
      const id = toValue(threadId)
      return id && cursors.value.length
        ? {
            paginationOpts: { cursor: null, numItems: 1 },
            streamArgs: { cursors: cursors.value, kind: 'deltas' as const },
            threadId: id
          }
        : undefined
    },
    { enabled: () => enabled() && cursors.value.length > 0 }
  )

  // Active streams discovered by the list query → seed/prune cursors.
  watch(
    () => listQuery.data.value,
    (data) => {
      const streams = data?.streams
      if (streams?.kind !== 'list') {
        return
      }
      const active = streams.messages.filter((m) => m.status === 'streaming')
      const activeIds = new Set(active.map((m) => m.streamId))
      cursors.value = active.map((m) => ({
        cursor:
          cursors.value.find((c) => c.streamId === m.streamId)?.cursor ?? 0,
        streamId: m.streamId
      }))
      // Keep only buffers whose streams are still active (finished ones drop).
      const kept: Record<string, string> = {}
      for (const id of activeIds) {
        if (buffers.value[id] !== undefined) {
          kept[id] = buffers.value[id]
        }
      }
      buffers.value = kept
    },
    { immediate: true }
  )

  // Incoming deltas → append to per-stream buffer and advance the cursor.
  watch(
    () => deltaQuery.data.value,
    (data) => {
      const streams = data?.streams
      if (streams?.kind !== 'deltas') {
        return
      }
      for (const delta of streams.deltas) {
        const text = delta.parts.map(partText).join('')
        buffers.value[delta.streamId] =
          (buffers.value[delta.streamId] ?? '') + text
        const entry = cursors.value.find((c) => c.streamId === delta.streamId)
        if (entry && delta.end > entry.cursor) {
          entry.cursor = delta.end
        }
      }
    },
    { immediate: true }
  )

  const streamingText = computed(() => {
    const ids = Object.keys(buffers.value)
    return ids.length ? (buffers.value[ids.at(-1) as string] ?? '') : ''
  })

  const isStreaming = computed(() => streamingText.value.length > 0)

  // Finished messages only; the live stream is rendered separately so the UI
  // can smooth it (see useSmoothText in chat.vue).
  const messages = computed<ChatMessage[]>(() => {
    const page = (listQuery.data.value?.page ?? []) as {
      key?: string
      role: string
      text: string
    }[]
    return page.map((m, i) => ({
      key: m.key ?? `m-${i}`,
      role: m.role,
      streaming: false,
      text: m.text
    }))
  })

  return {
    isStreaming,
    messages,
    pending: listQuery.pending,
    streamingText
  }
}
