import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@/lib/enums'
import { testRunner } from '@/lib/test-runner'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { checkTestRunLimit, limitExceededResponse } from '@/lib/rate-limit'

function normalizeStatus(status: string): 'pass' | 'fail' {
    if (status === TestStatus.PASSED || status === TestStatus.HEALED) return 'pass'
    return 'fail'
}

async function isFlakyProject(projectId: string): Promise<boolean> {
    const recentRuns = await db.testRun.findMany({
        where: { projectId },
        select: { status: true },
        orderBy: { startedAt: 'desc' },
        take: 5,
    })

    if (recentRuns.length < 3) return false

    const normalized = recentRuns.map((run) => normalizeStatus(run.status))
    const hasPass = normalized.includes('pass')
    const hasFail = normalized.includes('fail')
    if (!hasPass || !hasFail) return false

    let transitions = 0
    for (let index = 1; index < normalized.length; index++) {
        if (normalized[index] !== normalized[index - 1]) transitions++
    }

    return transitions >= 2
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: projectId } = await params

        const project = await db.project.findUnique({
            where: { id: projectId, userId: session.user.id }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const limitCheck = await checkTestRunLimit(session.user.id)
        if (!limitCheck.allowed) {
            return limitExceededResponse('testRuns', limitCheck)
        }

        // 1. Create a new TestRun
        const testRun = await db.testRun.create({
            data: {
                projectId,
                status: TestStatus.PENDING,
                branch: 'main', // Default for demo
                triggeredBy: 'manual',
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                healedTests: 0,
            },
        })

        // 2. Execute tests (In prod this should be a background task)
        // We don't await here if we want it to be "async", but for demo we can wait 
        // or just trigger it and return the run ID.
        // Let's await for now so the UI updates correctly after the request.
        await testRunner.runProjectTests(projectId, testRun.id)

        const finishedRun = await db.testRun.findUnique({
            where: { id: testRun.id },
            select: { status: true, branch: true },
        })

        let retryRunId: string | null = null
        let autoRetried = false

        if (finishedRun && normalizeStatus(finishedRun.status) === 'fail') {
            const flaky = await isFlakyProject(projectId)

            if (flaky) {
                const retryLimitCheck = await checkTestRunLimit(session.user.id)
                if (retryLimitCheck.allowed) {
                    const retryRun = await db.testRun.create({
                        data: {
                            projectId,
                            status: TestStatus.PENDING,
                            branch: finishedRun.branch || 'main',
                            triggeredBy: 'auto_retry_flaky',
                            totalTests: 0,
                            passedTests: 0,
                            failedTests: 0,
                            healedTests: 0,
                        },
                    })

                    retryRunId = retryRun.id
                    autoRetried = true
                    await testRunner.runProjectTests(projectId, retryRun.id)
                }
            }
        }

        return NextResponse.json({
            message: 'Test run initiated',
            testRunId: testRun.id,
            autoRetried,
            retryRunId,
        })
    } catch (error) {
        console.error('Error initiating test run:', error)
        return NextResponse.json(
            { error: 'Failed to initiate test run' },
            { status: 500 }
        )
    }
}
