import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@/lib/enums'
import { testRunner } from '@/lib/test-runner'
import { gitAnalyzer } from '@/lib/git-analyzer'
import { createHmac, timingSafeEqual } from 'crypto'

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
            const commitMessage = payload.head_commit?.message || 'Push event'

            // Find project associated with this repository
            const project = await db.project.findFirst({
                where: { repository }
            })

            if (!project) {
                return NextResponse.json({ message: 'No project found for this repository' })
            }

            // Analyze impact (simulated)
            const impact = await gitAnalyzer.analyzeCommit('')

            // Create a new TestRun
            const testRun = await db.testRun.create({
                data: {
                    projectId: project.id,
                    status: TestStatus.PENDING,
                    branch,
                    commitMessage,
                    triggeredBy: 'github_webhook',
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    healedTests: 0,
                },
            })

            // Trigger test execution asynchronously
            testRunner.runProjectTests(project.id, testRun.id).catch(err => {
                console.error('Failed to run tests from webhook:', err)
            })

            return NextResponse.json({
                message: 'Webhook received, test run initiated',
                testRunId: testRun.id,
                impactSummary: impact.summary
            })
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
