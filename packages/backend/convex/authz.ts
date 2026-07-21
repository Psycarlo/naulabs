import type { Auth } from 'convex/server'

// Shared auth guard for app-facing functions (queries, mutations, actions):
// resolve the Better Auth user id (identity.subject) or throw. Queries that
// prefer returning null over throwing call ctx.auth.getUserIdentity() directly.
export const requireUserId = async (ctx: { auth: Auth }): Promise<string> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity.subject
}
