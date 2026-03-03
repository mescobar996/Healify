/**
 * POST /api/checkout
 *
 * Body: { planId: 'starter' | 'pro' | 'enterprise', currency: 'USD' | 'ARS' }
 *
 * Returns: { url: string }
 *
 * USD → Lemon Squeezy
 * ARS → MercadoPago (dynamic ARS price via exchange rate)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { PLAN_META, type PlanId, type Currency } from '@/lib/payment/types'
import { createCheckoutSession as lsCheckout } from '@/lib/payment/lemonsqueezy'
import { createCheckoutSession as mpCheckout } from '@/lib/payment/mercadopago'

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { planId, currency } = body as { planId: PlanId; currency: Currency }

    if (!planId || !PLAN_META[planId]) {
      return NextResponse.json({ error: 'Invalid planId' }, { status: 400 })
    }

    const validCurrencies: Currency[] = ['USD', 'ARS']
    if (!currency || !validCurrencies.includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency. Use USD or ARS.' }, { status: 400 })
    }

    const result =
      currency === 'ARS'
        ? await mpCheckout({ planId, userId: user.id, email: user.email })
        : await lsCheckout({ planId, userId: user.id, email: user.email })

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
