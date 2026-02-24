import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { checkProjectLimit, limitExceededResponse } from '@/lib/rate-limit'

// GET /api/projects - Get all projects
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await db.project.findMany({
      where: { userId: session.user.id },
      include: {
        testRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { testRuns: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const projectsWithStats = projects.map((project) => {
      const lastRun = project.testRuns[0]
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
        testRunCount: project._count.testRuns,
        lastTestRun: lastRun
          ? {
            status: lastRun.status,
            startedAt: lastRun.startedAt,
            passedTests: lastRun.passedTests,
            totalTests: lastRun.totalTests,
            healedTests: lastRun.healedTests,
          }
          : null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      }
    })

    return NextResponse.json(projectsWithStats)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, repository } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      )
    }

    // ── Bloque 9: Rate limiting por plan ──────────────────────────────
    const limitCheck = await checkProjectLimit(session.user.id)
    if (!limitCheck.allowed) {
      return limitExceededResponse('projects', limitCheck)
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        repository: repository?.trim() || null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
