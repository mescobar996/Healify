import { Queue } from 'bullmq'
import { redis } from './redis'

export const TEST_QUEUE_NAME = 'test_execution_queue'

export const testQueue = new Queue(TEST_QUEUE_NAME, {
    connection: redis,
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

export async function addTestJob(projectId: string, commitSha?: string) {
    return await testQueue.add('execute_tests', {
        projectId,
        commitSha,
    })
}
