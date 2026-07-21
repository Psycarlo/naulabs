import { tool } from 'ai'
import { z } from 'zod'

import { internal } from './_generated/api'
import type { ActionCtx } from './_generated/server'

// Model-facing Google tools. Every call is proxied host-side through
// internal.integrations.googleFetch — the OAuth token never enters the sandbox,
// the prompt, or a tool result. Destructive calls (send email, create event)
// are NOT executed here: they enqueue a pendingAction the user must approve in
// the app (see pendingActions.ts).

const MAX_LIST_RESULTS = 10
const DEFAULT_LIST_RESULTS = 5
const BODY_TRUNCATE_AT = 20_000

interface ToolContext {
  ctx: ActionCtx
  threadId: string
  userId: string
}

const CONFIRM_NOTE =
  'Queued for user confirmation — it will only run after the user approves it in the web app. Tell the user to review the pending action.'

const googleJson = async (
  { ctx, userId }: ToolContext,
  method: string,
  url: string,
  body?: string
): Promise<unknown> => {
  const response = await ctx.runAction(internal.integrations.googleFetch, {
    body,
    method,
    url,
    userId
  })
  if (!response.ok) {
    return { detail: response.body, error: `Google API ${response.status}` }
  }
  try {
    return JSON.parse(response.body)
  } catch {
    return { raw: response.body }
  }
}

const enqueueConfirmation = async (
  { ctx, threadId, userId }: ToolContext,
  kind: string,
  payload: Record<string, unknown>
): Promise<{ actionId: string; note: string; status: string }> => {
  const actionId = await ctx.runMutation(internal.pendingActions.create, {
    kind,
    payload: JSON.stringify(payload),
    threadId,
    userId
  })
  return { actionId, note: CONFIRM_NOTE, status: 'pending_confirmation' }
}

// Decode Gmail's base64url body data (Node runtime: Buffer is available; this
// module is only imported from the "use node" agent action).
const decodeBase64Url = (data: string): string =>
  Buffer.from(data, 'base64url').toString('utf-8')

interface GmailHeader {
  name?: string
  value?: string
}

interface GmailPart {
  body?: { data?: string }
  mimeType?: string
  parts?: GmailPart[]
}

interface GmailMessage {
  id?: string
  payload?: GmailPart & { headers?: GmailHeader[] }
  snippet?: string
}

const headerValue = (
  headers: GmailHeader[] | undefined,
  name: string
): string =>
  headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
  ''

const extractPlainText = (part: GmailPart | undefined): string => {
  if (!part) {
    return ''
  }
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  for (const child of part.parts ?? []) {
    const text = extractPlainText(child)
    if (text) {
      return text
    }
  }
  return ''
}

const gmailTools = (tc: ToolContext) => ({
  gmail_read: tool({
    description:
      'Read a single email (headers + plain-text body) by its message id.',
    execute: async ({ messageId }) => {
      const message = (await googleJson(
        tc,
        'GET',
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=full`
      )) as GmailMessage
      const headers = message.payload?.headers
      return {
        body: extractPlainText(message.payload).slice(0, BODY_TRUNCATE_AT),
        date: headerValue(headers, 'Date'),
        from: headerValue(headers, 'From'),
        snippet: message.snippet ?? '',
        subject: headerValue(headers, 'Subject'),
        to: headerValue(headers, 'To')
      }
    },
    inputSchema: z.object({
      messageId: z.string().describe('Gmail message id from gmail_search.')
    })
  }),

  gmail_search: tool({
    description:
      'Search the user\'s Gmail. Uses Gmail query syntax (e.g. "from:alice is:unread newer_than:7d"). Returns id, subject, from, date, snippet per match.',
    execute: async ({ maxResults, query }) => {
      const limit = Math.min(
        maxResults ?? DEFAULT_LIST_RESULTS,
        MAX_LIST_RESULTS
      )
      const list = (await googleJson(
        tc,
        'GET',
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${limit}`
      )) as { messages?: { id: string }[] }
      const ids = (list.messages ?? []).map((m) => m.id)
      const messages = await Promise.all(
        ids.map(async (id) => {
          const message = (await googleJson(
            tc,
            'GET',
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
          )) as GmailMessage
          const headers = message.payload?.headers
          return {
            date: headerValue(headers, 'Date'),
            from: headerValue(headers, 'From'),
            id,
            snippet: message.snippet ?? '',
            subject: headerValue(headers, 'Subject')
          }
        })
      )
      return { messages }
    },
    inputSchema: z.object({
      maxResults: z
        .number()
        .optional()
        .describe(
          `How many results (default ${DEFAULT_LIST_RESULTS}, max ${MAX_LIST_RESULTS}).`
        ),
      query: z.string().describe('Gmail search query.')
    })
  }),

  gmail_send: tool({
    description:
      "Send an email from the user's Gmail. DESTRUCTIVE: this only queues the email for the user to approve in the app; it is not sent immediately.",
    execute: async ({ body, subject, to }) =>
      await enqueueConfirmation(tc, 'gmail_send', { body, subject, to }),
    inputSchema: z.object({
      body: z.string().describe('Plain-text email body.'),
      subject: z.string().describe('Email subject.'),
      to: z.string().describe('Recipient email address.')
    })
  })
})

interface CalendarEvent {
  end?: { date?: string; dateTime?: string }
  htmlLink?: string
  id?: string
  start?: { date?: string; dateTime?: string }
  status?: string
  summary?: string
}

const calendarTools = (tc: ToolContext) => ({
  calendar_create_event: tool({
    description:
      "Create an event on the user's primary Google Calendar. DESTRUCTIVE: this only queues the event for the user to approve in the app; it is not created immediately.",
    execute: async ({ description, endIso, startIso, summary }) =>
      await enqueueConfirmation(tc, 'calendar_create_event', {
        description,
        endIso,
        startIso,
        summary
      }),
    inputSchema: z.object({
      description: z.string().optional().describe('Event description.'),
      endIso: z
        .string()
        .describe('End as RFC3339 datetime, e.g. 2026-07-03T15:00:00+01:00.'),
      startIso: z
        .string()
        .describe('Start as RFC3339 datetime, e.g. 2026-07-03T14:00:00+01:00.'),
      summary: z.string().describe('Event title.')
    })
  }),

  calendar_list_events: tool({
    description:
      "List events from the user's primary Google Calendar in a time window.",
    execute: async ({ maxResults, timeMax, timeMin }) => {
      const limit = Math.min(
        maxResults ?? DEFAULT_LIST_RESULTS,
        MAX_LIST_RESULTS
      )
      const params = new URLSearchParams({
        maxResults: String(limit),
        orderBy: 'startTime',
        singleEvents: 'true'
      })
      if (timeMin) {
        params.set('timeMin', timeMin)
      }
      if (timeMax) {
        params.set('timeMax', timeMax)
      }
      const data = (await googleJson(
        tc,
        'GET',
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`
      )) as { items?: CalendarEvent[] }
      return {
        events: (data.items ?? []).map((event) => ({
          end: event.end?.dateTime ?? event.end?.date ?? '',
          id: event.id ?? '',
          start: event.start?.dateTime ?? event.start?.date ?? '',
          status: event.status ?? '',
          summary: event.summary ?? ''
        }))
      }
    },
    inputSchema: z.object({
      maxResults: z
        .number()
        .optional()
        .describe(
          `How many events (default ${DEFAULT_LIST_RESULTS}, max ${MAX_LIST_RESULTS}).`
        ),
      timeMax: z.string().optional().describe('Window end, RFC3339 datetime.'),
      timeMin: z.string().optional().describe('Window start, RFC3339 datetime.')
    })
  })
})

interface DriveFile {
  id?: string
  mimeType?: string
  modifiedTime?: string
  name?: string
}

const driveTools = (tc: ToolContext) => ({
  drive_read: tool({
    description:
      'Read the text content of a Google Drive file by id. Google Docs are exported as plain text; other files are downloaded as-is (text files only).',
    execute: async ({ fileId }) => {
      const id = encodeURIComponent(fileId)
      const meta = (await googleJson(
        tc,
        'GET',
        `https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType`
      )) as DriveFile
      const isGoogleDoc = meta.mimeType?.startsWith(
        'application/vnd.google-apps'
      )
      const url = isGoogleDoc
        ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=text/plain`
        : `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
      const response = await tc.ctx.runAction(
        internal.integrations.googleFetch,
        { method: 'GET', url, userId: tc.userId }
      )
      if (!response.ok) {
        return { detail: response.body, error: `Google API ${response.status}` }
      }
      return {
        content: response.body.slice(0, BODY_TRUNCATE_AT),
        mimeType: meta.mimeType ?? '',
        name: meta.name ?? ''
      }
    },
    inputSchema: z.object({
      fileId: z.string().describe('Drive file id from drive_search.')
    })
  }),

  drive_search: tool({
    description:
      "Search the user's Google Drive. Uses Drive query syntax for `q` (e.g. \"name contains 'report'\" or \"fullText contains 'budget'\").",
    execute: async ({ maxResults, query }) => {
      const limit = Math.min(
        maxResults ?? DEFAULT_LIST_RESULTS,
        MAX_LIST_RESULTS
      )
      const params = new URLSearchParams({
        fields: 'files(id,name,mimeType,modifiedTime)',
        pageSize: String(limit),
        q: query
      })
      const data = (await googleJson(
        tc,
        'GET',
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`
      )) as { files?: DriveFile[] }
      return { files: data.files ?? [] }
    },
    inputSchema: z.object({
      maxResults: z
        .number()
        .optional()
        .describe(
          `How many files (default ${DEFAULT_LIST_RESULTS}, max ${MAX_LIST_RESULTS}).`
        ),
      query: z.string().describe('Drive search query (q syntax).')
    })
  })
})

// Mount only the tools the user's grant actually covers. Empty object when
// Google isn't connected — the agent then has no account surface at all.
export const buildIntegrationTools = (
  ctx: ActionCtx,
  opts: { services: string[]; threadId: string; userId: string }
) => {
  const tc: ToolContext = { ctx, threadId: opts.threadId, userId: opts.userId }
  return {
    ...(opts.services.includes('gmail') ? gmailTools(tc) : {}),
    ...(opts.services.includes('calendar') ? calendarTools(tc) : {}),
    ...(opts.services.includes('drive') ? driveTools(tc) : {})
  }
}
