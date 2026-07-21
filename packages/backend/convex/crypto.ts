// AES-256-GCM encryption for integration tokens at rest. Web Crypto only, so it
// runs in Convex's default V8 isolate — but ONLY inside actions/httpActions
// (SubtleCrypto is async and unavailable to deterministic queries/mutations).
//
// Key: INTEGRATIONS_ENCRYPTION_KEY env — base64-encoded 32 random bytes
// (`openssl rand -base64 32`). Rotating the key invalidates stored tokens;
// users just reconnect their integrations.

const IV_BYTES = 12
const KEY_BYTES = 32

// Return type is inferred so the Uint8Array stays ArrayBuffer-backed —
// annotating `Uint8Array` widens to ArrayBufferLike, which SubtleCrypto's
// BufferSource rejects under TS 5.7+.
const keyBytes = () => {
  const b64 = process.env.INTEGRATIONS_ENCRYPTION_KEY
  if (!b64) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY is not set')
  }
  const bytes = Uint8Array.from(atob(b64), (c) => c.codePointAt(0) ?? 0)
  if (bytes.length !== KEY_BYTES) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes, base64')
  }
  return bytes
}

const importKey = async (): Promise<CryptoKey> =>
  await crypto.subtle.importKey('raw', keyBytes(), 'AES-GCM', false, [
    'decrypt',
    'encrypt'
  ])

const toBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte)
  }
  return btoa(binary)
}

// Encrypt a JSON-serializable value → base64(iv || ciphertext).
export const encryptJson = async (value: unknown): Promise<string> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await importKey()
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ iv, name: 'AES-GCM' }, key, plaintext)
  )
  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv)
  packed.set(ciphertext, iv.length)
  return toBase64(packed)
}

export const decryptJson = async <T>(payload: string): Promise<T> => {
  const packed = Uint8Array.from(atob(payload), (c) => c.codePointAt(0) ?? 0)
  const iv = packed.slice(0, IV_BYTES)
  const data = packed.slice(IV_BYTES)
  const key = await importKey()
  const plaintext = await crypto.subtle.decrypt(
    { iv, name: 'AES-GCM' },
    key,
    data
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
