'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { initProjectApiKey } from '@/lib/api-key-service'
import { db } from '@/lib/db'
import { checkProjectLimit } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/auth/session'

export async function getProjects() {
  try {
    const user = await getSessionUser()
    if (!user?.id) return []

    const projects = await db.project.findMany({
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
      orderBy: { createdAt: 'desc' },
    })

    return projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      repository: project.repository,
      testRunCount: project._count.testRuns,
      lastTestRun: project.testRuns[0] ? {
        status: project.testRuns[0].status,
        startedAt: project.testRuns[0].startedAt.toISOString(),
        passedTests: project.testRuns[0].passedTests,
        totalTests: project.testRuns[0].totalTests,
        healedTests: project.testRuns[0].healedTests,
      } : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }))
  } catch (error) {
    console.error('Error fetching projects:', error)
    Sentry.captureException(error)
    return []
  }
}

export async function createProject(data: {
  name: string
  description?: string
  repository?: string
}) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return { success: false, error: 'Debés iniciar sesión para crear un proyecto' }
    }

    if (!data.name || data.name.trim().length < 3 || data.name.trim().length > 50) {
      return { success: false, error: 'El nombre debe tener entre 3 y 50 caracteres' }
    }
    if (data.description && data.description.length > 200) {
      return { success: false, error: 'La descripción debe tener menos de 200 caracteres' }
    }

    const limitCheck = await checkProjectLimit(user.id)
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `Límite de ${limitCheck.limit} proyecto${limitCheck.limit !== 1 ? 's' : ''} alcanzado en el plan ${limitCheck.plan}. Actualizá tu plan en /pricing para crear más.`,
        limitExceeded: true,
        upgradeUrl: '/pricing',
      }
    }

    const project = await db.project.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        repository: data.repository?.trim() || null,
        userId: user.id,
      },
    })

    // Provision hash-only API key — await to ensure key is ready (A-M4)
    try {
      await initProjectApiKey(project.id)
    } catch (err) {
      console.error('[createProject] Failed to init API key for', project.id, err)
      Sentry.captureException(err)
      // Non-fatal: project exists, key can be rotated later
    }

    await db.notification.create({
      data: {
        userId: user.id,
        type: 'info',
        title: 'analytics_event:onboarding_step_1_repo_connected',
        message: JSON.stringify({ projectId: project.id, source: 'create_project_action' }),
        link: '/dashboard/projects',
      },
    }).catch(() => { })

    revalidatePath('/dashboard/projects')
    return { success: true, project }
  } catch (error) {
    console.error('[createProject] Error creating project:', error)
    Sentry.captureException(error)

    const errorDetails = error instanceof Error ? error.message : 'Unknown database error'
    const isDbError = errorDetails.includes('Prisma') || errorDetails.includes('database') || errorDetails.includes('connect') || errorDetails.includes('fetch');

    return {
      success: false,
      error: isDbError
        ? 'El servidor de base de datos demoró en responder. ¿Querés reintentar manualmente?'
        : 'Error inesperado al crear el proyecto.'
    }
  }
}
