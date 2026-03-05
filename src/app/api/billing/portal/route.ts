/**
 * GET /api/billing/portal
 *
 * Returns { url: string } — the billing/subscription management URL for the
 * current user's active gateway: LemonSqueezy, MercadoPago, or Stripe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { getPortalUrl as mpPortal } from '@/lib/payment/mercadopago'
import Stripe from 'stripe'
import { billingRateLimit } from '@/lib/http-rate-limiter'

export async function GET(req: NextRequest) {
  // 10 req / min per IP
  const rl = await billingRateLimit(req)
  if (!rl.ok) return rl.response!
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const subscription = await db.subscription.findUnique({
      where: { userId: user.id },
    })

    if (!subscription) {
      return NextResponse.json({ url: '/pricing' })
    }

    const gateway = subscription.gateway

    // ── MercadoPago ────────────────────────────────────────────────────────
    if (gateway === 'MERCADOPAGO') {
      const url = await mpPortal(subscription.gatewaySubId ?? '')
      return NextResponse.json({ url })
    }

    // ── Stripe (legacy) ────────────────────────────────────────────────────
    if (gateway === 'STRIPE' || subscription.stripeCustomerId) {
      const stripeKey = process.env.STRIPE_SECRET_KEY
      if (!stripeKey) return NextResponse.json({ url: 'https://billing.stripe.com' })

      const stripe = new Stripe(stripeKey, { apiVersion: '2026-01-28.clover' })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healify-sigma.vercel.app'

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId!,
        return_url: `${appUrl}/dashboard`,
      })
      return NextResponse.json({ url: portalSession.url })
    }

    // No active gateway — send to pricing
    return NextResponse.json({ url: '/pricing' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/billing/portal]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
