/**
 * POST /api/checkout
 *
 * Body: { planId: 'starter' | 'pro' | 'enterprise' }
 *
 * Returns: { url: string }
 *
 * Pasarela única: MercadoPago (ARS)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { PLAN_META, type PlanId } from '@/lib/payment/types'
import { createCheckoutSession } from '@/lib/payment/mercadopago'

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { planId } = body as { planId: PlanId }

    if (!planId || !PLAN_META[planId]) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 })
    }

    const result = await createCheckoutSession({
      planId,
      userId: user.id,
      email: user.email,
    })

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
