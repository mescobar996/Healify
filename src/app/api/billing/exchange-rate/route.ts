/**
 * GET /api/billing/exchange-rate
 *
 * Returns the current USD → ARS exchange rate for the pricing page.
 * Response: { rate: number, source: 'api' | 'cache' | 'fallback', updatedAt: string | null }
 *
 * No auth required — public endpoint for pricing page display.
 * Cache-Control: 15 minutes (matches Redis TTL).
 */

import { NextResponse } from 'next/server'
import { getUsdToArsRate } from '@/lib/payment/exchange-rate'

export async function GET() {
  try {
    const rate = await getUsdToArsRate()
    return NextResponse.json(
      { rate, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[/api/billing/exchange-rate]', message)
    return NextResponse.json(
      { rate: 1050, updatedAt: null },
      { status: 200 },
    )
  }
}
