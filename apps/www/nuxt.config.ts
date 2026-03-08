import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
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
      'Albert Sans': [400, 500, 700]
    }
  },
  devtools: { enabled: true }
})
