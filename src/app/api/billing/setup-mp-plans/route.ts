/**
 * POST /api/billing/setup-mp-plans
 *
 * Crea los 3 preapproval_plans en MercadoPago (una sola vez).
 * Protegido por CRON_SECRET para evitar abuso.
 *
 * Uso:
 *   curl -X POST https://tu-dominio/api/billing/setup-mp-plans \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 *
 * Respuesta:
 *   { starter: "...", pro: "...", enterprise: "..." }
 *   → Copiar esos IDs a las env vars MERCADOPAGO_*_PLAN_ID en Railway.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createMpPlan } from '@/lib/payment/mercadopago'
import type { PlanId } from '@/lib/payment/types'

export async function POST(req: NextRequest) {
  // Auth: same CRON_SECRET used by the cron dispatcher
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const plans: PlanId[] = ['starter', 'pro', 'enterprise']

  const monthly: Record<string, { id: string; initPoint: string }> = {}
  const annual:  Record<string, { id: string; initPoint: string }> = {}
  const errors:  Record<string, string> = {}

  for (const planId of plans) {
    try {
      monthly[planId] = await createMpPlan(planId, 'monthly')
    } catch (err) {
      errors[`${planId}_monthly`] = err instanceof Error ? err.message : String(err)
    }
    try {
      annual[planId] = await createMpPlan(planId, 'annual')
    } catch (err) {
      errors[`${planId}_annual`] = err instanceof Error ? err.message : String(err)
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return NextResponse.json(
    {
      ok: !hasErrors,
      monthly,
      annual,
      errors: hasErrors ? errors : undefined,
      next: [
        '── Monthly plans ──────────────────────────────────────────',
        `  MERCADOPAGO_STARTER_PLAN_ID    = ${monthly.starter?.id ?? '<error>'}`,
        `  MERCADOPAGO_PRO_PLAN_ID        = ${monthly.pro?.id ?? '<error>'}`,
        `  MERCADOPAGO_ENTERPRISE_PLAN_ID = ${monthly.enterprise?.id ?? '<error>'}`,
        '── Annual plans ───────────────────────────────────────────',
        `  MERCADOPAGO_STARTER_ANNUAL_PLAN_ID    = ${annual.starter?.id ?? '<error>'}`,
        `  MERCADOPAGO_PRO_ANNUAL_PLAN_ID        = ${annual.pro?.id ?? '<error>'}`,
        `  MERCADOPAGO_ENTERPRISE_ANNUAL_PLAN_ID = ${annual.enterprise?.id ?? '<error>'}`,
        'Agregá todas estas variables en Railway + Vercel y hacé redeploy.',
      ],
    },
    { status: hasErrors ? 207 : 200 },
  )
}
