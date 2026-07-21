import { saveMessage } from '@convex-dev/agent'
import { vResultValidator, vWorkflowId } from '@convex-dev/workflow'
import { v } from 'convex/values'

import { components, internal } from './_generated/api'
import type { MutationCtx } from './_generated/server'
import { internalMutation } from './_generated/server'
import { resolveEntitlements } from './entitlements'
import { workflow } from './workflow'

// Per-user turn lifecycle. Every turn flows through here:
//
//   startOrQueueTurn  — run now (slot free) or enqueue FIFO
//   onTurnComplete    — workflow onComplete: settle the activeTurns counter,
//                       surface failures, drain the queue, hibernate when idle
//
// `sandboxes.activeTurns` counts running turns; `maxConcurrentSessions` (an
// entitlement) caps them. Counting happens in mutations (transactional), and
// onComplete fires even when the workflow fails or is canceled — so the box
// can't leak into a never-paused state and the queue can't stall.

const MAX_QUEUED_TURNS = 10

const TURN_FAILED_MESSAGE =
  'Something went wrong handling that message. Please try again.'

export interface TurnArgs {
  channel?: string
  chatId?: string
  promptMessageId: string
  threadId: string
  userId: string
}

const sandboxRowFor = async (ctx: MutationCtx, userId: string) =>
  await ctx.db
    .query('sandboxes')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first()

const concurrencyCap = async (
  ctx: MutationCtx,
  userId: string
): Promise<number> => {
  const ent = await resolveEntitlements(ctx, userId)
  return Math.max(1, ent.maxConcurrentSessions)
}

// Claim a slot (increment the counter) and start the durable workflow. The
// increment and workflow.start share the mutation's transaction, so a crash
// between them is impossible.
const beginTurn = async (ctx: MutationCtx, args: TurnArgs): Promise<void> => {
  const row = await sandboxRowFor(ctx, args.userId)
  await (row
    ? ctx.db.patch(row._id, { activeTurns: (row.activeTurns ?? 0) + 1 })
    : ctx.db.insert('sandboxes', {
        activeTurns: 1,
        provider: 'unassigned',
        status: 'none',
        userId: args.userId
      }))
  await workflow.start(ctx, internal.workflow.agentTurn, args, {
    context: args,
    onComplete: internal.turnQueue.onTurnComplete
  })
}

// Capacity pre-check so callers can refuse a message BEFORE saving the prompt
// (a saved-but-never-answered prompt is worse than a clean rejection).
export const hasTurnCapacity = async (
  ctx: MutationCtx,
  userId: string
): Promise<boolean> => {
  const queued = await ctx.db
    .query('turnQueue')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  return queued.length < MAX_QUEUED_TURNS
}

// Run the turn now if a slot is free, otherwise enqueue it (FIFO).
export const startOrQueueTurn = async (
  ctx: MutationCtx,
  args: TurnArgs
): Promise<'queued' | 'started'> => {
  const row = await sandboxRowFor(ctx, args.userId)
  const running = row?.activeTurns ?? 0
  if (running < (await concurrencyCap(ctx, args.userId))) {
    await beginTurn(ctx, args)
    return 'started'
  }
  await ctx.db.insert('turnQueue', {
    channel: args.channel,
    chatId: args.chatId,
    promptMessageId: args.promptMessageId,
    threadId: args.threadId,
    userId: args.userId
  })
  return 'queued'
}

export const onTurnComplete = internalMutation({
  args: {
    context: v.any(),
    result: vResultValidator,
    workflowId: vWorkflowId
  },
  handler: async (ctx, { context, result }) => {
    const turn = context as TurnArgs
    const { userId } = turn

    // 1. Release the slot.
    const row = await sandboxRowFor(ctx, userId)
    const running = Math.max(0, (row?.activeTurns ?? 1) - 1)
    if (row) {
      await ctx.db.patch(row._id, { activeTurns: running })
    }

    // 2. Surface failures: persist an assistant message (web reads the thread)
    //    and push to Telegram, which has no reactive client.
    if (result.kind !== 'success') {
      await saveMessage(ctx, components.agent, {
        message: { content: TURN_FAILED_MESSAGE, role: 'assistant' },
        threadId: turn.threadId,
        userId
      })
      if (turn.channel === 'telegram' && turn.chatId) {
        await ctx.scheduler.runAfter(0, internal.telegram.deliverToTelegram, {
          chatId: turn.chatId,
          text: TURN_FAILED_MESSAGE
        })
      }
      const detail = result.kind === 'failed' ? `: ${result.error}` : ''
      console.error(`agentTurn ${result.kind} for user ${userId}${detail}`)
    }

    // 3. Drain the queue into the freed slot (FIFO).
    if (running < (await concurrencyCap(ctx, userId))) {
      const next = await ctx.db
        .query('turnQueue')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .order('asc')
        .first()
      if (next) {
        await ctx.db.delete(next._id)
        await beginTurn(ctx, {
          channel: next.channel,
          chatId: next.chatId,
          promptMessageId: next.promptMessageId,
          threadId: next.threadId,
          userId
        })
        return
      }
    }

    // 4. Nothing running or queued — hibernate the box (metered).
    if (running === 0) {
      await ctx.scheduler.runAfter(0, internal.sandbox.pauseAndMeter, {
        userId
      })
    }
  }
})
