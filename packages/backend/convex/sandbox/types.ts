// Provider-agnostic sandbox contract. The agent loop and tool layer depend ONLY
// on this interface — never on a vendor SDK (E2B, Fly, ...). Swapping providers
// is a driver change selected by env (SANDBOX_PROVIDER), not a loop rewrite.

export interface ExecResult {
  exitCode: number
  stderr: string
  stdout: string
}

export interface ProvisionOpts {
  // Requested compute. Drivers honor what they can; E2B sizing is template-level
  // (see e2b.ts) so these are advisory there and enforced at metering time.
  cpu: number
  ramMb: number
  userId: string
}

export interface SandboxProvider {
  readonly name: string
  // Create a fresh persistent box for a user. Returns the opaque provider id.
  provision: (opts: ProvisionOpts) => Promise<{ sandboxId: string }>
  // Wake a hibernated box (cheap; ~1s on E2B). No-op if already running.
  resume: (sandboxId: string) => Promise<void>
  // Hibernate a box (storage-only cost). Safe to call on an already-paused box.
  pause: (sandboxId: string) => Promise<void>
  // Run a shell command in the box. Never throws on non-zero exit — the exit
  // code is returned so the model can react to failures.
  exec: (sandboxId: string, cmd: string) => Promise<ExecResult>
  readFile: (sandboxId: string, path: string) => Promise<string>
  writeFile: (sandboxId: string, path: string, content: string) => Promise<void>
}
