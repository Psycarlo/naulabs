import type { MutationCtx } from './_generated/server'

// Fixed-window rate limiter backed by the rateLimits table. Runs inside the
// caller's mutation, so check-and-increment is transactional (Convex OCC —
// concurrent sends serialize). Fixed windows are coarse but cheap: one row per
// user+key, no timestamp lists to prune.

export const MESSAGE_RATE = { limit: 20, windowMs: 60_000 }

// True if the call fits in the current window (and counts it); false = blocked.
export const takeRateLimit = async (
  ctx: MutationCtx,
  userId: string,
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<boolean> => {
  const now = Date.now()
  const row = await ctx.db
    .query('rateLimits')
    .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', key))
    .first()

  if (!row || now - row.windowStart >= windowMs) {
    await (row
      ? ctx.db.patch(row._id, { count: 1, windowStart: now })
      : ctx.db.insert('rateLimits', {
          count: 1,
          key,
          userId,
          windowStart: now
        }))
    return true
  }

  if (row.count >= limit) {
    return false
  }
  await ctx.db.patch(row._id, { count: row.count + 1 })
  return true
}
