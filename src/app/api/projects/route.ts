import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkProjectLimit, limitExceededResponse } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/auth/session'
import { initProjectApiKey } from '@/lib/api-key-service'

// GET /api/projects - Get all projects
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let projects: Array<Record<string, unknown>> = []

    try {
      projects = await db.project.findMany({
        where: { userId: user.id },
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
      }) as unknown as Array<Record<string, unknown>>
    } catch (queryError) {
      console.error('Error fetching projects with stats include, falling back to basic query:', queryError)
      projects = await db.project.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          name: true,
          description: true,
          repository: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      }) as unknown as Array<Record<string, unknown>>
    }

    const projectsWithStats = projects.map((project) => {
      const testRuns = Array.isArray(project.testRuns) ? project.testRuns : []
      const lastRun = testRuns[0] as {
        status?: string
        startedAt?: Date | string
        passedTests?: number
        totalTests?: number
        healedTests?: number
      } | undefined
      const testRunCount =
        typeof (project._count as { testRuns?: number } | undefined)?.testRuns === 'number'
          ? ((project._count as { testRuns: number }).testRuns)
          : 0

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        repository: project.repository,
        testRunCount,
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
    const user = await getSessionUser()
    if (!user?.id) {
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
    const limitCheck = await checkProjectLimit(user.id)
    if (!limitCheck.allowed) {
      return limitExceededResponse('projects', limitCheck)
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        repository: repository?.trim() || null,
        userId: user.id,
      },
    })

    // Provision hash-only API key (plaintext returned once for display)
    const apiKey = await initProjectApiKey(project.id)

    return NextResponse.json({ ...project, apiKey }, { status: 201 })
  } catch (error) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
