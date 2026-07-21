<template>
  <section
    class="container-narrow py-24 flex flex-col items-center gap-6 text-center"
  >
    <h1 class="text-4xl sm:text-6xl font-bold tracking-tight">
      Your AI agent, in the cloud.
    </h1>
    <p class="max-w-xl text-muted-foreground">
      A personal agent with its own computer and access to your accounts. Chat
      on the web, Telegram, or WhatsApp.
    </p>
    <div class="flex gap-3">
      <UiButton as-child> <NuxtLink to="/chat">Open chat</NuxtLink> </UiButton>
      <UiButton variant="outline" as-child>
        <NuxtLink to="/login">Sign in</NuxtLink>
      </UiButton>
    </div>
  </section>
</template>
