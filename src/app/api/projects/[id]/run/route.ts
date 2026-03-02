import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@/lib/enums'
import { checkTestRunLimit, limitExceededResponse } from '@/lib/rate-limit'
import { addTestJob } from '@/lib/queue'
import { getSessionUser } from '@/lib/auth/session'
import { apiError } from '@/lib/api-response'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
        }

        const { id: projectId } = await params

        const project = await db.project.findUnique({
            where: { id: projectId, userId: user.id }
        })

        if (!project) {
            return apiError(request, 404, 'Project not found', { code: 'PROJECT_NOT_FOUND' })
        }

        const limitCheck = await checkTestRunLimit(user.id)
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

        const enqueuedJob = await addTestJob(projectId, undefined, testRun.id, {
            branch: 'main',
            commitMessage: 'Manual dashboard run',
            commitAuthor: user.email || user.name || 'manual',
            repository: project.repository || undefined,
        })

        if (enqueuedJob?.id) {
            await db.testRun.update({
                where: { id: testRun.id },
                data: { jobId: enqueuedJob.id },
            })

            return NextResponse.json({
                message: 'Test run enqueued',
                testRunId: testRun.id,
                jobId: enqueuedJob.id,
                queueStatus: 'queued',
            })
        }

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
    } catch (error) {
        console.error('Error initiating test run:', error)
        return apiError(request, 500, 'Failed to initiate test run', { code: 'PROJECT_RUN_FAILED' })
    }
}
