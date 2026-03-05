import { NextResponse } from 'next/server'
import { PLAN_META, type PlanId } from '@/lib/payment/types'

// Features per plan (not part of PLAN_META since they're display-only)
const PLAN_FEATURES: Record<PlanId, string[]> = {
  starter:    ['5 Projects', '100 Test Runs/mo', 'Email Support'],
  pro:        ['Unlimited Projects', '1,000 Test Runs/mo', 'Priority Support', 'Custom Selectors'],
  enterprise: ['Custom Limits', 'Dedicated Support', 'SSO & Audit Logs', 'On-premise option'],
}

// GET /api/plans — runtime env var evaluation (reads at request time, not build time)
export async function GET() {
  const PRICE_ID_MAP: Record<PlanId, string | undefined> = {
    starter:    process.env.STRIPE_STARTER_PRICE_ID,
    pro:        process.env.STRIPE_PRO_PRICE_ID,
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
  }

  const plans = (Object.keys(PLAN_META) as PlanId[]).map((id) => {
    const meta = PLAN_META[id]
    const priceId = PRICE_ID_MAP[id] ?? null
    return {
      id: meta.id,
      name: meta.name,
      price: meta.priceUsd,
      annualPrice: meta.annualPriceUsd,
      annualMonthly: meta.annualMonthlyUsd,
      priceId,
      features: PLAN_FEATURES[id],
      configured: !!(priceId && !priceId.includes('mock')),
    }
  })

  const stripeConfigured = plans.some((p) => p.configured)
  return NextResponse.json({ plans, stripeConfigured })
}
