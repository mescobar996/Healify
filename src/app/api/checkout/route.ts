import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// Whitelist de priceIds válidos leída en RUNTIME (no en build time)
// CRÍTICO: no importar PLANS desde lib/stripe — cachea process.env en build time
function getValidPriceIds(): Set<string> {
    const ids = [
        process.env.STRIPE_STARTER_PRICE_ID,
        process.env.STRIPE_PRO_PRICE_ID,
        process.env.STRIPE_ENTERPRISE_PRICE_ID,
    ].filter((id): id is string => !!id && !id.includes('mock'))
    return new Set(ids)
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verificar que Stripe esté configurado
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('mock')) {
            return NextResponse.json({ notConfigured: true }, { status: 200 })
        }

        const { priceId } = await request.json()

        // Validar que el priceId sea real (leído en runtime)
        const validIds = getValidPriceIds()
        if (!priceId || typeof priceId !== 'string' || !validIds.has(priceId)) {
            console.error('[checkout] Invalid priceId:', priceId, 'Valid:', [...validIds])
            return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
        }

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
