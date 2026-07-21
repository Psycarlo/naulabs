import { cronJobs } from 'convex/server'

import { internal } from './_generated/api'

const crons = cronJobs()

// GC short-lived rows: expired oauth states / telegram link codes, old
// telegram update-dedupe markers, settled pending actions, stale rate-limit
// windows. Bounded batches; see cleanup.ts.
crons.interval('cleanup expired rows', { hours: 6 }, internal.cleanup.run, {})

export default crons
