'use node'

import { Sandbox } from 'e2b'
import type { CommandResult } from 'e2b'

import type { ProvisionOpts, SandboxProvider } from './types'

// E2B driver for the SandboxProvider contract. Imported ONLY behind the env
// selector (see index.ts) and only from a Node-runtime ("use node") Convex
// action — the E2B SDK is Node-only. The agent loop never imports this file.
//
// Persistence note: E2B pause/resume is public beta. `Sandbox.connect(id)`
// auto-resumes a hibernated box; `betaPause` hibernates it (storage-only cost).
// CPU/RAM are fixed at the E2B *template* level, not per `create()` call, so
// ProvisionOpts.cpu/ramMb are advisory here and enforced via metering instead.

const DEFAULT_TIMEOUT_MS = 300_000

// Egress is restricted by default (untrusted agent code lives near user data).
// Escalate deliberately, in order:
//   1. default                      — no egress at all
//   2. E2B_ALLOWED_DOMAINS=a.com,…  — egress only to the listed hosts
//   3. E2B_ALLOW_INTERNET=true      — open egress (dev only)
const allowInternet = (): boolean => process.env.E2B_ALLOW_INTERNET === 'true'

const allowedDomains = (): string[] =>
  (process.env.E2B_ALLOWED_DOMAINS ?? '')
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean)

const egressOpts = () => {
  if (allowInternet()) {
    return { allowInternetAccess: true }
  }
  const domains = allowedDomains()
  if (domains.length > 0) {
    return { network: { allowOut: domains } }
  }
  return { allowInternetAccess: false }
}

// Optional custom template (e.g. one provisioned with more CPU/RAM per tier).
const template = (): string | undefined => process.env.E2B_TEMPLATE

// Reuse a live connection across tool calls within a single action invocation.
const connections = new Map<string, Promise<Sandbox>>()

const connect = (sandboxId: string): Promise<Sandbox> => {
  const existing = connections.get(sandboxId)
  if (existing) {
    return existing
  }
  const pending = Sandbox.connect(sandboxId, { timeoutMs: DEFAULT_TIMEOUT_MS })
  connections.set(sandboxId, pending)
  return pending
}

const isCommandResult = (value: unknown): value is CommandResult =>
  typeof value === 'object' &&
  value !== null &&
  'exitCode' in value &&
  'stdout' in value

export const e2bProvider: SandboxProvider = {
  exec: async (sandboxId, cmd) => {
    const box = await connect(sandboxId)
    try {
      const result = await box.commands.run(cmd)
      return {
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout
      }
    } catch (error) {
      // A non-zero exit throws CommandExitError, which IS a CommandResult.
      // Surface it to the model instead of failing the turn.
      if (isCommandResult(error)) {
        return {
          exitCode: error.exitCode,
          stderr: error.stderr,
          stdout: error.stdout
        }
      }
      throw error
    }
  },

  name: 'e2b',

  pause: async (sandboxId) => {
    connections.delete(sandboxId)
    await Sandbox.betaPause(sandboxId)
  },

  provision: async (_opts: ProvisionOpts) => {
    const tpl = template()
    const opts = {
      ...egressOpts(),
      // The box is the user's persistent computer: if a turn crashes before our
      // explicit pause, the idle timeout must hibernate it, never kill it —
      // killing discards the filesystem.
      lifecycle: { onTimeout: 'pause' as const },
      timeoutMs: DEFAULT_TIMEOUT_MS
    }
    const box = await (tpl ? Sandbox.create(tpl, opts) : Sandbox.create(opts))
    return { sandboxId: box.sandboxId }
  },

  readFile: async (sandboxId, path) => {
    const box = await connect(sandboxId)
    return await box.files.read(path)
  },

  resume: async (sandboxId) => {
    // connect() auto-resumes a paused box; just establish the connection.
    await connect(sandboxId)
  },

  writeFile: async (sandboxId, path, content) => {
    const box = await connect(sandboxId)
    await box.files.write(path, content)
  }
} satisfies SandboxProvider
