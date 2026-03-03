/**
 * LemonSqueezy payments — USD subscriptions
 *
 * Environment variables required:
 *   LEMONSQUEEZY_API_KEY           — store API key (starts with "eyJ…")
 *   LEMONSQUEEZY_STORE_ID          — numeric store ID
 *   LEMONSQUEEZY_WEBHOOK_SECRET    — secret for webhook signature verification
 *   LEMONSQUEEZY_STARTER_VARIANT_ID
 *   LEMONSQUEEZY_PRO_VARIANT_ID
 *   LEMONSQUEEZY_ENTERPRISE_VARIANT_ID
 *
 * Docs: https://docs.lemonsqueezy.com/api
 */

import { createHmac, timingSafeEqual } from 'crypto'
import type { PlanId, CheckoutResult, NormalizedSubscription } from './types'
import { Plan } from '@/lib/enums'

const LS_API = 'https://api.lemonsqueezy.com/v1'

function getApiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY
  if (!key) throw new Error('[LemonSqueezy] LEMONSQUEEZY_API_KEY not set')
  return key
}

function headers() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
  }
}

function getVariantId(planId: PlanId): string {
  const map: Record<PlanId, string> = {
    starter:    process.env.LEMONSQUEEZY_STARTER_VARIANT_ID    || '',
    pro:        process.env.LEMONSQUEEZY_PRO_VARIANT_ID        || '',
    enterprise: process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID || '',
  }
  const id = map[planId]
  if (!id) throw new Error(`[LemonSqueezy] Variant ID not configured for plan: ${planId}`)
  return id
}

// ── Checkout ──────────────────────────────────────────────────────────────

export async function createCheckoutSession(params: {
  planId: PlanId
  userId: string
  email: string
}): Promise<CheckoutResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'
  const variantId = getVariantId(params.planId)
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  if (!storeId) throw new Error('[LemonSqueezy] LEMONSQUEEZY_STORE_ID not set')

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: params.email,
          custom: { userId: params.userId },
        },
        product_options: {
          redirect_url: `${appUrl}/dashboard/upgrade-success?plan=${params.planId}&gateway=lemonsqueezy`,
        },
        checkout_options: {
          embed: false,
          media: false,
          logo: true,
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  }

  const res = await fetch(`${LS_API}/checkouts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`[LemonSqueezy] Checkout creation failed ${res.status}: ${text}`)
  }

  const data = await res.json()
  const url = data?.data?.attributes?.url
  if (!url) throw new Error('[LemonSqueezy] No checkout URL in response')

  return { url }
}

// ── Customer portal ────────────────────────────────────────────────────────

export async function getPortalUrl(gatewayCustomerId: string): Promise<string> {
  // LS customer portal: retrieve customer to get portal URL
  const res = await fetch(`${LS_API}/customers/${gatewayCustomerId}`, {
    headers: headers(),
  })

  if (!res.ok) {
    // Fallback to LS dashboard
    return 'https://app.lemonsqueezy.com/my-orders'
  }

  const data = await res.json()
  const portalUrl = data?.data?.attributes?.urls?.customer_portal
  return portalUrl ?? 'https://app.lemonsqueezy.com/my-orders'
}

// ── Webhook ────────────────────────────────────────────────────────────────

/** Verify the X-Signature header from LemonSqueezy */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) return false

  try {
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex')
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

/** Map LS plan/variant ID to our Plan enum */
function variantToPlan(variantId: string | number): Plan {
  const id = String(variantId)
  if (id === (process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT_ID ?? ''))  return Plan.ENTERPRISE
  if (id === (process.env.LEMONSQUEEZY_PRO_VARIANT_ID ?? ''))         return Plan.PRO
  return Plan.STARTER
}

function planIdFromVariant(variantId: string | number): PlanId {
  const p = variantToPlan(variantId)
  if (p === Plan.ENTERPRISE) return 'enterprise'
  if (p === Plan.PRO)        return 'pro'
  return 'starter'
}

// ── Webhook event types we care about ─────────────────────────────────────

interface LsPayload {
  meta: {
    event_name: string
    custom_data?: { userId?: string }
  }
  data: {
    id: string
    attributes: {
      status: string
      variant_id?: number | string
      customer_id?: number | string
      user_email?: string
      renews_at?: string | null
      ends_at?: string | null
    }
  }
}

/** Parse a LS webhook payload into a normalized subscription update */
export function parseWebhookPayload(payload: LsPayload): Partial<NormalizedSubscription> | null {
  const { event_name, custom_data } = payload.meta
  const userId = custom_data?.userId
  const attr = payload.data.attributes

  const STATUS_MAP: Record<string, NormalizedSubscription['status']> = {
    active:        'active',
    past_due:      'past_due',
    unpaid:        'past_due',
    cancelled:     'canceled',
    expired:       'canceled',
    on_trial:      'active',
    paused:        'canceled',
  }

  const supportedEvents = [
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled',
    'subscription_expired',
    'subscription_resumed',
    'order_created',
  ]

  if (!supportedEvents.includes(event_name)) return null

  const variantId = attr.variant_id ?? ''
  const customerId = String(attr.customer_id ?? '')
  const periodEndRaw = attr.renews_at ?? attr.ends_at ?? null
  const periodEnd = periodEndRaw ? new Date(periodEndRaw) : null

  return {
    userId,
    planId:           planIdFromVariant(variantId),
    gateway:          'lemonsqueezy',
    gatewaySubId:     payload.data.id,
    gatewayCustomerId: customerId,
    currency:         'USD',
    status:           STATUS_MAP[attr.status] ?? 'active',
    currentPeriodEnd: periodEnd,
  }
}
