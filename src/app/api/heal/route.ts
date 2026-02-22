import { NextRequest, NextResponse } from 'next/server'
import { analyzeAndHeal, HealRequestSchema } from '@/lib/engine/healing-engine'

/**
 * POST /api/heal
 * 
 * Endpoint principal para analizar y curar selectores fallidos.
 * 
 * Request Body:
 * - selector: string (required) - El selector que falló
 * - htmlContext: string (optional) - Contexto HTML del elemento
 * - testName: string (optional) - Nombre del test
 * - errorMessage: string (optional) - Mensaje de error del fallo
 * 
 * Response:
 * - fixedSelector: string - Selector propuesto
 * - confidence: number (0-1) - Nivel de confianza
 * - explanation: string - Explicación del cambio
 * - selectorType: enum - Tipo de selector
 * - alternatives: array - Selectores alternativos
 * - needsReview: boolean - Si requiere revisión humana
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar entrada con Zod
    const validationResult = HealRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const healRequest = validationResult.data

    // Ejecutar motor de curación
    const result = await analyzeAndHeal(healRequest)

    // Log para debugging (en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Heal API] Request:', healRequest)
      console.log('[Heal API] Result:', result)
    }

    // Retornar resultado
    return NextResponse.json({
      success: true,
      data: result,
    })

  } catch (error) {
    console.error('[Heal API] Error:', error)

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/heal
 * 
 * Endpoint de información sobre el motor de curación
 */
export async function GET() {
  return NextResponse.json({
    name: 'Healify Healing Engine',
    version: '1.0.0',
    description: 'AI-powered selector healing engine',
    capabilities: [
      'CSS selector analysis',
      'TestID pattern detection',
      'Semantic selector generation',
      'Confidence scoring',
      'Alternative suggestions',
    ],
    supportedSelectorTypes: [
      'CSS',
      'XPATH',
      'TESTID',
      'ROLE',
      'TEXT',
    ],
    confidenceThreshold: 0.70,
  })
}