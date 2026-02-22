import { Queue } from 'bullmq'
import { getRedisInstance } from './redis'

export const TEST_QUEUE_NAME = 'test_execution_queue'

// Crear queue solo si Redis está disponible (no durante build time)
const redisConnection = getRedisInstance()

export const testQueue = redisConnection 
  ? new Queue(TEST_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    })
  : null

export async function addTestJob(projectId: string, commitSha?: string) {
    if (!testQueue) {
        console.warn('Test queue not available (Redis not connected)')
        return null
    }
    return await testQueue.add('execute_tests', {
        projectId,
        commitSha,
    })
}
