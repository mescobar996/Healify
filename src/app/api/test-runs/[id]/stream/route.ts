import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { subscribeToTestRun } from '@/lib/event-bus'
import type { TestRunEvent } from '@/lib/event-bus'

/**
 * GET /api/test-runs/[id]/stream
 *
 * Server-Sent Events endpoint.
 * Streams real-time events for the given test run to the browser.
 *
 * Authentication: session required (user must own the project that owns this run)
 * Fallback: if Redis is unavailable, polls DB every 3 s and streams status updates.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: testRunId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────
  const user = await getSessionUser()
  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  // ── Verify ownership ──────────────────────────────────────────────────
  const testRun = await db.testRun.findUnique({
    where: { id: testRunId },
    include: { project: { select: { userId: true } } },
  })

  if (!testRun) return new Response('Not found', { status: 404 })
  if (testRun.project.userId !== user.id) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Already finished? Stream a single event and close ────────────────
  const terminalStatuses = ['PASSED', 'FAILED', 'HEALED', 'PARTIAL', 'CANCELLED']
  if (terminalStatuses.includes(testRun.status)) {
    const finalEvent: TestRunEvent = {
      type: testRun.status === 'FAILED' ? 'failed' : 'completed',
      testRunId,
      timestamp: new Date().toISOString(),
      progress: 100,
      data: {
        status: testRun.status,
        passedTests: testRun.passedTests,
        failedTests: testRun.failedTests,
        healedTests: testRun.healedTests,
        duration: testRun.duration,
      },
    }
    const body = `data: ${JSON.stringify(finalEvent)}\n\ndata: ${JSON.stringify({ type: 'close' })}\n\n`
    return new Response(body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // ── Live stream via SSE ───────────────────────────────────────────────
  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null
  let controllerRef: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller

      // Heartbeat every 15 s to keep the connection alive (nginx/Cloudflare timeout prevention)
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, 15_000)

      // SSE comment header
      controller.enqueue(encoder.encode(`: connected to testrun/${testRunId}\n\n`))

      function sendEvent(event: TestRunEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

          // Close SSE when run finishes
          if (event.type === 'completed' || event.type === 'failed') {
            setTimeout(() => {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'close' })}\n\n`))
                controller.close()
              } catch { /* already closed */ }
              clearInterval(heartbeatInterval)
            }, 500)
          }
        } catch { /* client disconnected */ }
      }

      // Subscribe to Redis pub/sub events
      cleanup = subscribeToTestRun(testRunId, sendEvent)

      // Fallback: if Redis not available, poll DB every 3 s
      if (!cleanup || cleanup.toString() === '() => {}') {
        const pollInterval = setInterval(async () => {
          try {
            const run = await db.testRun.findUnique({
              where: { id: testRunId },
              select: {
                status: true,
                passedTests: true,
                failedTests: true,
                healedTests: true,
                duration: true,
              },
            })
            if (!run) return

            const pollEvent: TestRunEvent = {
              type: terminalStatuses.includes(run.status)
                ? run.status === 'FAILED' ? 'failed' : 'completed'
                : 'progress',
              testRunId,
              timestamp: new Date().toISOString(),
              data: { ...run },
            }
            sendEvent(pollEvent)

            if (terminalStatuses.includes(run.status)) {
              clearInterval(pollInterval)
            }
          } catch { /* ignore */ }
        }, 3_000)

        cleanup = () => clearInterval(pollInterval)
      }
    },

    cancel() {
      cleanup?.()
      controllerRef = null
    },
  })

  // Also clean up when the request is aborted (client navigates away)
  request.signal.addEventListener('abort', () => {
    cleanup?.()
    try { controllerRef?.close() } catch { /* already closed */ }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
