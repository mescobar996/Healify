/**
 * POST /api/checkout
 *
 * Body: { planId: 'starter' | 'pro' | 'enterprise', billingCycle?: 'monthly' | 'annual' }
 *
 * Returns: { url: string }
 *
 * Pasarela única: MercadoPago (ARS)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { PLAN_META, type PlanId, type BillingCycle } from '@/lib/payment/types'
import { createCheckoutSession } from '@/lib/payment/mercadopago'
import { billingRateLimit } from '@/lib/http-rate-limiter'

export async function POST(req: NextRequest) {
  // 10 req / min per IP — prevents checkout spam
  const rl = await billingRateLimit(req)
  if (!rl.ok) return rl.response!
  try {
    const user = await getSessionUser()
    if (!user?.id || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { planId, billingCycle } = body as { planId: PlanId; billingCycle?: BillingCycle }

    if (!planId || !PLAN_META[planId]) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 })
    }

    const cycle: BillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly'

    const result = await createCheckoutSession({
      planId,
      userId: user.id,
      email: user.email,
      billingCycle: cycle,
    })

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
