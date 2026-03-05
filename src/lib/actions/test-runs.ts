'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db'
import { addTestJob } from '@/lib/queue'
import { getSessionUser } from '@/lib/auth/session'
import type { TestStatus } from '@/lib/enums'

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

    // Validate repository before enqueuing
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
