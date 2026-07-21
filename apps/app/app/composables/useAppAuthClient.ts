import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

// Auth client used to initiate sign-in flows. Includes the magicLink plugin
// (not part of the module's default client) plus the Convex plugin. Session
// state is cookie-based on this origin, so the module's useConvexAuth() picks
// it up after the redirect-based flows complete.
let client: ReturnType<typeof createAuthClient>

export const useAppAuthClient = () => {
  if (!client) {
    // useRequestURL() resolves an absolute origin on both server and client.
    // Better Auth's createAuthClient rejects relative base URLs ("Invalid base
    // URL: /api/auth"), so the SSR branch must not pass a bare path.
    const baseURL = `${useRequestURL().origin}/api/auth`
    client = createAuthClient({
      baseURL,
      fetchOptions: { credentials: 'include' },
      plugins: [convexClient(), magicLinkClient()]
    })
  }
  return client
}
