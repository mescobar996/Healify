import { Queue, Job } from 'bullmq'

export const TEST_QUEUE_NAME = 'test_execution_queue'

// Detectar build time real (evitar falsos positivos con VERCEL='1' en runtime)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// ── Parseo robusto de REDIS_URL ───────────────────────────────────────────────
// Railway usa URLs con credenciales: redis://:password@host:port
// BullMQ con { url } no siempre las parsea bien — pasamos campos explícitos.
function parseRedisConnection(): { host: string; port: number; password?: string; tls?: boolean } | null {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null

  try {
    const url = new URL(redisUrl)
    const host = url.hostname
    const port = parseInt(url.port || '6379', 10)
    // Railway pone la password en url.password (después de `:` en la parte de auth)
    const password = url.password || undefined
    // Upstash y algunos Redis cloud usan TLS (rediss://)
    const tls = url.protocol === 'rediss:' ? true : undefined

    return { host, port, password, ...(tls ? { tls: true as boolean } : {}) }
  } catch {
    // Si no se puede parsear, fallback a la URL directa
    console.warn('[Queue] Could not parse REDIS_URL, falling back to url string')
    return null
  }
}

function getBullMQConnection() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null

  const parsed = parseRedisConnection()
  if (parsed) {
    return {
      host: parsed.host,
      port: parsed.port,
      password: parsed.password,
      ...(parsed.tls ? { tls: parsed.tls } : {}),
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
    }
  }
  // Fallback: url string
  return { url: redisUrl, maxRetriesPerRequest: null, enableOfflineQueue: false }
}

// ── Lazy singleton ────────────────────────────────────────────────────────────
let testQueueInstance: Queue | null = null

function createTestQueue(): Queue | null {
  // Durante build time en Vercel NO crear queue (Redis no accesible en build)
  if (isBuildTime) return null

  const connection = getBullMQConnection()
  if (!connection) return null

  return new Queue(TEST_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100, age: 24 * 3600 },
      removeOnFail: { count: 500, age: 7 * 24 * 3600 },
    },
  })
}

/**
 * Getter lazy de la queue — siempre llama esto en runtime, nunca uses
 * la variable testQueue exportada directamente (puede ser null si el módulo
 * fue importado durante build time en Vercel).
 */
export function getTestQueue(): Queue | null {
  if (isBuildTime) return null

  if (!testQueueInstance) {
    testQueueInstance = createTestQueue()
  }

  return testQueueInstance
}

// Solo para backward compatibility — NO usar en código nuevo
// En runtime de Vercel puede ser null si el módulo se cacheó durante build
export const testQueue = isBuildTime ? null : null // deprecated: usar getTestQueue()

export interface TestJobData {
  projectId: string
  commitSha?: string
  testRunId: string
  branch?: string
  commitMessage?: string
  commitAuthor?: string
  repository?: string
}

/**
 * Encola un job de ejecución de tests en BullMQ
 * El worker en Railway procesará este job
 * 
 * @param projectId - ID del proyecto en DB
 * @param commitSha - SHA del commit que triggered el test
 * @param testRunId - ID del TestRun creado
 * @param metadata - Información adicional (branch, author, etc.)
 * @returns Job creado o null si Redis no está disponible
 */
export async function addTestJob(
  projectId: string,
  commitSha?: string | null,
  testRunId?: string | null,
  metadata?: {
    branch?: string | null
    commitMessage?: string | null
    commitAuthor?: string | null
    repository?: string | null
  }
): Promise<Job | null> {
  // CRITICO: usar getTestQueue() en cada invocacion, NO el singleton exportado.
  // El modulo puede haberse importado durante build time (isBuildTime=true) y el
  // singleton quedo null. getTestQueue() lo reinicializa correctamente en runtime.
  const queue = getTestQueue()

  if (!queue) {
    console.warn('[Queue] Test queue not available (REDIS_URL not set or build time)')
    return null
  }

  const jobData: TestJobData = {
    projectId,
    commitSha: commitSha || undefined,
    testRunId: testRunId || '',
    branch: metadata?.branch || undefined,
    commitMessage: metadata?.commitMessage || undefined,
    commitAuthor: metadata?.commitAuthor || undefined,
    repository: metadata?.repository || undefined,
  }

  const job = await queue.add('execute_tests', jobData, {
    jobId: testRunId ? `testrun-${testRunId}` : undefined,
  })

  console.log(`[Queue] Job ${job.id} enqueued for project ${projectId}, testRun ${testRunId}`)
  return job
}

/**
 * Obtiene el estado de un job por su ID
 */
export async function getJobStatus(jobId: string): Promise<{
  state: string
  progress: number
  failedReason?: string
  returnValue?: unknown
} | null> {
  const queue = getTestQueue()
  if (!queue) return null

  const job = await queue.getJob(jobId)
  if (!job) return null

  const state = await job.getState()

  return {
    state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    failedReason: job.failedReason,
    returnValue: job.returnvalue,
  }
}
