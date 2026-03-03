/**
 * GET /api/user/onboarding-status
 * Returns real-time onboarding completion state for the current user.
 */

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id!

  const [projectCount, runCount, healCount] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.testRun.count({
      where: { project: { userId } },
    }),
    db.healingEvent.count({
      where: {
        status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        testRun: { project: { userId } },
      },
    }),
  ])

  return NextResponse.json({
    projectConnected: projectCount > 0,
    firstRunExecuted: runCount > 0,
    firstHealingDone: healCount > 0,
  })
}
