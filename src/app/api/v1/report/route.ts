/**
 * HEALIFY - API v1 Report Endpoint
 * Receives test failures from external runners and triggers healing
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKeyFromRequest } from '@/lib/api-key-service'
import { db } from '@/lib/db'
import { analyzeAndHeal } from '@/lib/engine/healing-engine'
import { z } from 'zod'

// ============================================
// IN-MEMORY RATE LIMIT — 60 reports/min per project
// Protects against runaway CI loops
// ============================================
const reportCounts = new Map<string, { count: number; resetAt: number }>()
const REPORT_LIMIT   = 60   // max per window
const REPORT_WINDOW  = 60_000 // 1 minute in ms

function checkReportRateLimit(projectId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now  = Date.now()
  const entry = reportCounts.get(projectId)

  if (!entry || now > entry.resetAt) {
    reportCounts.set(projectId, { count: 1, resetAt: now + REPORT_WINDOW })
    return { allowed: true, remaining: REPORT_LIMIT - 1, resetIn: REPORT_WINDOW }
  }

  if (entry.count >= REPORT_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, remaining: REPORT_LIMIT - entry.count, resetIn: entry.resetAt - now }
}

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
  const rateCheck = checkReportRateLimit(projectId!)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 reports/minute per project.', resetIn: rateCheck.resetIn },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(REPORT_LIMIT),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(Math.ceil(rateCheck.resetIn / 1000)),
          'Retry-After':           String(Math.ceil(rateCheck.resetIn / 1000)),
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

    // 6. Run Healing Engine
    const healResult = await analyzeAndHeal({
      selector: payload.selector,
      htmlContext: payload.context,
      testName: payload.testName,
      errorMessage: payload.error,
    })

    // 7. Update healing event with result
    const updatedEvent = await db.healingEvent.update({
      where: { id: healingEvent.id },
      data: {
        newSelector: healResult.fixedSelector,
        newSelectorType: healResult.selectorType as any,
        confidence: healResult.confidence,
        status: healResult.confidence >= 0.95 ? 'HEALED_AUTO' : 'NEEDS_REVIEW',
        reasoning: healResult.explanation,
        actionTaken: healResult.confidence >= 0.95 ? 'auto_fixed' : 'suggested',
        appliedAt: healResult.confidence >= 0.95 ? new Date() : null,
        appliedBy: 'system',
      },
    })

    // 8. Update test run stats
    await db.testRun.update({
      where: { id: testRun.id },
      data: {
        totalTests: { increment: 1 },
        healedTests: healResult.confidence >= 0.95 ? { increment: 1 } : undefined,
        failedTests: healResult.confidence < 0.95 ? { increment: 1 } : undefined,
      },
    })

    // 9. Create notification for low confidence
    if (healResult.confidence < 0.70) {
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      })
      
      if (project?.userId) {
        await db.notification.create({
          data: {
            userId: project.userId,
            type: 'warning',
            title: 'Manual Review Required',
            message: `Test "${payload.testName}" needs review (${Math.round(healResult.confidence * 100)}% confidence)`,
            link: `/dashboard/tests`,
          },
        })
      }
    }

    // 10. Return response
    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      testRunId: testRun.id,
      healingEventId: updatedEvent.id,
      project: projectName,
      result: {
        fixedSelector: healResult.fixedSelector,
        confidence: healResult.confidence,
        selectorType: healResult.selectorType,
        explanation: healResult.explanation,
        needsReview: healResult.needsReview,
        alternatives: healResult.alternatives,
      },
      processingTimeMs: processingTime,
    })

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