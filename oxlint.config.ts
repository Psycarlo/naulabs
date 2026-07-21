import { defineConfig } from 'oxlint'
import core from 'ultracite/oxlint/core'
import vitest from 'ultracite/oxlint/vitest'
import vue from 'ultracite/oxlint/vue'

export default defineConfig({
  extends: [core, vue, vitest],
  ignorePatterns: core.ignorePatterns,
  rules: {
    // Vue SFCs are PascalCase and composables are camelCase by convention.
    'unicorn/filename-case': [
      'error',
      { cases: { camelCase: true, kebabCase: true, pascalCase: true } }
    ]
  }
})
