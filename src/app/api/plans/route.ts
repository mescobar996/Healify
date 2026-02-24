import { NextResponse } from 'next/server'

// GET /api/plans
// CRÍTICO: Lee env vars directamente en el handler, NO importa PLANS desde lib/stripe
// porque ese archivo cachea process.env en build time.
export async function GET() {
    const plans = [
        {
            id: 'starter',
            name: 'Starter',
            price: 49,
            priceId: process.env.STRIPE_STARTER_PRICE_ID || null,
            features: ['5 Projects', '100 Test Runs/mo', 'Email Support'],
            configured: !!(process.env.STRIPE_STARTER_PRICE_ID && !process.env.STRIPE_STARTER_PRICE_ID.includes('mock')),
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 99,
            priceId: process.env.STRIPE_PRO_PRICE_ID || null,
            features: ['Unlimited Projects', '1,000 Test Runs/mo', 'Priority Support', 'Custom Selectors'],
            configured: !!(process.env.STRIPE_PRO_PRICE_ID && !process.env.STRIPE_PRO_PRICE_ID.includes('mock')),
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 499,
            priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
            features: ['Custom Limits', 'Dedicated Support', 'SSO & Audit Logs', 'On-premise option'],
            configured: !!(process.env.STRIPE_ENTERPRISE_PRICE_ID && !process.env.STRIPE_ENTERPRISE_PRICE_ID.includes('mock')),
        },
    ]

    const stripeConfigured = plans.some(p => p.configured)

    return NextResponse.json({ plans, stripeConfigured })
}
