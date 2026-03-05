'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Check, Loader2, Sparkles, ArrowRight,
  Bell, Users, Zap, Shield, Infinity,
  Star
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HealifyLogo } from '@/components/HealifyLogo'
import Link from 'next/link'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'

type PlanId = 'starter' | 'pro' | 'enterprise'
type BillingCycle = 'monthly' | 'annual'

// ─── Plan data ──────────────────────────────────────────────────────
const PLANS: Array<{
  id: PlanId
  name: string
  price: number
  annualMonthly: number  // per-month cost when billed annually (10 months)
  annualTotal: number    // total billed once a year
  description: string
  color: string
  badge: string | null
  features: Array<{ text: string; icon: React.ElementType }>
  notIncluded: string[]
}> = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    annualMonthly: 40.83,
    annualTotal: 490,
    description: 'Para equipos pequeños que quieren automatizar sus primeros tests.',
    color: '#F2F2F2',
    badge: null,
    features: [
      { text: '5 proyectos', icon: Zap },
      { text: '100 test runs / mes', icon: Zap },
      { text: 'Auto-curación con IA', icon: Zap },
      { text: 'GitHub webhook', icon: Zap },
      { text: 'Email de soporte', icon: Shield },
    ],
    notIncluded: ['Auto-PR ilimitados', 'Slack alerts', 'SSO'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    annualMonthly: 82.50,
    annualTotal: 990,
    description: 'Para equipos que necesitan velocidad y escala en su pipeline de CI.',
    color: '#F2F2F2',
    badge: 'Más popular',
    features: [
      { text: 'Proyectos ilimitados', icon: Infinity },
      { text: '1.000 test runs / mes', icon: Infinity },
      { text: 'Auto-curación con IA', icon: Zap },
      { text: 'Auto-PR automáticos', icon: Zap },
      { text: 'Slack + email alerts', icon: Bell },
      { text: 'Soporte prioritario', icon: Shield },
      { text: 'Export CSV de reportes', icon: Zap },
    ],
    notIncluded: ['SSO', 'On-premise'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 499,
    annualMonthly: 415.83,
    annualTotal: 4990,
    description: 'Para organizaciones con necesidades avanzadas de seguridad y compliance.',
    color: '#EDEDED',
    badge: null,
    features: [
      { text: 'Todo lo de Pro', icon: Check },
      { text: 'Test runs ilimitados', icon: Infinity },
      { text: 'SSO / SAML', icon: Shield },
      { text: 'Audit logs', icon: Shield },
      { text: 'Opción on-premise', icon: Shield },
      { text: 'SLA garantizado', icon: Star },
      { text: 'Soporte dedicado', icon: Users },
    ],
    notIncluded: [],
  },
]

const FREE_FEATURES = [
  '1 proyecto',
  '50 test runs / mes',
  'Auto-curación básica',
  'Dashboard completo',
]

// ─── Plan card ──────────────────────────────────────────────────────
function PlanCard({
  plan,
  index,
  arsRate,
  billingCycle,
}: {
  plan: typeof PLANS[0]
  index: number
  arsRate: number | null
  billingCycle: BillingCycle
}) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const isPopular = plan.badge === 'Más popular'

  const usdPrice = billingCycle === 'annual' ? plan.annualMonthly : plan.price
  const arsPrice = arsRate ? Math.round((usdPrice * arsRate) / 100) * 100 : null
  const arsSavings = arsRate
    ? Math.round(((plan.price - plan.annualMonthly) * arsRate) / 100) * 100
    : null

  const handleCheckout = useCallback(async () => {
    if (!session) {
      window.location.href = `/auth/signin?callbackUrl=/pricing`
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, billingCycle }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Error al iniciar el pago. Intentá de nuevo.')
      }
    } catch {
      toast.error('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [session, plan.id, billingCycle])

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'relative rounded-2xl border p-6 flex flex-col',
        isPopular
          ? 'border-white/20 bg-white/[0.04]'
          : 'border-white/10 bg-white/[0.03]'
      )}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white text-[#0A0A0A]">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: plan.color }}>
          {plan.name}
        </p>
        {/* Annual savings badge */}
        {billingCycle === 'annual' && arsSavings && (
          <div className="mb-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
              Ahorrás ${arsSavings.toLocaleString('es-AR')} ARS/año (2 meses gratis)
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-1 mb-1">
          {arsPrice ? (
            <>
              <span className="text-3xl font-bold text-white">${arsPrice.toLocaleString('es-AR')}</span>
              <span className="text-sm text-[#EDEDED]/40">ARS / mes</span>
            </>
          ) : (
            <span className="text-xl font-bold text-[#EDEDED]/50">Calculando…</span>
          )}
        </div>
        {arsPrice && billingCycle === 'annual' && (
          <p className="text-xs text-[#EDEDED]/35">
            ≈ ${plan.annualMonthly.toFixed(2)} USD/mes · facturado anualmente (${plan.annualTotal} USD) · tasa oficial
          </p>
        )}
        {arsPrice && billingCycle === 'monthly' && (
          <p className="text-xs text-[#EDEDED]/35">≈ ${plan.price} USD · tasa oficial</p>
        )}
        <p className="text-xs text-[#EDEDED]/50 leading-relaxed mt-1">{plan.description}</p>
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map(f => (
          <li key={f.text} className="flex items-center gap-2 text-sm text-[#EDEDED]/70">
            <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
            {f.text}
          </li>
        ))}
        {plan.notIncluded.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-[#EDEDED]/25 line-through">
            <Check className="w-3.5 h-3.5 shrink-0 text-[#EDEDED]/15" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={loading || !arsPrice}
        className={cn(
          'w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
          isPopular
            ? 'bg-white text-[#0A0A0A] hover:bg-[#E3E3E3] disabled:opacity-50'
            : 'border border-white/20 text-white hover:bg-white/10 disabled:opacity-30'
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Elegir {plan.name}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
export default function PricingPage() {
  const [arsRate, setArsRate] = useState<number | null>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  useEffect(() => {
    fetch('/api/billing/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setArsRate(d.rate) })
      .catch(() => setArsRate(1050))
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed top-[20%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div className="fixed bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><HealifyLogo size="md" showText /></Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm text-[#EDEDED]/50 hover:text-white transition-colors">Docs</Link>
            <Link href="/support" className="text-sm text-[#EDEDED]/50 hover:text-white transition-colors">Support</Link>
            <Link href="/dashboard" className="text-sm px-3 py-1.5 rounded-lg bg-white text-[#0A0A0A] font-medium hover:bg-[#E3E3E3] transition-colors">
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-16 relative z-10">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #DADADA 60%, #9D9D9D 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Precios simples y transparentes
          </h1>
          <p className="text-[#EDEDED]/60 max-w-xl mx-auto leading-relaxed">
            Cobá en pesos argentinos vía MercadoPago. Tarjeta de crédito, débito o transferencia.
            Sin sorpresas: cancelá cuando quieras.
          </p>
        </motion.div>

        {/* Billing cycle toggle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
            <button
              onClick={() => setBillingCycle('monthly')}
              aria-pressed={billingCycle === 'monthly'}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                billingCycle === 'monthly'
                  ? 'bg-white text-[#0A0A0A] shadow-sm'
                  : 'text-[#EDEDED]/50 hover:text-white'
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              aria-pressed={billingCycle === 'annual'}
              className={cn(
                'relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                billingCycle === 'annual'
                  ? 'bg-white text-[#0A0A0A] shadow-sm'
                  : 'text-[#EDEDED]/50 hover:text-white'
              )}
            >
              Anual
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                billingCycle === 'annual'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-900/60 text-emerald-300'
              )}>
                −2 meses
              </span>
            </button>
          </div>
        </motion.div>

        {/* Free plan highlight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-10 p-4 rounded-2xl border border-white/15 bg-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              Plan Gratuito — disponible ahora, sin tarjeta
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {FREE_FEATURES.map(f => (
                <span key={f} className="text-xs text-[#EDEDED]/50 flex items-center gap-1">
                  <Check className="w-3 h-3 text-white" /> {f}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-sm px-4 py-2 rounded-xl bg-white text-[#0A0A0A] font-semibold hover:bg-[#E3E3E3] transition-colors flex items-center gap-2"
          >
            Empezar gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* MP rate note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-[#EDEDED]/40 -mt-2 mb-6"
        >
          Precios en ARS calculados con el dólar oficial · Cobro mensual vía MercadoPago
        </motion.p>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} arsRate={arsRate} billingCycle={billingCycle} />
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-center text-lg font-semibold text-white mb-6">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {[
              {
                q: '¿El plan gratuito tiene límite de tiempo?',
                a: 'No. El plan gratuito es permanente. Podés usarlo mientras quieras sin tarjeta de crédito.',
              },
              {
                q: '¿Qué métodos de pago aceptan?',
                a: 'Pesos argentinos vía MercadoPago: tarjeta de crédito, débito o transferencia bancaria. El precio en ARS se actualiza automáticamente cada 15 minutos según el dólar oficial.',
              },
              {
                q: '¿Puedo cambiar de plan después?',
                a: 'Sí. Podrás hacer upgrade o downgrade en cualquier momento desde el dashboard, con prorrateo automático.',
              },
              {
                q: '¿Hay descuento por pago anual?',
                a: '2 meses gratis al pagar anualmente. Lo activamos junto con los pagos.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group p-4 rounded-xl bg-white/[0.02] border border-white/8 cursor-pointer">
                <summary className="text-sm font-medium text-white list-none flex items-center justify-between">
                  {q}
                  <ArrowRight className="w-4 h-4 text-[#EDEDED]/30 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-[#EDEDED]/55 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#EDEDED]/25 mt-12">
          ¿Preguntas? <a href="mailto:support@healify.dev" className="text-white hover:underline">support@healify.dev</a>
          {' · '}
          <Link href="/privacy" className="hover:text-[#EDEDED]/50 transition-colors">Privacidad</Link>
          {' · '}
          <Link href="/terms" className="hover:text-[#EDEDED]/50 transition-colors">Términos</Link>
          {' · '}
          <Link href="/refund" className="hover:text-[#EDEDED]/50 transition-colors">Reembolsos</Link>
        </p>
      </div>
    </div>
  )
}
