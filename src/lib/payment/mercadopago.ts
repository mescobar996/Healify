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
import type { PlanId, BillingCycle, CheckoutResult, NormalizedSubscription } from './types'
import { ANNUAL_DISCOUNT_MONTHS } from './types'
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

function getPlanId(planId: PlanId, cycle: BillingCycle = 'monthly'): string {
  const monthly: Record<PlanId, string> = {
    starter:    process.env.MERCADOPAGO_STARTER_PLAN_ID    || '',
    pro:        process.env.MERCADOPAGO_PRO_PLAN_ID        || '',
    enterprise: process.env.MERCADOPAGO_ENTERPRISE_PLAN_ID || '',
  }
  const annual: Record<PlanId, string> = {
    starter:    process.env.MERCADOPAGO_STARTER_ANNUAL_PLAN_ID    || '',
    pro:        process.env.MERCADOPAGO_PRO_ANNUAL_PLAN_ID        || '',
    enterprise: process.env.MERCADOPAGO_ENTERPRISE_ANNUAL_PLAN_ID || '',
  }
  const map = cycle === 'annual' ? annual : monthly
  const id = map[planId]
  if (!id) {
    if (cycle === 'annual') {
      // Graceful fallback: redirect to monthly plan if annual not yet configured
      console.warn(`[MercadoPago] Annual plan ID not configured for ${planId}, falling back to monthly`)
      return getPlanId(planId, 'monthly')
    }
    throw new Error(`[MercadoPago] Plan ID not configured for: ${planId}. Run setup first.`)
  }
  return id
}

// ── Plans setup (run once) ─────────────────────────────────────────────────

const PLAN_PRICES_USD: Record<PlanId, number> = {
  starter:    49,
  pro:        99,
  enterprise: 499,
}

/** Create a preapproval_plan in MercadoPago. Call this once per plan. */
export async function createMpPlan(
  planId: PlanId,
  cycle: BillingCycle = 'monthly',
): Promise<{ id: string; initPoint: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'

  // Annual = 10 months price billed once every 12 months
  const priceMultiplier = cycle === 'annual' ? ANNUAL_DISCOUNT_MONTHS : 1
  const billingFrequency = cycle === 'annual' ? 12 : 1
  const priceArs = await usdToArs(PLAN_PRICES_USD[planId] * priceMultiplier)

  const names: Record<PlanId, string> = {
    starter: 'Healify Starter',
    pro: 'Healify Pro',
    enterprise: 'Healify Enterprise',
  }
  const suffix = cycle === 'annual' ? ' (Anual)' : ''

  const body = {
    reason: `${names[planId]}${suffix}`,
    auto_recurring: {
      frequency:          billingFrequency,
      frequency_type:     'months',
      transaction_amount: priceArs,
      currency_id:        'ARS',
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
  billingCycle?: BillingCycle
}): Promise<CheckoutResult> {
  const cycle = params.billingCycle ?? 'monthly'
  const mpPlanId = getPlanId(params.planId, cycle)

  // Fetch the preapproval_plan to get its init_point (subscription page URL).
  // This avoids POST /preapproval which requires card_token_id.
  // The user is redirected to init_point where they enter their card details.
  const res = await fetch(`${MP_API}/preapproval_plan/${mpPlanId}`, {
    headers: headers(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[MercadoPago] Failed to fetch plan ${res.status}: ${text}`)
  }

  const data = await res.json()
  const url = data?.init_point
  if (!url) throw new Error('[MercadoPago] No init_point in plan response')

  // Pre-fill payer email and set external_reference (userId) so webhook can identify the user.
  // Encode billingCycle alongside userId so the webhook can store it.
  // MP honors these query params on the subscription init_point.
  const checkoutUrl = new URL(url)
  checkoutUrl.searchParams.set('payer_email', params.email)
  checkoutUrl.searchParams.set('external_reference', `${params.userId}:${cycle}`)

  return { url: checkoutUrl.toString(), gatewaySubId: '' }
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
  // Check annual plan IDs first (more specific)
  if (mpPlanId && mpPlanId === (process.env.MERCADOPAGO_ENTERPRISE_ANNUAL_PLAN_ID ?? '__')) return 'enterprise'
  if (mpPlanId && mpPlanId === (process.env.MERCADOPAGO_PRO_ANNUAL_PLAN_ID ?? '__'))        return 'pro'
  if (mpPlanId && mpPlanId === (process.env.MERCADOPAGO_STARTER_ANNUAL_PLAN_ID ?? '__'))    return 'starter'
  // Monthly plan IDs
  if (mpPlanId === (process.env.MERCADOPAGO_ENTERPRISE_PLAN_ID ?? '')) return 'enterprise'
  if (mpPlanId === (process.env.MERCADOPAGO_PRO_PLAN_ID ?? ''))        return 'pro'
  return 'starter'
}

function cycleFromMpPlanId(mpPlanId: string): BillingCycle {
  const annualIds = [
    process.env.MERCADOPAGO_STARTER_ANNUAL_PLAN_ID,
    process.env.MERCADOPAGO_PRO_ANNUAL_PLAN_ID,
    process.env.MERCADOPAGO_ENTERPRISE_ANNUAL_PLAN_ID,
  ].filter(Boolean)
  return annualIds.includes(mpPlanId) ? 'annual' : 'monthly'
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

  // external_reference is encoded as "userId:billingCycle" (or plain userId for legacy)
  const rawRef: string = data.external_reference ?? ''
  const [userId, cyclePart] = rawRef.split(':')
  const billingCycle: BillingCycle = cyclePart === 'annual' ? 'annual' : 'monthly'

  const mpPlanId: string = data.preapproval_plan_id ?? ''
  const nextPaymentDate: string | null = data.next_payment_date ?? null

  return {
    userId:            userId || undefined,
    planId:            planFromMpPlanId(mpPlanId),
    gateway:           'mercadopago',
    gatewaySubId:      preapprovalId,
    gatewayCustomerId: data.payer_email ?? String(data.payer_id ?? ''),
    currency:          'ARS',
    billingCycle,
    status:            statusFromMp(data.status),
    currentPeriodEnd:  nextPaymentDate ? new Date(nextPaymentDate) : null,
  }
}
