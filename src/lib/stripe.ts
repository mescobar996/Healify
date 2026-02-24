import Stripe from 'stripe'

// ═══════════════════════════════════════════════════════════════════════
// REGLA DE ORO: NUNCA instanciar Stripe a nivel de módulo.
// Next.js ejecuta ese código en BUILD TIME — la key aún no existe.
// Usar siempre getStripe() dentro de funciones/handlers.
// ═══════════════════════════════════════════════════════════════════════

export function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key || key.includes('mock')) {
        throw new Error('[Stripe] STRIPE_SECRET_KEY no configurada o inválida')
    }
    return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

export const PLANS = {
    STARTER: {
        id: 'starter',
        name: 'Starter',
        price: 49,
        get priceId() { return process.env.STRIPE_STARTER_PRICE_ID || '' },
        features: ['5 Projects', '100 Test Runs/mo', 'Email Support'],
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 99,
        get priceId() { return process.env.STRIPE_PRO_PRICE_ID || '' },
        features: ['Unlimited Projects', '1,000 Test Runs/mo', 'Priority Support', 'Custom Selectors'],
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499,
        get priceId() { return process.env.STRIPE_ENTERPRISE_PRICE_ID || '' },
        features: ['Custom Limits', 'Dedicated Support', 'SSO & Audit Logs', 'On-premise option'],
    },
}

export async function createCheckoutSession(userId: string, email: string, priceId: string) {
    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://healify-sigma.vercel.app'
    const session = await stripe.checkout.sessions.create({
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/dashboard/upgrade-success?plan=${priceId}`,
        cancel_url: `${appUrl}/pricing?canceled=true`,
        metadata: { userId },
    })
    return session
}

export async function createPortalSession(customerId: string) {
    const stripe = getStripe()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://healify-sigma.vercel.app'
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/dashboard`,
    })
    return session
}
