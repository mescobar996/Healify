import { db } from '@/lib/db'

// ─── Funnel event types ────────────────────────────────────────────────────
// landing_view  → user lands on the marketing page
// signup_start  → user clicks "Get Started" / "Sign In" on the landing
// activation    → user creates an account (first login)
// payment       → user completes a paid subscription
export type FunnelEvent = 'landing_view' | 'signup_start' | 'activation' | 'payment'

/**
 * Fire-and-forget funnel event tracking.
 * Stores events in AnalyticsEvent table prefixed with "funnel:".
 * Never throws — failures are silently swallowed so they can't block requests.
 */
export async function trackFunnelEvent(
  event: FunnelEvent,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        eventType: `funnel:${event}`,
        metadata: JSON.stringify({ ...metadata, ts: Date.now() }),
      },
    })
  } catch {
    // fire-and-forget — never block the caller
  }
}

/**
 * Aggregate funnel counts for a given time window.
 * Used by /api/analytics/funnel and the conversion report.
 */
export async function getFunnelCounts(sinceDate: Date): Promise<{
  landing_view: number
  signup_start: number
  activation: number
  payment: number
}> {
  const rows = await db.analyticsEvent.groupBy({
    by: ['eventType'],
    where: {
      eventType: { in: ['funnel:landing_view', 'funnel:signup_start', 'funnel:activation', 'funnel:payment'] },
      createdAt: { gte: sinceDate },
    },
    _count: { eventType: true },
  })

  const map = Object.fromEntries(
    rows.map((r) => [r.eventType.replace('funnel:', ''), r._count.eventType])
  )

  return {
    landing_view: map['landing_view'] ?? 0,
    signup_start: map['signup_start'] ?? 0,
    activation:   map['activation']   ?? 0,
    payment:      map['payment']      ?? 0,
  }
}
