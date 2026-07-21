import type { Metadata } from 'next'
import { HealifyLogo } from '@/components/HealifyLogo'

export const metadata: Metadata = {
  title: 'Healify - Sanado local de selectores rotos',
  description:
    'Reporter local y gratuito para Playwright y Cypress: cuando un selector se rompe, Healify sugiere el fix en tu propia máquina, sin cuenta ni servidor.',
}

const packages = [
  { name: '@healify/test-runner', for: 'Playwright' },
  { name: '@healify/cypress-plugin', for: 'Cypress' },
]

export default function Home() {
  return (
    <div className="min-h-screen px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <HealifyLogo size="lg" />

        <h1 className="mt-10 text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
          Cuando un selector se rompe, Healify te dice cómo arreglarlo — sin salir de tu máquina.
        </h1>

        <p className="mt-4 text-[#9B9B9B] leading-relaxed">
          Reporter local para Playwright y Cypress. Corre tu suite, y si un test falla por un
          selector roto, generamos un <code className="font-mono text-sm text-[#EDEDED]">healify-report.html</code> con
          la sugerencia de fix — sin cuenta, sin servidor, sin que tu código salga de tu PC.
        </p>

        <div className="mt-10 rounded-lg border border-white/10 bg-[#0A0A0A]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-[#D0D0D0]">
{`npm install --save-dev @healify/test-runner
npx playwright test   # sin HEALIFY_API_KEY = modo local, automático`}
          </pre>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div key={pkg.name} className="rounded-lg border border-white/10 bg-[#0A0A0A] p-4">
              <p className="font-mono text-sm text-[#EDEDED]">{pkg.name}</p>
              <p className="mt-1 text-sm text-[#8A8A8A]">Para {pkg.for}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 text-sm text-[#9B9B9B]">
          <p className="text-[#EDEDED] font-medium">Cómo funciona</p>
          <p>1. Un test falla por un selector que ya no existe en el DOM.</p>
          <p>2. Una heurística local (sin red, sin IA en la nube) analiza el selector y propone una alternativa más estable.</p>
          <p>3. Al terminar la corrida, se genera <code className="font-mono text-xs">healify-report.html</code> con cada caso: selector original, sugerencia y nivel de confianza.</p>
        </div>

        <p className="mt-16 text-xs text-[#8A8A8A]">
          ¿Querés reportar los fixes a un servidor propio en vez de solo generarlos localmente? Seteá{' '}
          <code className="font-mono">HEALIFY_API_KEY</code> y <code className="font-mono">HEALIFY_API_URL</code> apuntando
          a tu propia instancia — el endpoint <code className="font-mono">/api/v1/report</code> de este mismo repo corre
          la misma heurística, sin base de datos.
        </p>
      </div>
    </div>
  )
}
