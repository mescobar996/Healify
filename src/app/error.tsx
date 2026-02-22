'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Healify Error Boundary caught:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4">
      <div className="glass-elite glass-elite-large p-12 text-center max-w-md w-full">
        <div className="flex justify-center mb-6">
          <HealifyLogo size="md" showText={true} />
        </div>

        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-[#E8F0FF] mb-3 font-heading">
          Algo salió mal
        </h1>
        <p className="text-sm text-[#E8F0FF]/60 mb-8 leading-relaxed">
          Ocurrió un error inesperado. Nuestra IA ya está analizando el problema.
        </p>

        {error.digest && (
          <div className="rounded-xl bg-black/30 border border-white/5 p-3 mb-6">
            <code className="text-[11px] font-mono text-[#E8F0FF]/40">
              Error ID: {error.digest}
            </code>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#0A0E1A]"
            style={{
              background: 'linear-gradient(135deg, #00F5C8, #7B5EF8)',
              boxShadow: '0 0 20px rgba(0,245,200,0.3)',
            }}
          >
            Intentar de nuevo
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#E8F0FF]/70 border border-white/10 hover:border-white/20 transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
