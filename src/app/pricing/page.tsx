'use client'
import { toast } from 'sonner'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HealifyLogo } from '@/components/HealifyLogo'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Github } from 'lucide-react'

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const { status } = useSession()

  // Plans fetched from server so env vars are always fresh (never stale from build-time bundle)
  const [plans, setPlans] = useState<Array<{ id: string; name: string; price: number; priceId: string; features: string[] }>>([])
  useEffect(() => {
    fetch('/api/plans', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.plans) setPlans(d.plans) })
      .catch(() => {})
  }, [])

  const handleSubscribe = async (priceId: string, planId: string) => {
    if (status !== 'authenticated') {
      signIn('github', { callbackUrl: '/pricing' })
      return
    }
    setLoadingPlan(planId)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.notConfigured) {
        toast.error('Pagos no configurados aún', {
          description: 'El equipo de Healify está activando los pagos. Por ahora podés usar el plan gratuito.',
        })
      } else {
        toast.error('Error al procesar el pago', { description: data.error || 'Intentá de nuevo en unos minutos' })
      }
    } catch {
      toast.error('Error de conexión', { description: 'No se pudo conectar con el servidor de pagos' })
    } finally {
      setLoadingPlan(null)
    }
  }


  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] relative overflow-hidden">
      <div className="fixed top-[20%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none animate-float-y" style={{ background: 'radial-gradient(circle, rgba(123,94,248,0.1) 0%, transparent 70%)', filter: 'blur(100px)' }} />
      <div className="fixed top-[50%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none animate-float-y-delay-2" style={{ background: 'radial-gradient(circle, rgba(0,245,200,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <header className="sticky top-0 z-50 glass-elite border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/"><HealifyLogo size="md" showText={true} /></Link>
          <Link href="/" className="text-sm text-[#E8F0FF]/60 hover:text-[#00F5C8] transition-colors">← Volver</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium glass-elite border border-[#00F5C8]/30 text-[#00F5C8] mb-6">
            <Sparkles className="w-3 h-3" /> Simple, Transparent Pricing
          </span>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-4 font-heading" style={{ background: 'linear-gradient(135deg, #E8F0FF 0%, #00F5C8 50%, #7B5EF8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Heal Your Tests
          </h1>
          <p className="text-lg text-[#E8F0FF]/60 max-w-2xl mx-auto">
            Choose the plan that fits your team. No credit card for the first 14 days.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan, i) => {
            const isPro = plan.id === 'pro'
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }} className={cn('glass-elite glass-elite-hover relative flex flex-col', isPro && 'border-[#00F5C8]/30')} style={isPro ? { boxShadow: '0 0 40px rgba(0,245,200,0.12), inset 0 1px 0 rgba(255,255,255,0.1)' } : undefined}>
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-[#0A0E1A] text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1" style={{ background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)' }}>
                      <Sparkles className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-[#E8F0FF] mb-1 font-heading">{plan.name}</h2>
                    <p className="text-sm text-[#E8F0FF]/50">{plan.id === 'starter' ? 'Perfect for small teams' : plan.id === 'pro' ? 'Best for growing teams' : 'For large organizations'}</p>
                  </div>
                  <div className="mb-6">
                    <div className="flex items-end gap-1">
                      <span className="text-5xl font-bold font-heading" style={isPro ? { background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : undefined}>${plan.price}</span>
                      <span className="text-[#E8F0FF]/40 mb-1.5 text-sm">/month</span>
                    </div>
                    <p className="text-xs text-[#E8F0FF]/40 mt-1">Billed monthly · Cancel anytime</p>
                  </div>
                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-[#E8F0FF]/80">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,245,200,0.15)' }}>
                          <Check className="h-3 w-3 text-[#00F5C8]" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button disabled={loadingPlan === plan.id} onClick={() => handleSubscribe(plan.priceId!, plan.id)} className={cn('w-full py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', isPro ? 'text-[#0A0E1A]' : 'text-[#E8F0FF] border border-white/10 hover:border-white/20 hover:bg-white/5')} style={isPro ? { background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)', boxShadow: '0 0 20px rgba(0,245,200,0.4)' } : undefined}>
                    {loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : status !== 'authenticated' ? <><Github className="w-4 h-4" /> Sign in to start</> : <>Get Started <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center text-sm text-[#E8F0FF]/40 mt-12">
          All plans include a 14-day free trial · No setup fees · Cancel anytime
        </motion.p>
      </div>

      {/* Footer consistente con landing */}
      <footer className="relative py-12 mt-16 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#E8F0FF]/60">
            <div className="flex items-center gap-3">
              <HealifyLogo size="sm" showText={true} />
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/mescobar996/Healify/wiki" target="_blank" rel="noopener noreferrer" className="hover:text-[#00F5C8] transition-colors">Documentation</a>
              <a href="https://github.com/mescobar996/Healify" target="_blank" rel="noopener noreferrer" className="hover:text-[#00F5C8] transition-colors">GitHub</a>
              <a href="mailto:support@healify.dev" className="hover:text-[#00F5C8] transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
