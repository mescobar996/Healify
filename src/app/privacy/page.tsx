import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Healify',
  description: 'Cómo Healify recopila, usa y protege tus datos personales.',
}

import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] px-6 py-16 max-w-3xl mx-auto">
      <Link href="/"><HealifyLogo size="sm" showText /></Link>
      <h1 className="text-3xl font-bold mt-8 mb-4 font-orbitron">Política de Privacidad</h1>
      <p className="text-[#E8F0FF]/60 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
      <div className="space-y-6 text-[#E8F0FF]/80 leading-relaxed">
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">1. Datos que Recopilamos</h2><p>Recopilamos tu nombre, email e imagen de perfil de tu proveedor OAuth (GitHub/Google). No almacenamos contraseñas.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">2. Uso de los Datos</h2><p>Tus datos se usan exclusivamente para identificarte en la plataforma y personalizar tu experiencia.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">3. Almacenamiento</h2><p>Los datos se almacenan en servidores seguros de PostgreSQL. Nunca vendemos ni compartimos tus datos con terceros.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">4. Cookies</h2><p>Usamos cookies de sesión para mantenerte autenticado. No usamos cookies de tracking o publicidad.</p></section>
        <section><h2 className="text-xl font-semibold text-[#00F5C8] mb-2">5. Eliminación de Datos</h2><p>Podés solicitar la eliminación de todos tus datos escribiendo a <a href="mailto:support@healify.dev" className="text-[#00F5C8]">support@healify.dev</a></p></section>
      </div>
      <Link href="/" className="mt-12 inline-block text-sm text-[#E8F0FF]/40 hover:text-[#00F5C8]">← Volver al inicio</Link>
    </div>
  )
}
