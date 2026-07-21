// Google OAuth + REST helpers for account integrations. Plain fetch, no SDK, so
// it runs in the V8 isolate and in Node actions alike. Tokens are handled ONLY
// here and in integrations.ts — they never enter the sandbox or a prompt.

export type GoogleService = 'calendar' | 'drive' | 'gmail'

export interface GoogleTokens {
  accessToken: string
  // Epoch ms when the access token expires.
  expiresAt: number
  refreshToken?: string
  scopes: string[]
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

// Minimal scopes per service: read + explicit send for Gmail (never `modify`),
// events-only for Calendar, read-only for Drive.
export const SERVICE_SCOPES: Record<GoogleService, string[]> = {
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
  drive: ['https://www.googleapis.com/auth/drive.readonly'],
  gmail: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
  ]
}

export const GOOGLE_SERVICES = Object.keys(SERVICE_SCOPES) as GoogleService[]

export const isGoogleService = (value: string): value is GoogleService =>
  (GOOGLE_SERVICES as string[]).includes(value)

// Which services a stored grant covers (derived from the granted scope URLs).
export const servicesFromScopes = (scopes: string[]): GoogleService[] =>
  GOOGLE_SERVICES.filter((service) =>
    SERVICE_SCOPES[service].some((scope) => scopes.includes(scope))
  )

// Host-side proxy allowlist: the model can only reach these API roots through
// googleFetch, never an arbitrary URL with the user's token.
const ALLOWED_API_PREFIXES = [
  'https://gmail.googleapis.com/gmail/v1/users/me/',
  'https://www.googleapis.com/calendar/v3/',
  'https://www.googleapis.com/drive/v3/'
]

export const isAllowedGoogleUrl = (url: string): boolean =>
  ALLOWED_API_PREFIXES.some((prefix) => url.startsWith(prefix))

const clientCredentials = (): { id: string; secret: string } => {
  const id = process.env.GOOGLE_CLIENT_ID
  const secret = process.env.GOOGLE_CLIENT_SECRET
  if (!(id && secret)) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set')
  }
  return { id, secret }
}

export const googleRedirectUri = (): string => {
  const site = process.env.CONVEX_SITE_URL
  if (!site) {
    throw new Error('CONVEX_SITE_URL is not set')
  }
  return `${site}/integrations/google/callback`
}

// Consent URL for the given services. `access_type=offline` + `prompt=consent`
// force a refresh token so access survives the 1h token expiry.
export const googleConsentUrl = (
  services: GoogleService[],
  state: string
): string => {
  const scopes = [
    'openid',
    'email',
    ...services.flatMap((service) => SERVICE_SCOPES[service])
  ]
  const params = new URLSearchParams({
    access_type: 'offline',
    client_id: clientCredentials().id,
    prompt: 'consent',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: scopes.join(' '),
    state
  })
  return `${AUTH_URL}?${params.toString()}`
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

const tokenRequest = async (
  params: Record<string, string>
): Promise<TokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    body: new URLSearchParams(params).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    method: 'POST'
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `Google token request failed (${response.status}): ${detail}`
    )
  }
  return (await response.json()) as TokenResponse
}

const EXPIRY_FALLBACK_SECONDS = 3600

const toTokens = (
  raw: TokenResponse,
  previous?: GoogleTokens
): GoogleTokens => {
  if (!raw.access_token) {
    throw new Error('Google token response had no access_token')
  }
  return {
    accessToken: raw.access_token,
    expiresAt: Date.now() + (raw.expires_in ?? EXPIRY_FALLBACK_SECONDS) * 1000,
    refreshToken: raw.refresh_token ?? previous?.refreshToken,
    scopes: raw.scope ? raw.scope.split(' ') : (previous?.scopes ?? [])
  }
}

export const exchangeGoogleCode = async (
  code: string
): Promise<GoogleTokens> => {
  const { id, secret } = clientCredentials()
  const raw = await tokenRequest({
    client_id: id,
    client_secret: secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: googleRedirectUri()
  })
  return toTokens(raw)
}

export const refreshGoogleTokens = async (
  previous: GoogleTokens
): Promise<GoogleTokens> => {
  if (!previous.refreshToken) {
    throw new Error('No refresh token stored — reconnect the integration')
  }
  const { id, secret } = clientCredentials()
  const raw = await tokenRequest({
    client_id: id,
    client_secret: secret,
    grant_type: 'refresh_token',
    refresh_token: previous.refreshToken
  })
  return toTokens(raw, previous)
}

export const fetchGoogleEmail = async (
  accessToken: string
): Promise<string | null> => {
  const response = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) {
    return null
  }
  const info = (await response.json()) as { email?: string }
  return info.email ?? null
}

// Best-effort revocation on disconnect; Google returns 200 even for tokens it
// no longer knows about.
export const revokeGoogleToken = async (token: string): Promise<void> => {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST'
  })
}

// URL-safe base64 without padding — Gmail's `raw` message encoding. Web-API
// only (no Buffer) so it works in the V8 isolate.
export const base64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

// Build the RFC 2822 message for Gmail send. Plain text v1; UTF-8 body.
export const buildRfc822 = (
  to: string,
  subject: string,
  body: string
): string =>
  [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body
  ].join('\r\n')
