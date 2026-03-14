<template>
  <main class="container-narrow relative">
    <ClientOnly> <ParticleSwarm class="top-20!" /> </ClientOnly>
    <div class="relative z-10 flex flex-col gap-2 items-center pt-100">
      <h1 class="font-bold text-5xl">Charting the AI future</h1>
      <p class="text-lg text-muted-foreground">
        We develop and deploy applied AI solutions to bring our partners to the
        Intelligence Age.
      </p>
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
