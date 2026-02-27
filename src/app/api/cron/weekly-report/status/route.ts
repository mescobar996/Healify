import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

function getIsoWeekKey(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getNextMondayAtEightUTC(now: Date): string {
  const next = new Date(now)
  const day = next.getUTCDay()
  const daysUntilMonday = (8 - day) % 7 || 7
  next.setUTCDate(next.getUTCDate() + daysUntilMonday)
  next.setUTCHours(8, 0, 0, 0)
  return next.toISOString()
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentWeekKey = getIsoWeekKey(new Date())

    const [lastReport, recentReports] = await Promise.all([
      db.notification.findFirst({
        where: {
          userId: session.user.id,
          title: { startsWith: 'Weekly report ' },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          message: true,
          createdAt: true,
        },
      }),
      db.notification.count({
        where: {
          userId: session.user.id,
          title: { startsWith: 'Weekly report ' },
        },
      }),
    ])

    const lastWeekKey = lastReport?.title.replace('Weekly report ', '') || null

    return NextResponse.json({
      enabled: true,
      scheduleUtc: '0 8 * * 1',
      nextScheduledAt: getNextMondayAtEightUTC(new Date()),
      currentWeekKey,
      sentThisWeek: lastWeekKey === currentWeekKey,
      recentReports,
      lastReport: lastReport
        ? {
          id: lastReport.id,
          weekKey: lastWeekKey,
          sentAt: lastReport.createdAt,
          message: lastReport.message,
        }
        : null,
    })
  } catch (error) {
    console.error('[WEEKLY_REPORT_STATUS] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly report status' }, { status: 500 })
  }
}
