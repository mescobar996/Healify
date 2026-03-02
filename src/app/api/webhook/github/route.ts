import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@/lib/enums'
import { gitAnalyzer } from '@/lib/git-analyzer'
import { createHmac, timingSafeEqual } from 'crypto'
import { addTestJob } from '@/lib/queue'
import { checkTestRunLimit } from '@/lib/rate-limit'
import { extractBranchFromGitRef, sanitizeCommitSha, sanitizeGitHubRepositoryUrl } from '@/lib/repo-validation'
import { apiError } from '@/lib/api-response'

type GitHubWebhookPayload = {
    repository?: { html_url?: string }
    ref?: string
    after?: string
    head_commit?: {
        message?: string
        author?: { username?: string }
        added?: string[]
        modified?: string[]
        removed?: string[]
    }
    commits?: Array<{
        added?: string[]
        modified?: string[]
        removed?: string[]
    }>
}

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
            return apiError(request, 401, 'Unauthorized', { code: 'WEBHOOK_UNAUTHORIZED' })
        }

        let payload: GitHubWebhookPayload
        try {
            payload = JSON.parse(body)
        } catch {
            return apiError(request, 400, 'Invalid JSON payload', { code: 'INVALID_JSON' })
        }

        if (event === 'ping') {
            return NextResponse.json({ message: 'pong' })
        }

        if (event === 'push') {
            const repository = sanitizeGitHubRepositoryUrl(payload?.repository?.html_url)
            const branch = extractBranchFromGitRef(payload?.ref)
            const commitSha = sanitizeCommitSha(payload?.after)
            const commitMessage = payload.head_commit?.message || 'Push event'
            const commitAuthor = payload.head_commit?.author?.username || 'unknown'

            if (!repository || !branch) {
                return apiError(request, 400, 'Invalid repository or branch in webhook payload', {
                    code: 'INVALID_WEBHOOK_PAYLOAD',
                })
            }

            // Find project associated with this repository
            const project = await db.project.findFirst({
                where: { repository }
            })

            if (!project) {
                return NextResponse.json({ message: 'No project found for this repository' })
            }

            if (!project.userId) {
                return apiError(request, 400, 'Project owner not found', { code: 'PROJECT_OWNER_NOT_FOUND' })
            }

            const limitCheck = await checkTestRunLimit(project.userId)
            if (!limitCheck.allowed) {
                return NextResponse.json({
                    error: `Test run monthly limit reached for plan ${limitCheck.plan}`,
                    limitExceeded: true,
                    plan: limitCheck.plan,
                    current: limitCheck.current,
                    limit: limitCheck.limit,
                }, { status: 429 })
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
                    commitSha: commitSha || undefined,
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
            const job = await addTestJob(project.id, commitSha || undefined, testRun.id, {
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
                await db.testRun.update({
                    where: { id: testRun.id },
                    data: {
                        status: TestStatus.FAILED,
                        error: 'Queue unavailable: REDIS_URL not configured',
                        finishedAt: new Date(),
                    },
                })

                return NextResponse.json({
                    error: 'Queue unavailable',
                    testRunId: testRun.id,
                    queueStatus: 'unavailable',
                }, { status: 503 })
            }
        }

        return NextResponse.json({ message: 'Event not handled' })
    } catch (error) {
        console.error('Error handling GitHub webhook:', error)
        return apiError(request, 500, 'Failed to process webhook', { code: 'WEBHOOK_PROCESS_FAILED' })
    }
}
