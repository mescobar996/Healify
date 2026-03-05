import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'

// ═══════════════════════════════════════════════════════════════════════
// POST /api/slack/interactions — Slack Interactive Components handler
//
// Handles button clicks from Block Kit messages (e.g. "Run Tests" button
// in /healify projects response).
// ═══════════════════════════════════════════════════════════════════════

function verifySlackSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET
  if (!secret) return false

  const timestamp = req.headers.get('x-slack-request-timestamp') || ''
  const signature = req.headers.get('x-slack-signature') || ''

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(timestamp)) > 300) return false

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature = 'v0=' + crypto.createHmac('sha256', secret).update(sigBasestring).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()

    if (process.env.SLACK_SIGNING_SECRET && !verifySlackSignature(request, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const params = new URLSearchParams(rawBody)
    const payloadStr = params.get('payload')
    if (!payloadStr) return NextResponse.json({ text: 'No payload' })

    const payload = JSON.parse(payloadStr)

    if (payload.type === 'block_actions') {
      for (const action of payload.actions ?? []) {
        // Handle "Run Tests" button from /healify projects
        if (action.action_id?.startsWith('run_tests_')) {
          const projectId = action.value
          if (!projectId) continue

          const project = await db.project.findUnique({
            where: { id: projectId },
            include: { user: true },
          })

          if (!project || !project.repository) {
            return NextResponse.json({
              replace_original: false,
              response_type: 'ephemeral',
              text: `⚠️ Proyecto no encontrado o sin repositorio configurado.`,
            })
          }

          // Create test run
          const testRun = await db.testRun.create({
            data: { projectId, status: 'PENDING', triggeredBy: 'slack' },
          })

          const job = await addTestJob(projectId, null, testRun.id, {
            repository: project.repository,
            branch: 'main',
          })

          const status = job ? '⏳ Test run encolado' : '❌ Cola no disponible'

          return NextResponse.json({
            replace_original: false,
            response_type: 'ephemeral',
            text: `${status} para *${project.name}* (run: \`${testRun.id.slice(0, 8)}\`)`,
          })
        }
      }
    }

    return NextResponse.json({ text: 'OK' })
  } catch (error) {
    console.error('[Slack Interactions] Error:', error)
    return NextResponse.json({ text: '❌ Error procesando acción.' })
  }
}
