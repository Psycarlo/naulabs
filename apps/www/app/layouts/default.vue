<template>
  <header
    class="sticky top-0 z-50 h-16 border-b backdrop-blur-xl bg-background/50"
  >
    <nav class="flex h-full items-center justify-between container-narrow">
      <a href="/"><img src="/logo-wide.svg" alt="NauLabs" class="h-6"></a>
      <ul class="flex gap-1.5 items-center">
        <li><UiButton variant="ghost">One</UiButton></li>
        <li><UiButton variant="ghost">Two</UiButton></li>
        <li><UiButton variant="ghost">Three</UiButton></li>
        <li><UiButton variant="ghost">Four</UiButton></li>
      </ul>
      <UiButton size="sm">Contact us</UiButton>
    </nav>
  </header>
  <slot />
  <h3
    class="text-[220px] text-center font-bold text-[oklch(0.16_0_0)] [-webkit-text-stroke:2px_oklch(0.2_0_0)] -mb-7 leading-none"
  >
    Nau Labs
  </h3>
  <footer class="py-20 relative z-10 bg-background">
    <svg
      aria-hidden="true"
      class="absolute top-0 left-0 w-full -translate-y-full"
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
    <div class="flex container-narrow">
      <ul class="flex flex-col gap-4">
        <li><img src="/logo-wide.svg" alt="NauLabs" class="h-5"></li>
        <li>
          <span class="text-muted-foreground text-sm">
            Copyright © 2026 Nau Labs
          </span>
        </li>
      </ul>
    </div>
  </footer>
</template>
