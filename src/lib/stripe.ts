import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock'
const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-01-27' as any,
})

export const PLANS = {
    STARTER: {
        id: 'starter',
        name: 'Starter',
        price: 49,
        priceId: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter_mock',
        features: ['5 Projects', '100 Test Runs/mo', 'Email Support'],
    },
    PRO: {
        id: 'pro',
        name: 'Pro',
        price: 99,
        priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_mock',
        features: ['Unlimited Projects', '1,000 Test Runs/mo', 'Priority Support', 'Custom Selectors'],
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 499,
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_mock',
        features: ['Custom Limits', 'Dedicated Support', 'SSO & Audit Logs', 'On-premise option'],
    }
}

export async function createCheckoutSession(userId: string, email: string, priceId: string) {
    const session = await stripe.checkout.sessions.create({
        customer_email: email,
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        metadata: {
            userId,
        },
    })

    return session
}

export async function createPortalSession(customerId: string) {
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return session
}
