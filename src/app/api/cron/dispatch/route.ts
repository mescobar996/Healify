/**
 * GET  /api/cron/dispatch
 *
 * Protected endpoint that finds all projects with scheduleEnabled=true whose
 * next run is due (based on scheduleCron + lastScheduledAt) and enqueues a
 * test job for each.  Intended to be called by an external cron service
 * (Railway cron job, Vercel cron, etc.) every minute.
 *
 * Authentication: requires the `Authorization: Bearer <CRON_SECRET>` header
 * where CRON_SECRET is set as an environment variable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'
import { TestStatus } from '@/lib/enums'
import { checkTestRunLimit } from '@/lib/rate-limit'

// Simple cron-next-date checker (no external lib dependency)
function cronIsDue(cron: string, lastRan: Date | null): boolean {
  try {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return false

    const now = new Date()
    if (!lastRan) return true // never ran → run now

    const [minPart, hourPart] = parts

    const minInterval = parseInterval(minPart)
    const hourInterval = parseInterval(hourPart)

    let intervalMs = 60 * 60 * 1000 // default: hourly
    if (hourInterval) {
      intervalMs = hourInterval * 60 * 60 * 1000
    } else if (minInterval) {
      intervalMs = minInterval * 60 * 1000
    }

    return now.getTime() - lastRan.getTime() >= intervalMs
  } catch {
    return false
  }
}

function parseInterval(part: string): number | null {
  const m = part.match(/^\*\/(\d+)$/)
  return m ? parseInt(m[1], 10) : null
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const projects = await db.project.findMany({
    where: { scheduleEnabled: true, scheduleCron: { not: null } },
    select: {
      id: true,
      scheduleCron: true,
      scheduleBranch: true,
      lastScheduledAt: true,
      repository: true,
      userId: true,
    },
  })

  const dispatched: string[] = []
  const skipped: string[] = []

  for (const project of projects) {
    if (!project.scheduleCron) continue

    const isDue = cronIsDue(project.scheduleCron, project.lastScheduledAt)
    if (!isDue) {
      skipped.push(project.id)
      continue
    }

    // Validate test run limit before dispatching (A-M5)
    if (project.userId) {
      const limitCheck = await checkTestRunLimit(project.userId)
      if (!limitCheck.allowed) {
        console.warn(`[cron/dispatch] Skipping project ${project.id}: test run limit reached (${limitCheck.current}/${limitCheck.limit})`)
        skipped.push(project.id)
        continue
      }
    }

    try {
      const testRun = await db.testRun.create({
        data: {
          projectId: project.id,
          status: TestStatus.PENDING,
          branch: project.scheduleBranch ?? 'main',
          triggeredBy: 'schedule',
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          healedTests: 0,
        },
      })

      const job = await addTestJob(project.id, undefined, testRun.id, {
        branch: project.scheduleBranch ?? 'main',
        commitMessage: 'Scheduled run',
        commitAuthor: 'cron',
        repository: project.repository ?? undefined,
      })

      if (job?.id) {
        await db.testRun.update({
          where: { id: testRun.id },
          data: { jobId: job.id },
        })
      }

      await db.project.update({
        where: { id: project.id },
        data: { lastScheduledAt: new Date() },
      })

      dispatched.push(project.id)
    } catch (err) {
      console.error(`[cron/dispatch] Failed to dispatch project ${project.id}:`, err)
    }
  }

  return NextResponse.json({
    dispatched: dispatched.length,
    skipped: skipped.length,
    dispatchedIds: dispatched,
  })
}
