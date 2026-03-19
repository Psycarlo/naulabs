<template>
  <div class="relative flex items-center justify-center overflow-hidden py-4">
    <div
      class="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/4 bg-linear-to-r from-background"
    />
    <div
      class="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4 bg-linear-to-l from-background"
    />
    <svg
      :viewBox="`0 0 ${TOTAL_WIDTH} ${SVG_HEIGHT}`"
      class="h-14 w-full max-w-2xl"
      aria-hidden="true"
    >
      <line
        v-for="(tick, i) in ticks"
        :key="i"
        :x1="tick.x"
        :y1="tick.y1"
        :x2="tick.x"
        :y2="tick.y2"
        class="stroke-muted-foreground/20"
        :stroke-width="tick.type === 'degree' ? 1.5 : 1"
        :stroke-linecap="'round'"
      />
      <text
        v-for="(tick, i) in ticks.filter(t => t.label)"
        :key="`label-${i}`"
        :x="tick.x"
        :y="tick.labelY"
        text-anchor="middle"
        class="fill-muted-foreground text-[10px] font-medium"
        :class="tick.label === 'N' ? 'fill-foreground' : ''"
      >
        {{ tick.label }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
interface Tick {
  x: number
  y1: number
  y2: number
  type: 'degree' | 'medium' | 'small'
  label?: string
  labelY?: number
}

const TOTAL_WIDTH = 600
const SVG_HEIGHT = 50
const CENTER_X = TOTAL_WIDTH / 2
const CURVE_DEPTH = 12
const TICK_COUNT = 73 // -180 to +180 in 5-degree steps
const SPREAD = TOTAL_WIDTH * 0.9

const ticks: Tick[] = []

for (let i = 0; i < TICK_COUNT; i++) {
  const degree = -180 + i * 5
  const t = i / (TICK_COUNT - 1)
  const x = (TOTAL_WIDTH - SPREAD) / 2 + t * SPREAD

  // Superellipse curve: raises the center, drops the edges
  const normalized = (x - CENTER_X) / (SPREAD / 2)
  const curve = CURVE_DEPTH * (1 - Math.abs(normalized) ** 2.5)

  const baseY = SVG_HEIGHT * 0.55 - curve
  const isDegreeLabel = degree % 45 === 0
  const isMedium = degree % 15 === 0

  let tickHeight: number
  let type: Tick['type']

  if (isDegreeLabel) {
    tickHeight = 14
    type = 'degree'
  } else if (isMedium) {
    tickHeight = 9
    type = 'medium'
  } else {
    tickHeight = 5
    type = 'small'
  }

  const y1 = baseY - tickHeight / 2
  const y2 = baseY + tickHeight / 2

  let label: string | undefined
  let labelY: number | undefined

  if (isDegreeLabel) {
    if (degree === 0) {
      label = 'N'
    } else {
      label = `${Math.abs(degree)}°`
    }
    labelY = y2 + 12
  }

  ticks.push({ x, y1, y2, type, label, labelY })
}
</script>
