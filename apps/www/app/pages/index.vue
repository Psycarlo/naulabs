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
  <section class="container-narrow container-section">
    <div class="flex flex-col gap-12 md:flex-row md:items-start md:gap-16">
      <div class="flex-1">
        <h2 class="text-3xl">AI from start to scale</h2>
        <CompassBar />
        <p class="mt-4 text-lg text-muted-foreground">
          We integrate AI into your business or home fast and securely, then
          make sure you know how to use it. No black boxes, no guesswork.
        </p>
      </div>
      <ul class="flex flex-1 flex-col gap-6">
        <li>
          <h3>Fast deployment</h3>
          <p class="text-sm text-muted-foreground">
            From kickoff to production in days, not months. We handle the
            infrastructure so you can focus on results.
          </p>
        </li>
        <li>
          <h3>Secure by default</h3>
          <p class="text-sm text-muted-foreground">
            Your data stays yours. Every integration is built with security and
            privacy at its core.
          </p>
        </li>
        <li>
          <h3>Training & 24/7 support</h3>
          <p class="text-sm text-muted-foreground">
            We teach your team to get the most out of AI and stay available
            around the clock when you need us.
          </p>
        </li>
      </ul>
    </div>
  </section>
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
