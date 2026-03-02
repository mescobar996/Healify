import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

// GET /api/user/profile/slack
// Retorna el slackWebhookUrl del usuario para pre-rellenar el input en Settings
export async function GET() {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { slackWebhookUrl: true },
        })

        return NextResponse.json({ slackWebhookUrl: dbUser?.slackWebhookUrl ?? null })
    } catch (error) {
        console.error('Error fetching slack webhook:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
