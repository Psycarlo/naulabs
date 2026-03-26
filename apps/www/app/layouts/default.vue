<template>
  <header
    class="sticky top-0 z-50 h-16 border-b backdrop-blur-xl bg-background/50"
  >
    <nav class="flex h-full items-center justify-between container-narrow">
      <a href="/"><img src="/logo-wide.svg" alt="NauLabs" class="h-6"></a>
      <ul class="hidden gap-1.5 items-center sm:flex">
        <li>
          <UiButton variant="ghost" as-child>
            <NuxtLink to="#about"> About </NuxtLink>
          </UiButton>
        </li>
        <li>
          <UiButton variant="ghost" as-child>
            <NuxtLink to="#services"> Services </NuxtLink>
          </UiButton>
        </li>
        <li>
          <UiButton variant="ghost" as-child>
            <NuxtLink to="#work"> Work </NuxtLink>
          </UiButton>
        </li>
      </ul>
      <div class="flex items-center gap-2">
        <UiButton size="sm" as-child>
          <a :href="CONTACT_URL" target="_blank" rel="noopener">Contact us</a>
        </UiButton>
        <UiSheet>
          <UiSheetTrigger as-child>
            <UiButton variant="ghost" size="icon" class="sm:hidden">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              >
                <line x1="2" y1="5" x2="14" y2="5" />
                <line x1="2" y1="11" x2="14" y2="11" />
              </svg>
            </UiButton>
          </UiSheetTrigger>
          <UiSheetContent side="right" class="w-64">
            <UiSheetHeader class="mt-2.5">
              <UiSheetTitle>
                <img src="/logo-wide.svg" alt="NauLabs" class="h-5">
              </UiSheetTitle>
            </UiSheetHeader>
            <nav class="flex flex-col gap-1 mt-6 px-4 items-center">
              <UiSheetClose as-child>
                <NuxtLink
                  to="#about"
                  class="rounded-md py-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  About
                </NuxtLink>
              </UiSheetClose>
              <UiSheetClose as-child>
                <NuxtLink
                  to="#services"
                  class="rounded-md py-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Services
                </NuxtLink>
              </UiSheetClose>
              <UiSheetClose as-child>
                <NuxtLink
                  to="#work"
                  class="rounded-md py-2 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Work
                </NuxtLink>
              </UiSheetClose>
              <UiSheetClose as-child>
                <UiButton class="mt-4 w-fit" as-child>
                  <a :href="CONTACT_URL" target="_blank" rel="noopener">Contact us</a>
                </UiButton>
              </UiSheetClose>
            </nav>
          </UiSheetContent>
        </UiSheet>
      </div>
    </nav>
  </header>
  <slot />
  <div
    ref="lightContainer"
    class="relative cursor-default select-none"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <h3
      class="text-[87px] sm:text-[140px] md:text-[172px] lg:text-[220px] text-center font-bold text-[oklch(0.16_0_0)] [-webkit-text-stroke:2px_oklch(0.2_0_0)] -mb-4 sm:-mb-7 leading-none"
    >
      Nau Labs
    </h3>
    <h3
      class="text-[87px] sm:text-[140px] md:text-[172px] lg:text-[220px] text-center font-bold text-transparent [-webkit-text-stroke:2px_oklch(0.5_0_0)] -mb-4 sm:-mb-7 leading-none absolute inset-0 transition-opacity duration-300"
      :style="{
        opacity: lightVisible ? 1 : 0,
        maskImage: `radial-gradient(circle 300px at ${lightX}px ${lightY}px, black, transparent)`,
        WebkitMaskImage: `radial-gradient(circle 300px at ${lightX}px ${lightY}px, black, transparent)`,
      }"
    >
      Nau Labs
    </h3>
  </div>
  <footer class="py-20 relative z-10 bg-background">
    <svg
      aria-hidden="true"
      class="absolute top-0 left-0 w-full -translate-y-[calc(100%-1px)]"
      viewBox="0 0 1440 20"
      preserveAspectRatio="none"
    >
      <path
        d="M0 12C120 12 180 4 300 4C420 4 480 12 600 12C720 12 780 4 900 4C1020 4 1080 12 1200 12C1320 12 1440 4 1440 4L1440 20H0Z"
        class="fill-background"
      />
      <path
        d="M0 12C120 12 180 4 300 4C420 4 480 12 600 12C720 12 780 4 900 4C1020 4 1080 12 1200 12C1320 12 1440 4 1440 4"
        stroke="oklch(0.2 0 0)"
        fill="none"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div class="flex justify-between container-narrow">
      <ul class="flex flex-col gap-4">
        <li><img src="/logo-wide.svg" alt="NauLabs" class="h-5"></li>
        <li>
          <span class="text-muted-foreground text-sm">
            Copyright © 2026 Nau Labs
          </span>
        </li>
      </ul>
      <UiButton variant="outline" as-child class="mt-4">
        <a :href="CONTACT_URL" target="_blank" rel="noopener">Contact us</a>
      </UiButton>
    </div>
  </footer>
</template>

<script setup lang="ts">
  const lightContainer = useTemplateRef('lightContainer')
  const lightX = ref(0)
  const lightY = ref(0)
  const lightVisible = ref(false)

  const onMouseMove = (e: MouseEvent) => {
    const rect = lightContainer.value?.getBoundingClientRect()
    if (!rect) {
      return
    }
    lightX.value = e.clientX - rect.left
    lightY.value = e.clientY - rect.top
    lightVisible.value = true
  }

  const onMouseLeave = () => {
    lightVisible.value = false
  }
</script>
