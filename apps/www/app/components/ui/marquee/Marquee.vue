<script lang="ts" setup>
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    class?: string
    reverse?: boolean
    slowOnHover?: boolean
    vertical?: boolean
    repeat?: number
  }>(),
  {
    repeat: 4,
    slowOnHover: false,
    vertical: false
  }
)

const containerRef = useTemplateRef('containerRef')

const setPlaybackRate = (rate: number) => {
  if (!containerRef.value) {
    return
  }
  for (const el of containerRef.value.querySelectorAll('.marquee-track')) {
    for (const anim of el.getAnimations()) {
      anim.playbackRate = rate
    }
  }
}

const onMouseEnter = () => {
  if (props.slowOnHover) {
    setPlaybackRate(0.25)
  }
}

const onMouseLeave = () => {
  if (props.slowOnHover) {
    setPlaybackRate(1)
  }
}
</script>

<template>
  <div
    ref="containerRef"
    :class="
      cn(
        `flex gap-(--gap) overflow-hidden p-2 [--duration:40s] [--gap:1rem]`,
        vertical ? 'flex-col' : 'flex-row',
        $props.class
      )
    "
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      v-for="index in repeat"
      :key="index"
      :style="{
        animationDirection: reverse ? 'reverse' : 'normal'
      }"
      :class="
        cn(
          `marquee-track flex shrink-0 justify-around gap-(--gap)`,
          vertical
            ? 'animate-marquee-vertical flex-col'
            : 'animate-marquee flex-row'
        )
      "
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.animate-marquee {
  animation: marquee var(--duration) linear infinite;
  animation-direction: reverse;
}

.animate-marquee-vertical {
  animation: marquee-vertical var(--duration) linear infinite;
}

@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100% - var(--gap)));
  }
}

@keyframes marquee-vertical {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(calc(-100% - var(--gap)));
  }
}
</style>
