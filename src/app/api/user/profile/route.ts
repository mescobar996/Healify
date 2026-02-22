import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

// PATCH /api/user/profile — Actualizar nombre del usuario
// HEAL-008 FIX: Crear endpoint de perfil para que Settings pueda guardar cambios reales
export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { name } = await request.json()

        // Validar input
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return NextResponse.json(
                { error: 'El nombre debe tener al menos 2 caracteres' },
                { status: 400 }
            )
        }

        // Truncar a 100 caracteres máximo
        const sanitizedName = name.trim().slice(0, 100)

        await db.user.update({
            where: { id: session.user.id },
            data: { name: sanitizedName },
        })

        return NextResponse.json({ success: true, name: sanitizedName })
    } catch (error) {
        console.error('Error updating user profile:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
