/**
 * Worker-side event publisher.
 * Uses a direct Redis connection (no @/ path alias compatible with esbuild bundle).
 *
 * Only publishes events — subscribing is done by the Next.js SSE route.
 */

import { Redis } from 'ioredis'
import type { TestRunEventType, TestRunEvent } from '../../lib/event-bus'

const redisUrl = process.env.REDIS_URL

// Lazy singleton publisher connection
let publisherInstance: Redis | null = null

function getPublisher(): Redis | null {
  if (!redisUrl) return null
  if (!publisherInstance) {
    publisherInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    })
    publisherInstance.on('error', () => { /* non-fatal */ })
  }
  return publisherInstance
}

function channelFor(testRunId: string) {
  return `testrun:${testRunId}`
}

/**
 * Publish a real-time event for a test run to Redis pub/sub.
 * Consumed by GET /api/test-runs/[id]/stream on the Next.js side.
 */
export async function publishTestRunEvent(
  testRunId: string,
  type: TestRunEventType,
  payload?: Partial<Omit<TestRunEvent, 'type' | 'testRunId' | 'timestamp'>>
): Promise<void> {
  const publisher = getPublisher()
  if (!publisher) return

  const event: TestRunEvent = {
    type,
    testRunId,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  try {
    await publisher.publish(channelFor(testRunId), JSON.stringify(event))
  } catch {
    // Non-fatal
  }
}
