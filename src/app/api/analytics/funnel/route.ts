import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { trackFunnelEvent, getFunnelCounts } from '@/lib/funnel-analytics'
import { getSessionUser } from '@/lib/auth/session'
import { publicRateLimit } from '@/lib/http-rate-limiter'

const PostSchema = z.object({
  event: z.enum(['landing_view', 'signup_start', 'activation', 'payment']),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

// POST /api/analytics/funnel — track a client-side funnel event (public, rate-limited)
export async function POST(request: NextRequest) {
  try {
    // Rate limit: prevent data-poisoning abuse
    const rl = await publicRateLimit(request)
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429 })
    }

    const body = PostSchema.parse(await request.json())
    await trackFunnelEvent(body.event, body.metadata)
    return NextResponse.json({ ok: true })
  } catch {
    // Return 200 even on validation errors — analytics must never break the UI
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

// GET /api/analytics/funnel?days=30 — admin-only funnel summary
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || '30')))

    const since = new Date()
    since.setDate(since.getDate() - days)

    const counts = await getFunnelCounts(since)

    const landingToSignup    = counts.landing_view  > 0 ? Number(((counts.signup_start / counts.landing_view)  * 100).toFixed(1)) : 0
    const signupToActivation = counts.signup_start  > 0 ? Number(((counts.activation   / counts.signup_start)  * 100).toFixed(1)) : 0
    const activationToPayment = counts.activation   > 0 ? Number(((counts.payment      / counts.activation)    * 100).toFixed(1)) : 0

    return NextResponse.json({
      days,
      counts,
      conversionRates: {
        landing_to_signup_pct:      landingToSignup,
        signup_to_activation_pct:   signupToActivation,
        activation_to_payment_pct:  activationToPayment,
      },
    })
  } catch (error) {
    console.error('[funnel] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
