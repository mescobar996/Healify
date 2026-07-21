/**
 * HEALIFY — API v1 Report Endpoint (modo nube, minimalista)
 *
 * Endpoint sin estado: valida una API key compartida (env var, sin base de
 * datos), corre el mismo motor heurístico que el modo local y devuelve la
 * sugerencia. No persiste nada, no dispara PRs, no manda notificaciones —
 * esas funciones vivían en el SaaS completo, archivado en la rama
 * `archive/saas-full`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeAndHeal } from '@/lib/engine/healing-engine'
import { z } from 'zod'

const ReportSchema = z.object({
  testName: z.string().min(1),
  testFile: z.string().optional(),
  selector: z.string().min(1),
  error: z.string().min(1),
  context: z.string().optional(),
  selectorType: z.enum(['CSS', 'XPATH', 'TESTID', 'ROLE', 'TEXT', 'UNKNOWN']).optional(),
  branch: z.string().optional(),
  commitSha: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const expectedKey = process.env.HEALIFY_API_KEY
  const providedKey = request.headers.get('x-api-key')

  if (!expectedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: z.infer<typeof ReportSchema>
  try {
    payload = ReportSchema.parse(await request.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = await analyzeAndHeal({
    selector: payload.selector,
    htmlContext: payload.context,
    testName: payload.testName,
    errorMessage: payload.error,
  })

  return NextResponse.json({
    success: true,
    result: {
      fixedSelector: result.fixedSelector,
      confidence: result.confidence,
      selectorType: result.selectorType,
      explanation: result.explanation,
      needsReview: result.needsReview,
      alternatives: result.alternatives ?? [],
    },
  })
}
