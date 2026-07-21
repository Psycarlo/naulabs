// Magic-link email via Resend's REST API.
// Uses fetch (not the Resend SDK) so it runs in Convex's default V8 runtime.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export const sendMagicLinkEmail = async (email: string, url: string) => {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }

  const from = process.env.EMAIL_FROM ?? 'Nau Labs <onboarding@resend.dev>'

  const res = await fetch(RESEND_ENDPOINT, {
    body: JSON.stringify({
      from,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5">
          <h2>Sign in to Nau Labs</h2>
          <p>Click the link below to sign in. It expires shortly.</p>
          <p><a href="${url}">Sign in</a></p>
          <p style="color:#888;font-size:12px">If you didn't request this, ignore this email.</p>
        </div>
      `,
      subject: 'Your Nau Labs sign-in link',
      to: email
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  })

  if (!res.ok) {
    throw new Error(`Resend failed: ${res.status} ${await res.text()}`)
  }
}
