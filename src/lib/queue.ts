import { Queue, Job } from 'bullmq'

export const TEST_QUEUE_NAME = 'test_execution_queue'

// Use Redis URL directly — avoids ioredis version mismatch between bullmq and app
const redisUrl = process.env.REDIS_URL

// Detectar build time real (evitar falsos positivos con VERCEL='1' en runtime)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// Lazy initialization: solo crear queue cuando se necesite, no durante build
let testQueueInstance: Queue | null = null

function createTestQueue(): Queue | null {
  // Durante build time en Vercel, no crear queue
  if (isBuildTime || !redisUrl) {
    return null
  }

  return new Queue(TEST_QUEUE_NAME, {
    connection: {
      url: redisUrl,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        count: 100, // Keep last 100 completed jobs
        age: 24 * 3600, // Or 24 hours
      },
      removeOnFail: {
        count: 500,          // Keep last 500 failed jobs for debugging
        age: 7 * 24 * 3600,  // And no older than 7 days
      },
    },
  })
}

// Exportar getter lazy para la queue
export function getTestQueue(): Queue | null {
  if (isBuildTime) {
    return null
  }

  if (!testQueueInstance) {
    testQueueInstance = createTestQueue()
  }

  return testQueueInstance
}

// Mantener backward compatibility: testQueue es null durante build
export const testQueue = isBuildTime ? null : (redisUrl ? createTestQueue() : null)

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
  if (!testQueue) {
    console.warn('[Queue] Test queue not available (REDIS_URL not set)')
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

  const job = await testQueue.add('execute_tests', jobData, {
    // Job-specific options
    jobId: testRunId ? `testrun-${testRunId}` : undefined, // Para tracking fácil
  })

  console.log(`[Queue] Job ${job.id} created for project ${projectId}`)
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
  if (!testQueue) return null

  const job = await testQueue.getJob(jobId)
  if (!job) return null

  const state = await job.getState()

  return {
    state,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    failedReason: job.failedReason,
    returnValue: job.returnvalue,
  }
}
