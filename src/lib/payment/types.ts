/**
 * Shared types for the payment abstraction layer.
 * MercadoPago (ARS) is the active payment gateway.
 */

export type PlanId = 'starter' | 'pro' | 'enterprise'
export type Currency = 'USD' | 'ARS'
export type GatewayId = 'mercadopago' | 'stripe'
export type BillingCycle = 'monthly' | 'annual'

// Annual = 10 months price (2 months free, ~17% savings)
export const ANNUAL_DISCOUNT_MONTHS = 10

export interface PlanMeta {
  id: PlanId
  name: string
  priceUsd: number          // e.g. 49 (monthly)
  annualPriceUsd: number    // e.g. 490 (10 months billed once a year)
  annualMonthlyUsd: number  // e.g. 40.83 (annual / 12, for display)
}

export const PLAN_META: Record<PlanId, PlanMeta> = {
  starter:    { id: 'starter',    name: 'Starter',    priceUsd: 49,  annualPriceUsd: 490,  annualMonthlyUsd: 40.83 },
  pro:        { id: 'pro',        name: 'Pro',         priceUsd: 99,  annualPriceUsd: 990,  annualMonthlyUsd: 82.50 },
  enterprise: { id: 'enterprise', name: 'Enterprise', priceUsd: 499, annualPriceUsd: 4990, annualMonthlyUsd: 415.83 },
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
  billingCycle: BillingCycle
  status: 'active' | 'canceled' | 'past_due' | 'pending'
  currentPeriodEnd: Date | null
}
