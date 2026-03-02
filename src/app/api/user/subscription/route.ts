import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { Plan } from '@/lib/enums'
import { apiError } from '@/lib/api-response'

// GET /api/user/subscription
// Retorna el plan actual del usuario — usado por /upgrade-success para polling
export async function GET(request: Request) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
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
        return apiError(request, 500, 'Failed to fetch subscription', { code: 'SUBSCRIPTION_FETCH_FAILED' })
    }
}
