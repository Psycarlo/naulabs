import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  app: {
    head: {
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
  devtools: { enabled: true }
})
