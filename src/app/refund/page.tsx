import type { Metadata } from 'next'
import Link from 'next/link'
import { HealifyLogo } from '@/components/HealifyLogo'

export const metadata: Metadata = {
  title: 'Política de Reembolsos — Healify',
  description: 'Conocé las condiciones, plazos y proceso para solicitar reembolsos en Healify.',
}

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF] px-6 py-16 max-w-3xl mx-auto">
      <Link href="/">
        <HealifyLogo size="sm" showText />
      </Link>

      <h1 className="text-3xl font-bold mt-8 mb-4 font-orbitron">Política de Reembolsos</h1>
      <p className="text-[#E8F0FF]/60 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>

      <div className="space-y-6 text-[#E8F0FF]/80 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">1. Período de prueba (Trial)</h2>
          <p>
            Healify puede ofrecer períodos de prueba gratuitos para evaluar la plataforma antes de contratar un plan pago.
            Durante ese período podés cancelar sin costo. Si no cancelás antes de finalizar el trial, se aplicará la
            suscripción seleccionada según las condiciones vigentes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">2. Política de reembolso general</h2>
          <p>
            Podés solicitar un reembolso dentro de los primeros 30 días corridos desde el cobro, siempre que exista
            una falla comprobable del servicio que haya impedido su uso normal y que no haya sido resuelta por soporte
            en un plazo razonable.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">3. Casos en los que no aplica reembolso</h2>
          <p>
            No aplica reembolso cuando el servicio fue utilizado de forma efectiva durante el período facturado,
            cuando el uso generó procesamiento de datos, o cuando la causa del inconveniente se deba a configuraciones,
            integraciones o infraestructura del cliente ajenas a Healify.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">4. Cómo solicitar un reembolso</h2>
          <p>
            Enviá un email a{' '}
            <a href="mailto:support@healify.dev" className="text-[#00F5C8]">
              support@healify.dev
            </a>{' '}
            con el asunto <strong>"Reembolso - [tu email]"</strong>, incluyendo fecha de cobro, plan contratado,
            motivo detallado y evidencia del problema.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">5. Tiempo de procesamiento</h2>
          <p>
            Una vez aprobado, el reembolso se procesa entre 5 y 10 días hábiles, según los tiempos del proveedor de
            pagos y de la entidad emisora de la tarjeta o medio de cobro.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">6. Cancelación de suscripción</h2>
          <p>
            Podés cancelar tu suscripción en cualquier momento desde tu panel. La cancelación evita renovaciones
            futuras y conserva el acceso hasta finalizar el período ya abonado. Los datos de cuenta se gestionan según
            nuestra política de privacidad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-[#00F5C8] mb-2">7. Contacto</h2>
          <p>
            Para consultas sobre facturación, cancelaciones o reembolsos, escribinos a{' '}
            <a href="mailto:support@healify.dev" className="text-[#00F5C8]">
              support@healify.dev
            </a>
            .
          </p>
        </section>
      </div>

      <Link href="/" className="mt-12 inline-block text-sm text-[#E8F0FF]/40 hover:text-[#00F5C8]">
        ← Volver al inicio
      </Link>
    </div>
  )
}
