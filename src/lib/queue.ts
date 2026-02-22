import { Queue } from 'bullmq'

export const TEST_QUEUE_NAME = 'test_execution_queue'

// Use Redis URL directly — avoids ioredis version mismatch between bullmq and app
const redisUrl = process.env.REDIS_URL

export const testQueue = redisUrl
  ? new Queue(TEST_QUEUE_NAME, {
      connection: {
        url: redisUrl,
      },
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
    console.warn('Test queue not available (REDIS_URL not set)')
    return null
  }
  return await testQueue.add('execute_tests', {
    projectId,
    commitSha,
  })
}
