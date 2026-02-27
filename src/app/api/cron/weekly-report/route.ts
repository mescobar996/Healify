import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notificationService } from '@/lib/notification-service'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export const runtime = 'nodejs'

function getCronSecretFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '').trim()
  }
  return request.headers.get('x-cron-secret')
}

function getIsoWeekKey(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function formatWeeklyEmailBody(params: {
  userName: string
  projectsCount: number
  testRuns: number
  testsExecuted: number
  healedEvents: number
  autoPrCount: number
  bugCount: number
  estimatedHoursSaved: number
  weekKey: string
}): string {
  const {
    userName,
    projectsCount,
    testRuns,
    testsExecuted,
    healedEvents,
    autoPrCount,
    bugCount,
    estimatedHoursSaved,
    weekKey,
  } = params

  return [
    `Hola ${userName}, acá va tu resumen semanal (${weekKey}).`,
    `<br/><br/>`,
    `• Proyectos activos: <strong>${projectsCount}</strong><br/>`,
    `• Test runs: <strong>${testRuns}</strong><br/>`,
    `• Tests ejecutados: <strong>${testsExecuted}</strong><br/>`,
    `• Healings completados: <strong>${healedEvents}</strong><br/>`,
    `• Auto-PRs abiertos: <strong>${autoPrCount}</strong><br/>`,
    `• Bugs detectados: <strong>${bugCount}</strong><br/>`,
    `• Tiempo ahorrado estimado: <strong>${estimatedHoursSaved.toFixed(1)} horas</strong>`,
    `<br/><br/>`,
    `Seguí el detalle en tu dashboard de Healify.`,
  ].join('')
}

async function runWeeklyReport() {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const weekKey = getIsoWeekKey(now)

  const users = await db.user.findMany({
    where: {
      email: { not: null },
      projects: {
        some: {
          testRuns: {
            some: {
              startedAt: { gte: sevenDaysAgo },
            },
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      projects: { select: { id: true } },
    },
  })

  let sent = 0
  let skipped = 0
  const details: Array<{ userId: string; status: 'sent' | 'skipped'; reason?: string }> = []

  for (const user of users) {
    if (!user.email || user.projects.length === 0) {
      skipped += 1
      details.push({ userId: user.id, status: 'skipped', reason: 'missing_email_or_projects' })
      continue
    }

    const dedupeTitle = `Weekly report ${weekKey}`
    const alreadySent = await db.notification.findFirst({
      where: {
        userId: user.id,
        title: dedupeTitle,
      },
      select: { id: true },
    })

    if (alreadySent) {
      skipped += 1
      details.push({ userId: user.id, status: 'skipped', reason: 'already_sent' })
      continue
    }

    const projectIds = user.projects.map((project) => project.id)

    const [
      testRunsCount,
      testsAgg,
      healedCount,
      autoPrCount,
      bugsDetected,
    ] = await Promise.all([
      db.testRun.count({
        where: {
          projectId: { in: projectIds },
          startedAt: { gte: sevenDaysAgo },
        },
      }),
      db.testRun.aggregate({
        where: {
          projectId: { in: projectIds },
          startedAt: { gte: sevenDaysAgo },
        },
        _sum: { totalTests: true },
      }),
      db.healingEvent.count({
        where: {
          testRun: {
            projectId: { in: projectIds },
          },
          createdAt: { gte: sevenDaysAgo },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
      }),
      db.healingEvent.count({
        where: {
          testRun: {
            projectId: { in: projectIds },
          },
          createdAt: { gte: sevenDaysAgo },
          prUrl: { not: null },
        },
      }),
      db.healingEvent.count({
        where: {
          testRun: {
            projectId: { in: projectIds },
          },
          createdAt: { gte: sevenDaysAgo },
          status: 'BUG_DETECTED',
        },
      }),
    ])

    const totalTests = testsAgg._sum.totalTests || 0

    if (testRunsCount === 0 && healedCount === 0) {
      skipped += 1
      details.push({ userId: user.id, status: 'skipped', reason: 'no_activity' })
      continue
    }

    const estimatedHoursSaved = (healedCount * 8) / 60
    const subject = `📊 Weekly report ${weekKey} — Healify`
    const body = formatWeeklyEmailBody({
      userName: user.name?.split(' ')[0] || 'equipo',
      projectsCount: projectIds.length,
      testRuns: testRunsCount,
      testsExecuted: totalTests,
      healedEvents: healedCount,
      autoPrCount,
      bugCount: bugsDetected,
      estimatedHoursSaved,
      weekKey,
    })

    const emailResult = await notificationService.sendEmail(user.email, subject, body)

    if (!emailResult.success) {
      skipped += 1
      details.push({ userId: user.id, status: 'skipped', reason: 'email_send_failed' })
      continue
    }

    await db.notification.create({
      data: {
        userId: user.id,
        type: 'info',
        title: dedupeTitle,
        message: `Resumen semanal enviado (${weekKey}): ${healedCount} healings, ${autoPrCount} auto-PRs.`,
        link: '/dashboard',
      },
    })

    sent += 1
    details.push({ userId: user.id, status: 'sent' })
  }

  return {
    ok: true,
    weekKey,
    processedUsers: users.length,
    sent,
    skipped,
    details,
  }
}

export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const requestSecret = getCronSecretFromRequest(request)
    if (!requestSecret || requestSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runWeeklyReport()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[CRON][WEEKLY_REPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to run weekly report cron' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await runWeeklyReport()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[MANUAL][WEEKLY_REPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to trigger weekly report manually' }, { status: 500 })
  }
}
