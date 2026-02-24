import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db'
import { Plan } from '@/lib/enums'

// ═══════════════════════════════════════════════════════════════════════
// CRÍTICO: NO instanciar Stripe a nivel de módulo.
// getStripeWebhook() se llama dentro del handler, en runtime.
// ═══════════════════════════════════════════════════════════════════════
function getStripeWebhook(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('[Webhook] STRIPE_SECRET_KEY no configurada')
    return new Stripe(key, { apiVersion: '2026-01-28.clover' })
}

function getPeriodEnd(subscription: Stripe.Subscription): Date {
    const item = subscription.items.data[0]
    const ts = (item as unknown as { current_period_end?: number }).current_period_end
        ?? subscription.billing_cycle_anchor
    return new Date(ts * 1000)
}

export async function POST(request: Request) {
    const body = await request.text()
    const sig = request.headers.get('stripe-signature')

    if (!sig) {
        return NextResponse.json({ error: 'No stripe-signature header' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET no configurada')
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event: Stripe.Event
    try {
        const stripe = getStripeWebhook()
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err) {
        console.error('[Webhook] Signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                const userId = session.metadata?.userId
                const subscriptionId = session.subscription as string

                if (!userId || !subscriptionId) {
                    console.error('[Webhook] Missing userId or subscriptionId', { userId, subscriptionId })
                    break
                }

                const stripe = getStripeWebhook()
                const subscription = await stripe.subscriptions.retrieve(subscriptionId)
                const priceId = subscription.items.data[0]?.price?.id
                const periodEnd = getPeriodEnd(subscription)

                // Mapear priceId → Plan
                const planMap: Record<string, Plan> = {
                    [process.env.STRIPE_STARTER_PRICE_ID || '']: Plan.STARTER,
                    [process.env.STRIPE_PRO_PRICE_ID || '']: Plan.PRO,
                    [process.env.STRIPE_ENTERPRISE_PRICE_ID || '']: Plan.ENTERPRISE,
                }
                const plan = planMap[priceId] || Plan.STARTER

                await db.subscription.upsert({
                    where: { userId },
                    update: {
                        plan,
                        status: 'active',
                        stripeSubscriptionId: subscriptionId,
                        stripeCustomerId: session.customer as string,
                        currentPeriodEnd: periodEnd,
                    },
                    create: {
                        userId,
                        plan,
                        status: 'active',
                        stripeSubscriptionId: subscriptionId,
                        stripeCustomerId: session.customer as string,
                        currentPeriodEnd: periodEnd,
                    },
                })

                console.log(`[Webhook] ✅ Plan ${plan} activado para user ${userId}`)
                break
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription
                const userId = subscription.metadata?.userId

                if (!userId) break

                const priceId = subscription.items.data[0]?.price?.id
                const periodEnd = getPeriodEnd(subscription)
                const planMap: Record<string, Plan> = {
                    [process.env.STRIPE_STARTER_PRICE_ID || '']: Plan.STARTER,
                    [process.env.STRIPE_PRO_PRICE_ID || '']: Plan.PRO,
                    [process.env.STRIPE_ENTERPRISE_PRICE_ID || '']: Plan.ENTERPRISE,
                }
                const plan = planMap[priceId] || Plan.STARTER

                await db.subscription.update({
                    where: { userId },
                    data: { plan, status: subscription.status, currentPeriodEnd: periodEnd },
                })
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                const userId = subscription.metadata?.userId
                if (!userId) break

                await db.subscription.update({
                    where: { userId },
                    data: { plan: Plan.FREE, status: 'canceled' },
                })
                console.log(`[Webhook] Plan cancelado para user ${userId}`)
                break
            }

            default:
                console.log(`[Webhook] Evento no manejado: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('[Webhook] Error procesando evento:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
