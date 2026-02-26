import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Healify',
  description: 'Términos y condiciones de uso de la plataforma Healify.',
}

import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] px-6 py-16 max-w-3xl mx-auto">
      <Link href="/"><HealifyLogo size="sm" showText /></Link>
      <h1 className="text-3xl font-bold mt-8 mb-4 font-orbitron">Términos de Servicio</h1>
      <p className="text-[#E8F0FF]/60 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
      <div className="space-y-6 text-[#E8F0FF]/80 leading-relaxed">
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">1. Uso del Servicio</h2><p>Healify es una plataforma de auto-curación de tests con IA. Al usar el servicio, aceptás estos términos.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">2. Cuenta y Seguridad</h2><p>Sos responsable de mantener la seguridad de tu cuenta y credenciales de acceso.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">3. Propiedad Intelectual</h2><p>El código de tu proyecto sigue siendo tuyo. Healify no reclama propiedad sobre tu código ni resultados de tests.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">4. Limitación de Responsabilidad</h2><p>El servicio se provee "tal como está". No garantizamos disponibilidad 24/7 durante el período beta.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">5. Contacto</h2><p>Para consultas: <a href="mailto:support@healify.dev" className="text-[#00F5C8]">support@healify.dev</a></p></section>
      </div>
      <Link href="/" className="mt-12 inline-block text-sm text-[#E8F0FF]/40 hover:text-[#00F5C8]">← Volver al inicio</Link>
    </div>
  )
}
