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

        const body = await request.json()
        const { name, slackWebhookUrl } = body

        if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
            return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
        }

        if (slackWebhookUrl && !slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
            return NextResponse.json({ error: 'URL de Slack inválida. Debe ser un Incoming Webhook.' }, { status: 400 })
        }

        const updateData: { name?: string; slackWebhookUrl?: string | null } = {}
        if (name !== undefined)             updateData.name = name.trim().slice(0, 100)
        if (slackWebhookUrl !== undefined)  updateData.slackWebhookUrl = slackWebhookUrl || null

        await db.user.update({ where: { id: session.user.id }, data: updateData })

        return NextResponse.json({ success: true, ...updateData })
    } catch (error) {
        console.error('Error updating user profile:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
