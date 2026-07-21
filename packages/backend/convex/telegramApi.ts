// Telegram Bot API client. Plain HTTPS via fetch, so it runs in the default V8
// isolate (no "use node") alongside the webhook httpAction. Never import a Node
// SDK here — the Bot API is just JSON over POST. The bot token lives only in
// Convex env and never enters the sandbox or a prompt.

// Telegram rejects messages over 4096 chars; truncate rather than split for v1.
const MAX_MESSAGE_LENGTH = 4096

const API_BASE = 'https://api.telegram.org'

const botToken = (): string => {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set')
  }
  return token
}

const callApi = async (
  method: string,
  body: Record<string, unknown>
): Promise<unknown> => {
  const response = await fetch(`${API_BASE}/bot${botToken()}/${method}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Telegram ${method} failed (${response.status}): ${detail}`)
  }
  return await response.json()
}

// Plain text (no parse_mode): the model emits Markdown that Telegram's
// MarkdownV2 would reject on any unescaped special char. Plain text is safe.
// Returns the sent message id so callers can later edit it (live streaming).
export const sendTelegramMessage = async (
  chatId: string,
  text: string
): Promise<{ messageId: number | null }> => {
  const response = (await callApi('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, MAX_MESSAGE_LENGTH)
  })) as { result?: { message_id?: number } }
  return { messageId: response.result?.message_id ?? null }
}

export const editTelegramMessage = async (
  chatId: string,
  messageId: number,
  text: string
): Promise<unknown> =>
  await callApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, MAX_MESSAGE_LENGTH)
  })

// One-time setup helper: point Telegram at the Convex webhook and set the secret
// header it will echo back. Can also be run via curl (see SETUP.md).
export const setWebhook = async (
  url: string,
  secretToken: string
): Promise<unknown> =>
  await callApi('setWebhook', { secret_token: secretToken, url })
