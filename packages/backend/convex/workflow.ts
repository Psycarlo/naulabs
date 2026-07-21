import { WorkflowManager } from '@convex-dev/workflow'
import { v } from 'convex/values'

import { components, internal } from './_generated/api'

// Durable, stepwise agent loop. Convex actions can't hold a multi-minute
// connection, so each turn is a sequence of resumable steps. The sandbox holds
// filesystem state between steps, so no long-lived connection is needed.
//
// Turn lifecycle (slot counting, failure surfacing, queue drain, hibernation)
// lives in turnQueue.ts: every start goes through startOrQueueTurn, and the
// onComplete handler settles the turn even when this workflow fails or is
// canceled — the workflow body stays a straight-line happy path.
export const workflow = new WorkflowManager(components.workflow)

export const agentTurn = workflow.define({
  args: {
    // Channel the message arrived on; 'telegram' streams into a placeholder
    // message (live edits) since it has no reactive client. Defaults to web.
    channel: v.optional(v.string()),
    chatId: v.optional(v.string()),
    promptMessageId: v.string(),
    threadId: v.string(),
    userId: v.string()
  },
  handler: async (
    step,
    { channel, chatId, promptMessageId, threadId, userId }
  ) => {
    const tgChatId = channel === 'telegram' ? chatId : undefined

    // 1. Wake (or first-provision) the user's persistent box.
    const { sandboxId } = await step.runAction(
      internal.sandbox.ensureRunning,
      { userId },
      { retry: true }
    )
    // 2. Telegram: send the placeholder the model turn will live-edit.
    //    null messageId degrades to send-on-complete.
    const placeholder = tgChatId
      ? await step.runAction(internal.telegram.sendPlaceholder, {
          chatId: tgChatId
        })
      : { messageId: null }
    // 3. Stream the model turn (deltas + tool roundtrips happen inside).
    const { text } = await step.runAction(internal.agent.runTurn, {
      promptMessageId,
      sandboxId,
      telegramChatId: tgChatId,
      telegramMessageId: placeholder.messageId ?? undefined,
      threadId,
      userId
    })
    // 4. Channels without a reactive client get the final text pushed.
    if (tgChatId) {
      await step.runAction(internal.telegram.deliverToTelegram, {
        chatId: tgChatId,
        messageId: placeholder.messageId ?? undefined,
        text
      })
    }
  }
})
