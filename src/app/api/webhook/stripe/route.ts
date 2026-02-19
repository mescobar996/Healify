import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { Plan } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-01-27' as any,
})

export async function POST(request: Request) {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            const userId = session.metadata?.userId
            const customerId = session.customer as string
            const subscriptionId = session.subscription as string

            if (userId) {
                // Get subscription details
                const subscription = await stripe.subscriptions.retrieve(subscriptionId)
                const priceId = subscription.items.data[0].price.id

                // Map priceId to Plan enum
                let plan: Plan = Plan.FREE
                if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = Plan.STARTER
                if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = Plan.PRO
                if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) plan = Plan.ENTERPRISE

                await db.subscription.upsert({
                    where: { userId },
                    update: {
                        stripeCustomerId: customerId,
                        stripePriceId: priceId,
                        plan,
                        status: subscription.status,
                        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    },
                    create: {
                        userId,
                        stripeCustomerId: customerId,
                        stripePriceId: priceId,
                        plan,
                        status: subscription.status,
                        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    },
                })
            }
            break
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription
            const customerId = subscription.customer as string

            const subInDb = await db.subscription.findFirst({
                where: { stripeCustomerId: customerId }
            })

            if (subInDb) {
                await db.subscription.update({
                    where: { id: subInDb.id },
                    data: {
                        status: subscription.status,
                        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    },
                })
            }
            break
        }
    }

    return NextResponse.json({ received: true })
}
