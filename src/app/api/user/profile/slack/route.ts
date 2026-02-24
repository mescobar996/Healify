import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

// GET /api/user/profile/slack
// Retorna el slackWebhookUrl del usuario para pre-rellenar el input en Settings
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: { slackWebhookUrl: true },
        })

        return NextResponse.json({ slackWebhookUrl: user?.slackWebhookUrl ?? null })
    } catch (error) {
        console.error('Error fetching slack webhook:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
