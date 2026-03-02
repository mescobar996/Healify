import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'
import { extractApiKey, validateApiKey } from '@/lib/api-key-service'
import { sanitizeCommitSha, sanitizeGitBranch } from '@/lib/repo-validation'
import { apiError } from '@/lib/api-response'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { apiKey: apiKeyFromBody, testName, testFile, failedSelector, errorMessage, domSnapshot, branch, commitSha } = body

        const apiKey = extractApiKey(request) || (typeof apiKeyFromBody === 'string' ? apiKeyFromBody : null)
        const validation = await validateApiKey(apiKey)

        if (!validation.valid || !validation.projectId) {
            return apiError(request, 401, 'Invalid API Key', { code: 'INVALID_API_KEY' })
        }

        if (typeof testName !== 'string' || testName.trim().length === 0) {
            return apiError(request, 400, 'Invalid testName', { code: 'INVALID_TEST_NAME' })
        }

        const safeBranch = branch ? sanitizeGitBranch(branch) : null
        if (branch && !safeBranch) {
            return apiError(request, 400, 'Invalid branch format', { code: 'INVALID_BRANCH' })
        }

        const safeCommitSha = commitSha ? sanitizeCommitSha(commitSha) : null
        if (commitSha && !safeCommitSha) {
            return apiError(request, 400, 'Invalid commitSha format', { code: 'INVALID_COMMIT_SHA' })
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
        return apiError(request, 500, 'Internal Server Error', { code: 'INGEST_FAILED' })
    }
}
