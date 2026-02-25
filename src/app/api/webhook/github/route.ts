import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@/lib/enums'
import { gitAnalyzer } from '@/lib/git-analyzer'
import { createHmac, timingSafeEqual } from 'crypto'
import { addTestJob } from '@/lib/queue'

// ✅ HEAL-001 FIX: Verificar firma HMAC de GitHub para evitar inyección de eventos falsos
function verifyGitHubSignature(body: string, signature: string | null): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    if (!secret) {
        console.warn('GITHUB_WEBHOOK_SECRET not set — webhook verification disabled')
        return false
    }
    if (!signature) return false

    const hmac = createHmac('sha256', secret)
    hmac.update(body, 'utf8')
    const digest = `sha256=${hmac.digest('hex')}`

    try {
        return timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(digest)
        )
    } catch {
        return false
    }
}

export async function POST(request: Request) {
    try {
        // Leer body como texto ANTES de parsear para poder verificar firma
        const body = await request.text()
        const signature = request.headers.get('x-hub-signature-256')
        const event = request.headers.get('x-github-event')

        // ✅ Verificar firma antes de procesar cualquier dato
        if (!verifyGitHubSignature(body, signature)) {
            console.warn('GitHub webhook: invalid or missing HMAC signature')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = JSON.parse(body)

        if (event === 'ping') {
            return NextResponse.json({ message: 'pong' })
        }

        if (event === 'push') {
            const repository = payload.repository.html_url
            const branch = payload.ref.replace('refs/heads/', '')
            const commitSha = payload.after // SHA del commit
            const commitMessage = payload.head_commit?.message || 'Push event'
            const commitAuthor = payload.head_commit?.author?.username || 'unknown'

            // Find project associated with this repository
            const project = await db.project.findFirst({
                where: { repository }
            })

            if (!project) {
                return NextResponse.json({ message: 'No project found for this repository' })
            }

            // Analyze impact usando archivos REALES del commit de GitHub
            // payload.head_commit.added + modified + removed = todos los archivos tocados
            const headCommit = payload.head_commit || {}
            const changedFiles: string[] = [
                ...(headCommit.added    || []),
                ...(headCommit.modified || []),
                ...(headCommit.removed  || []),
            ]
            // Si el push tiene múltiples commits, acumular archivos de todos
            const allCommitFiles: string[] = [...changedFiles]
            if (Array.isArray(payload.commits)) {
                for (const commit of payload.commits) {
                    allCommitFiles.push(
                        ...(commit.added    || []),
                        ...(commit.modified || []),
                        ...(commit.removed  || []),
                    )
                }
            }
            const uniqueFiles = Array.from(new Set(allCommitFiles))
            const impact = await gitAnalyzer.analyzeCommit('', uniqueFiles)

            // Create a new TestRun
            const testRun = await db.testRun.create({
                data: {
                    projectId: project.id,
                    status: TestStatus.PENDING,
                    branch,
                    commitSha,
                    commitMessage,
                    triggeredBy: 'github_webhook',
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    healedTests: 0,
                },
            })

            // 🚀 AUTO-ENQUEUE: Agregar job a la cola de BullMQ
            // El worker en Railway procesará este job y ejecutará Playwright
            const job = await addTestJob(project.id, commitSha, testRun.id, {
                branch,
                commitMessage,
                commitAuthor,
                repository,
            })

            if (job) {
                // Guardar jobId en TestRun para tracking
                await db.testRun.update({
                    where: { id: testRun.id },
                    data: { jobId: job.id }
                })

                console.log(`[Webhook] TestRun ${testRun.id} enqueued as Job ${job.id}`)

                return NextResponse.json({
                    message: 'Webhook received, test run enqueued',
                    testRunId: testRun.id,
                    jobId: job.id,
                    impactSummary: impact.summary,
                    queueStatus: 'queued'
                })
            } else {
                // Fallback: Redis no disponible, marcar como pendiente manual
                console.warn(`[Webhook] Redis not available. TestRun ${testRun.id} created but not enqueued.`)

                return NextResponse.json({
                    message: 'Webhook received, test run created (manual trigger required)',
                    testRunId: testRun.id,
                    impactSummary: impact.summary,
                    queueStatus: 'unavailable',
                    hint: 'Configure REDIS_URL to enable automatic test execution'
                })
            }
        }

        return NextResponse.json({ message: 'Event not handled' })
    } catch (error) {
        console.error('Error handling GitHub webhook:', error)
        return NextResponse.json(
            { error: 'Failed to process webhook' },
            { status: 500 }
        )
    }
}
