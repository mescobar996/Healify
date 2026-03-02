import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { apiError } from '@/lib/api-response'

// GET /api/user/profile/slack
// Retorna el slackWebhookUrl del usuario para pre-rellenar el input en Settings
export async function GET(request: Request) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
        }

        const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { slackWebhookUrl: true },
        })

        return NextResponse.json({ slackWebhookUrl: dbUser?.slackWebhookUrl ?? null })
    } catch (error) {
        console.error('Error fetching slack webhook:', error)
        return apiError(request, 500, 'Internal Server Error', { code: 'USER_PROFILE_SLACK_FETCH_FAILED' })
    }
}
