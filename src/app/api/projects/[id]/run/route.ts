import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TestStatus } from '@prisma/client'
import { testRunner } from '@/lib/test-runner'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params

        const project = await db.project.findUnique({
            where: { id: projectId }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

        return NextResponse.json({
            message: 'Test run initiated',
            testRunId: testRun.id,
        })
    } catch (error) {
        console.error('Error initiating test run:', error)
        return NextResponse.json(
            { error: 'Failed to initiate test run' },
            { status: 500 }
        )
    }
}
