import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redirect } from 'next/navigation'
import { SignInButton } from '@/components/SignInButton'
import { HealifyLogo } from '@/components/HealifyLogo'

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4">
      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00F5C8]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7B5EF8]/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <HealifyLogo size="lg" showText={false} />
          <h1 className="mt-4 text-2xl font-bold text-[#E8F0FF] tracking-tight font-orbitron">
            Healify
          </h1>
          <p className="mt-2 text-sm text-[#E8F0FF]/50">
            AI-powered test self-healing platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-elite rounded-2xl p-8 space-y-4">
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-[#E8F0FF]">Iniciar sesión</h2>
            <p className="text-sm text-[#E8F0FF]/40 mt-1">
              Elegí tu proveedor para continuar
            </p>
          </div>

          <SignInButton provider="github" />
          <SignInButton provider="google" />

          <p className="text-xs text-center text-[#E8F0FF]/30 pt-2">
            Al continuar, aceptás nuestros{' '}
            <a href="/terms" className="text-[#00F5C8]/70 hover:text-[#00F5C8]">Términos</a>
            {' '}y{' '}
            <a href="/privacy" className="text-[#00F5C8]/70 hover:text-[#00F5C8]">Política de privacidad</a>
          </p>
        </div>

        <p className="text-center mt-6">
          <a href="/" className="text-sm text-[#E8F0FF]/40 hover:text-[#00F5C8] transition-colors">
            ← Volver al inicio
          </a>
        </p>
      </div>
    </div>
  )
}
