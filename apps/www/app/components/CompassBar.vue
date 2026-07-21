<template>
  <div
    ref="containerRef"
    class="relative flex cursor-grab items-center justify-center overflow-hidden py-4 active:cursor-grabbing"
    @mousedown="onPointerDown"
    @touchstart.passive="onTouchStart"
  >
    <div
      class="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/4 bg-linear-to-r from-background"
    />
    <div
      class="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4 bg-linear-to-l from-background"
    />
    <svg
      :viewBox="`0 0 ${TOTAL_WIDTH} ${SVG_HEIGHT}`"
      class="h-14 w-full max-w-2xl select-none"
      aria-hidden="true"
    >
      <template v-for="(tick, i) in visibleTicks" :key="i">
        <line
          :x1="tick.x"
          :y1="tick.y1"
          :x2="tick.x"
          :y2="tick.y2"
          class="stroke-muted-foreground/20"
          :stroke-width="tick.type === 'degree' ? 1.5 : 1"
          stroke-linecap="round"
        />
        <text
          v-if="tick.label"
          :x="tick.x"
          :y="tick.labelY"
          text-anchor="middle"
          class="fill-muted-foreground text-[10px] font-medium"
          :class="tick.label === 'N' ? 'fill-foreground' : ''"
        >
          {{ tick.label }}
        </text>
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
interface VisibleTick {
  label?: string
  labelY?: number
  type: 'degree' | 'medium' | 'small'
  x: number
  y1: number
  y2: number
}

const TOTAL_WIDTH = 600
const SVG_HEIGHT = 50
const CENTER_X = TOTAL_WIDTH / 2
const CURVE_DEPTH = 12
const VISIBLE_DEGREES = 90
const PX_PER_DEGREE = (TOTAL_WIDTH * 0.9) / VISIBLE_DEGREES
const DEGREES_PER_PX = 1 / PX_PER_DEGREE
const TICK_STEP = 2.5

// degrees per second
const AUTO_SPEED = 2
const FRICTION = 0.95
const offset = ref(0)
const isDragging = ref(false)
let velocity = 0
let startX = 0
let startOffset = 0
let lastMoveX = 0
let lastMoveTime = 0
let animationId: number | null = null
let lastTime = 0

const autoRotate = (time: number) => {
  if (lastTime) {
    const dt = (time - lastTime) / 1000
    if (!isDragging.value) {
      if (Math.abs(velocity) > 0.5) {
        offset.value += velocity * dt
        velocity *= FRICTION
      } else {
        velocity = 0
        offset.value -= AUTO_SPEED * dt
      }
    }
  }
  lastTime = time
  animationId = requestAnimationFrame(autoRotate)
}

onMounted(() => {
  animationId = requestAnimationFrame(autoRotate)
})

onBeforeUnmount(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
  }
})

const wrap = (deg: number): number => ((deg % 360) + 360) % 360

const isClose = (a: number, b: number): boolean => Math.abs(a - b) < 0.1

const labelForDegree = (deg: number): string | undefined => {
  const d = wrap(deg)
  if (isClose(d, 0)) {
    return 'N'
  }
  if (isClose(d, 90)) {
    return 'E'
  }
  if (isClose(d, 180)) {
    return 'S'
  }
  if (isClose(d, 270)) {
    return 'W'
  }
  return `${d % 1 === 0 ? d : d.toFixed(1)}°`
}

const visibleTicks = computed<VisibleTick[]>(() => {
  const result: VisibleTick[] = []
  const centerDeg = offset.value
  const halfRange = VISIBLE_DEGREES / 2

  const startDeg = centerDeg - halfRange - 10
  const endDeg = centerDeg + halfRange + 10
  const firstTick = Math.floor(startDeg / TICK_STEP) * TICK_STEP

  const halfWidth = (VISIBLE_DEGREES / 2) * PX_PER_DEGREE

  for (let deg = firstTick; deg <= endDeg; deg += TICK_STEP) {
    const relDeg = deg - centerDeg
    const x = CENTER_X + relDeg * PX_PER_DEGREE

    if (x < -20 || x > TOTAL_WIDTH + 20) {
      continue
    }

    const normalized = (x - CENTER_X) / halfWidth
    const curve = CURVE_DEPTH * (1 - Math.abs(normalized) ** 2.5)
    const baseY = SVG_HEIGHT * 0.55 - curve

    const wrappedDeg = wrap(deg)
    const isDegreeLabel = Math.abs(wrappedDeg % 22.5) < 0.1
    const isMedium = Math.abs(wrappedDeg % 10) < 0.1

    let tickHeight: number
    let type: VisibleTick['type']

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

    const label = isDegreeLabel ? labelForDegree(deg) : undefined
    const labelY = isDegreeLabel ? y2 + 12 : undefined

    result.push({ label, labelY, type, x, y1, y2 })
  }

  return result
})

const trackVelocity = (clientX: number) => {
  const now = performance.now()
  const dt = (now - lastMoveTime) / 1000
  if (dt > 0) {
    const dx = (clientX - lastMoveX) * DEGREES_PER_PX
    velocity = -dx / dt
  }
  lastMoveX = clientX
  lastMoveTime = now
}

const onPointerMove = (e: MouseEvent) => {
  trackVelocity(e.clientX)
  const dx = e.clientX - startX
  offset.value = startOffset - dx * DEGREES_PER_PX
}

const onTouchMove = (e: TouchEvent) => {
  const [touch] = e.touches
  if (!touch) {
    return
  }
  trackVelocity(touch.clientX)
  const dx = touch.clientX - startX
  offset.value = startOffset - dx * DEGREES_PER_PX
}

const onPointerUp = () => {
  isDragging.value = false
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
}

const onTouchEnd = () => {
  isDragging.value = false
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
}

const onPointerDown = (e: MouseEvent) => {
  isDragging.value = true
  velocity = 0
  startX = e.clientX
  startOffset = offset.value
  lastMoveX = e.clientX
  lastMoveTime = performance.now()
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
}

const onTouchStart = (e: TouchEvent) => {
  const [touch] = e.touches
  if (!touch) {
    return
  }
  isDragging.value = true
  velocity = 0
  startX = touch.clientX
  startOffset = offset.value
  lastMoveX = touch.clientX
  lastMoveTime = performance.now()
  window.addEventListener('touchmove', onTouchMove, { passive: true })
  window.addEventListener('touchend', onTouchEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
})
</script>
