'use server'

import { db } from '@/lib/db'

// ============================================
// AUTHORIZATION HELPERS (shared across action modules)
// ============================================

export async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId },
  })
  if (!project) {
    throw new Error('Unauthorized: Project does not belong to user')
  }
  return project
}

export async function verifyHealingEventOwnership(eventId: string, userId: string) {
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

export async function verifyTestRunOwnership(testRunId: string, userId: string) {
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
