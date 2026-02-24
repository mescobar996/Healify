import { NextResponse } from 'next/server'
import { createCheckoutSession, PLANS } from '@/lib/stripe'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

// ✅ HEAL-002 FIX: Whitelist de priceIds válidos para evitar manipulación de precios
const VALID_PRICE_IDS = new Set(
    Object.values(PLANS)
        .map((p) => p.priceId)
        .filter(Boolean) as string[]
)

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { priceId } = await request.json()

        // ✅ Validar que el priceId pertenezca a un plan real conocido
        if (!priceId || typeof priceId !== 'string' || !VALID_PRICE_IDS.has(priceId)) {
            return NextResponse.json(
                { error: 'Invalid plan selected' },
                { status: 400 }
            )
        }

        // ✅ Detectar mock keys en el servidor (no en el cliente)
        // Esto sucede cuando las env vars de Stripe no están configuradas en Vercel
        if (priceId.includes('mock')) {
            return NextResponse.json({ notConfigured: true }, { status: 200 })
        }

        // ✅ Verificar que la Stripe secret key no sea mock
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock') {
            return NextResponse.json({ notConfigured: true }, { status: 200 })
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
