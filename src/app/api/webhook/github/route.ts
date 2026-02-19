import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@prisma/client'
import { testRunner } from '@/lib/test-runner'
import { gitAnalyzer } from '@/lib/git-analyzer'

export async function POST(request: Request) {
    try {
        const payload = await request.json()
        const event = request.headers.get('x-github-event')

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
            // In a real environment, we'd use a queue like BullMQ
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
