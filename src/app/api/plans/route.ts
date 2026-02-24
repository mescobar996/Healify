import { NextResponse } from 'next/server'
import { PLANS } from '@/lib/stripe'

// GET /api/plans
// Retorna los planes con los priceIds leídos en runtime desde las env vars del servidor.
// CRÍTICO: NO importar PLANS en el cliente ('use client') porque Next.js bundlea
// los valores de process.env en build time — si el build fue sin keys, quedan mock.
// Este endpoint se llama desde el cliente y siempre retorna los valores actuales.
export async function GET() {
    const plans = Object.values(PLANS).map(plan => ({
        id:       plan.id,
        name:     plan.name,
        price:    plan.price,
        priceId:  plan.priceId,
        features: plan.features,
        // Flag para que el cliente sepa si está configurado sin necesitar acceso a la key
        configured: !plan.priceId.includes('mock'),
    }))

    return NextResponse.json({ plans })
}
