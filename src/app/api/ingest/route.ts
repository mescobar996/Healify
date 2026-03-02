import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'
import { extractApiKey, validateApiKey } from '@/lib/api-key-service'
import { sanitizeCommitSha, sanitizeGitBranch } from '@/lib/repo-validation'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { apiKey: apiKeyFromBody, testName, testFile, failedSelector, errorMessage, domSnapshot, branch, commitSha } = body

        const apiKey = extractApiKey(request) || (typeof apiKeyFromBody === 'string' ? apiKeyFromBody : null)
        const validation = await validateApiKey(apiKey)

        if (!validation.valid || !validation.projectId) {
            return NextResponse.json({ error: 'Invalid API Key' }, { status: 401 })
        }

        if (typeof testName !== 'string' || testName.trim().length === 0) {
            return NextResponse.json({ error: 'Invalid testName' }, { status: 400 })
        }

        const safeBranch = branch ? sanitizeGitBranch(branch) : null
        if (branch && !safeBranch) {
            return NextResponse.json({ error: 'Invalid branch format' }, { status: 400 })
        }

        const safeCommitSha = commitSha ? sanitizeCommitSha(commitSha) : null
        if (commitSha && !safeCommitSha) {
            return NextResponse.json({ error: 'Invalid commitSha format' }, { status: 400 })
        }

        // 1. Project validado por API key
        const projectId = validation.projectId

        // 2. Crear TestRun
        const testRun = await db.testRun.create({
            data: {
                projectId,
                status: 'PENDING',
                branch: safeBranch,
                commitSha: safeCommitSha,
                triggeredBy: 'cli',
                totalTests: 1,
                failedTests: 1,
            }
        })

        // 3. Crear HealingEvent
        await db.healingEvent.create({
            data: {
                testRunId: testRun.id,
                testName,
                testFile,
                failedSelector: failedSelector || 'unknown',
                selectorType: 'UNKNOWN',
                errorMessage: errorMessage || '',
                oldDomSnapshot: domSnapshot,
                status: 'ANALYZING',
            }
        })

        // 4. Encolar Job en BullMQ (puede retornar null si Redis no está disponible)
        const job = await addTestJob(projectId, safeCommitSha || undefined)

        // 5. Vincular JobId solo si el job fue creado exitosamente
        if (job?.id) {
            await db.testRun.update({
                where: { id: testRun.id },
                data: { jobId: job.id }
            })
        }

        if (!job?.id) {
            await db.testRun.update({
                where: { id: testRun.id },
                data: {
                    status: 'FAILED',
                    error: 'Queue unavailable: REDIS_URL not configured',
                    finishedAt: new Date(),
                }
            })

            return NextResponse.json({
                success: false,
                testRunId: testRun.id,
                jobId: null,
                error: 'Queue unavailable'
            }, { status: 503 })
        }

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
