import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'
import { getJobStatus } from '@/lib/queue'

// GET /api/job-status/:id — Estado real del BullMQ job
// Permite polling desde la UI para mostrar progreso del Railway worker
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        // Primero buscar el TestRun para verificar ownership
        const testRun = await db.testRun.findFirst({
            where: {
                OR: [
                    { id },
                    { jobId: id }
                ],
                project: { userId: session.user.id }
            },
            select: {
                id: true,
                status: true,
                jobId: true,
                passedTests: true,
                failedTests: true,
                healedTests: true,
                totalTests: true,
                startedAt: true,
                finishedAt: true,
                error: true,
            }
        })

        if (!testRun) {
            return NextResponse.json({ error: 'Test run not found' }, { status: 404 })
        }

        // Si tiene jobId y Redis disponible, consultar estado real de BullMQ
        let jobStatus: { state: string; progress: number; failedReason?: string; returnValue?: unknown } | null = null
        if (testRun.jobId) {
            jobStatus = await getJobStatus(`testrun-${testRun.id}`)
                .catch(() => null) // Si Redis no disponible, no falla
        }

        return NextResponse.json({
            testRunId: testRun.id,
            dbStatus: testRun.status,
            jobId: testRun.jobId,
            // Estado real del worker si está disponible
            workerStatus: jobStatus ? {
                state: jobStatus.state,
                progress: jobStatus.progress,
                failedReason: jobStatus.failedReason,
            } : null,
            results: {
                passed: testRun.passedTests,
                failed: testRun.failedTests,
                healed: testRun.healedTests,
                total: testRun.totalTests,
            },
            timing: {
                startedAt: testRun.startedAt,
                finishedAt: testRun.finishedAt,
            },
            error: testRun.error,
        })

    } catch (error) {
        console.error('Error fetching job status:', error)
        return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 })
    }
}
