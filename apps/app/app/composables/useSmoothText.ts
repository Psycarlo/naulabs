import type { MaybeRefOrGetter } from 'vue'
import { onScopeDispose, ref, toValue, watch } from 'vue'

// Reveal streamed text one chunk at a time so tokens arriving in bursts (the
// agent batches deltas ~4/s) animate in smoothly instead of jumping. The Vue
// stand-in for the Agent component's React-only `useSmoothText`.
const CHARS_PER_FRAME = 2

export const useSmoothText = (source: MaybeRefOrGetter<string>) => {
  const visible = ref('')
  let frame = 0

  const tick = () => {
    const target = toValue(source)
    if (visible.value.length < target.length) {
      visible.value = target.slice(0, visible.value.length + CHARS_PER_FRAME)
      frame = requestAnimationFrame(tick)
    } else {
      // Snap to target (handles shrink/reset, e.g. switching threads).
      visible.value = target
      frame = 0
    }
  }

  watch(
    () => toValue(source),
    (next) => {
      if (!next.startsWith(visible.value)) {
        visible.value = ''
      }
      if (!frame) {
        frame = requestAnimationFrame(tick)
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    if (frame) {
      cancelAnimationFrame(frame)
    }
  })

  return visible
}
