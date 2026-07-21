'use node'

import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getSandboxProvider } from './sandbox/index'

const MS_PER_MINUTE = 60_000

// Wake (or first-provision) the user's persistent box and return its id. Called
// as the first step of the agent workflow. The driver is provider-agnostic.
export const ensureRunning = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<{ sandboxId: string }> => {
    const provider = getSandboxProvider()
    const row = await ctx.runQuery(internal.sandboxState.getByUser, { userId })

    if (row?.sandboxId && row.status !== 'none') {
      // Resume covers both paused (wake) and running (cheap reconnect) — the
      // box may have auto-hibernated after its idle timeout regardless of our
      // last recorded status.
      await provider.resume(row.sandboxId)
      await ctx.runMutation(internal.sandboxState.markRunning, {
        provider: provider.name,
        sandboxId: row.sandboxId,
        userId
      })
      return { sandboxId: row.sandboxId }
    }

    const ent = await ctx.runQuery(internal.entitlements.getForUser, { userId })
    const { sandboxId } = await provider.provision({
      cpu: ent.sandbox.cpu,
      ramMb: ent.sandbox.ramMb,
      userId
    })
    await ctx.runMutation(internal.sandboxState.markRunning, {
      provider: provider.name,
      sandboxId,
      userId
    })
    return { sandboxId }
  }
})

// Hibernate the box after a turn and meter the active minutes. Last step of the
// workflow; safe to call even if the box is already paused. Skips the pause
// when another turn grabbed the box in the meantime (activeTurns > 0) — that
// turn's own finish step will pause it.
export const pauseAndMeter = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<void> => {
    const row = await ctx.runQuery(internal.sandboxState.getByUser, { userId })
    if (!(row?.sandboxId && row.status === 'running')) {
      return
    }
    if ((row.activeTurns ?? 0) > 0) {
      return
    }

    const activeMs = row.lastActiveAt ? Date.now() - row.lastActiveAt : 0
    const minutes = Math.max(0, Math.ceil(activeMs / MS_PER_MINUTE))
    if (minutes > 0) {
      await ctx.runMutation(internal.entitlements.incrementUsage, {
        amount: minutes,
        metric: 'sandboxMinutes',
        userId
      })
    }

    const provider = getSandboxProvider()
    await provider.pause(row.sandboxId)
    await ctx.runMutation(internal.sandboxState.markPaused, { userId })
  }
})
