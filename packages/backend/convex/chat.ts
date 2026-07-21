import {
  createThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs
} from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireUserId } from './authz'
import { withinBudget } from './entitlements'
import { MESSAGE_RATE, takeRateLimit } from './rateLimit'
import { hasTurnCapacity, startOrQueueTurn } from './turnQueue'

const UPSELL =
  "You've used your monthly token budget on the current plan. Upgrade in Settings → Billing to keep chatting."

// What sendMessage tells the client. Everything except 'ok' means the turn was
// NOT started; only 'budget_blocked' leaves a visible assistant reply.
export type SendStatus = 'budget_blocked' | 'ok' | 'queue_full' | 'rate_limited'

// Load an app thread the caller owns, returning its linked agent thread id.
const ownedAgentThreadId = async (
  ctx: QueryCtx,
  userId: string,
  threadId: Id<'threads'>
): Promise<string> => {
  const thread = await ctx.db.get(threadId)
  if (!thread || thread.userId !== userId) {
    throw new Error('Thread not found')
  }
  if (!thread.agentThreadId) {
    throw new Error('Thread is not wired to an agent thread')
  }
  return thread.agentThreadId
}

export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx)
    return await ctx.db
      .query('threads')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .collect()
  }
})

export const createChatThread = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx: MutationCtx, { title }): Promise<Id<'threads'>> => {
    const userId = await requireUserId(ctx)
    const agentThreadId = await createThread(ctx, components.agent, {
      title,
      userId
    })
    return await ctx.db.insert('threads', {
      agentThreadId,
      channel: 'web',
      title,
      userId
    })
  }
})

export const sendMessage = mutation({
  args: { text: v.string(), threadId: v.id('threads') },
  handler: async (ctx, { text, threadId }): Promise<{ status: SendStatus }> => {
    const userId = await requireUserId(ctx)
    const agentThreadId = await ownedAgentThreadId(ctx, userId, threadId)

    // Gates, cheapest first — all before the prompt is saved, so a refused
    // message never sits unanswered in the thread.
    if (!(await takeRateLimit(ctx, userId, 'messages', MESSAGE_RATE))) {
      return { status: 'rate_limited' }
    }
    if (!(await hasTurnCapacity(ctx, userId))) {
      return { status: 'queue_full' }
    }
    // Hard cap: block the turn (don't run the model) when over the token budget.
    if (!(await withinBudget(ctx, userId, 'tokens', 1))) {
      await saveMessage(ctx, components.agent, {
        message: { content: UPSELL, role: 'assistant' },
        threadId: agentThreadId,
        userId
      })
      return { status: 'budget_blocked' }
    }

    const { messageId } = await saveMessage(ctx, components.agent, {
      prompt: text,
      threadId: agentThreadId,
      userId
    })
    // 'queued' still answers eventually — the client treats it as ok.
    await startOrQueueTurn(ctx, {
      channel: 'web',
      promptMessageId: messageId,
      threadId: agentThreadId,
      userId
    })
    return { status: 'ok' }
  }
})

export const listMessages = query({
  args: {
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
    threadId: v.id('threads')
  },
  handler: async (ctx, { paginationOpts, streamArgs, threadId }) => {
    const userId = await requireUserId(ctx)
    const agentThreadId = await ownedAgentThreadId(ctx, userId, threadId)
    const paginated = await listUIMessages(ctx, components.agent, {
      paginationOpts,
      threadId: agentThreadId
    })
    const streams = await syncStreams(ctx, components.agent, {
      streamArgs,
      threadId: agentThreadId
    })
    return { ...paginated, streams }
  }
})
