import { createClient } from '@convex-dev/better-auth'
import type { GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { magicLink } from 'better-auth/plugins'

import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import authConfig from './auth.config'
import { sendMagicLinkEmail } from './email'

// Default mode: the Better Auth component owns the auth tables.
export const authComponent = createClient<DataModel>(components.betterAuth)

// Non-production signup allowlist. When ALLOWED_SIGNUP_EMAILS is set (comma
// separated), only those addresses can register. Leave it unset in production
// to allow open signups.
const allowedSignupEmails = (process.env.ALLOWED_SIGNUP_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const isSignupAllowed = (email: string) =>
  allowedSignupEmails.length === 0 ||
  allowedSignupEmails.includes(email.toLowerCase())

// Fail fast on missing auth env: an unset SITE_URL yields baseURL undefined +
// empty trustedOrigins, and unset Google creds break OAuth — all silently, at
// request time, with confusing symptoms instead of a clear config error.
const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: requireEnv('SITE_URL'),
    database: authComponent.adapter(ctx),
    databaseHooks: {
      user: {
        create: {
          before: (user) => {
            if (!isSignupAllowed(user.email)) {
              throw new APIError('FORBIDDEN', {
                message: 'This email is not allowed to register.'
              })
            }
          }
        }
      }
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(email, url)
        },
        // Default is plaintext at rest — a DB/dashboard read would expose live
        // sign-in tokens for their validity window.
        storeToken: 'hashed'
      }),
      convex({ authConfig })
    ],
    secret: process.env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: requireEnv('GOOGLE_CLIENT_ID'),
        clientSecret: requireEnv('GOOGLE_CLIENT_SECRET')
      }
    },
    trustedOrigins: [requireEnv('SITE_URL')]
  })

// Auth-gated query the client uses to read the current user.
export const { getAuthUser } = authComponent.clientApi()
