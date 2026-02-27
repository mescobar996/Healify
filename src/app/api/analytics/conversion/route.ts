import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

const KPI_TARGETS = {
  activation24hPct: 60,
  timeToFirstHealingMinutes: 15,
  autoPrRatePct: 35,
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(1))
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(7, Number(searchParams.get('days') || '30')))

    const since = new Date()
    since.setDate(since.getDate() - days)

    const cohortUsers = await db.user.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const cohortIds = cohortUsers.map((user) => user.id)
    const isAdmin = session.user.role === 'admin'
    const scopedUserIds = isAdmin ? cohortIds : cohortIds.filter((id) => id === session.user.id)

    if (scopedUserIds.length === 0) {
      return NextResponse.json({
        days,
        scope: isAdmin ? 'global' : 'self',
        funnel: {
          registered: 0,
          repoConnected: 0,
          firstHealing: 0,
          paid: 0,
          conversionRegisteredToRepoPct: 0,
          conversionRepoToHealingPct: 0,
          conversionHealingToPaidPct: 0,
        },
        kpiTargets: KPI_TARGETS,
        kpiActuals: {
          activation24hPct: 0,
          timeToFirstHealingMinutes: null,
          autoPrRatePct: 0,
        },
      })
    }

    const [repoConnectedUsers, paidUsers, healedEvents, autoHealedEvents, onboardingEvents] = await Promise.all([
      db.user.findMany({
        where: {
          id: { in: scopedUserIds },
          projects: { some: {} },
        },
        select: { id: true, createdAt: true, projects: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
      }),
      db.subscription.count({
        where: {
          userId: { in: scopedUserIds },
          status: { not: 'canceled' },
          plan: { not: 'FREE' },
        },
      }),
      db.healingEvent.findMany({
        where: {
          createdAt: { gte: since },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
          testRun: { project: { userId: { in: scopedUserIds } } },
        },
        select: {
          createdAt: true,
          testRun: { select: { project: { select: { userId: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      db.healingEvent.count({
        where: {
          createdAt: { gte: since },
          status: 'HEALED_AUTO',
          testRun: { project: { userId: { in: scopedUserIds } } },
        },
      }),
      db.notification.findMany({
        where: {
          userId: { in: scopedUserIds },
          title: { startsWith: 'analytics_event:onboarding_step_' },
          createdAt: { gte: since },
        },
        select: { title: true },
      }),
    ])

    const firstHealingByUser = new Map<string, Date>()
    for (const event of healedEvents) {
      const userId = event.testRun.project.userId
      if (!userId) continue
      const current = firstHealingByUser.get(userId)
      if (!current || event.createdAt < current) {
        firstHealingByUser.set(userId, event.createdAt)
      }
    }

    const timeToFirstHealingMinutesList: number[] = []
    for (const user of cohortUsers) {
      if (!scopedUserIds.includes(user.id)) continue
      const firstHealing = firstHealingByUser.get(user.id)
      if (!firstHealing) continue
      const minutes = Math.max(0, (firstHealing.getTime() - user.createdAt.getTime()) / 60000)
      timeToFirstHealingMinutesList.push(minutes)
    }

    const avgTimeToFirstHealingMinutes = timeToFirstHealingMinutesList.length
      ? Number((timeToFirstHealingMinutesList.reduce((acc, value) => acc + value, 0) / timeToFirstHealingMinutesList.length).toFixed(1))
      : null

    const activation24h = repoConnectedUsers.filter((user) => {
      const firstProject = user.projects[0]
      if (!firstProject) return false
      return firstProject.createdAt.getTime() - user.createdAt.getTime() <= 24 * 60 * 60 * 1000
    }).length

    const firstHealingUsers = firstHealingByUser.size
    const registered = scopedUserIds.length
    const repoConnected = repoConnectedUsers.length

    const onboardingSteps = {
      step1: onboardingEvents.filter((event) => event.title === 'analytics_event:onboarding_step_1_repo_connected').length,
      step2: onboardingEvents.filter((event) => event.title === 'analytics_event:onboarding_step_2_sdk_installed').length,
      step3: onboardingEvents.filter((event) => event.title === 'analytics_event:onboarding_step_3_first_healing').length,
    }

    return NextResponse.json({
      days,
      scope: isAdmin ? 'global' : 'self',
      funnel: {
        registered,
        repoConnected,
        firstHealing: firstHealingUsers,
        paid: paidUsers,
        conversionRegisteredToRepoPct: pct(repoConnected, registered),
        conversionRepoToHealingPct: pct(firstHealingUsers, repoConnected),
        conversionHealingToPaidPct: pct(paidUsers, firstHealingUsers),
      },
      onboardingSteps,
      kpiTargets: KPI_TARGETS,
      kpiActuals: {
        activation24hPct: pct(activation24h, registered),
        timeToFirstHealingMinutes: avgTimeToFirstHealingMinutes,
        autoPrRatePct: pct(autoHealedEvents, healedEvents.length),
      },
    })
  } catch (error) {
    console.error('[ANALYTICS][CONVERSION] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch conversion analytics' }, { status: 500 })
  }
}
