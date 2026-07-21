import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  app: {
    head: {
      link: [{ href: '/favicon.png', rel: 'icon', type: 'image/png' }],
      meta: [
        {
          content:
            'We build and deploy AI solutions to your business or home at full speed.',
          name: 'description'
        },
        { content: 'website', property: 'og:type' },
        { content: 'Nau Labs | Charting the AI future', property: 'og:title' },
        {
          content:
            'We build and deploy AI solutions to your business or home at full speed.',
          property: 'og:description'
        },
        { content: '/og.png', property: 'og:image' },
        { content: 'summary_large_image', name: 'twitter:card' },
        { content: 'Nau Labs | Charting the AI future', name: 'twitter:title' },
        {
          content:
            'We build and deploy AI solutions to your business or home at full speed.',
          name: 'twitter:description'
        },
        { content: '/og.png', name: 'twitter:image' }
      ],
      title: 'Nau Labs | Charting the AI future'
    }
  },
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/tailwind.css'],
  devtools: { enabled: true },
  googleFonts: {
    families: {
      'Inter Tight': [400, 500, 700]
    }
  },
  modules: ['shadcn-nuxt', '@vueuse/nuxt', '@nuxtjs/google-fonts'],
  router: {
    options: {
      scrollBehaviorType: 'smooth'
    }
  },
  shadcn: {
    componentDir: '@/components/ui',
    prefix: 'Ui'
  },
  vite: {
    plugins: [tailwindcss()]
  }
})
