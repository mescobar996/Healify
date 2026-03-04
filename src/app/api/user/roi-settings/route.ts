import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth/session'

const DEFAULT_RATE = 65 // USD/hr

const PatchSchema = z.object({
  devHourlyRate: z
    .number()
    .min(1, 'La tarifa mínima es $1/hr')
    .max(1000, 'La tarifa máxima es $1000/hr'),
})

// GET /api/user/roi-settings — return current hourly rate for ROI calculations
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, devHourlyRate: true },
    })

    return NextResponse.json({
      devHourlyRate: dbUser?.devHourlyRate ?? DEFAULT_RATE,
    })
  } catch (error) {
    console.error('[roi-settings] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/user/roi-settings — update hourly rate
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = PatchSchema.parse(await request.json())

    const updated = await db.user.update({
      where: { id: user.id },
      data: { devHourlyRate: body.devHourlyRate },
      select: { id: true, devHourlyRate: true },
    })

    return NextResponse.json({
      devHourlyRate: updated.devHourlyRate ?? DEFAULT_RATE,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('[roi-settings] PATCH error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
