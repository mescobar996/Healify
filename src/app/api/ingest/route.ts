import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'
import { extractApiKey, validateApiKey } from '@/lib/api-key-service'
import { sanitizeCommitSha, sanitizeGitBranch } from '@/lib/repo-validation'
import { apiError } from '@/lib/api-response'
import { analyzeBrokenSelector } from '@/lib/ai/healing-service'
import { checkApiReportRateLimit } from '@/lib/rate-limit'

const MAX_DOM_SNAPSHOT_BYTES = 500_000 // 500 KB

const IngestSchema = z.object({
    apiKey:         z.string().max(256).optional(),
    testName:       z.string().min(1, 'testName required').max(500),
    testFile:       z.string().max(500).optional(),
    failedSelector: z.string().max(2000).optional(),
    errorMessage:   z.string().max(5000).optional(),
    domSnapshot:    z.string().max(MAX_DOM_SNAPSHOT_BYTES).optional(),
    branch:         z.string().max(250).optional(),
    commitSha:      z.string().max(40).optional(),
})

export async function POST(request: NextRequest) {
    try {
        // ── Parse and validate body with Zod ─────────────────────────────
        let body: z.infer<typeof IngestSchema>
        try {
            body = IngestSchema.parse(await request.json())
        } catch (err) {
            if (err instanceof z.ZodError) {
                return apiError(request, 400, 'Invalid payload', { code: 'INVALID_PAYLOAD', details: err.issues })
            }
            return apiError(request, 400, 'Malformed JSON', { code: 'INVALID_JSON' })
        }

        const { apiKey: apiKeyFromBody, testName, testFile, failedSelector, errorMessage, domSnapshot, branch, commitSha } = body

        const apiKey = extractApiKey(request) || (typeof apiKeyFromBody === 'string' ? apiKeyFromBody : null)
        const validation = await validateApiKey(apiKey)

        if (!validation.valid || !validation.projectId) {
            return apiError(request, 401, 'Invalid API Key', { code: 'INVALID_API_KEY' })
        }

        // ── Rate limit (same window as /api/v1/report) ───────────────────
        const rl = await checkApiReportRateLimit(validation.projectId)
        if (!rl.allowed) {
            return apiError(request, 429, `Rate limit exceeded (${rl.plan} plan: ${rl.limit}/min)`, {
                code: 'RATE_LIMITED',
                details: {
                    plan: rl.plan,
                    limit: rl.limit,
                    remaining: rl.remaining,
                    resetInMs: rl.resetInMs,
                },
            })
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

        // 3. Crear HealingEvent y analizar con IA
        const healingEvent = await db.healingEvent.create({
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

        // Resolve the healing event immediately using AI analysis
        try {
            const suggestion = await analyzeBrokenSelector(
                failedSelector || 'unknown',
                errorMessage || '',
                domSnapshot || '',
            )
            const confidence = suggestion?.confidence ?? 0.0
            await db.healingEvent.update({
                where: { id: healingEvent.id },
                data: {
                    newSelector: suggestion?.newSelector ?? (failedSelector || 'unknown'),
                    newSelectorType: (suggestion?.selectorType ?? 'UNKNOWN') as 'CSS' | 'XPATH' | 'TESTID' | 'ROLE' | 'TEXT' | 'UNKNOWN',
                    confidence,
                    reasoning: suggestion?.reasoning ?? 'Analysis unavailable',
                    status: confidence >= 0.95 ? 'HEALED_AUTO' : 'NEEDS_REVIEW',
                    actionTaken: confidence >= 0.95 ? 'auto_fixed' : 'suggested',
                    appliedAt: confidence >= 0.95 ? new Date() : null,
                    appliedBy: 'system',
                },
            })
        } catch {
            // Non-critical: keep ANALYZING so the worker can retry
        }

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
