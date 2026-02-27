import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

interface BranchSummary {
  branch: string
  runs: number
  failedRuns: number
  healedRuns: number
  totalTests: number
  failedTests: number
  failureRate: number
}

function summarizeBranch(runs: Array<{ status: string; totalTests: number; failedTests: number; healedTests: number }>, branch: string): BranchSummary {
  const runsCount = runs.length
  const failedRuns = runs.filter((run) => run.status === 'FAILED' || run.status === 'PARTIAL').length
  const healedRuns = runs.filter((run) => run.status === 'HEALED').length
  const totalTests = runs.reduce((acc, run) => acc + (run.totalTests || 0), 0)
  const failedTests = runs.reduce((acc, run) => acc + (run.failedTests || 0), 0)
  const failureRate = totalTests > 0 ? Number(((failedTests / totalTests) * 100).toFixed(1)) : 0

  return {
    branch,
    runs: runsCount,
    failedRuns,
    healedRuns,
    totalTests,
    failedTests,
    failureRate,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const baseBranch = (searchParams.get('base') || 'main').trim()
    const compareBranchParam = searchParams.get('compare')?.trim()

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const allRuns = await db.testRun.findMany({
      where: {
        project: { userId: session.user.id },
        branch: { not: null },
        startedAt: { gte: since },
      },
      select: {
        branch: true,
        status: true,
        totalTests: true,
        failedTests: true,
        healedTests: true,
      },
      orderBy: { startedAt: 'desc' },
      take: 1000,
    })

    const branches = Array.from(new Set(allRuns.map((run) => run.branch).filter(Boolean) as string[]))

    if (!branches.includes(baseBranch)) {
      branches.unshift(baseBranch)
    }

    const defaultCompare = branches.find((branch) => branch !== baseBranch) || null
    const compareBranch = compareBranchParam && compareBranchParam !== baseBranch
      ? compareBranchParam
      : defaultCompare

    if (!compareBranch) {
      return NextResponse.json({
        branches,
        base: summarizeBranch([], baseBranch),
        compare: null,
        delta: null,
      })
    }

    const baseRuns = allRuns.filter((run) => run.branch === baseBranch)
    const compareRuns = allRuns.filter((run) => run.branch === compareBranch)

    const baseSummary = summarizeBranch(baseRuns, baseBranch)
    const compareSummary = summarizeBranch(compareRuns, compareBranch)

    return NextResponse.json({
      branches,
      base: baseSummary,
      compare: compareSummary,
      delta: {
        failedTests: compareSummary.failedTests - baseSummary.failedTests,
        failureRate: Number((compareSummary.failureRate - baseSummary.failureRate).toFixed(1)),
        healedRuns: compareSummary.healedRuns - baseSummary.healedRuns,
      },
    })
  } catch (error) {
    console.error('[ANALYTICS][BRANCH_COMPARISON] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch branch comparison' }, { status: 500 })
  }
}
