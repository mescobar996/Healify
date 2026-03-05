'use client'

import { useSession, signIn } from 'next-auth/react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HealifyLogo } from '@/components/HealifyLogo'
import LandingHero from '@/components/landing/LandingHero'
import CompatibleToolsSection from '@/components/landing/CompatibleToolsSection'
import VideoDemoSection from '@/components/landing/VideoDemoSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import CTASection from '@/components/landing/CTASection'

function Footer() {
  return (
    <footer className="relative py-12 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#EDEDED]/60">
          <HealifyLogo size="sm" showText={true} />
          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <a href="/docs" className="hover:text-white transition-colors">Documentación</a>
            <a href="https://github.com/mescobar996/Healify" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
            <a href="/support" className="hover:text-white transition-colors">Soporte</a>
            <a href="/refund" className="hover:text-white transition-colors">Reembolsos</a>
            <a href="/privacy" className="hover:text-white transition-colors">Privacidad</a>
            <a href="/terms" className="hover:text-white transition-colors">Términos</a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#000000] text-[#EDEDED] relative">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] px-3 py-2 rounded-md bg-white text-[#0A0A0A] text-sm font-semibold"
      >
        Saltar al contenido principal
      </a>

      <header className="sticky top-0 z-50 glass-elite border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-3">
          <HealifyLogo size="md" showText={true} />
          <nav aria-label="Principal" className="flex items-center gap-3 sm:gap-4">
            <a href="/pricing" className="text-sm text-[#EDEDED]/60 hover:text-white transition-colors">
              Precios
            </a>
            <Button
              variant="outline"
              size="sm"
              className="glass-elite border-white/20 text-[#EDEDED] hover:border-white/35 hover:bg-white/5"
              onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            >
              <Github className="w-4 h-4 mr-2" />
              Iniciar sesión
            </Button>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <LandingHero />
        <CompatibleToolsSection />
        <VideoDemoSection />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}