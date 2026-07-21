<script setup lang="ts">
import type { SpringOptions } from 'motion-v'
import { useMotionValue, useSpring } from 'motion-v'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { cn } from '@/lib/utils'

interface StarsBackgroundProps {
  factor?: number
  speed?: number
  transition?: SpringOptions
  starColor?: string
  class?: string
}

const props = withDefaults(defineProps<StarsBackgroundProps>(), {
  factor: 0.05,
  speed: 50,
  starColor: '#fff',
  transition: () => ({ damping: 20, stiffness: 50 })
})

defineSlots()

interface Bubble {
  x: number
  y: number
  radius: number
  opacity: number
}

const generateBubbles = (
  count: number,
  minRadius: number,
  maxRadius: number
): Bubble[] => {
  const bubbles: Bubble[] = []
  for (let i = 0; i < count; i += 1) {
    bubbles.push({
      opacity: 0.15 + Math.random() * 0.45,
      radius: minRadius + Math.random() * (maxRadius - minRadius),
      x: Math.random() * 4000 - 2000,
      y: Math.random() * 4000 - 2000
    })
  }
  return bubbles
}

const offsetX = useMotionValue(0)
const offsetY = useMotionValue(0)
const springX = useSpring(offsetX, props.transition)
const springY = useSpring(offsetY, props.transition)

const handleMouseMove = (e: MouseEvent) => {
  const centerX = window.innerWidth / 2
  const centerY = window.innerHeight / 2
  offsetX.set(-(e.clientX - centerX) * props.factor)
  offsetY.set(-(e.clientY - centerY) * props.factor)
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId = 0
let layer1Bubbles: Bubble[] = []
let layer2Bubbles: Bubble[] = []
let layer3Bubbles: Bubble[] = []

const initBubbles = () => {
  layer1Bubbles = generateBubbles(400, 1, 2.5)
  layer2Bubbles = generateBubbles(200, 2.5, 5)
  layer3Bubbles = generateBubbles(100, 5, 9)
}

const drawBubbles = (
  ctx: CanvasRenderingContext2D,
  bubbles: Bubble[],
  color: string,
  offsetYAnim: number,
  parallaxX: number,
  parallaxY: number,
  canvasW: number,
  canvasH: number
) => {
  const cx = canvasW / 2 + parallaxX
  const cy = canvasH / 2 + parallaxY
  const range = 4000

  for (const b of bubbles) {
    const screenX = cx + b.x
    const rawY = ((b.y + offsetYAnim + range) % range) - range / 2
    const screenY = cy + rawY

    if (
      screenX < -20 ||
      screenX > canvasW + 20 ||
      screenY < -20 ||
      screenY > canvasH + 20
    ) {
      continue
    }

    ctx.beginPath()
    ctx.arc(screenX, screenY, b.radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.globalAlpha = b.opacity
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

const startAnimation = () => {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  const startTime = performance.now()

  const frame = (now: number) => {
    const frameCanvas = canvasRef.value
    if (!frameCanvas || !ctx) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const w = frameCanvas.clientWidth
    const h = frameCanvas.clientHeight

    if (frameCanvas.width !== w * dpr || frameCanvas.height !== h * dpr) {
      frameCanvas.width = w * dpr
      frameCanvas.height = h * dpr
      ctx.scale(dpr, dpr)
    }

    ctx.clearRect(0, 0, w, h)

    const elapsed = (now - startTime) / 1000
    const color = props.starColor
    const px = springX.get()
    const py = springY.get()

    const speed1 = 4000 / props.speed
    const speed2 = 4000 / (props.speed * 2)
    const speed3 = 4000 / (props.speed * 3)

    drawBubbles(ctx, layer1Bubbles, color, -elapsed * speed1, px, py, w, h)
    drawBubbles(ctx, layer2Bubbles, color, -elapsed * speed2, px, py, w, h)
    drawBubbles(ctx, layer3Bubbles, color, -elapsed * speed3, px, py, w, h)

    animationId = requestAnimationFrame(frame)
  }

  animationId = requestAnimationFrame(frame)
}

onMounted(() => {
  initBubbles()
  startAnimation()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
})

watch(
  () => props.starColor,
  () => {
    // Color is read each frame, no re-init needed
  }
)
</script>

<template>
  <div
    :class="
      cn(
        `relative size-full overflow-hidden bg-[radial-gradient(ellipse_at_bottom,#262626_0%,#000_100%)]`,
        props.class
      )
    "
    @mousemove="handleMouseMove"
  >
    <canvas
      ref="canvasRef"
      class="pointer-events-none absolute inset-0 size-full"
    />
    <slot />
  </div>
</template>
