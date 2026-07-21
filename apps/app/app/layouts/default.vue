<template>
  <div class="min-h-dvh flex flex-col">
    <header
      class="sticky top-0 z-50 h-16 border-b backdrop-blur-xl bg-background/50"
    >
      <nav class="flex h-full items-center justify-between container-narrow">
        <NuxtLink to="/" class="font-bold tracking-tight">Nau Labs</NuxtLink>
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" size="sm" as-child>
            <NuxtLink to="/pricing">Pricing</NuxtLink>
          </UiButton>
          <ConvexAuthenticated>
            <UiButton variant="ghost" size="sm" as-child>
              <NuxtLink to="/chat">Chat</NuxtLink>
            </UiButton>
            <UiButton variant="ghost" size="sm" as-child>
              <NuxtLink to="/settings/billing">Billing</NuxtLink>
            </UiButton>
            <UiButton variant="ghost" size="sm" as-child>
              <NuxtLink to="/settings/telegram">Telegram</NuxtLink>
            </UiButton>
            <UiButton variant="ghost" size="sm" as-child>
              <NuxtLink to="/settings/integrations">Integrations</NuxtLink>
            </UiButton>
            <UiButton variant="outline" size="sm" @click="onSignOut">
              Sign out
            </UiButton>
          </ConvexAuthenticated>
          <ConvexUnauthenticated>
            <UiButton size="sm" as-child>
              <NuxtLink to="/login">Sign in</NuxtLink>
            </UiButton>
          </ConvexUnauthenticated>
        </div>
      </nav>
    </header>
    <main class="flex-1"><slot /></main>
  </div>
</template>

<script setup lang="ts">
const auth = useAppAuthClient()

const onSignOut = async () => {
  await auth.signOut()
  await navigateTo('/')
}
</script>
