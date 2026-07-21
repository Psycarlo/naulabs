import agent from '@convex-dev/agent/convex.config'
import betterAuth from '@convex-dev/better-auth/convex.config'
import workflow from '@convex-dev/workflow/convex.config'
import { defineApp } from 'convex/server'

const app = defineApp()
app.use(betterAuth)
// Agent component: owns its own threads/messages/streamingMessages/streamDeltas
// tables. We do NOT define a streamDeltas table ourselves.
app.use(agent)
// Durable workflow component: the stepwise agent loop (resume -> turn -> pause).
app.use(workflow)

export default app
