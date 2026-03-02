import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { apiError } from '@/lib/api-response'

// PATCH /api/user/profile — Actualizar nombre del usuario
// HEAL-008 FIX: Crear endpoint de perfil para que Settings pueda guardar cambios reales
export async function PATCH(request: Request) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
        }

        const body = await request.json()
        const { name, slackWebhookUrl } = body

        if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
            return apiError(request, 400, 'El nombre debe tener al menos 2 caracteres', { code: 'INVALID_NAME' })
        }

        if (slackWebhookUrl && !slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
            return apiError(request, 400, 'URL de Slack inválida. Debe ser un Incoming Webhook.', {
                code: 'INVALID_SLACK_WEBHOOK_URL',
            })
        }

        const updateData: { name?: string; slackWebhookUrl?: string | null } = {}
        if (name !== undefined)             updateData.name = name.trim().slice(0, 100)
        if (slackWebhookUrl !== undefined)  updateData.slackWebhookUrl = slackWebhookUrl || null

        await db.user.update({ where: { id: user.id }, data: updateData })

        return NextResponse.json({ success: true, ...updateData })
    } catch (error) {
        console.error('Error updating user profile:', error)
        return apiError(request, 500, 'Internal Server Error', { code: 'USER_PROFILE_UPDATE_FAILED' })
    }
}
