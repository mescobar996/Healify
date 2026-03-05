import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { publicRateLimit } from '@/lib/http-rate-limiter'

const WaitlistSchema = z.object({
  email: z.string().email('Email inválido'),
  name:  z.string().max(100).optional(),
  plan:  z.enum(['starter', 'pro', 'enterprise']).default('pro'),
  source: z.enum(['pricing', 'landing', 'docs']).default('pricing'),
})

// POST /api/waitlist — register interest
export async function POST(request: NextRequest) {
  try {
    // Centralized rate limit (works in serverless, unlike in-memory Map)
    const rl = await publicRateLimit(request)
    if (!rl.ok) return rl.response!

    const body = await request.json()
    const data = WaitlistSchema.parse(body)

    // Upsert — si ya existe, actualiza plan pero no falla
    const entry = await db.waitlistEntry.upsert({
      where:  { email: data.email },
      create: { email: data.email, name: data.name, plan: data.plan, source: data.source },
      update: { plan: data.plan, name: data.name ?? undefined },
    })

    // Send confirmation email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'Healify <noreply@healify.dev>',
          to: data.email,
          subject: '¡Estás en la lista de espera de Healify! 🎉',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0A0E1A;color:#E8F0FF;padding:32px;border-radius:12px">
              <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">¡Gracias${data.name ? ', ' + data.name.split(' ')[0] : ''}! 🎉</h1>
              <p style="color:#9CA3AF;margin:0 0 16px;line-height:1.6">
                Estás anotado en la lista de espera del plan <strong style="color:#7B5EF8;text-transform:capitalize">${data.plan}</strong> de Healify.
              </p>
              <p style="color:#9CA3AF;margin:0 0 24px;line-height:1.6">
                Te avisamos ni bien activemos los pagos. Mientras tanto, podés usar el plan gratuito y conectar tus primeros proyectos.
              </p>
              <a href="https://healify-sigma.vercel.app/dashboard"
                 style="display:inline-block;background:#7B5EF8;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
                Ir al dashboard →
              </a>
              <p style="color:#4A5568;font-size:12px;margin:32px 0 0">
                Si no te anotaste vos, ignorá este email.
              </p>
            </div>
          `,
        })

        // Day-3 follow-up: re-engagement
        const day3At = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
        await resend.emails.send({
          from: 'Healify <noreply@healify.dev>',
          to: data.email,
          subject: '¿Ya exploraste el dashboard de Healify? 🚀',
          scheduledAt: day3At,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0A0E1A;color:#E8F0FF;padding:32px;border-radius:12px">
              <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">¿Ya le diste una vuelta? 👀</h1>
              <p style="color:#9CA3AF;margin:0 0 16px;line-height:1.6">
                Hace 3 días te anotaste en la lista de espera de Healify. Si todavía no exploraste la demo, este es el momento.
              </p>
              <p style="color:#9CA3AF;margin:0 0 24px;line-height:1.6">
                Conectá un repo, corré tu primer test y mirá cómo la IA lo autocura. Es gratis, sin tarjeta.
              </p>
              <a href="https://healify-sigma.vercel.app/dashboard"
                 style="display:inline-block;background:#7B5EF8;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
                Ir al dashboard →
              </a>
              <p style="color:#4A5568;font-size:12px;margin:32px 0 0">Podés darte de baja respondiendo este email.</p>
            </div>
          `,
        })

        // Day-7 follow-up: plan reminder
        const day7At = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        await resend.emails.send({
          from: 'Healify <noreply@healify.dev>',
          to: data.email,
          subject: `Tu plan ${data.plan} en Healify te está esperando ⏳`,
          scheduledAt: day7At,
          html: `
            <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0A0E1A;color:#E8F0FF;padding:32px;border-radius:12px">
              <h1 style="font-size:22px;font-weight:700;margin:0 0 8px">Tu plan <span style="color:#7B5EF8;text-transform:capitalize">${data.plan}</span> viene pronto 🎯</h1>
              <p style="color:#9CA3AF;margin:0 0 16px;line-height:1.6">
                Esta semana abrimos los pagos para los primeros usuarios de la lista. Vas a ser de los primeros en enterarte.
              </p>
              <p style="color:#9CA3AF;margin:0 0 24px;line-height:1.6">
                Mientras tanto, usá el plan gratuito sin límite de tiempo.
              </p>
              <a href="https://healify-sigma.vercel.app/pricing"
                 style="display:inline-block;background:#7B5EF8;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
                Ver planes →
              </a>
              <p style="color:#4A5568;font-size:12px;margin:32px 0 0">Podés darte de baja respondiendo este email.</p>
            </div>
          `,
        })
      } catch (emailErr) {
        console.warn('[Waitlist] Email failed (non-fatal):', emailErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: '¡Te anotamos! Te avisamos cuando los pagos estén disponibles.',
      id: entry.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      )
    }
    console.error('[Waitlist] Error:', error)
    return NextResponse.json(
      { error: 'Error interno. Intentá de nuevo.' },
      { status: 500 }
    )
  }
}

// GET /api/waitlist — count (public, no sensitive data)
export async function GET() {
  try {
    const count = await db.waitlistEntry.count()
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
