'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { HealifyLogo } from '@/components/HealifyLogo'

// Nombres de plan para mostrar al usuario
const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise',
}

// Polling cada 2s, máximo 30s antes de mostrar soporte
const POLL_INTERVAL = 2000
const MAX_WAIT_MS   = 30000

export default function UpgradeSuccessPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const planParam    = searchParams.get('plan')?.toUpperCase() || ''

  const [phase, setPhase]           = useState<'loading' | 'success' | 'timeout'>('loading')
  const [detectedPlan, setDetectedPlan] = useState<string>('')
  const [dots, setDots]             = useState('.')
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef                = useRef(Date.now())

  // Animación de puntos suspensivos
  useEffect(() => {
    const d = setInterval(() => setDots(p => p.length >= 3 ? '.' : p + '.'), 500)
    return () => clearInterval(d)
  }, [])

  // Polling a /api/user/subscription
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/user/subscription', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()

        // Si el plan ya no es FREE → el webhook fue procesado
        if (data.plan && data.plan !== 'FREE') {
          clearInterval(intervalRef.current!)
          clearTimeout(timeoutRef.current!)
          setDetectedPlan(data.plan)
          setPhase('success')
          // Redirigir al dashboard después de 2.5s para que el usuario vea la confirmación
          setTimeout(() => router.push('/dashboard'), 2500)
        }
      } catch {
        // Silencioso — seguimos reintentando
      }
    }

    // Primera poll inmediata
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    // Timeout de 30s
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!)
      setPhase('timeout')
    }, MAX_WAIT_MS)

    return () => {
      clearInterval(intervalRef.current!)
      clearTimeout(timeoutRef.current!)
    }
  }, [router])

  const displayPlan = PLAN_LABELS[detectedPlan] || PLAN_LABELS[planParam] || 'Pro'

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-[#00F5C8]/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-[#7B5EF8]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <HealifyLogo size="md" showText />
        </div>

        {/* ── FASE: LOADING ── */}
        {phase === 'loading' && (
          <div className="glass-elite rounded-2xl p-10 space-y-6">
            {/* Spinner animado con gradiente */}
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full"
                style={{ background: 'conic-gradient(from 0deg, #00F5C8, #7B5EF8, #00F5C8)', animation: 'spin 1.5s linear infinite' }}
              />
              <div className="absolute w-14 h-14 rounded-full bg-[#0D1117] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-[#00F5C8] animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-[#E8F0FF] font-orbitron">
                Activando tu plan{dots}
              </h1>
              <p className="text-sm text-[#E8F0FF]/50">
                Estamos confirmando tu pago con Stripe.<br />
                Esto toma unos segundos.
              </p>
            </div>

            {/* Progress bar indeterminada */}
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #00F5C8, #7B5EF8)',
                  animation: 'progress-slide 1.8s ease-in-out infinite',
                  width: '40%',
                }}
              />
            </div>

            <p className="text-xs text-[#E8F0FF]/25 font-mono">
              Verificando webhook de Stripe{dots}
            </p>
          </div>
        )}

        {/* ── FASE: SUCCESS ── */}
        {phase === 'success' && (
          <div className="glass-elite rounded-2xl p-10 space-y-6">
            {/* Checkmark con glow */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-xl opacity-60"
                  style={{ background: 'radial-gradient(circle, #00F5C8, transparent)' }} />
                <CheckCircle2 className="relative w-20 h-20 text-[#00F5C8]" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold font-orbitron"
                style={{ background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                ¡Plan {displayPlan} activado!
              </h1>
              <p className="text-sm text-[#E8F0FF]/60">
                Tu suscripción está activa. Redirigiendo al dashboard{dots}
              </p>
            </div>

            {/* Features desbloqueadas */}
            <div className="text-left space-y-2 bg-white/3 rounded-xl p-4">
              {(detectedPlan === 'PRO' || planParam === 'PRO') && (
                <>
                  {['Proyectos ilimitados', '2,000 test runs/mes', 'Healing con IA real', 'Soporte prioritario'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-[#E8F0FF]/70">
                      <span className="text-[#00F5C8]">✓</span> {f}
                    </div>
                  ))}
                </>
              )}
              {(detectedPlan === 'STARTER' || planParam === 'STARTER') && (
                <>
                  {['5 proyectos', '2,000 tests/mes', 'Healing con IA', 'Email support'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-[#E8F0FF]/70">
                      <span className="text-[#00F5C8]">✓</span> {f}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── FASE: TIMEOUT ── */}
        {phase === 'timeout' && (
          <div className="glass-elite rounded-2xl p-10 space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-[#E8F0FF]">
                Tomando más de lo esperado
              </h1>
              <p className="text-sm text-[#E8F0FF]/50">
                Tu pago fue procesado por Stripe. La activación del plan puede demorar
                un par de minutos más.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-[#0A0E1A] transition-all"
                style={{ background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)' }}
              >
                Ir al dashboard de todos modos
              </button>
              <a
                href="mailto:support@healify.dev"
                className="w-full py-3 px-6 rounded-xl text-sm font-medium text-[#E8F0FF]/60 border border-white/10 hover:border-white/20 hover:text-[#E8F0FF] transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Contactar soporte
              </a>
            </div>

            <p className="text-xs text-[#E8F0FF]/25">
              Si ya fuiste cobrado, el plan se activará automáticamente.
              Revisá el dashboard en unos minutos.
            </p>
          </div>
        )}
      </div>

      {/* CSS animations inline */}
      <style>{`
        @keyframes progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}
