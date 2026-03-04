/**
 * POST /api/webhook/mercadopago
 *
 * Receives subscription payment notifications from MercadoPago.
 * Signature verified via HMAC-SHA256 (x-signature header).
 *
 * MP sends notifications for:
 *   type=subscription_preapproval → subscription status change
 *   type=subscription_authorized_payment → payment confirmed
 *
 * Query params populated by MP:
 *   ?data.id=<preapproval_id>&type=<topic>
 *
 * Signature format (x-signature header):
 *   ts=<timestamp>,v1=<hex>
 *
 * Verification manifest:
 *   "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Plan } from '@/lib/enums'
import { verifyWebhookSignature, fetchAndNormalizePreapproval } from '@/lib/payment/mercadopago'
import type { NormalizedSubscription } from '@/lib/payment/types'
import { webhookRateLimit } from '@/lib/http-rate-limiter'
import { trackFunnelEvent } from '@/lib/funnel-analytics'

function planIdToEnum(planId: NormalizedSubscription['planId']): Plan {
  if (planId === 'enterprise') return Plan.ENTERPRISE
  if (planId === 'pro')        return Plan.PRO
  return Plan.STARTER
}

export async function POST(req: NextRequest) {
  // 200 req / min — allows MP burst but blocks abuse
  const rl = await webhookRateLimit(req)
  if (!rl.ok) return rl.response!

  // ── Extract query params and headers ───────────────────────────────────
  const url         = new URL(req.url)
  const dataId      = url.searchParams.get('data.id') ?? ''
  const type        = url.searchParams.get('type') ?? ''
  const xSignature  = req.headers.get('x-signature') ?? ''
  const xRequestId  = req.headers.get('x-request-id') ?? ''

  // Only handle subscription events before reading body
  if (!['subscription_preapproval', 'subscription_authorized_payment'].includes(type)) {
    return NextResponse.json({ received: true })
  }

  if (!dataId) {
    return NextResponse.json({ error: 'Missing data.id' }, { status: 400 })
  }

  // Read body once
  const rawBody = await req.text()

  // ── Signature verification ─────────────────────────────────────────────
  // If MERCADOPAGO_WEBHOOK_SECRET is configured, the header is REQUIRED.
  // Skipping verification when the secret is set would allow anyone to
  // forge a subscription-upgrade by omitting the x-signature header.
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (webhookSecret) {
    if (!xSignature) {
      console.warn('[MP Webhook] Missing x-signature header (MERCADOPAGO_WEBHOOK_SECRET is configured)')
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }
    const tsMatch = xSignature.match(/ts=([^,]+)/)
    const ts = tsMatch?.[1] ?? ''
    if (!verifyWebhookSignature(rawBody, xSignature, xRequestId, dataId, ts)) {
      console.warn('[MP Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else {
    console.warn('[MP Webhook] MERCADOPAGO_WEBHOOK_SECRET not configured — signature verification skipped')
  }

  try {
    const normalized = await fetchAndNormalizePreapproval(dataId)

    if (!normalized) {
      console.warn('[MP Webhook] Could not normalize preapproval:', dataId)
      return NextResponse.json({ received: true })
    }

    // Resolve userId: prefer external_reference, fall back to email lookup
    let resolvedUserId = normalized.userId
    if (!resolvedUserId && normalized.gatewayCustomerId) {
      const email = normalized.gatewayCustomerId
      const user = await db.user.findFirst({ where: { email }, select: { id: true } })
      if (user) resolvedUserId = user.id
    }

    if (!resolvedUserId) {
      console.warn('[MP Webhook] Could not resolve userId for preapproval:', dataId)
      return NextResponse.json({ received: true })
    }

    normalized.userId = resolvedUserId

    const plan = planIdToEnum(normalized.planId!)

    await db.subscription.upsert({
      where: { userId: resolvedUserId },
      update: {
        plan,
        status:            normalized.status ?? 'active',
        billingCycle:      normalized.billingCycle ?? 'monthly',
        gateway:           'MERCADOPAGO',
        gatewaySubId:      normalized.gatewaySubId       ?? null,
        gatewayCustomerId: normalized.gatewayCustomerId  ?? null,
        currency:          'ARS',
        currentPeriodEnd:  normalized.currentPeriodEnd  ?? null,
      },
      create: {
        userId:            normalized.userId,
        plan,
        status:            normalized.status ?? 'active',
        billingCycle:      normalized.billingCycle ?? 'monthly',
        gateway:           'MERCADOPAGO',
        gatewaySubId:      normalized.gatewaySubId       ?? null,
        gatewayCustomerId: normalized.gatewayCustomerId  ?? null,
        currency:          'ARS',
        currentPeriodEnd:  normalized.currentPeriodEnd  ?? null,
      },
    })

    console.log(`[MP Webhook] ✅ ${normalized.planId} ${normalized.status} for user ${normalized.userId}`)
    void trackFunnelEvent('payment', { userId: normalized.userId, plan: normalized.planId, gateway: 'mercadopago' })
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[MP Webhook] Error processing notification:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }
}
