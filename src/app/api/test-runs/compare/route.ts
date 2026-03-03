/**
 * GET /api/test-runs/compare?a={runId1}&b={runId2}
 * Returns side-by-side comparison data for two test runs belonging to the same user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

async function fetchRun(id: string, userId: string) {
  return db.testRun.findFirst({
    where: { id, project: { userId } },
    select: {
      id: true,
      status: true,
      branch: true,
      commitSha: true,
      commitMessage: true,
      triggeredBy: true,
      startedAt: true,
      finishedAt: true,
      duration: true,
      totalTests: true,
      passedTests: true,
      failedTests: true,
      healedTests: true,
      error: true,
      project: { select: { id: true, name: true } },
      healingEvents: {
        select: {
          id: true,
          testName: true,
          status: true,
          failedSelector: true,
          newSelector: true,
          confidence: true,
          errorMessage: true,
        },
      },
    },
  })
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const aId = url.searchParams.get('a')
  const bId = url.searchParams.get('b')

  if (!aId || !bId) {
    return NextResponse.json({ error: 'Params a and b are required' }, { status: 400 })
  }

  const [runA, runB] = await Promise.all([
    fetchRun(aId, user.id!),
    fetchRun(bId, user.id!),
  ])

  if (!runA || !runB) {
    return NextResponse.json({ error: 'One or both runs not found' }, { status: 404 })
  }

  // Compute delta statistics
  const delta = {
    totalTests: runB.totalTests - runA.totalTests,
    passedTests: runB.passedTests - runA.passedTests,
    failedTests: runB.failedTests - runA.failedTests,
    healedTests: runB.healedTests - runA.healedTests,
    duration: (runB.duration ?? 0) - (runA.duration ?? 0),
  }

  return NextResponse.json({ a: runA, b: runB, delta })
}
