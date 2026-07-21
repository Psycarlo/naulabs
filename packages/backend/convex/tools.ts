import { tool } from 'ai'
import { z } from 'zod'

import type { SandboxProvider } from './sandbox/index'

// Maps the model-facing tools to provider methods. The model never sees E2B (or
// any vendor) — only this contract. All execution happens inside the user's box.
//
// Shell-quote a single argument for safe interpolation into a bash command.
const shellQuote = (value: string): string =>
  `'${value.replaceAll("'", "'\\''")}'`

const TRUNCATE_AT = 30_000

const truncate = (text: string): string =>
  text.length > TRUNCATE_AT
    ? `${text.slice(0, TRUNCATE_AT)}\n…[truncated]`
    : text

export const buildTools = (provider: SandboxProvider, sandboxId: string) => ({
  bash: tool({
    description:
      'Run a shell command inside the sandbox. Returns stdout, stderr, and exit code.',
    execute: async ({ command }) => {
      const result = await provider.exec(sandboxId, command)
      return {
        exitCode: result.exitCode,
        stderr: truncate(result.stderr),
        stdout: truncate(result.stdout)
      }
    },
    inputSchema: z.object({
      command: z.string().describe('The shell command to run.')
    })
  }),

  edit: tool({
    description:
      'Replace the first occurrence of a string in a file. Fails if the string is not found.',
    execute: async ({ newString, oldString, path }) => {
      const content = await provider.readFile(sandboxId, path)
      if (!content.includes(oldString)) {
        return { error: 'oldString not found in file', ok: false }
      }
      await provider.writeFile(
        sandboxId,
        path,
        content.replace(oldString, newString)
      )
      return { ok: true }
    },
    inputSchema: z.object({
      newString: z.string().describe('Replacement text.'),
      oldString: z.string().describe('Exact text to replace.'),
      path: z.string().describe('Absolute path of the file to edit.')
    })
  }),

  glob: tool({
    description: 'Find files matching a glob pattern under a directory.',
    execute: async ({ path, pattern }) => {
      const dir = path ?? '.'
      const result = await provider.exec(
        sandboxId,
        `find ${shellQuote(dir)} -type f -name ${shellQuote(pattern)}`
      )
      return { matches: truncate(result.stdout) }
    },
    inputSchema: z.object({
      path: z
        .string()
        .optional()
        .describe('Directory to search (default cwd).'),
      pattern: z.string().describe('Filename glob, e.g. "*.ts".')
    })
  }),

  grep: tool({
    description: 'Search file contents for a regex pattern (recursive).',
    execute: async ({ path, pattern }) => {
      const target = path ?? '.'
      const result = await provider.exec(
        sandboxId,
        `grep -rn -- ${shellQuote(pattern)} ${shellQuote(target)}`
      )
      return { matches: truncate(result.stdout) }
    },
    inputSchema: z.object({
      path: z.string().optional().describe('File or directory to search.'),
      pattern: z.string().describe('Regex pattern to search for.')
    })
  }),

  read: tool({
    description: 'Read a file from the sandbox filesystem.',
    execute: async ({ path }) => {
      const content = await provider.readFile(sandboxId, path)
      return { content: truncate(content) }
    },
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to read.')
    })
  }),

  write: tool({
    description: 'Write (create or overwrite) a file in the sandbox.',
    execute: async ({ content, path }) => {
      await provider.writeFile(sandboxId, path, content)
      return { ok: true }
    },
    inputSchema: z.object({
      content: z.string().describe('Full file contents to write.'),
      path: z.string().describe('Absolute path of the file to write.')
    })
  })
})
