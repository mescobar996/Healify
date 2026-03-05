'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { initProjectApiKey } from '@/lib/api-key-service'
import { db } from '@/lib/db'
import { checkProjectLimit } from '@/lib/rate-limit'
import { addTestJob } from '@/lib/queue'
import { getSessionUser } from '@/lib/auth/session'
import type { TestStatus } from '@/lib/enums'

// ============================================
// PROJECTS ACTIONS
// ============================================

export async function getProjects() {
  try {
    // Always scope to the authenticated user — never return other users' projects
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
    // Get session to link project to the logged-in user
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

    // ── Bloque 9: Rate limiting por plan ──────────────────────────────
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
    }).catch(() => {})

    revalidatePath('/dashboard/projects')
    return { success: true, project }
  } catch (error) {
    console.error('Error creating project:', error)
    Sentry.captureException(error)
    return { success: false, error: 'Failed to create project' }
  }
}

// ============================================
// TEST RUNS ACTIONS
// ============================================

export async function getTestRuns(params?: {
  limit?: number
  projectId?: string
  status?: string
}) {
  try {
    const user = await getSessionUser()
    if (!user?.id) return []

    const runs = await db.testRun.findMany({
      where: {
        project: { userId: user.id },
        ...(params?.projectId && { projectId: params.projectId }),
        ...(params?.status && { status: params.status as TestStatus }),
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: params?.limit || 20,
    })

    return runs.map(run => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() || null,
      duration: run.duration,
      branch: run.branch,
      commitSha: run.commitSha,
      commitMessage: run.commitMessage,
      totalTests: run.totalTests,
      passedTests: run.passedTests,
      failedTests: run.failedTests,
      healedTests: run.healedTests,
      project: run.project,
    }))
  } catch (error) {
    console.error('Error fetching test runs:', error)
    Sentry.captureException(error)
    return []
  }
}

export async function executeTestRun(projectId: string) {
  try {
    const user = await getSessionUser()
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
    })
    if (!project) return { success: false, error: 'Project not found' }

    // Point 4: Validate repository before enqueuing
    if (!project.repository) {
      return {
        success: false,
        error: 'Este proyecto no tiene un repositorio conectado. Editalo en /dashboard/projects.',
      }
    }

    // Create test run with PENDING status (worker will update it)
    const testRun = await db.testRun.create({
      data: {
        projectId,
        status: 'PENDING',
        triggeredBy: 'manual',
      },
    })

    // Enqueue to BullMQ — Railway worker picks it up
    const job = await addTestJob(projectId, null, testRun.id, {
      repository: project.repository,
      branch: 'main',
    })

    if (!job) {
      // Redis unavailable — mark run as failed immediately
      await db.testRun.update({
        where: { id: testRun.id },
        data: { status: 'FAILED', finishedAt: new Date(), error: 'Queue unavailable' },
      })
      return {
        success: false,
        error: 'Test runner is temporarily unavailable. Please try again in a few seconds.',
      }
    }

    revalidatePath('/dashboard/tests')
    revalidatePath('/dashboard')
    return { success: true, testRunId: testRun.id }
  } catch (error) {
    console.error('Error executing test run:', error)
    Sentry.captureException(error)
    return { success: false, error: 'Failed to execute test run' }
  }
}

// ============================================
// HEALING EVENTS ACTIONS
// ============================================

export async function getHealingEvents(params?: { limit?: number }) {
  try {
    const user = await getSessionUser()
    if (!user?.id) return []

    const events = await db.healingEvent.findMany({
      where: {
        testRun: { project: { userId: user.id } },
      },
      include: {
        testRun: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 20,
    })

    return events.map(event => ({
      id: event.id,
      testName: event.testName,
      testFile: event.testFile,
      failedSelector: event.failedSelector,
      newSelector: event.newSelector,
      confidence: event.confidence,
      status: event.status,
      reasoning: event.reasoning,
      projectName: event.testRun.project.name,
      projectId: event.testRun.project.id,
      createdAt: event.createdAt.toISOString(),
    }))
  } catch (error) {
    console.error('Error fetching healing events:', error)
    Sentry.captureException(error)
    return []
  }
}

export async function approveHealing(eventId: string) {
  try {
    const user = await getSessionUser()
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Verify the healing event belongs to the authenticated user
    await verifyHealingEventOwnership(eventId, user.id)

    await db.healingEvent.update({
      where: { id: eventId },
      data: {
        status: 'HEALED_MANUAL',
        appliedAt: new Date(),
        appliedBy: user.id,
      },
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error approving healing:', error)
    Sentry.captureException(error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to approve healing' }
  }
}

export async function rejectHealing(eventId: string) {
  try {
    const user = await getSessionUser()
    if (!user?.id) return { success: false, error: 'Not authenticated' }

    // Verify the healing event belongs to the authenticated user
    await verifyHealingEventOwnership(eventId, user.id)

    await db.healingEvent.update({
      where: { id: eventId },
      data: {
        status: 'IGNORED',
      },
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error rejecting healing:', error)
    Sentry.captureException(error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reject healing' }
  }
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getDashboardStats() {
  try {
    const user = await getSessionUser()
    if (!user?.id) return null

    // Scope ALL queries to the authenticated user
    const userFilter = { project: { userId: user.id } }

    const [totalProjects, totalTestRuns, healedCount, failedCount, recentHealingEvents] = await Promise.all([
      db.project.count({ where: { userId: user.id } }),
      db.testRun.count({ where: userFilter }),
      db.healingEvent.count({
        where: {
          ...userFilter,
          testRun: { project: { userId: user.id } },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
      }),
      db.testRun.count({
        where: { ...userFilter, status: 'FAILED' },
      }),
      db.healingEvent.findMany({
        where: {
          testRun: { project: { userId: user.id } },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    const healingSuccessRate = failedCount > 0 
      ? Math.round((healedCount / (failedCount + healedCount)) * 100)
      : 0

    // Chart data scoped to user
    const chartData = await getChartData(user.id)

    // Fragile selectors scoped to user
    const fragileSelectors = await db.trackedSelector.findMany({
      where: { project: { userId: user.id }, timesFailed: { gt: 0 } },
      orderBy: { timesFailed: 'desc' },
      take: 5,
    })

    return {
      metrics: {
        testsExecutedToday: totalTestRuns,
        autoHealingRate: healingSuccessRate,
        bugsDetected: failedCount,
        healedCount,
      },
      chartData,
      healingEvents: recentHealingEvents.map(e => ({
        id: e.id,
        testName: e.testName,
        status: e.status === 'HEALED_AUTO' ? 'curado' : e.status === 'HEALED_MANUAL' ? 'curado' : 'pendiente',
        confidence: Math.round((e.confidence || 0) * 100),
        timestamp: formatRelativeTime(e.createdAt),
        oldSelector: e.failedSelector,
        newSelector: e.newSelector,
      })),
      fragileSelectors: fragileSelectors.map(s => ({
        selector: s.selector,
        failures: s.timesFailed,
        successRate: Math.round(((s.timesUsed - s.timesFailed) / s.timesUsed) * 100),
      })),
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    Sentry.captureException(error)
    return null
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================


// ============================================
// AUTHORIZATION HELPERS
// ============================================

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  })
  if (!project) {
    throw new Error('Unauthorized: Project does not belong to user')
  }
  return project
}

async function verifyHealingEventOwnership(eventId: string, userId: string) {
  const event = await db.healingEvent.findUnique({
    where: { id: eventId },
    include: {
      testRun: {
        include: {
          project: true,
        },
      },
    },
  })
  if (!event || event.testRun.project.userId !== userId) {
    throw new Error('Unauthorized: Healing event does not belong to user')
  }
  return event
}

async function verifyTestRunOwnership(testRunId: string, userId: string) {
  const testRun = await db.testRun.findUnique({
    where: { id: testRunId },
    include: {
      project: true,
    },
  })
  if (!testRun || testRun.project.userId !== userId) {
    throw new Error('Unauthorized: Test run does not belong to user')
  }
  return testRun
}

// formatRelativeTime is imported from '@/lib/api' in components.
// This local version is used only by server actions for Spanish locale.
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `hace ${minutes} min`
  return 'hace unos segundos'
}

async function getChartData(userId: string) {
  const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Scope to user's projects only
  const runs = await db.testRun.findMany({
    where: {
      project: { userId },
      startedAt: { gte: weekAgo },
    },
  })

  // Group by calendar date (not day-of-week) to avoid collisions
  const byDay = days.map((day, i) => {
    const dayDate = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000)
    const dayStr = dayDate.toISOString().slice(0, 10) // YYYY-MM-DD
    const dayRuns = runs.filter(r => {
      return new Date(r.startedAt).toISOString().slice(0, 10) === dayStr
    })

    return {
      date: day,
      testsRotos: dayRuns.filter(r => r.status === 'FAILED').length,
      curados: dayRuns.reduce((acc, r) => acc + r.healedTests, 0),
    }
  })

  return byDay
}

