/**
 * POST /api/webhook/lemonsqueezy
 *
 * Receives subscription lifecycle events from LemonSqueezy.
 * Signature verified via HMAC-SHA256 (X-Signature header).
 *
 * Events handled:
 *   subscription_created   → activate plan
 *   subscription_updated   → update status / period
 *   subscription_cancelled → cancel plan
 *   subscription_expired   → cancel plan
 *   subscription_resumed   → reactivate
 *   order_created          → initial activation (one-time or trial start)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Plan } from '@/lib/enums'
import { verifyWebhookSignature, parseWebhookPayload } from '@/lib/payment/lemonsqueezy'
import type { NormalizedSubscription } from '@/lib/payment/types'

function planIdToEnum(planId: NormalizedSubscription['planId']): Plan {
  if (planId === 'enterprise') return Plan.ENTERPRISE
  if (planId === 'pro')        return Plan.PRO
  return Plan.STARTER
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[LS Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const normalized = parseWebhookPayload(payload as Parameters<typeof parseWebhookPayload>[0])

  if (!normalized) {
    // Event not relevant — acknowledge silently
    return NextResponse.json({ received: true })
  }

  const { userId, planId, gatewaySubId, gatewayCustomerId, status, currentPeriodEnd } = normalized

  if (!userId) {
    console.warn('[LS Webhook] Missing userId in custom_data — skipping', payload)
    return NextResponse.json({ received: true })
  }

  try {
    const plan = planIdToEnum(planId!)

    await db.subscription.upsert({
      where: { userId },
      update: {
        plan,
        status: status ?? 'active',
        gateway: 'LEMONSQUEEZY',
        gatewaySubId:      gatewaySubId ?? null,
        gatewayCustomerId: gatewayCustomerId ?? null,
        currency:          'USD',
        currentPeriodEnd:  currentPeriodEnd ?? null,
      },
      create: {
        userId,
        plan,
        status: status ?? 'active',
        gateway: 'LEMONSQUEEZY',
        gatewaySubId:      gatewaySubId ?? null,
        gatewayCustomerId: gatewayCustomerId ?? null,
        currency:          'USD',
        currentPeriodEnd:  currentPeriodEnd ?? null,
      },
    })

    console.log(`[LS Webhook] ✅ ${normalized.planId} ${status} for user ${userId}`)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[LS Webhook] DB error:', err)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
