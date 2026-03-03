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
  const results: Record<string, { id: string; initPoint: string }> = {}
  const errors: Record<string, string> = {}

  for (const planId of plans) {
    try {
      results[planId] = await createMpPlan(planId)
    } catch (err) {
      errors[planId] = err instanceof Error ? err.message : String(err)
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return NextResponse.json(
    {
      ok: !hasErrors,
      plans: results,
      errors: hasErrors ? errors : undefined,
      next: [
        'Copiá los IDs a Railway como variables de entorno:',
        `  MERCADOPAGO_STARTER_PLAN_ID    = ${results.starter?.id ?? '<error>'}`,
        `  MERCADOPAGO_PRO_PLAN_ID        = ${results.pro?.id ?? '<error>'}`,
        `  MERCADOPAGO_ENTERPRISE_PLAN_ID = ${results.enterprise?.id ?? '<error>'}`,
        'Luego hace un redeploy en Railway para que tomen efecto.',
      ],
    },
    { status: hasErrors ? 207 : 200 },
  )
}
