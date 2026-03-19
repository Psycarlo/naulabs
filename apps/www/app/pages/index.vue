<template>
  <main class="container-narrow relative">
    <ClientOnly> <ParticleSwarm class="top-20!" /> </ClientOnly>
    <div class="relative z-10 flex flex-col gap-2 items-center pt-120">
      <h1 class="font-bold text-5xl">Charting the AI future</h1>
      <p class="text-lg text-muted-foreground">
        We develop and deploy applied AI solutions to bring our partners to the
        Intelligence Age.
      </p>
      <UiButton size="lg" class="z-10 w-fit">Contact us</UiButton>
      <p class="mt-8 text-sm text-muted-foreground">
        Powered by the best and latest AI technologies
      </p>
    </div>
    <div class="relative z-10 mt-4">
      <div
        class="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background"
      />
      <div
        class="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background"
      />
      <ClientOnly>
        <UiMarquee slow-on-hover>
          <UiMarqueeTool
            v-for="tool in tools"
            :key="tool.name"
            :name="tool.name"
            :link="tool.link"
          />
        </UiMarquee>
      </ClientOnly>
    </div>
  </main>
  <section></section>
  <section class="container-section">
    <div
      class="container-narrow relative h-52 w-full overflow-clip rounded-xl border border-zinc-800"
    >
      <div class="absolute inset-0">
        <UiStarsBackground :factor="0.05" :speed="100" star-color="#fff" />
      </div>
      <div class="flex justify-center h-full flex-col gap-4 px-4">
        <h3 class="relative z-10 text-3xl font-medium text-white max-w-lg">
          Want to gain real-world advantage with the assistance of artificial
          intelligence?
        </h3>
        <UiButton class="z-10 w-fit">Get in contact with us</UiButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  const tools = [
    { name: 'Openclaw', link: 'https://openclaw.ai' },
    { name: 'Claude', link: 'https://claude.ai' },
    { name: 'Gemini', link: 'https://gemini.google.com' },
    { name: 'OpenAI', link: 'https://openai.com' },
    { name: 'Vercel AI', link: 'https://sdk.vercel.ai' },
    { name: 'Eleven Labs', link: 'https://elevenlabs.io' },
    {
      name: 'Nano Banana',
      link: 'https://gemini.google/overview/image-generation'
    }
  ]
</script>
