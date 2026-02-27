import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'admin'

    const users = await db.user.findMany({
      where: isAdmin
        ? { projects: { some: {} } }
        : { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        projects: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const since = new Date()
    since.setDate(since.getDate() - 30)

    const members = await Promise.all(users.map(async (user) => {
      const projectIds = user.projects.map((project) => project.id)
      const [runs30d, healed30d] = await Promise.all([
        db.testRun.count({
          where: {
            projectId: { in: projectIds.length ? projectIds : [''] },
            startedAt: { gte: since },
          },
        }),
        db.healingEvent.count({
          where: {
            testRun: { projectId: { in: projectIds.length ? projectIds : [''] } },
            createdAt: { gte: since },
            status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
          },
        }),
      ])

      return {
        id: user.id,
        name: user.name || 'Sin nombre',
        email: user.email,
        projects: projectIds.length,
        runs30d,
        healed30d,
      }
    }))

    return NextResponse.json({
      isAdmin,
      totalMembers: members.length,
      totalProjects: members.reduce((acc, member) => acc + member.projects, 0),
      totalRuns30d: members.reduce((acc, member) => acc + member.runs30d, 0),
      members,
    })
  } catch (error) {
    console.error('[DASHBOARD][TEAM] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch team dashboard' }, { status: 500 })
  }
}
