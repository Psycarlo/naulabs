import { v } from 'convex/values'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query
} from './_generated/server'
import { requireUserId } from './authz'
import { base64Url, buildRfc822 } from './googleApi'

// Confirm gate for destructive tools (prompt-injection mitigation): the agent
// never sends email / writes to calendar directly. It enqueues a pendingAction;
// the user approves or denies it in the app; only an approval schedules the
// actual call. A malicious email that tricks the model still can't act without
// the user clicking Approve on the exact payload.

const PENDING_TTL_MS = 30 * 60 * 1000
const RESULT_TRUNCATE_AT = 2000

// ---- Agent-facing (via internal) -----------------------------------------

export const create = internalMutation({
  args: {
    kind: v.string(),
    payload: v.string(),
    threadId: v.string(),
    userId: v.string()
  },
  handler: async (ctx, { kind, payload, threadId, userId }): Promise<string> =>
    await ctx.db.insert('pendingActions', {
      expiresAt: Date.now() + PENDING_TTL_MS,
      kind,
      payload,
      status: 'pending',
      threadId,
      userId
    })
})

export const getById = internalQuery({
  args: { id: v.id('pendingActions') },
  handler: async (ctx, { id }) => await ctx.db.get(id)
})

export const finish = internalMutation({
  args: {
    id: v.id('pendingActions'),
    ok: v.boolean(),
    result: v.string()
  },
  handler: async (ctx, { id, ok, result }) => {
    await ctx.db.patch(id, {
      result: result.slice(0, RESULT_TRUNCATE_AT),
      status: ok ? 'executed' : 'failed'
    })
  }
})

// ---- App-facing (authenticated) ------------------------------------------

export const myPending = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return []
    }
    const rows = await ctx.db
      .query('pendingActions')
      .withIndex('by_user_status', (q) =>
        q.eq('userId', identity.subject).eq('status', 'pending')
      )
      .collect()
    const now = Date.now()
    return rows
      .filter((row) => row.expiresAt > now)
      .map((row) => ({
        id: row._id,
        kind: row.kind,
        payload: row.payload
      }))
  }
})

const ownedPending = async (ctx: MutationCtx, id: Id<'pendingActions'>) => {
  const userId = await requireUserId(ctx)
  const row = await ctx.db.get(id)
  if (!row || row.userId !== userId) {
    throw new Error('Action not found')
  }
  if (row.status !== 'pending') {
    throw new Error('Action is no longer pending')
  }
  if (row.expiresAt < Date.now()) {
    throw new Error('Action expired — ask the agent again')
  }
  return row
}

export const approve = mutation({
  args: { id: v.id('pendingActions') },
  handler: async (ctx, { id }) => {
    await ownedPending(ctx, id)
    await ctx.db.patch(id, { status: 'approved' })
    await ctx.scheduler.runAfter(0, internal.pendingActions.execute, { id })
  }
})

export const deny = mutation({
  args: { id: v.id('pendingActions') },
  handler: async (ctx, { id }) => {
    await ownedPending(ctx, id)
    await ctx.db.patch(id, { status: 'denied' })
  }
})

// ---- Execution (internal, after approval) ---------------------------------

interface GmailSendPayload {
  body: string
  subject: string
  to: string
}

interface CalendarCreatePayload {
  description?: string
  endIso: string
  startIso: string
  summary: string
}

export const execute = internalAction({
  args: { id: v.id('pendingActions') },
  handler: async (ctx, { id }): Promise<void> => {
    const row = await ctx.runQuery(internal.pendingActions.getById, { id })
    if (!row || row.status !== 'approved') {
      return
    }

    try {
      if (row.kind === 'gmail_send') {
        const payload = JSON.parse(row.payload) as GmailSendPayload
        const raw = base64Url(
          buildRfc822(payload.to, payload.subject, payload.body)
        )
        const response = await ctx.runAction(
          internal.integrations.googleFetch,
          {
            body: JSON.stringify({ raw }),
            method: 'POST',
            url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            userId: row.userId
          }
        )
        await ctx.runMutation(internal.pendingActions.finish, {
          id,
          ok: response.ok,
          result: response.body
        })
        return
      }

      if (row.kind === 'calendar_create_event') {
        const payload = JSON.parse(row.payload) as CalendarCreatePayload
        const response = await ctx.runAction(
          internal.integrations.googleFetch,
          {
            body: JSON.stringify({
              description: payload.description,
              end: { dateTime: payload.endIso },
              start: { dateTime: payload.startIso },
              summary: payload.summary
            }),
            method: 'POST',
            url: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            userId: row.userId
          }
        )
        await ctx.runMutation(internal.pendingActions.finish, {
          id,
          ok: response.ok,
          result: response.body
        })
        return
      }

      await ctx.runMutation(internal.pendingActions.finish, {
        id,
        ok: false,
        result: `Unknown action kind: ${row.kind}`
      })
    } catch (error) {
      await ctx.runMutation(internal.pendingActions.finish, {
        id,
        ok: false,
        result: (error as Error).message
      })
    }
  }
})
