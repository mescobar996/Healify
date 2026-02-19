import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { apiKey, testName, testFile, failedSelector, errorMessage, domSnapshot, branch, commitSha } = body

        // 1. Validar Project existance & API Key
        const project = await db.project.findUnique({
            where: { apiKey },
            include: { user: true }
        })

        if (!project) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
        }

        // 2. Crear TestRun
        const testRun = await db.testRun.create({
            data: {
                projectId: project.id,
                status: 'PENDING',
                branch,
                commitSha,
                triggeredBy: 'cli',
                totalTests: 1, // Por ahora recibimos fallos individuales
                failedTests: 1,
            }
        })

        // 3. Crear HealingEvent (Solo el inicio)
        const healingEvent = await db.healingEvent.create({
            data: {
                testRunId: testRun.id,
                testName,
                testFile,
                failedSelector: failedSelector || 'unknown',
                selectorType: 'UNKNOWN',
                errorMessage: errorMessage || '',
                oldDomSnapshot: domSnapshot, // El DOM que nos envía el CLI
                status: 'ANALYZING',
            }
        })

        // 4. Encolar Job en BullMQ
        const job = await addTestJob(project.id, commitSha)

        // 5. Vincular JobId
        await db.testRun.update({
            where: { id: testRun.id },
            data: { jobId: job.id }
        })

        return NextResponse.json({
            success: true,
            testRunId: testRun.id,
            jobId: job.id,
            message: 'Healing job queued successfully'
        })

    } catch (error) {
        console.error('Ingest API Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
