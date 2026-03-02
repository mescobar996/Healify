/**
 * HEALIFY RAILWAY WORKER â€” Entry Point
 *
 * Responsibilities:
 *   1. Validate required environment variables
 *   2. Start BullMQ Worker (delegates to job-processor.ts)
 *   3. Serve Railway health check on PORT (HTTP)
 *   4. Handle SIGTERM / SIGINT for graceful shutdown
 *
 * Business logic lives in:
 *   src/workers/lib/git-ops.ts          â€” clone, detect framework, install deps
 *   src/workers/lib/playwright-runner.ts â€” browser install + test execution
 *   src/workers/lib/healing-ops.ts       â€” AI healing + auto-PR creation
 *   src/workers/job-processor.ts         â€” processJob orchestrator
 */

import { createServer } from 'http'
import { Worker, Job } from 'bullmq'
import { TEST_QUEUE_NAME, TestJobData } from '../lib/queue'
import { processJob } from './job-processor'

// â”€â”€ Startup banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

console.log('========================================')
console.log('ðŸš€ HEALIFY RAILWAY WORKER STARTING')
console.log('========================================')

const KNOWN_VARS = [
  'REDIS_URL',
  'DATABASE_URL',
  'NODE_ENV',
  'PORT',
  'RAILWAY_ENVIRONMENT',
  'RAILWAY_SERVICE_NAME',
]
console.log('ðŸ” Environment variables present:')
for (const v of KNOWN_VARS) {
  const val = process.env[v]
  console.log(val ? `  âœ… ${v} = ${val.substring(0, 20)}...` : `  âŒ ${v} = NOT SET`)
}
console.log('========================================')

// â”€â”€ Guard: REDIS_URL required â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
  console.error('âŒ FATAL: REDIS_URL not set')
  console.error('Go to Railway â†’ Your Service â†’ Variables and add REDIS_URL')

  // Start health server returning 503 so Railway can show logs before exit
  const PORT_503 = parseInt(process.env.PORT ?? '8080', 10)
  const http = require('http') as typeof import('http')
  http
    .createServer((_req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'error', error: 'REDIS_URL not configured' }))
    })
    .listen(PORT_503, '0.0.0.0', () => {
      console.error(`âš ï¸ Health server on port ${PORT_503} (503 until REDIS_URL is set)`)
    })

  setTimeout(() => process.exit(1), 60_000)
  throw new Error('REDIS_URL_NOT_SET')
}

console.log('âœ… Redis URL configured')
console.log(`ðŸ“¦ Queue: ${TEST_QUEUE_NAME}`)
console.log(`ðŸ”§ Environment: ${process.env.NODE_ENV ?? 'development'}`)

// â”€â”€ BullMQ Worker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const worker = new Worker<TestJobData>(
  TEST_QUEUE_NAME,
  async (job: Job<TestJobData>) => {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`ðŸ“¥ Job received: ${job.id}`)
    console.log('='.repeat(50))

    const result = await processJob(job)

    console.log('='.repeat(50))
    console.log(`ðŸ“¤ Job completed: ${job.id}`)
    console.log(`   Success: ${result.success}`)
    console.log(
      `   Results: ${result.passed} passed, ${result.failed} failed, ${result.healed} healed`
    )
    console.log('='.repeat(50), '\n')

    return result
  },
  {
    connection: { url: redisUrl },
    concurrency: 2,
    limiter: { max: 10, duration: 60_000 },
  }
)

worker.on('completed', (job: Job<TestJobData>) => {
  console.log(`âœ… Job ${job.id} completed successfully`)
})
worker.on('failed', (job: Job<TestJobData> | undefined, error: Error) => {
  console.error(`âŒ Job ${job?.id} failed:`, error.message)
})
worker.on('error', (error: Error) => {
  console.error('Worker error:', error)
})
worker.on('stalled', (jobId: string) => {
  console.warn(`âš ï¸ Job ${jobId} stalled`)
})

// â”€â”€ Health check HTTP server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Railway does healthchecks on /health. Without this the deploy shows UNHEALTHY
// even when the worker is processing jobs correctly.

const PORT = parseInt(process.env.PORT ?? '8080', 10)

const healthServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        worker: 'healify-railway-worker',
        queue: TEST_QUEUE_NAME,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    )
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`ðŸ¥ Health server listening on 0.0.0.0:${PORT} -> GET /health`)
})

console.log('\nðŸŽ¯ Worker ready and listening for jobs...\n')

// â”€â”€ Graceful shutdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function shutdown(signal: string): Promise<void> {
  console.log(`\nðŸ›‘ ${signal} received, shutting down gracefully...`)
  healthServer.close()
  await worker.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

