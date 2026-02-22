import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { dashboardService } from '@/lib/dashboard-service'

/**
 * GET /api/healing-events/[id]/diff
 * 
 * Endpoint optimizado para el Diff Viewer del frontend.
 * Devuelve todos los datos necesarios para mostrar el diff visual:
 * - Información del test
 * - Selectores viejo/nuevo
 * - Snapshots del DOM
 * - Razonamiento de la IA
 * - Información del branch/commit
 * 
 * Response:
 * {
 *   id: string,
 *   testName: string,
 *   testFile: string,
 *   status: 'curado' | 'fallido' | 'pendiente',
 *   confidence: number,
 *   timestamp: string,
 *   errorMessage: string,
 *   oldSelector: string,
 *   newSelector: string | null,
 *   oldDomSnapshot: string | null,
 *   newDomSnapshot: string | null,
 *   reasoning: string | null,
 *   branch: string | null,
 *   commitSha: string | null
 * }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Debes iniciar sesión para ver este evento' },
        { status: 401 }
      )
    }

    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'ID del evento requerido' },
        { status: 400 }
      )
    }

    const diffData = await dashboardService.getHealingDiff(id, session.user.id)
    
    if (!diffData) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Evento de curación no encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(diffData)
  } catch (error) {
    console.error('Error fetching healing diff:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error',
        message: 'Error al obtener los datos del evento de curación'
      },
      { status: 500 }
    )
  }
}
