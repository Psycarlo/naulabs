<template>
  <header class="h-16 border-b">
    <nav class="flex h-full items-center justify-between container-narrow">
      <a>logo</a>
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
  <footer></footer>
</template>
