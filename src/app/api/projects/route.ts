import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { checkProjectLimit, limitExceededResponse } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/auth/session'
import { initProjectApiKey } from '@/lib/api-key-service'
import { apiError } from '@/lib/api-response'

// ─── Types inferred from Prisma (no unsafe casting) ─────────────────────────
type ProjectWithStats = Prisma.ProjectGetPayload<{
  include: {
    testRuns: { orderBy: { startedAt: 'desc' }; take: 1 }
    _count: { select: { testRuns: true } }
  }
}>

// GET /api/projects - Get all projects
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
    }

    const { searchParams } = new URL(request.url)
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1',  10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip  = (page - 1) * limit

    let projects: ProjectWithStats[] | null = null
    let total = 0

    try {
      ;[projects, total] = await Promise.all([
        db.project.findMany({
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
          skip,
          take: limit,
        }),
        db.project.count({ where: { userId: user.id } }),
      ])
    } catch (queryError) {
      console.error('[projects] Full query failed, using basic fallback:', queryError)
    }

    // Fallback: basic select without relations when include fails
    if (!projects) {
      const [basic, fallbackTotal] = await Promise.all([
        db.project.findMany({
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
          skip,
          take: limit,
        }),
        db.project.count({ where: { userId: user.id } }),
      ])
      return NextResponse.json({
        data: basic.map((p) => ({
          ...p,
          testRunCount: 0,
          lastTestRun: null,
        })),
        pagination: { total: fallbackTotal, page, limit, pages: Math.ceil(fallbackTotal / limit) },
      })
    }

    const projectsWithStats = projects.map((project) => {
      const lastRun = project.testRuns[0] ?? null

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

    return NextResponse.json({
      data: projectsWithStats,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return apiError(request, 500, 'Failed to fetch projects', { code: 'PROJECTS_FETCH_FAILED' })
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
    }

    const body = await request.json()
    const { name, description, repository } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError(request, 400, 'Project name is required', { code: 'INVALID_NAME' })
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
    return apiError(request, 500, 'Failed to create project', { code: 'PROJECT_CREATE_FAILED' })
  }
}
