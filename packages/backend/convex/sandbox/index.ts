'use node'

import { e2bProvider } from './e2b'
import type { SandboxProvider } from './types'

export type { ExecResult, ProvisionOpts, SandboxProvider } from './types'

// Select the sandbox driver by env so swapping providers is config, not code.
// Add new drivers here (e.g. a Fly Machines driver) without touching the loop.
export const getSandboxProvider = (): SandboxProvider => {
  const provider = process.env.SANDBOX_PROVIDER ?? 'e2b'
  switch (provider) {
    case 'e2b': {
      return e2bProvider
    }
    default: {
      throw new Error(
        `Unknown SANDBOX_PROVIDER "${provider}". Built drivers: e2b.`
      )
    }
  }
}
