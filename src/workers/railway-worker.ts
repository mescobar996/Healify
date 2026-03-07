/**
 * HEALIFY RAILWAY WORKER — Entry Point
 *
 * FIX CRÍTICO (Fase 2): El problema original era que new Worker() se creaba
 * sincrónicamente sin verificar que Redis esté accesible. Si Railway tarda en
 * levantar Redis, el worker se conectaba en estado zombie y dejaba de procesar jobs.
 * Solución: probar PING a Redis con backoff exponencial ANTES de crear el Worker.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { TEST_QUEUE_NAME, TestJobData } from '../lib/queue'
import { processJob } from './job-processor'

console.log('========================================')
console.log('🚀 HEALIFY RAILWAY WORKER STARTING')
console.log('========================================')

const KNOWN_VARS = ['REDIS_URL','DATABASE_URL','NODE_ENV','PORT','RAILWAY_ENVIRONMENT','RAILWAY_SERVICE_NAME','ANTHROPIC_API_KEY']
console.log('🔍 Environment variables present:')
for (const v of KNOWN_VARS) {
  const val = process.env[v]
  console.log(val ? `  ✅ ${v} = ${val.substring(0, 20)}...` : `  ❌ ${v} = NOT SET`)
}
console.log('========================================')

const redisUrl = process.env.REDIS_URL

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('⚠️  ANTHROPIC_API_KEY not set — healing will use deterministic fallback only')
}

if (!redisUrl) {
  console.error('❌ FATAL: REDIS_URL not set')
  const PORT_503 = parseInt(process.env.PORT ?? '8080', 10)
  require('http')
    .createServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'error', error: 'REDIS_URL not configured' }))
    })
    .listen(PORT_503, '0.0.0.0', () => {
      console.error(`⚠️  Health server on port ${PORT_503} (503)`)
    })
  setTimeout(() => process.exit(1), 60_000)
  throw new Error('REDIS_URL_NOT_SET')
}

console.log('✅ Redis URL configured')
console.log(`📦 Queue: ${TEST_QUEUE_NAME}`)

// ── Health server — arranca ANTES del worker para que Railway no haga timeout ──
const PORT = parseInt(process.env.PORT ?? '8080', 10)
let workerReady = false
let redisConnected = false

const healthServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: workerReady ? 'ok' : 'starting',
      worker: 'healify-railway-worker',
      queue: TEST_QUEUE_NAME,
      redis: redisConnected ? 'connected' : 'connecting',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    }))
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

healthServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🏥 Health server listening on 0.0.0.0:${PORT} -> GET /health`)
})

// ── Redis pre-check con retry exponencial ────────────────────────────────────
async function waitForRedis(url: string, maxAttempts = 12): Promise<void> {
  console.log('\n🔌 Verifying Redis connection before starting worker...')

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const probe = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 5_000,
      commandTimeout: 5_000,
      enableOfflineQueue: false,
    })

    try {
      await probe.connect()
      const pong = await probe.ping()
      await probe.quit()

      if (pong === 'PONG') {
        redisConnected = true
        console.log(`✅ Redis PING OK (attempt ${attempt}/${maxAttempts})`)
        return
      }
      throw new Error(`Unexpected PING response: ${pong}`)
    } catch (err) {
      probe.disconnect()
      const delay = Math.min(5_000 * attempt, 30_000)
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`⏳ Redis not ready (attempt ${attempt}/${maxAttempts}): ${errMsg}`)
      if (attempt === maxAttempts) {
        throw new Error(`Redis unreachable after ${maxAttempts} attempts. Last: ${errMsg}`)
      }
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// ── Main: esperar Redis, luego crear Worker ──────────────────────────────────
async function main(): Promise<void> {
  try {
    await waitForRedis(redisUrl!)
  } catch (err) {
    console.error('❌ FATAL: Cannot connect to Redis:', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const worker = new Worker<TestJobData>(
    TEST_QUEUE_NAME,
    async (job: Job<TestJobData>) => {
      console.log(`\n${'='.repeat(50)}`)
      console.log(`📥 Job received: ${job.id}`)
      console.log('='.repeat(50))
      const result = await processJob(job)
      console.log(`📤 Job completed: ${job.id} — ${result.passed}✅ ${result.failed}❌ ${result.healed}🩹`)
      return result
    },
    {
      connection: { url: redisUrl! },
      concurrency: 2,
      lockDuration:    600_000,
      maxStalledCount: 2,
      stalledInterval: 60_000,
      limiter: { max: 10, duration: 60_000 },
    }
  )

  worker.on('ready', () => {
    workerReady = true
    console.log('\n🎯 Worker ready and listening for jobs...\n')
  })

  worker.on('completed', (job: Job<TestJobData>) => {
    console.log(`✅ Job ${job.id} completed`)
  })

  worker.on('failed', (job: Job<TestJobData> | undefined, error: Error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message)
  })

  worker.on('error', (error: Error) => {
    // No crashear — BullMQ reintenta conexiones automáticamente
    console.error('Worker connection error (will retry):', error.message)
  })

  worker.on('stalled', (jobId: string) => {
    console.warn(`⚠️ Job ${jobId} stalled — will be retried`)
  })

  async function shutdown(signal: string): Promise<void> {
    console.log(`\n🛑 ${signal} received, shutting down gracefully...`)
    workerReady = false
    healthServer.close()
    await worker.close()
    console.log('✅ Worker closed cleanly')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('❌ Unhandled error in main():', err)
  process.exit(1)
})
