'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Loader2, Sparkles, ArrowRight,
  Bell, Clock, Users, Zap, Shield, Infinity,
  Star, ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { HealifyLogo } from '@/components/HealifyLogo'
import Link from 'next/link'
import { toast } from 'sonner'

// ─── Plan data ──────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    description: 'Para equipos pequeños que quieren automatizar sus primeros tests.',
    color: '#7B5EF8',
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
    description: 'Para equipos que necesitan velocidad y escala en su pipeline de CI.',
    color: '#00F5C8',
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
    description: 'Para organizaciones con necesidades avanzadas de seguridad y compliance.',
    color: '#FF6B9D',
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

// ─── Waitlist form ──────────────────────────────────────────────────
function WaitlistForm({ plan }: { plan: string }) {
  const [email, setEmail]     = useState('')
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Ingresá un email válido')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, plan, source: 'pricing' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setDone(true)
        toast.success('¡Anotado! Te avisamos cuando los pagos estén listos.')
      } else {
        toast.error(data.error || 'Error al registrar. Intentá de nuevo.')
      }
    } catch {
      toast.error('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-4"
      >
        <div className="w-12 h-12 rounded-full bg-[#00F5C8]/15 border border-[#00F5C8]/30 flex items-center justify-center mx-auto mb-3">
          <Check className="w-5 h-5 text-[#00F5C8]" />
        </div>
        <p className="text-sm font-medium text-white">¡Estás en la lista!</p>
        <p className="text-xs text-[#E8F0FF]/50 mt-1">Te mandamos un email de confirmación.</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Tu nombre (opcional)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#7B5EF8]/50 transition-colors"
      />
      <input
        type="email"
        placeholder="tu@email.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#7B5EF8]/50 transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #7B5EF8, #00F5C8)' }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Bell className="w-4 h-4" />
            Avisarme cuando esté disponible
          </>
        )}
      </button>
    </div>
  )
}

// ─── Plan card ──────────────────────────────────────────────────────
function PlanCard({ plan, index }: { plan: typeof PLANS[0]; index: number }) {
  const [showWaitlist, setShowWaitlist] = useState(false)
  const isPopular = plan.badge === 'Más popular'

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'relative rounded-2xl border p-6 flex flex-col',
        isPopular
          ? 'border-[#00F5C8]/40 bg-[#00F5C8]/5'
          : 'border-white/10 bg-white/[0.03]'
      )}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-[#00F5C8] text-[#0A0E1A]">
            {plan.badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-medium tracking-widest uppercase mb-1" style={{ color: plan.color }}>
          {plan.name}
        </p>
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-3xl font-bold text-white">${plan.price}</span>
          <span className="text-sm text-[#E8F0FF]/40">USD / mes</span>
        </div>
        <p className="text-xs text-[#E8F0FF]/50 leading-relaxed">{plan.description}</p>
      </div>

      {/* Coming soon banner */}
      <div className="mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs text-amber-400 font-medium">Pagos disponibles próximamente</span>
      </div>

      {/* Features */}
      <ul className="space-y-2 mb-4 flex-1">
        {plan.features.map(f => (
          <li key={f.text} className="flex items-center gap-2 text-sm text-[#E8F0FF]/70">
            <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
            {f.text}
          </li>
        ))}
        {plan.notIncluded.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-[#E8F0FF]/25 line-through">
            <Check className="w-3.5 h-3.5 shrink-0 text-[#E8F0FF]/15" />
            {f}
          </li>
        ))}
      </ul>

      {/* Waitlist toggle */}
      <div>
        <button
          onClick={() => setShowWaitlist(!showWaitlist)}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-2',
            showWaitlist
              ? 'border-[#7B5EF8]/40 text-[#7B5EF8] bg-[#7B5EF8]/10'
              : 'border-white/10 text-[#E8F0FF]/70 bg-white/5 hover:bg-white/10 hover:text-white'
          )}
        >
          {showWaitlist ? (
            <>
              <ChevronDown className="w-4 h-4" />
              Ocultar
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Unirme a la lista de espera
            </>
          )}
        </button>

        <AnimatePresence>
          {showWaitlist && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <WaitlistForm plan={plan.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
export default function PricingPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/waitlist')
      .then(r => r.json())
      .then(d => setWaitlistCount(d.count ?? null))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] relative overflow-hidden">
      {/* Ambient */}
      <div className="fixed top-[20%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(123,94,248,0.08) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div className="fixed bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,245,200,0.06) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/"><HealifyLogo size="md" showText /></Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm text-[#E8F0FF]/50 hover:text-white transition-colors">Docs</Link>
            <Link href="/dashboard" className="text-sm px-3 py-1.5 rounded-lg bg-[#7B5EF8] text-white font-medium hover:bg-[#7B5EF8]/90 transition-colors">
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
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-500/30 text-amber-400 bg-amber-500/10 mb-5">
            <Clock className="w-3 h-3" /> Pagos disponibles próximamente
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{ background: 'linear-gradient(135deg, #E8F0FF 0%, #00F5C8 50%, #7B5EF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Precios simples y transparentes
          </h1>
          <p className="text-[#E8F0FF]/60 max-w-xl mx-auto leading-relaxed">
            Mientras activamos los pagos, podés usar el plan gratuito sin límite de tiempo.
            Anotate en la lista de espera para ser el primero en acceder.
          </p>

          {/* Social proof counter */}
          {waitlistCount !== null && waitlistCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-sm text-[#E8F0FF]/40"
            >
              <span className="text-[#00F5C8] font-semibold">{waitlistCount}</span> personas ya se anotaron
            </motion.p>
          )}
        </motion.div>

        {/* Free plan highlight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-10 p-4 rounded-2xl border border-[#7B5EF8]/25 bg-[#7B5EF8]/5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7B5EF8]" />
              Plan Gratuito — disponible ahora, sin tarjeta
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {FREE_FEATURES.map(f => (
                <span key={f} className="text-xs text-[#E8F0FF]/50 flex items-center gap-1">
                  <Check className="w-3 h-3 text-[#7B5EF8]" /> {f}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-sm px-4 py-2 rounded-xl bg-[#7B5EF8] text-white font-semibold hover:bg-[#7B5EF8]/90 transition-colors flex items-center gap-2"
          >
            Empezar gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Plan cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-14">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>

        {/* Global waitlist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="max-w-md mx-auto text-center"
        >
          <h2 className="text-lg font-semibold text-white mb-1">¿No sabés qué plan elegir?</h2>
          <p className="text-sm text-[#E8F0FF]/50 mb-5">
            Anotate sin comprometerte a ningún plan. Te contactamos cuando los pagos estén disponibles.
          </p>
          <WaitlistForm plan="pro" />
        </motion.div>

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
                q: '¿Qué métodos de pago van a aceptar?',
                a: 'Estamos evaluando opciones para Argentina: MercadoPago, Lemon Squeezy y transferencia bancaria. Te avisamos por email cuando esté listo.',
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
                  <ArrowRight className="w-4 h-4 text-[#E8F0FF]/30 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-[#E8F0FF]/55 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#E8F0FF]/25 mt-12">
          ¿Preguntas? <a href="mailto:support@healify.dev" className="text-[#7B5EF8] hover:underline">support@healify.dev</a>
          {' · '}
          <Link href="/privacy" className="hover:text-[#E8F0FF]/50 transition-colors">Privacidad</Link>
          {' · '}
          <Link href="/terms" className="hover:text-[#E8F0FF]/50 transition-colors">Términos</Link>
        </p>
      </div>
    </div>
  )
}
