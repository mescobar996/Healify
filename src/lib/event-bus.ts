/**
 * Healify Event Bus — Redis pub/sub wrapper for real-time test run events.
 *
 * Worker side: publish events via publishTestRunEvent()
 * API/SSE side: subscribe via subscribeToTestRun()
 *
 * Channel format: testrun:{testRunId}
 */

import { getRedisInstance } from '@/lib/redis'

// ── Event shape ────────────────────────────────────────────────────────────
export type TestRunEventType =
  | 'started'
  | 'progress'
  | 'test_passed'
  | 'test_failed'
  | 'test_healed'
  | 'pr_created'
  | 'completed'
  | 'failed'
  | 'log'
  | 'close'

export interface TestRunEvent {
  type: TestRunEventType
  testRunId: string
  timestamp: string
  progress?: number          // 0-100
  message?: string
  data?: Record<string, unknown>
}

function channelFor(testRunId: string) {
  return `testrun:${testRunId}`
}

// ── Publisher (used by the Railway worker) ────────────────────────────────
export async function publishTestRunEvent(
  testRunId: string,
  type: TestRunEventType,
  payload?: Omit<TestRunEvent, 'type' | 'testRunId' | 'timestamp'>
): Promise<void> {
  const instance = getRedisInstance()
  if (!instance) return // Redis unavailable — degrade gracefully

  const event: TestRunEvent = {
    type,
    testRunId,
    timestamp: new Date().toISOString(),
    ...payload,
  }

  try {
    await instance.publish(channelFor(testRunId), JSON.stringify(event))
  } catch {
    // Non-fatal: SSE is a best-effort channel
  }
}

// ── Subscriber (used by the SSE API route) ────────────────────────────────
/**
 * Subscribe to all events for a given test run.
 * Returns an unsubscribe function to call when the client disconnects.
 *
 * @param testRunId  The test run to watch
 * @param onEvent    Called with each parsed event
 * @returns          cleanup function
 */
export function subscribeToTestRun(
  testRunId: string,
  onEvent: (event: TestRunEvent) => void
): () => void {
  const baseInstance = getRedisInstance()
  if (!baseInstance) {
    // No Redis — return no-op cleanup
    return () => {}
  }

  // ioredis: a subscriber connection cannot send regular commands, so
  // we must create a duplicate connection for sub.
  const sub = baseInstance.duplicate()

  const channel = channelFor(testRunId)

  sub.subscribe(channel).catch(() => {})

  sub.on('message', (_ch: string, message: string) => {
    try {
      const event = JSON.parse(message) as TestRunEvent
      onEvent(event)
    } catch {
      // Ignore parse errors
    }
  })

  sub.on('error', () => {
    // Ignore subscriber errors silently
  })

  return () => {
    sub.unsubscribe(channel).catch(() => {})
    sub.quit().catch(() => {})
  }
}
