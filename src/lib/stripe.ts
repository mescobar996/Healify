import Stripe from 'stripe'

// ── CRÍTICO: Lazy initialization ────────────────────────────────────────────
// NO inicializar Stripe a nivel de módulo — Next.js lo ejecuta en BUILD TIME
// y cachea el cliente con la key que había en ese momento (puede ser mock).
// getStripe() crea el cliente en cada llamada usando process.env en runtime.
function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key || key.includes('mock')) {
        throw new Error('STRIPE_SECRET_KEY no está configurada o es inválida')
    }
    return new Stripe(key, { apiVersion: '2025-01-27' as any })
}

// PLANS se exporta solo para referencia de nombres/precios en UI server-side
// Los priceIds se leen siempre directamente de process.env en los handlers
export const PLANS = {
    STARTER: {
        id: 'starter',
        name: 'Starter',
        price: 49,
        get priceId() { return process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_mock' },
        features: ['5 Projects', '100 Test Runs/mo', 'Email Support'],
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 99,
        get priceId() { return process.env.STRIPE_PRO_PRICE_ID || 'price_pro_mock' },
        features: ['Unlimited Projects', '1,000 Test Runs/mo', 'Priority Support', 'Custom Selectors'],
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499,
        get priceId() { return process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_mock' },
        features: ['Custom Limits', 'Dedicated Support', 'SSO & Audit Logs', 'On-premise option'],
    }
}

export async function createCheckoutSession(userId: string, email: string, priceId: string) {
    const stripe = getStripe() // ← lee la key en runtime, no en build time
    const session = await stripe.checkout.sessions.create({
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/upgrade-success?plan=${priceId}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        metadata: { userId },
    })
    return session
}

export async function createPortalSession(customerId: string) {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })
    return session
}
