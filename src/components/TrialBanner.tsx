'use client'

/**
 * TrialBanner
 *
 * Displayed at the top of the dashboard when the user is on a free trial.
 * Shows days remaining and a CTA to upgrade.
 * Auto-dismisses after the trial ends (component will simply not render).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, X, ArrowRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubscriptionInfo {
  status: string
  trialEndsAt: string | null
}

export function TrialBanner() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check sessionStorage so dismissed state persists across page navigations in the same session
    const wasDismissed = sessionStorage.getItem('trial-banner-dismissed')
    if (wasDismissed) { setDismissed(true); return }

    fetch('/api/user/subscription')
      .then(r => r.ok ? r.json() : null)
      .then((data: SubscriptionInfo | null) => {
        if (data?.status === 'trial') setSub(data)
      })
      .catch(() => null)
  }, [])

  const handleDismiss = () => {
    sessionStorage.setItem('trial-banner-dismissed', '1')
    setDismissed(true)
  }

  if (!sub || dismissed) return null

  // Calculate days remaining
  const trialEndsAt = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
  const msRemaining = trialEndsAt ? trialEndsAt.getTime() - Date.now() : 0
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))

  // Trial already expired — don't show
  if (daysRemaining === 0) return null

  const isUrgent = daysRemaining <= 3

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm border-b',
        isUrgent
          ? 'bg-amber-950/40 border-amber-500/20 text-amber-200'
          : 'bg-white/[0.03] border-white/[0.06] text-[#EDEDED]/80'
      )}
    >
      {/* Icon */}
      {isUrgent
        ? <Clock className="w-4 h-4 shrink-0 text-amber-400" />
        : <Sparkles className="w-4 h-4 shrink-0 text-white/60" />
      }

      {/* Message */}
      <p className="flex-1 min-w-0 text-xs sm:text-sm">
        {isUrgent
          ? <>Tu trial de 14 días vence en <strong className="text-amber-300">{daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}</strong>. Activá tu plan para no perder el acceso.</>
          : <>Estás en el <strong className="text-white">trial gratuito de Healify Starter</strong> — {daysRemaining} días restantes.</>
        }
      </p>

      {/* CTA */}
      <Link
        href="/pricing"
        className={cn(
          'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
          isUrgent
            ? 'bg-amber-500 text-[#0A0A0A] hover:bg-amber-400'
            : 'bg-white text-[#0A0A0A] hover:bg-[#E3E3E3]'
        )}
      >
        Activar plan
        <ArrowRight className="w-3 h-3" />
      </Link>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Cerrar aviso de trial"
        className="shrink-0 p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
