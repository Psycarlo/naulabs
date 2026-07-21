import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config'
import type { AuthConfig } from 'convex/server'

// Tells Convex how to validate the JWTs Better Auth issues.
export default {
  providers: [getAuthConfigProvider()]
} satisfies AuthConfig
