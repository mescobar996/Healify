/**
 * Shared types for the payment abstraction layer.
 * Both LemonSqueezy and MercadoPago implement the same interface.
 */

export type PlanId = 'starter' | 'pro' | 'enterprise'
export type Currency = 'USD' | 'ARS'
export type GatewayId = 'lemonsqueezy' | 'mercadopago' | 'stripe'

export interface PlanMeta {
  id: PlanId
  name: string
  priceUsd: number      // e.g. 49
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  starter:    { id: 'starter',    name: 'Starter',    priceUsd: 49  },
  pro:        { id: 'pro',        name: 'Pro',         priceUsd: 99  },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceUsd: 499 },
}

/** Result returned by createCheckoutSession on both gateways */
export interface CheckoutResult {
  url: string
  gatewaySubId?: string
}

/** Result returned by getPortalUrl on both gateways */
export interface PortalResult {
  url: string
}

/** Normalized subscription data after a webhook */
export interface NormalizedSubscription {
  userId: string
  planId: PlanId
  gateway: GatewayId
  gatewaySubId: string
  gatewayCustomerId: string
  currency: Currency
  status: 'active' | 'canceled' | 'past_due' | 'pending'
  currentPeriodEnd: Date | null
}
