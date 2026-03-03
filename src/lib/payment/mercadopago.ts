/**
 * MercadoPago payments — ARS subscriptions (Argentina)
 *
 * Uses the Preapproval (subscriptions) API.
 *
 * Environment variables required:
 *   MERCADOPAGO_ACCESS_TOKEN       — production/sandbox access token
 *   MERCADOPAGO_WEBHOOK_SECRET     — for signature verification
 *   MERCADOPAGO_STARTER_PLAN_ID    — preapproval_plan ID for Starter
 *   MERCADOPAGO_PRO_PLAN_ID        — preapproval_plan ID for Pro
 *   MERCADOPAGO_ENTERPRISE_PLAN_ID — preapproval_plan ID for Enterprise
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/subscriptions
 *
 * Setup (one-time, run via `/api/billing/setup-mp-plans` or manually):
 *   POST https://api.mercadopago.com/preapproval_plan with plan details.
 *   Save returned IDs as env vars above.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { PlanId, CheckoutResult, NormalizedSubscription } from './types'
import { usdToArs } from './exchange-rate'
import { Plan } from '@/lib/enums'

const MP_API = 'https://api.mercadopago.com'

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('[MercadoPago] MERCADOPAGO_ACCESS_TOKEN not set')
  return token
}

function headers() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
  }
}

function getPlanId(planId: PlanId): string {
  const map: Record<PlanId, string> = {
    starter:    process.env.MERCADOPAGO_STARTER_PLAN_ID    || '',
    pro:        process.env.MERCADOPAGO_PRO_PLAN_ID        || '',
    enterprise: process.env.MERCADOPAGO_ENTERPRISE_PLAN_ID || '',
  }
  const id = map[planId]
  if (!id) throw new Error(`[MercadoPago] Plan ID not configured for: ${planId}. Run setup first.`)
  return id
}

// ── Plans setup (run once) ─────────────────────────────────────────────────

const PLAN_PRICES_USD: Record<PlanId, number> = {
  starter:    49,
  pro:        99,
  enterprise: 499,
}

/** Create a preapproval_plan in MercadoPago. Call this once per plan. */
export async function createMpPlan(planId: PlanId): Promise<{ id: string; initPoint: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'
  const priceArs = await usdToArs(PLAN_PRICES_USD[planId])
  const names: Record<PlanId, string> = {
    starter: 'Healify Starter',
    pro: 'Healify Pro',
    enterprise: 'Healify Enterprise',
  }

  const body = {
    reason: names[planId],
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: priceArs,
      currency_id: 'ARS',
    },
    back_url: `${appUrl}/pricing`,
    status: 'active',
  }

  const res = await fetch(`${MP_API}/preapproval_plan`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[MercadoPago] Failed to create plan ${res.status}: ${text}`)
  }

  const data = await res.json()
  return { id: data.id, initPoint: data.init_point }
}

// ── Checkout ──────────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  planId: PlanId
  userId: string
  email: string
}): Promise<CheckoutResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'
  const mpPlanId = getPlanId(params.planId)
  const priceArs = await usdToArs(PLAN_PRICES_USD[params.planId])

  const body = {
    preapproval_plan_id: mpPlanId,
    reason: `Healify ${params.planId}`,
    payer_email: params.email,
    external_reference: params.userId, // we use this in webhook to identify user
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: priceArs,
      currency_id: 'ARS',
    },
    back_url: `${appUrl}/dashboard/upgrade-success?plan=${params.planId}&gateway=mercadopago`,
    status: 'pending',
  }

  const res = await fetch(`${MP_API}/preapproval`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[MercadoPago] Checkout creation failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  const url = data?.init_point
  if (!url) throw new Error('[MercadoPago] No init_point in response')

  return { url, gatewaySubId: data.id }
}

// ── Customer portal ────────────────────────────────────────────────────────

export async function getPortalUrl(gatewaySubId: string): Promise<string> {
  // Retrieve the preapproval to get management URL
  const res = await fetch(`${MP_API}/preapproval/${gatewaySubId}`, {
    headers: headers(),
  })

  if (!res.ok) return 'https://www.mercadopago.com.ar/subscriptions'

  const data = await res.json()
  return data?.init_point ?? 'https://www.mercadopago.com.ar/subscriptions'
}

// ── Webhook ────────────────────────────────────────────────────────────────

/** Verify MercadoPago webhook signature (x-signature header) */
export function verifyWebhookSignature(
  rawBody: string,
  xSignature: string,
  xRequestId: string,
  dataId: string,
  ts: string,
): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return false

  try {
    // MP signature format: "ts=<ts>,v1=<hash>"
    const parts = xSignature.split(',').reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split('=')
      if (k && v) acc[k] = v
      return acc
    }, {})

    const receivedHash = parts['v1']
    if (!receivedHash) return false

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
    const digest = createHmac('sha256', secret).update(manifest).digest('hex')
    return timingSafeEqual(Buffer.from(digest), Buffer.from(receivedHash))
  } catch {
    return false
  }
}

// ── Plan mapping ────────────────────────────────────────────────────────────

function planFromMpPlanId(mpPlanId: string): PlanId {
  if (mpPlanId === (process.env.MERCADOPAGO_ENTERPRISE_PLAN_ID ?? '')) return 'enterprise'
  if (mpPlanId === (process.env.MERCADOPAGO_PRO_PLAN_ID ?? ''))        return 'pro'
  return 'starter'
}

function statusFromMp(mpStatus: string): NormalizedSubscription['status'] {
  const map: Record<string, NormalizedSubscription['status']> = {
    authorized:  'active',
    pending:     'pending',
    paused:      'canceled',
    cancelled:   'canceled',
    expired:     'canceled',
  }
  return map[mpStatus] ?? 'active'
}

/** Fetch preapproval details and return normalized subscription */
export async function fetchAndNormalizePreapproval(
  preapprovalId: string,
): Promise<Partial<NormalizedSubscription> | null> {
  const res = await fetch(`${MP_API}/preapproval/${preapprovalId}`, {
    headers: headers(),
  })

  if (!res.ok) return null

  const data = await res.json()

  const userId: string | undefined = data.external_reference
  const mpPlanId: string = data.preapproval_plan_id ?? ''
  const nextPaymentDate: string | null = data.next_payment_date ?? null

  return {
    userId,
    planId:            planFromMpPlanId(mpPlanId),
    gateway:           'mercadopago',
    gatewaySubId:      preapprovalId,
    gatewayCustomerId: data.payer_email ?? String(data.payer_id ?? ''),
    currency:          'ARS',
    status:            statusFromMp(data.status),
    currentPeriodEnd:  nextPaymentDate ? new Date(nextPaymentDate) : null,
  }
}
