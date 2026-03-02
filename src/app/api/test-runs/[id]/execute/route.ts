import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { testRunner } from '@/lib/test-runner'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const testRun = await db.testRun.findUnique({
            where: { id },
            include: { project: true }
        })

        if (!testRun) {
            return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
        }

        // Verify ownership
        if (testRun.project.userId !== user.id) {
            return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
        }

        // Execute tests asynchronously (for demo purposes we wait, 
        // but in prod this would be a background job)
        const results = await testRunner.runProjectTests(testRun.projectId, testRun.id)

        return NextResponse.json({
            message: 'Tests executed successfully',
            results,
        })
    } catch (error) {
        console.error('Error executing tests:', error)
        return NextResponse.json(
            { error: 'Failed to execute tests' },
            { status: 500 }
        )
    }
}
