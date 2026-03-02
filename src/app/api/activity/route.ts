import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'

/**
 * GET /api/activity
 * Returns recent activity events for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent test runs with healing events (scoped to user)
    const testRuns = await db.testRun.findMany({
      where: { project: { userId: user.id } },
      take: 10,
      orderBy: { startedAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        healingEvents: { take: 3 },
      },
    })

    // Get recent projects (scoped to user)
    const projects = await db.project.findMany({
      where: { userId: user.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
    })

    // Build activity feed
    interface ActivityItem {
      id: string
      type: string
      title: string
      description: string
      projectName: string
      projectId: string
      createdAt: Date | null
    }
    const activities: ActivityItem[] = []

    // Add project created events
    projects.forEach((project) => {
      activities.push({
        id: `project-${project.id}`,
        type: 'project_created',
        title: 'Nuevo proyecto creado',
        description: `${project.name} fue añadido a tu workspace`,
        projectName: project.name,
        projectId: project.id,
        createdAt: project.createdAt,
      })
    })

    // Add test run events
    testRuns.forEach((run) => {
      if (run.healedTests > 0) {
        activities.push({
          id: `run-${run.id}-healed`,
          type: 'healing_success',
          title: 'Tests autocurados',
          description: `${run.healedTests} tests curados automáticamente`,
          projectName: run.project.name,
          projectId: run.project.id,
          createdAt: run.startedAt,
        })
      }

      activities.push({
        id: `run-${run.id}`,
        type: 'test_run',
        title: 'Tests ejecutados',
        description: `${run.totalTests} tests • ${run.passedTests} pasaron`,
        projectName: run.project.name,
        projectId: run.project.id,
        createdAt: run.startedAt,
      })
    })

    // Sort by date
    activities.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      activities: activities.slice(0, 15),
    })
  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}