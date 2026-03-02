import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Plan } from '@/lib/enums'

// GET /api/user/subscription
// Retorna el plan actual del usuario — usado por /upgrade-success para polling
export async function GET() {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const subscription = await db.subscription.findUnique({
            where: { userId: user.id },
        })

        if (!subscription) {
            return NextResponse.json({
                plan: Plan.FREE,
                status: 'active',
                currentPeriodEnd: null,
            })
        }

        return NextResponse.json({
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
        })
    } catch (error) {
        console.error('Error fetching subscription:', error)
        return NextResponse.json(
            { error: 'Failed to fetch subscription' },
            { status: 500 }
        )
    }
}
