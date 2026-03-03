import Link from 'next/link'
import { Metadata } from 'next'
import { Mail, Github, BookOpen, MessageSquare, ArrowRight } from 'lucide-react'
import { HealifyLogo } from '@/components/HealifyLogo'

export const metadata: Metadata = {
  title: 'Support — Healify',
  description: 'Canales oficiales de soporte, documentación y reporte de issues para Healify.',
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <HealifyLogo size="sm" showText />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-[#9B9B9B] hover:text-[#EDEDED] transition-colors">Docs</Link>
            <Link href="/pricing" className="text-[#9B9B9B] hover:text-[#EDEDED] transition-colors">Pricing</Link>
            <Link href="/dashboard" className="px-3 py-1.5 rounded-lg bg-white text-[#0A0A0A] font-medium hover:bg-[#E3E3E3] transition-colors">Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-14">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-3">Support</h1>
          <p className="text-[#9B9B9B] max-w-2xl">
            Elegí el canal según tu necesidad: documentación, issues en GitHub o soporte directo por email.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <a href="mailto:support@healify.dev" className="rounded-xl border border-white/[0.1] bg-[#111111] p-5 hover:border-white/[0.2] transition-colors">
            <Mail className="w-5 h-5 text-white mb-3" />
            <h2 className="text-lg font-semibold mb-1">Email de soporte</h2>
            <p className="text-sm text-[#9B9B9B] mb-3">Para consultas de cuenta, facturación o incidencias en producción.</p>
            <span className="text-sm text-white inline-flex items-center gap-1">support@healify.dev <ArrowRight className="w-3.5 h-3.5" /></span>
          </a>

          <a href="https://github.com/mescobar996/Healify/issues" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/[0.1] bg-[#111111] p-5 hover:border-white/[0.2] transition-colors">
            <Github className="w-5 h-5 text-white mb-3" />
            <h2 className="text-lg font-semibold mb-1">Reportar issue</h2>
            <p className="text-sm text-[#9B9B9B] mb-3">Errores reproducibles, bugs UI o problemas del SDK/reporter.</p>
            <span className="text-sm text-white inline-flex items-center gap-1">Abrir issue <ArrowRight className="w-3.5 h-3.5" /></span>
          </a>

          <Link href="/docs" className="rounded-xl border border-white/[0.1] bg-[#111111] p-5 hover:border-white/[0.2] transition-colors">
            <BookOpen className="w-5 h-5 text-white mb-3" />
            <h2 className="text-lg font-semibold mb-1">Documentación</h2>
            <p className="text-sm text-[#9B9B9B] mb-3">Quickstart, API reference, integraciones CI y preguntas frecuentes.</p>
            <span className="text-sm text-white inline-flex items-center gap-1">Ir a docs <ArrowRight className="w-3.5 h-3.5" /></span>
          </Link>

          <Link href="/dashboard/settings" className="rounded-xl border border-white/[0.1] bg-[#111111] p-5 hover:border-white/[0.2] transition-colors">
            <MessageSquare className="w-5 h-5 text-white mb-3" />
            <h2 className="text-lg font-semibold mb-1">Configuración de cuenta</h2>
            <p className="text-sm text-[#9B9B9B] mb-3">Gestioná perfil, API keys y preferencias desde el dashboard.</p>
            <span className="text-sm text-white inline-flex items-center gap-1">Abrir configuración <ArrowRight className="w-3.5 h-3.5" /></span>
          </Link>
        </div>
      </main>
    </div>
  )
}
