/**
 * HEALIFY - API v1 Report Endpoint
 * Receives test failures from external runners and triggers healing
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKeyFromRequest } from '@/lib/api-key-service'
import { db } from '@/lib/db'
import { analyzeBrokenSelector } from '@/lib/ai/healing-service'
import { checkApiReportRateLimit } from '@/lib/rate-limit'
import type { SelectorType } from '@/lib/enums'
import { evaluateGate } from '@/lib/gate/evaluate-gate'
import { z } from 'zod'

// ============================================
// REQUEST SCHEMA
// ============================================

const ReportSchema = z.object({
  testName: z.string().min(1),
  testFile: z.string().optional(),
  selector: z.string().min(1),
  error: z.string().min(1),
  context: z.string().optional(), // HTML snippet
  selectorType: z.enum(['CSS', 'XPATH', 'TESTID', 'ROLE', 'TEXT', 'UNKNOWN']).optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
})

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // 1. Validate API Key
  const validation = await validateApiKeyFromRequest(request)
  
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error || 'Unauthorized' },
      { status: 401 }
    )
  }

  const { projectId, projectName } = validation
  
  if (!projectId) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    )
  }

  // 2. Rate limit check
  const rateCheck = await checkApiReportRateLimit(projectId!)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded for plan ${rateCheck.plan}. Max ${rateCheck.limit} reports/minute per project.`,
        plan: rateCheck.plan,
        limit: rateCheck.limit,
        resetIn: rateCheck.resetInMs,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(rateCheck.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(Math.ceil(rateCheck.resetInMs / 1000)),
          'X-RateLimit-Plan':      rateCheck.plan,
          'Retry-After':           String(Math.ceil(rateCheck.resetInMs / 1000)),
        },
      }
    )
  }

  try {
    // 3. Parse request body
    const body = await request.json()
    const payload = ReportSchema.parse(body)

    // 4. Create or get active test run
    let testRun = await db.testRun.findFirst({
      where: {
        projectId,
        status: 'RUNNING',
        startedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 min
      },
    })

    if (!testRun) {
      testRun = await db.testRun.create({
        data: {
          projectId,
          status: 'RUNNING',
          branch: payload.branch,
          commitSha: payload.commitSha,
          triggeredBy: 'api',
        },
      })
    }

    // 5. Create healing event
    const healingEvent = await db.healingEvent.create({
      data: {
        testRunId: testRun.id,
        testName: payload.testName,
        testFile: payload.testFile,
        failedSelector: payload.selector,
        selectorType: payload.selectorType || 'UNKNOWN',
        errorMessage: payload.error,
        oldDomSnapshot: payload.context,
        status: 'ANALYZING',
      },
    })

    // 6. Run Healing Engine (ZAI + deterministic fallback)
    const suggestion = await analyzeBrokenSelector(
      payload.selector,
      payload.error,
      payload.context ?? '',
    )

    const fixedSelector = suggestion?.newSelector  ?? payload.selector
    const confidence    = suggestion?.confidence   ?? 0.0
    const reasoning     = suggestion?.reasoning    ?? 'Analysis unavailable'
    const selectorType  = suggestion?.selectorType ?? 'UNKNOWN'

    // 6b. Gate: confidence, fragilidad y unicidad del selector propuesto
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { userId: true, autoHealThreshold: true },
    })
    const gate = evaluateGate({
      confidence,
      selector: fixedSelector,
      selectorType: selectorType as SelectorType,
      threshold: project?.autoHealThreshold ?? 0.95,
      // No `newDomSnapshot ?? oldDomSnapshot` fallback like auto-pr.ts here: this
      // endpoint never runs a post-fix browser pass, so payload.context (the DOM
      // at the time of the ORIGINAL failure) is the only snapshot that exists.
      domSnapshot: payload.context,
    })

    // 7. Update healing event with result
    const updatedEvent = await db.healingEvent.update({
      where: { id: healingEvent.id },
      data: {
        newSelector: fixedSelector,
        newSelectorType: selectorType as SelectorType,
        confidence,
        status: gate.pass ? 'HEALED_AUTO' : 'NEEDS_REVIEW',
        reasoning,
        actionTaken: gate.pass ? 'auto_fixed' : 'suggested',
        appliedAt: gate.pass ? new Date() : null,
        appliedBy: 'system',
      },
    })

    // 8. Update test run stats
    await db.testRun.update({
      where: { id: testRun.id },
      data: {
        totalTests: { increment: 1 },
        healedTests: gate.pass ? { increment: 1 } : undefined,
        failedTests: !gate.pass ? { increment: 1 } : undefined,
      },
    })

    // 9. Create notification for low confidence
    if (confidence < 0.70 && project?.userId) {
      await db.notification.create({
        data: {
          userId: project.userId,
          type: 'warning',
          title: 'Manual Review Required',
          message: `Test "${payload.testName}" needs review (${Math.round(confidence * 100)}% confidence)`,
          link: `/dashboard/tests`,
        },
      })
    }

    // 10. Return response
    const processingTime = Date.now() - startTime

    return NextResponse.json(
      {
        success: true,
        testRunId: testRun.id,
        healingEventId: updatedEvent.id,
        project: projectName,
        result: {
          fixedSelector,
          confidence,
          selectorType,
          explanation: reasoning,
          needsReview: !gate.pass,
          alternatives: [],
        },
        processingTimeMs: processingTime,
      },
      {
        headers: {
          'X-RateLimit-Limit': String(rateCheck.limit),
          'X-RateLimit-Remaining': String(rateCheck.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetInMs / 1000)),
          'X-RateLimit-Plan': rateCheck.plan,
        },
      }
    )

  } catch (error) {
    console.error('Report API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}