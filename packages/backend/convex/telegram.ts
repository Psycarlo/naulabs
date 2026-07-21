import { createThread, saveMessage } from '@convex-dev/agent'
import { v } from 'convex/values'

import { components } from './_generated/api'
import type { MutationCtx } from './_generated/server'
import {
  internalAction,
  internalMutation,
  mutation,
  query
} from './_generated/server'
import { requireUserId } from './authz'
import {
  channelAllowed,
  resolveEntitlements,
  withinBudget
} from './entitlements'
import { MESSAGE_RATE, takeRateLimit } from './rateLimit'
import { editTelegramMessage, sendTelegramMessage } from './telegramApi'
import { hasTurnCapacity, startOrQueueTurn } from './turnQueue'

// Link codes are short-lived, single-use bearers of identity. Ambiguous glyphs
// (0/O, 1/I/L) are excluded so a user can read the code off the screen.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const LINK_CODE_TTL_MS = 10 * 60 * 1000

const generateCode = (): string => {
  const bytes = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (const byte of bytes) {
    code += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  }
  return code
}

const botUsername = (): string | null =>
  process.env.TELEGRAM_BOT_USERNAME ?? null

// One agent thread per user for Telegram, reused across every Telegram message
// so context carries between messages. The persistent sandbox (the "box") is
// already shared per user, so web and Telegram share one brain + one box; this
// keeps the Telegram conversation log in its own thread (see PLAN.md).
const telegramThreadFor = async (
  ctx: MutationCtx,
  userId: string
): Promise<string> => {
  const existing = await ctx.db
    .query('threads')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .filter((q) => q.eq(q.field('channel'), 'telegram'))
    .first()
  if (existing?.agentThreadId) {
    return existing.agentThreadId
  }
  const agentThreadId = await createThread(ctx, components.agent, {
    title: 'Telegram',
    userId
  })
  await ctx.db.insert('threads', {
    agentThreadId,
    channel: 'telegram',
    title: 'Telegram',
    userId
  })
  return agentThreadId
}

// ---- App-facing (authenticated) -----------------------------------------

// Whether the signed-in user has a linked Telegram chat (drives the UI state).
export const myLink = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return null
    }
    const link = await ctx.db
      .query('channelLinks')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .filter((q) => q.eq(q.field('channel'), 'telegram'))
      .first()
    return { botUsername: botUsername(), linked: Boolean(link) }
  }
})

// Issue a fresh single-use link code for the signed-in user. Clears any prior
// codes so only the latest is valid.
export const createLinkCode = mutation({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    botUsername: string | null
    code: string
    expiresAt: number
  }> => {
    const userId = await requireUserId(ctx)
    const previous = await ctx.db
      .query('telegramLinkCodes')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()
    await Promise.all(previous.map((row) => ctx.db.delete(row._id)))
    const code = generateCode()
    const expiresAt = Date.now() + LINK_CODE_TTL_MS
    await ctx.db.insert('telegramLinkCodes', { code, expiresAt, userId })
    return { botUsername: botUsername(), code, expiresAt }
  }
})

// ---- Internal (webhook + workflow) --------------------------------------

// Redeem a `/start <code>`: validate, bind the chat to the issuing user
// (upsert — one link per chat), and burn the code.
export const consumeLinkCode = internalMutation({
  args: { chatId: v.string(), code: v.string() },
  handler: async (
    ctx,
    { chatId, code }
  ): Promise<{ ok: boolean; reason?: string }> => {
    const row = await ctx.db
      .query('telegramLinkCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first()
    if (!row) {
      return { ok: false, reason: 'invalid' }
    }
    if (row.expiresAt < Date.now()) {
      await ctx.db.delete(row._id)
      return { ok: false, reason: 'expired' }
    }
    const { userId } = row
    const existing = await ctx.db
      .query('channelLinks')
      .withIndex('by_channel_external', (q) =>
        q.eq('channel', 'telegram').eq('externalId', chatId)
      )
      .first()
    await (existing
      ? ctx.db.patch(existing._id, { userId })
      : ctx.db.insert('channelLinks', {
          channel: 'telegram',
          externalId: chatId,
          userId
        }))
    await ctx.db.delete(row._id)
    return { ok: true }
  }
})

// Claim a Telegram update id exactly once. Telegram retries any update we
// don't 200 fast enough — without this, a slow response double-runs the turn.
export const claimUpdate = internalMutation({
  args: { updateId: v.number() },
  handler: async (ctx, { updateId }): Promise<{ fresh: boolean }> => {
    const seen = await ctx.db
      .query('telegramUpdates')
      .withIndex('by_update_id', (q) => q.eq('updateId', updateId))
      .first()
    if (seen) {
      return { fresh: false }
    }
    await ctx.db.insert('telegramUpdates', { updateId })
    return { fresh: true }
  }
})

// Route an inbound Telegram message into the agent loop. Resolves the chat's
// user, gates channel + rate + queue capacity + token budget, then saves the
// prompt and starts (or queues) the turn. Returns a status the webhook turns
// into a reply.
export const routeInbound = internalMutation({
  args: { chatId: v.string(), text: v.string() },
  handler: async (
    ctx,
    { chatId, text }
  ): Promise<{
    status:
      | 'budget_blocked'
      | 'channel_blocked'
      | 'not_linked'
      | 'ok'
      | 'queue_full'
      | 'rate_limited'
  }> => {
    const link = await ctx.db
      .query('channelLinks')
      .withIndex('by_channel_external', (q) =>
        q.eq('channel', 'telegram').eq('externalId', chatId)
      )
      .first()
    if (!link) {
      return { status: 'not_linked' }
    }
    const { userId } = link
    const ent = await resolveEntitlements(ctx, userId)
    if (!channelAllowed(ent, 'telegram')) {
      return { status: 'channel_blocked' }
    }
    if (!(await takeRateLimit(ctx, userId, 'messages', MESSAGE_RATE))) {
      return { status: 'rate_limited' }
    }
    if (!(await hasTurnCapacity(ctx, userId))) {
      return { status: 'queue_full' }
    }
    if (!(await withinBudget(ctx, userId, 'tokens', 1))) {
      return { status: 'budget_blocked' }
    }
    const agentThreadId = await telegramThreadFor(ctx, userId)
    const { messageId } = await saveMessage(ctx, components.agent, {
      prompt: text,
      threadId: agentThreadId,
      userId
    })
    await startOrQueueTurn(ctx, {
      channel: 'telegram',
      chatId,
      promptMessageId: messageId,
      threadId: agentThreadId,
      userId
    })
    return { status: 'ok' }
  }
})

// Send the "thinking" placeholder the model turn will live-edit. Returns null
// on failure so the workflow degrades to send-on-complete instead of failing.
export const sendPlaceholder = internalAction({
  args: { chatId: v.string() },
  handler: async (_ctx, { chatId }): Promise<{ messageId: number | null }> => {
    try {
      return await sendTelegramMessage(chatId, '…')
    } catch {
      return { messageId: null }
    }
  }
})

// Final workflow step for the Telegram channel: replace the streamed placeholder
// with the completed reply (or plain-send when there is no placeholder). Runs in
// the V8 isolate (fetch only).
export const deliverToTelegram = internalAction({
  args: {
    chatId: v.string(),
    messageId: v.optional(v.number()),
    text: v.string()
  },
  handler: async (_ctx, { chatId, messageId, text }): Promise<void> => {
    const finalText = text.trim() || '(no reply)'
    if (messageId !== undefined) {
      try {
        await editTelegramMessage(chatId, messageId, finalText)
        return
      } catch (error) {
        // The stream already showed the full text — nothing to do. Any other
        // edit failure (placeholder deleted, ...) falls through to a fresh send.
        if ((error as Error).message.includes('message is not modified')) {
          return
        }
      }
    }
    await sendTelegramMessage(chatId, finalText)
  }
})
