'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'
import { verifyHealingEventOwnership } from './helpers'

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
