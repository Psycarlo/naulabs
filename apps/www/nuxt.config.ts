import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  app: {
    head: {
      title: 'Nau Labs | Charting the AI future',
      meta: [
        { name: 'description', content: 'We build and deploy AI solutions to your business or home at full speed.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Nau Labs | Charting the AI future' },
        { property: 'og:description', content: 'We build and deploy AI solutions to your business or home at full speed.' },
        { property: 'og:image', content: '/og.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Nau Labs | Charting the AI future' },
        { name: 'twitter:description', content: 'We build and deploy AI solutions to your business or home at full speed.' },
        { name: 'twitter:image', content: '/og.png' },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }]
    }
  },
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()]
  },
  modules: ['shadcn-nuxt', '@vueuse/nuxt', '@nuxtjs/google-fonts'],
  shadcn: {
    prefix: 'Ui',
    componentDir: '@/components/ui'
  },
  googleFonts: {
    families: {
      'Inter Tight': [400, 500, 700]
    }
  },
  router: {
    options: {
      scrollBehaviorType: 'smooth'
    }
  },
  devtools: { enabled: true }
})
