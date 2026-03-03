import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — Healify',
  description: 'Cómo Healify recopila, usa y protege tus datos personales.',
}

import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] px-6 py-16 max-w-3xl mx-auto">
      <Link href="/"><HealifyLogo size="sm" showText /></Link>
      <h1 className="text-3xl font-bold mt-8 mb-4 font-orbitron">Política de Privacidad</h1>
      <p className="text-[#EDEDED]/60 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
      <div className="space-y-6 text-[#EDEDED]/80 leading-relaxed">
        <section><h2 className="text-xl font-semibold text-white mb-2">1. Datos que Recopilamos</h2><p>Recopilamos tu nombre, email e imagen de perfil de tu proveedor OAuth (GitHub/Google). No almacenamos contraseñas.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">2. Uso de los Datos</h2><p>Tus datos se usan exclusivamente para identificarte en la plataforma y personalizar tu experiencia.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">3. Almacenamiento</h2><p>Los datos se almacenan en servidores seguros de PostgreSQL. Nunca vendemos ni compartimos tus datos con terceros.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">4. Cookies</h2><p>Usamos cookies de sesión para mantenerte autenticado. No usamos cookies de tracking o publicidad.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">5. Eliminación de Datos</h2><p>Podés solicitar la eliminación de todos tus datos escribiendo a <a href="mailto:support@healify.dev" className="text-white">support@healify.dev</a></p></section>
        <section>
          <h2 className="text-xl font-semibold text-white mb-2">6. Servicios de Terceros</h2>
          <p>Healify utiliza servicios de terceros que pueden procesar datos para operar la plataforma:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-[#EDEDED]/75">
            <li>GitHub / Google: autenticación OAuth (aplican sus políticas de privacidad).</li>
            <li>Neon PostgreSQL: almacenamiento de datos (infraestructura en EE.UU.).</li>
            <li>Resend: envío de emails transaccionales.</li>
            <li>Stripe / MercadoPago / Lemon Squeezy: procesamiento de pagos (no almacenamos datos de tarjetas).</li>
            <li>Anthropic: análisis de selectores con IA (solo selector fallido y contexto técnico mínimo).</li>
          </ul>
        </section>
        <section><h2 className="text-xl font-semibold text-white mb-2">7. Período de Retención</h2><p>Los datos se conservan mientras la cuenta permanezca activa. Si solicitás eliminación de cuenta, los datos se eliminan dentro de los 30 días hábiles siguientes.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">8. Derechos del Usuario</h2><p>Podés solicitar acceso, corrección, eliminación o portabilidad de tus datos escribiendo a <a href="mailto:support@healify.dev" className="text-white">support@healify.dev</a>.</p></section>
      </div>
      <Link href="/" className="mt-12 inline-block text-sm text-[#EDEDED]/40 hover:text-white">← Volver al inicio</Link>
    </div>
  )
}
