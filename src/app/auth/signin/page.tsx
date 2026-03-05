import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar sesión — Healify',
  description: 'Iniciá sesión en Healify con tu cuenta de GitHub o Google para empezar a autocurar tus tests.',
}

import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/SignInButton'
import { HealifyLogo } from '@/components/HealifyLogo'

export default async function SignInPage() {
  const user = await getSessionUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4">
      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <HealifyLogo size="lg" showText={false} />
          <h1 className="mt-4 text-2xl font-bold text-[#EDEDED] tracking-tight font-orbitron">
            Healify
          </h1>
          <p className="mt-2 text-sm text-[#EDEDED]/60">
            AI-powered test self-healing platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-elite rounded-2xl p-8 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-[#EDEDED]">Iniciar sesión</h2>
            <p className="text-sm text-[#EDEDED]/60 mt-1">
              Elegí tu proveedor para continuar
            </p>
          </div>

          <SignInButton provider="github" />
          <SignInButton provider="google" />

          <p className="text-xs text-center text-[#EDEDED]/50 pt-2">
            Al continuar, aceptás nuestros{' '}
            <a href="/terms" className="text-white/70 hover:text-white">Términos</a>
            {' '}y{' '}
            <a href="/privacy" className="text-white/70 hover:text-white">Política de privacidad</a>
          </p>
        </div>

        <p className="text-center mt-6 flex items-center justify-center gap-4">
          <a href="/" className="text-sm text-[#EDEDED]/60 hover:text-white transition-colors">
            ← Volver al inicio
          </a>
          <a href="/support" className="text-sm text-[#EDEDED]/60 hover:text-white transition-colors">
            Soporte
          </a>
        </p>
      </div>
    </div>
  )
}
