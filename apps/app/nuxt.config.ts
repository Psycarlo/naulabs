import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Resolve the shared backend's generated Convex api. Explicit alias because
  // bun doesn't always create a node_modules link for workspace packages on
  // Windows; this also feeds Nuxt's generated tsconfig paths.
  alias: {
    '@naulabs/backend': fileURLToPath(
      new URL('../../packages/backend/convex/_generated/api', import.meta.url)
    )
  },
  app: {
    head: {
      link: [{ href: '/favicon.png', rel: 'icon', type: 'image/png' }],
      meta: [
        { content: 'Your personal AI agent in the cloud.', name: 'description' }
      ],
      title: 'Nau Labs'
    }
  },
  compatibilityDate: '2025-07-15',
  // better-convex-nuxt: bundles the Convex client + Better Auth Vue integration.
  // Provides useConvexAuth(), the SSR /api/auth/* proxy, and definePageMeta({ convexAuth: true }).
  convex: {
    // Route guard (convexAuth: true) redirects unauthenticated users here.
    // Defaults to '/auth/signin', but this app's sign-in page is /login.
    auth: {
      routeProtection: {
        redirectTo: '/login'
      }
    },
    url: process.env.NUXT_PUBLIC_CONVEX_URL
  },
  css: ['~/assets/css/tailwind.css'],
  devtools: { enabled: true },
  googleFonts: {
    families: {
      'Inter Tight': [400, 500, 700]
    }
  },
  modules: [
    'better-convex-nuxt',
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/google-fonts',
    '@comark/nuxt'
  ],
  runtimeConfig: {
    public: {
      convexSiteUrl: process.env.NUXT_PUBLIC_CONVEX_SITE_URL,
      convexUrl: process.env.NUXT_PUBLIC_CONVEX_URL
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
