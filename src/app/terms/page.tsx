import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos de Servicio — Healify',
  description: 'Términos y condiciones de uso de la plataforma Healify.',
}

import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] px-6 py-16 max-w-3xl mx-auto">
      <Link href="/"><HealifyLogo size="sm" showText /></Link>
      <h1 className="text-3xl font-bold mt-8 mb-4 font-orbitron">Términos de Servicio</h1>
      <p className="text-[#EDEDED]/60 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
      <div className="space-y-6 text-[#EDEDED]/80 leading-relaxed">
        <section><h2 className="text-xl font-semibold text-white mb-2">1. Uso del Servicio</h2><p>Healify es una plataforma de auto-curación de tests con IA. Al usar el servicio, aceptás estos términos.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">2. Cuenta y Seguridad</h2><p>Sos responsable de mantener la seguridad de tu cuenta y credenciales de acceso.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">3. Propiedad Intelectual</h2><p>El código de tu proyecto sigue siendo tuyo. Healify no reclama propiedad sobre tu código ni resultados de tests.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">4. Limitación de Responsabilidad</h2><p>El servicio se provee "tal como está". No garantizamos disponibilidad 24/7 durante el período beta.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">5. Contacto</h2><p>Para consultas: <a href="mailto:support@healify.dev" className="text-white">support@healify.dev</a></p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">6. Política de Cancelación</h2><p>Podés cancelar tu suscripción en cualquier momento desde Dashboard → Settings → Plan. El acceso continúa hasta el fin del período pago vigente y no se aplican penalidades por cancelación.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">7. Nivel de Servicio (SLA) Beta</h2><p>Durante el período beta, Healify no garantiza un uptime específico contractual. Se realizará el mejor esfuerzo para mantener una disponibilidad objetivo del 99% y comunicar incidentes relevantes por email.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">8. Datos Generados por IA</h2><p>Los selectores sugeridos y Pull Requests generados automáticamente son sugerencias de automatización. El usuario es responsable de revisar, validar y aprobar cualquier cambio antes de mergearlo en su repositorio.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">9. Modificaciones al Servicio</h2><p>Healify podrá modificar funcionalidades y precios notificando con al menos 30 días de anticipación por email. Las modificaciones de precio no afectan suscripciones activas hasta su siguiente renovación.</p></section>
        <section><h2 className="text-xl font-semibold text-white mb-2">10. Ley Aplicable</h2><p>Estos términos se rigen por las leyes de la República Argentina.</p></section>
      </div>
      <Link href="/" className="mt-12 inline-block text-sm text-[#EDEDED]/40 hover:text-white">← Volver al inicio</Link>
    </div>
  )
}
