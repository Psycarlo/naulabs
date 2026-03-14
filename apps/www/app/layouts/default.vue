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
  <footer class="border-t py-20">
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
