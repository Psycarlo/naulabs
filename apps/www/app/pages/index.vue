<template>
  <main class="container-narrow relative">
    <ClientOnly> <ParticleSwarm class="-top-12! sm:top-10!" /> </ClientOnly>
    <div class="relative z-10 flex flex-col gap-3 items-center pt-80 md:pt-120">
      <h1 class="font-bold text-4xl sm:text-5xl text-center">
        Charting the AI future
      </h1>
      <p class="text-lg text-muted-foreground text-center">
        We build and deploy AI solutions to your business or home at full speed.
      </p>
      <div class="flex items-center gap-4 mt-2">
        <UiButton size="lg" class="z-10 w-fit" as-child>
          <a :href="CONTACT_URL" target="_blank" rel="noopener">Contact us</a>
        </UiButton>
        <UiButton size="lg" variant="ghost" class="z-10 w-fit group">
          See our work
          <AnimatedChevron />
        </UiButton>
      </div>
      <p class="mt-20 text-sm text-muted-foreground">
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
  <section id="about" class="container-narrow container-section">
    <div class="flex flex-col gap-12 md:flex-row md:items-start md:gap-16">
      <div class="flex-1 text-center">
        <h2 class="text-3xl">AI from start to scale</h2>
        <p class="mt-1 mb-6 text-lg text-muted-foreground">
          We integrate AI into your business or home fast and securely, then
          make sure you know how to use it.
        </p>
        <CompassBar />
        <UiButton variant="ghost" as-child class="mt-4">
          <a :href="CONTACT_URL" target="_blank" rel="noopener"
            >Let's work together</a
          >
        </UiButton>
      </div>
    </div>
  </section>
  <section id="services" class="container-section">
    <div class="container-narrow">
      <h2 class="text-3xl">What we do</h2>
      <p class="mt-1 text-lg text-muted-foreground max-w-2xl">
        End-to-end AI deployment. From the hardware in your walls to the bot
        chat in your pocket.
      </p>
      <div
        class="mt-8 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3"
      >
        <div class="flex flex-col gap-2 bg-background p-6">
          <div class="text-muted-foreground text-xs uppercase tracking-widest">
            01
          </div>
          <h3>Hardware installation</h3>
          <p class="text-sm text-muted-foreground">
            We install and configure the physical infrastructure your AI needs
            to run, on-site and production-ready.
          </p>
        </div>
        <div class="flex flex-col gap-2 bg-background p-6">
          <div class="text-muted-foreground text-xs uppercase tracking-widest">
            02
          </div>
          <h3>Secure remote access</h3>
          <p class="text-sm text-muted-foreground">
            Encrypted communication lines between you and your AI, so you can
            control everything from anywhere in the world.
          </p>
        </div>
        <div class="flex flex-col gap-2 bg-background p-6">
          <div class="text-muted-foreground text-xs uppercase tracking-widest">
            03
          </div>
          <h3>Best practices & guidelines</h3>
          <p class="text-sm text-muted-foreground">
            We define the rules your bots and AI systems follow, tailored to
            your use case, compliant by design.
          </p>
        </div>
        <div class="flex flex-col gap-2 bg-background p-6">
          <div class="text-muted-foreground text-xs uppercase tracking-widest">
            04
          </div>
          <h3>Maintenance</h3>
          <p class="text-sm text-muted-foreground">
            Updates, fixes, and optimizations. We keep your AI systems running
            at peak performance.
          </p>
        </div>
        <div class="flex flex-col gap-2 bg-background p-6 md:col-span-2">
          <div class="text-muted-foreground text-xs uppercase tracking-widest">
            05
          </div>
          <h3>Training & support</h3>
          <p class="text-sm text-muted-foreground">
            We train your team to work with AI confidently and provide 24/7
            support whenever you need it.
          </p>
        </div>
      </div>
    </div>
  </section>
  <!-- <section id="work" class="container-narrow container-section"></section> -->
  <section class="container-section container-narrow">
    <div
      class="relative h-fit py-8 px-2 w-full overflow-clip rounded-xl border border-zinc-800"
    >
      <div class="absolute inset-0">
        <UiStarsBackground :factor="0.05" :speed="100" star-color="#fff" />
      </div>
      <div class="flex justify-center h-full flex-col gap-4 px-4">
        <h3
          class="relative z-10 text-2xl sm:text-3xl font-medium text-white max-w-lg"
        >
          Want to gain real-world advantage with the assistance of artificial
          intelligence?
        </h3>
        <UiButton class="z-10 w-fit" as-child>
          <a :href="CONTACT_URL" target="_blank" rel="noopener"
            >Get in contact with us</a
          >
        </UiButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const tools = [
  { link: 'https://openclaw.ai', name: 'Openclaw' },
  { link: 'https://claude.ai', name: 'Claude' },
  { link: 'https://gemini.google.com', name: 'Gemini' },
  { link: 'https://openai.com', name: 'OpenAI' },
  { link: 'https://sdk.vercel.ai', name: 'Vercel AI' },
  { link: 'https://elevenlabs.io', name: 'Eleven Labs' },
  {
    link: 'https://gemini.google/overview/image-generation',
    name: 'Nano Banana'
  },
  { link: 'https://app.klingai.com/', name: 'Kling AI' }
]
</script>
