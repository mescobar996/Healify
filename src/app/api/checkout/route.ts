import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { priceId } = await request.json()

        const stripeSession = await createCheckoutSession(
            session.user.id,
            session.user.email,
            priceId
        )

        return NextResponse.json({ url: stripeSession.url })
    } catch (error) {
        console.error('Error creating checkout session:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
