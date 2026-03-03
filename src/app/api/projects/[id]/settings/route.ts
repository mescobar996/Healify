/**
 * GET  /api/projects/[id]/settings  — retrieve project configuration
 * PUT  /api/projects/[id]/settings  — update project configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

async function getProject(projectId: string, userId: string) {
  return db.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      name: true,
      autoHealThreshold: true,
      autoPrEnabled: true,
      notifyOnHeal: true,
      notifyOnFail: true,
      scheduleEnabled: true,
      scheduleCron: true,
      scheduleBranch: true,
    },
  })
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const project = await getProject(id, user.id!)
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const existing = await getProject(id, user.id!)
  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    autoHealThreshold,
    autoPrEnabled,
    notifyOnHeal,
    notifyOnFail,
    scheduleEnabled,
    scheduleCron,
    scheduleBranch,
  } = body as Record<string, unknown>

  // Validate
  if (autoHealThreshold !== undefined) {
    const t = Number(autoHealThreshold)
    if (isNaN(t) || t < 0 || t > 1) {
      return NextResponse.json(
        { error: 'autoHealThreshold must be a number between 0 and 1' },
        { status: 400 }
      )
    }
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      ...(autoHealThreshold !== undefined && { autoHealThreshold: Number(autoHealThreshold) }),
      ...(autoPrEnabled !== undefined && { autoPrEnabled: Boolean(autoPrEnabled) }),
      ...(notifyOnHeal !== undefined && { notifyOnHeal: Boolean(notifyOnHeal) }),
      ...(notifyOnFail !== undefined && { notifyOnFail: Boolean(notifyOnFail) }),
      ...(scheduleEnabled !== undefined && { scheduleEnabled: Boolean(scheduleEnabled) }),
      ...(scheduleCron !== undefined && { scheduleCron: scheduleCron as string | null }),
      ...(scheduleBranch !== undefined && { scheduleBranch: scheduleBranch as string | null }),
    },
    select: {
      id: true,
      name: true,
      autoHealThreshold: true,
      autoPrEnabled: true,
      notifyOnHeal: true,
      notifyOnFail: true,
      scheduleEnabled: true,
      scheduleCron: true,
      scheduleBranch: true,
    },
  })

  return NextResponse.json(updated)
}
