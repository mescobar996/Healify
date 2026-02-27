import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const format    = searchParams.get('format') || 'csv'
  const limit     = Math.min(parseInt(searchParams.get('limit') || '500'), 1000)

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const project = await db.project.findUnique({
    where: { id: projectId, userId: session.user.id },
    select: { id: true, name: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const runs = await db.testRun.findMany({
    where:   { projectId },
    orderBy: { startedAt: 'desc' },
    take:    limit,
    select: {
      id:          true,
      branch:      true,
      commitSha:   true,
      status:      true,
      triggeredBy: true,
      totalTests:  true,
      passedTests: true,
      failedTests: true,
      healedTests: true,
      startedAt:   true,
      finishedAt:  true,
      duration:    true,
      healingEvents: {
        select: {
          id:             true,
          testName:       true,
          failedSelector: true,
          newSelector:    true,
          confidence:     true,
          status:         true,
          appliedAt:      true,
        },
      },
    },
  })

  const timestamp = new Date().toISOString().split('T')[0]
  const filename  = `healify-${project.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}`

  if (format === 'json') {
    return new NextResponse(
      JSON.stringify({ project: project.name, exportedAt: new Date().toISOString(), runs }, null, 2),
      {
        headers: {
          'Content-Type':        'application/json',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      }
    )
  }

  const rows: string[] = []
  rows.push([
    'Run ID', 'Branch', 'Commit SHA', 'Status', 'Triggered By',
    'Total Tests', 'Passed', 'Failed', 'Healed',
    'Started At', 'Duration (s)',
    'Healing Event ID', 'Test Name', 'Failed Selector', 'New Selector',
    'Confidence (%)', 'Healing Status', 'Applied At',
  ].map(h => `"${h}"`).join(','))

  for (const run of runs) {
    const duration = run.duration !== null
      ? Math.round((run.duration as number) / 1000)
      : ''

    if (run.healingEvents.length === 0) {
      rows.push([
        run.id, run.branch || '', run.commitSha || '',
        run.status, run.triggeredBy || '',
        run.totalTests, run.passedTests, run.failedTests, run.healedTests,
        run.startedAt ? new Date(run.startedAt).toISOString() : '', duration,
        '', '', '', '', '', '', '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    } else {
      for (const he of run.healingEvents) {
        rows.push([
          run.id, run.branch || '', run.commitSha || '',
          run.status, run.triggeredBy || '',
          run.totalTests, run.passedTests, run.failedTests, run.healedTests,
          run.startedAt ? new Date(run.startedAt).toISOString() : '', duration,
          he.id, he.testName, he.failedSelector, he.newSelector || '',
          he.confidence !== null ? Math.round((he.confidence as number) * 100) : '',
          he.status,
          he.appliedAt ? new Date(he.appliedAt).toISOString() : '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      }
    }
  }

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}