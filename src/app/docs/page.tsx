import type { Metadata } from 'next'
import Link from 'next/link'
import { 
  Terminal, Package, Zap, Key, GitBranch, 
  CheckCircle, Copy, ArrowRight, Book,
  Code2, Workflow, Shield, AlertTriangle
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Docs — Healify',
  description: 'Documentación del SDK y reporter de Healify. Instalación, configuración y guía de uso.',
}

// ─── Code block component ───────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/8 rounded-t-xl">
        <span className="text-[11px] text-[#E8F0FF]/30 font-mono uppercase tracking-widest">{lang}</span>
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white/10" />
          <span className="w-3 h-3 rounded-full bg-white/10" />
          <span className="w-3 h-3 rounded-full bg-white/10" />
        </div>
      </div>
      <pre className="p-4 rounded-b-xl bg-[#070B14] overflow-x-auto">
        <code className="text-sm font-mono text-[#E8F0FF]/80 leading-relaxed">{code}</code>
      </pre>
    </div>
  )
}

// ─── Section heading ────────────────────────────────────────────────
function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-white mt-12 mb-4 scroll-mt-24 flex items-center gap-2 group">
      <a href={`#${id}`} className="text-[#00F5C8]/0 group-hover:text-[#00F5C8]/60 transition-colors text-lg">#</a>
      {children}
    </h2>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-base font-semibold text-[#E8F0FF]/90 mt-8 mb-3 scroll-mt-24">
      {children}
    </h3>
  )
}

// ─── Callout ────────────────────────────────────────────────────────
function Callout({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info:    { bg: 'bg-[#3B82F6]/10', border: 'border-[#3B82F6]/25', icon: <Zap className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" /> },
    warning: { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/25', icon: <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" /> },
    tip:     { bg: 'bg-[#00F5C8]/10', border: 'border-[#00F5C8]/25', icon: <CheckCircle className="w-4 h-4 text-[#00F5C8] shrink-0 mt-0.5" /> },
  }
  const s = styles[type]
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${s.bg} ${s.border} my-4`}>
      {s.icon}
      <div className="text-sm text-[#E8F0FF]/70 leading-relaxed">{children}</div>
    </div>
  )
}

// ─── Nav TOC ────────────────────────────────────────────────────────
const TOC = [
  { id: 'quickstart',    label: 'Quickstart',         indent: false },
  { id: 'installation',  label: 'Instalación',         indent: false },
  { id: 'configuration', label: 'Configuración',       indent: false },
  { id: 'playwright',    label: 'Playwright',          indent: true  },
  { id: 'cypress',       label: 'Cypress',             indent: true  },
  { id: 'jest',          label: 'Jest / Vitest',       indent: true  },
  { id: 'api',           label: 'API Reference',       indent: false },
  { id: 'webhook',       label: 'GitHub Webhook',      indent: false },
  { id: 'dashboard',     label: 'Dashboard',           indent: false },
  { id: 'faq',           label: 'FAQ',                 indent: false },
]

// ══════════════════════════════════════════════════════════════════════
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF]">

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(10,14,26,0.9)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-white">
              <Book className="w-4 h-4 text-[#00F5C8]" />
              <span>Healify</span>
              <span className="text-[#E8F0FF]/30">/</span>
              <span className="text-[#E8F0FF]/60 font-normal">Docs</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-[#E8F0FF]/50">
              <a href="#quickstart" className="hover:text-white transition-colors">Quickstart</a>
              <a href="#api" className="hover:text-white transition-colors">API</a>
              <a href="#webhook" className="hover:text-white transition-colors">Webhook</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="https://github.com/mescobar996/Healify"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#E8F0FF]/50 hover:text-white transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="/dashboard"
              className="text-sm px-3 py-1.5 rounded-lg bg-[#7B5EF8] text-white font-medium hover:bg-[#7B5EF8]/90 transition-colors"
            >
              Dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-10 flex gap-10">

        {/* ── Sidebar TOC ── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[11px] font-medium tracking-widest text-[#E8F0FF]/30 uppercase mb-3">En esta página</p>
            {TOC.map(item => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`block text-sm py-1 transition-colors hover:text-white text-[#E8F0FF]/50 ${item.indent ? 'pl-3 text-xs' : ''}`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 max-w-3xl">

          {/* Hero */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#00F5C8]/10 text-[#00F5C8] border border-[#00F5C8]/20">
                SDK v1.0
              </span>
              <span className="text-xs text-[#E8F0FF]/30">Última actualización: Feb 2026</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
              Documentación del SDK
            </h1>
            <p className="text-[#E8F0FF]/60 leading-relaxed max-w-xl">
              Integrá Healify en tu pipeline de CI/CD en menos de 5 minutos.
              Cuando un test falla, Healify detecta el selector roto, genera una corrección
              y crea un Pull Request automáticamente.
            </p>
          </div>

          {/* ── QUICKSTART ── */}
          <SectionHeading id="quickstart">
            <Zap className="w-5 h-5 text-[#00F5C8]" /> Quickstart
          </SectionHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4 leading-relaxed">
            3 pasos para conectar tu primer repositorio:
          </p>

          <div className="grid gap-3 mb-6">
            {[
              { step: '1', title: 'Instalá el reporter', desc: 'npm i -D @healify/reporter' },
              { step: '2', title: 'Agregá tu API Key', desc: 'Desde Configuración → API Keys' },
              { step: '3', title: 'Conectá el webhook de GitHub', desc: 'Desde Proyectos → Conectar repo' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/8">
                <span className="w-6 h-6 rounded-full bg-[#7B5EF8]/20 border border-[#7B5EF8]/30 text-[#7B5EF8] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-[#E8F0FF]/40 font-mono mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── INSTALLATION ── */}
          <SectionHeading id="installation">
            <Package className="w-5 h-5 text-[#7B5EF8]" /> Instalación
          </SectionHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4">
            Instalá el reporter como dependencia de desarrollo:
          </p>

          <CodeBlock lang="npm" code="npm install --save-dev @healify/reporter" />
          <CodeBlock lang="yarn" code="yarn add -D @healify/reporter" />
          <CodeBlock lang="pnpm" code="pnpm add -D @healify/reporter" />

          <Callout type="info">
            El reporter solo se activa cuando detecta la variable de entorno{' '}
            <code className="text-[#00F5C8] bg-white/5 px-1 rounded">HEALIFY_API_KEY</code>.
            En entornos sin la key, los tests corren normalmente sin overhead.
          </Callout>

          {/* ── CONFIGURATION ── */}
          <SectionHeading id="configuration">
            <Code2 className="w-5 h-5 text-[#FF6B9D]" /> Configuración
          </SectionHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4">
            Agregá tu API Key como variable de entorno. Nunca la commitees al repo.
          </p>

          <CodeBlock lang=".env.local" code={`# .env.local (NO commitear)
HEALIFY_API_KEY=hf_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Opcional — para reportar el branch y commit actual
HEALIFY_BRANCH=main
HEALIFY_COMMIT_SHA=\${GITHUB_SHA}`} />

          {/* ── PLAYWRIGHT ── */}
          <SubHeading id="playwright">Playwright</SubHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4">
            Importá el reporter en tu <code className="text-[#00F5C8] bg-white/5 px-1 rounded">playwright.config.ts</code>:
          </p>

          <CodeBlock lang="playwright.config.ts" code={`import { defineConfig } from '@playwright/test'
import { HealifyReporter } from '@healify/reporter/playwright'

export default defineConfig({
  reporter: [
    ['list'],
    // Agregar el reporter de Healify
    [HealifyReporter, {
      apiKey: process.env.HEALIFY_API_KEY,
      // Opcional: capturar HTML del DOM en cada fallo para mejor autocuración
      captureDOM: true,
    }],
  ],
  // ...resto de tu config
})`} />

          <Callout type="tip">
            Activá <code className="text-[#00F5C8] bg-white/5 px-1 rounded">captureDOM: true</code> para
            que Healify tenga más contexto sobre la estructura del DOM al momento del fallo.
            Mejora la precisión de autocuración en un ~30%.
          </Callout>

          {/* ── CYPRESS ── */}
          <SubHeading id="cypress">Cypress</SubHeading>

          <CodeBlock lang="cypress.config.ts" code={`import { defineConfig } from 'cypress'
import { HealifyCypressPlugin } from '@healify/reporter/cypress'

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      HealifyCypressPlugin(on, config, {
        apiKey: process.env.HEALIFY_API_KEY,
      })
      return config
    },
  },
})`} />

          {/* ── JEST / VITEST ── */}
          <SubHeading id="jest">Jest / Vitest</SubHeading>

          <CodeBlock lang="vitest.config.ts" code={`import { defineConfig } from 'vitest/config'
import { HealifyVitestReporter } from '@healify/reporter/vitest'

export default defineConfig({
  test: {
    reporters: [
      'default',
      new HealifyVitestReporter({
        apiKey: process.env.HEALIFY_API_KEY,
      }),
    ],
  },
})`} />

          {/* ── API REFERENCE ── */}
          <SectionHeading id="api">
            <Terminal className="w-5 h-5 text-[#00F5C8]" /> API Reference
          </SectionHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4">
            Podés reportar fallos directamente desde tu pipeline sin usar el reporter de npm.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#00F5C8]/15 text-[#00F5C8] border border-[#00F5C8]/20 font-mono">POST</span>
            <code className="text-sm text-[#E8F0FF]/70 font-mono">/api/v1/report</code>
          </div>

          <CodeBlock lang="curl" code={`curl -X POST https://healify-sigma.vercel.app/api/v1/report \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: hf_live_xxxxxxxxxxxxxxxx" \\
  -d '{
    "testName": "Login / should authenticate user",
    "selector": "#login-btn",
    "error": "Waiting for selector #login-btn timeout",
    "testFile": "tests/auth.spec.ts",
    "context": "<html>...</html>",
    "selectorType": "CSS",
    "branch": "main",
    "commitSha": "abc123def456"
  }'`} />

          <SubHeading id="api-params">Parámetros</SubHeading>

          <div className="rounded-xl border border-white/8 overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/8">
                  <th className="text-left px-4 py-3 text-[#E8F0FF]/50 font-medium text-xs tracking-wide">Campo</th>
                  <th className="text-left px-4 py-3 text-[#E8F0FF]/50 font-medium text-xs tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-[#E8F0FF]/50 font-medium text-xs tracking-wide">Requerido</th>
                  <th className="text-left px-4 py-3 text-[#E8F0FF]/50 font-medium text-xs tracking-wide">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ['testName',     'string',  '✓', 'Nombre completo del test'],
                  ['selector',     'string',  '✓', 'El selector que falló (CSS, XPath, etc.)'],
                  ['error',        'string',  '✓', 'Mensaje de error completo'],
                  ['testFile',     'string',  '–', 'Ruta relativa al archivo de test'],
                  ['context',      'string',  '–', 'HTML del DOM al momento del fallo'],
                  ['selectorType', 'enum',    '–', 'CSS | XPATH | TESTID | ROLE | TEXT'],
                  ['branch',       'string',  '–', 'Branch de Git actual'],
                  ['commitSha',    'string',  '–', 'SHA del commit que disparó el fallo'],
                ].map(([field, type, req, desc]) => (
                  <tr key={field} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[#00F5C8] text-xs">{field}</td>
                    <td className="px-4 py-3 text-[#E8F0FF]/40 text-xs">{type}</td>
                    <td className="px-4 py-3 text-center text-xs">{req === '✓' ? <span className="text-[#10B981]">✓</span> : <span className="text-[#E8F0FF]/20">—</span>}</td>
                    <td className="px-4 py-3 text-[#E8F0FF]/60 text-xs">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubHeading id="api-response">Respuesta exitosa</SubHeading>

          <CodeBlock lang="json" code={`{
  "success": true,
  "testRunId": "run_abc123",
  "healingEventId": "heal_xyz789",
  "project": "My App",
  "result": {
    "fixedSelector": "#submit-button",
    "confidence": 0.97,
    "selectorType": "CSS",
    "explanation": "El botón cambió de id 'login-btn' a 'submit-button'",
    "needsReview": false,
    "alternatives": ["button[type='submit']", ".btn-primary"]
  },
  "processingTimeMs": 1240
}`} />

          <SubHeading id="api-errors">Códigos de error</SubHeading>

          <div className="space-y-2 mb-6">
            {[
              ['401', '#EF4444', 'API Key inválida o ausente'],
              ['400', '#F59E0B', 'Payload inválido (falta testName, selector o error)'],
              ['429', '#FF6B9D', 'Rate limit: máx. 60 reportes/minuto por proyecto'],
              ['500', '#E8F0FF', 'Error interno — contactar soporte'],
            ].map(([code, color, msg]) => (
              <div key={code} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/8">
                <code className="text-xs font-bold font-mono px-2 py-0.5 rounded" style={{ color, background: `${color}18` }}>{code}</code>
                <span className="text-sm text-[#E8F0FF]/60">{msg}</span>
              </div>
            ))}
          </div>

          {/* ── WEBHOOK ── */}
          <SectionHeading id="webhook">
            <GitBranch className="w-5 h-5 text-[#7B5EF8]" /> GitHub Webhook
          </SectionHeading>

          <p className="text-sm text-[#E8F0FF]/60 mb-4 leading-relaxed">
            Configurar el webhook de GitHub permite que Healify analice automáticamente
            cada push y ejecute tus tests en el Railway Worker.
          </p>

          <div className="space-y-4 mb-6">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
              <p className="text-sm font-medium text-white mb-1">URL del webhook</p>
              <code className="text-xs font-mono text-[#00F5C8] bg-black/30 px-2 py-1 rounded block">
                https://healify-sigma.vercel.app/api/webhook/github
              </code>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Content type', 'application/json'],
                ['Events',       'push, pull_request'],
                ['SSL verify',   'Enabled ✓'],
                ['Secret',       'Configurar en el repo → igual que GITHUB_WEBHOOK_SECRET'],
              ].map(([k, v]) => (
                <div key={k} className="p-3 rounded-xl bg-white/[0.02] border border-white/8">
                  <p className="text-[11px] text-[#E8F0FF]/30 uppercase tracking-widest mb-1">{k}</p>
                  <p className="text-xs text-[#E8F0FF]/70 font-mono">{v}</p>
                </div>
              ))}
            </div>
          </div>

          <Callout type="warning">
            El webhook usa HMAC-SHA256 para verificar la autenticidad de cada evento.
            Asegurate de configurar el mismo secreto tanto en GitHub como en{' '}
            <code className="bg-white/5 px-1 rounded">GITHUB_WEBHOOK_SECRET</code> en tus env vars de Vercel.
          </Callout>

          <CodeBlock lang="Variables de entorno (Vercel)" code={`GITHUB_WEBHOOK_SECRET=tu-secreto-seguro-aqui
NEXTAUTH_SECRET=otro-secreto-muy-largo
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...`} />

          {/* ── DASHBOARD ── */}
          <SectionHeading id="dashboard">
            <Workflow className="w-5 h-5 text-[#00F5C8]" /> Dashboard
          </SectionHeading>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {[
              {
                title: 'Tests Hoy',
                desc: 'Total de tests ejecutados en las últimas 24h, con variación respecto al día anterior.',
                icon: <Zap className="w-4 h-4 text-[#7B5EF8]" />,
              },
              {
                title: 'Autocuración',
                desc: 'Porcentaje de tests fallidos que fueron curados automáticamente con confidence ≥ 95%.',
                icon: <CheckCircle className="w-4 h-4 text-[#00F5C8]" />,
              },
              {
                title: 'Bugs Detectados',
                desc: 'Fallos que requieren revisión manual (confidence < 95%). Aparecen en la cola de revisión.',
                icon: <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />,
              },
              {
                title: 'Tiempo Promedio',
                desc: 'Tiempo promedio de procesamiento por evento de healing, incluyendo análisis de IA.',
                icon: <Terminal className="w-4 h-4 text-[#FF6B9D]" />,
              },
            ].map(card => (
              <div key={card.title} className="p-4 rounded-xl bg-white/[0.03] border border-white/8">
                <div className="flex items-center gap-2 mb-2">
                  {card.icon}
                  <p className="text-sm font-medium text-white">{card.title}</p>
                </div>
                <p className="text-xs text-[#E8F0FF]/50 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* ── FAQ ── */}
          <SectionHeading id="faq">
            <Shield className="w-5 h-5 text-[#FF6B9D]" /> FAQ
          </SectionHeading>

          <div className="space-y-4">
            {[
              {
                q: '¿Healify modifica mis tests directamente?',
                a: 'No. Healify crea un Pull Request con la corrección propuesta. Vos decidís si aprobarlo o no. El flow siempre pasa por tu revisión.',
              },
              {
                q: '¿Qué pasa si la confianza de la corrección es baja?',
                a: 'Si el confidence es menor a 95%, el evento se marca como NEEDS_REVIEW y recibís una notificación en el dashboard. Por debajo de 70%, se marca como FAILED para revisión manual.',
              },
              {
                q: '¿Funciona con tests de backend (Jest, Vitest)?',
                a: 'Sí, pero está optimizado para tests E2E que trabajan con selectores del DOM. Para tests unitarios, la autocuración es menos efectiva ya que no hay selectores que reparar.',
              },
              {
                q: '¿Cuántos reportes puedo enviar?',
                a: 'El límite es de 60 reportes por minuto por proyecto. Si superás ese límite, recibirás un 429 con el header Retry-After indicando cuándo reintentar.',
              },
              {
                q: '¿Es seguro enviar el HTML del DOM?',
                a: 'El HTML se usa únicamente para el análisis de healing y no se almacena de forma persistente. Nunca incluyas datos sensibles como tokens o contraseñas en el contexto HTML.',
              },
              {
                q: '¿Puedo usar Healify sin el worker de Railway?',
                a: 'Sí. Podés usar solo el endpoint /api/v1/report para análisis on-demand. El worker de Railway es para el flujo automático: push → test → heal → PR.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group p-4 rounded-xl bg-white/[0.02] border border-white/8 cursor-pointer">
                <summary className="text-sm font-medium text-white list-none flex items-center justify-between">
                  {q}
                  <ArrowRight className="w-4 h-4 text-[#E8F0FF]/30 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-sm text-[#E8F0FF]/60 mt-3 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>

          {/* CTA bottom */}
          <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-[#7B5EF8]/10 to-[#00F5C8]/5 border border-[#7B5EF8]/20 text-center">
            <p className="text-lg font-semibold text-white mb-2">¿Listo para empezar?</p>
            <p className="text-sm text-[#E8F0FF]/60 mb-4">Conectá tu primer repositorio en menos de 5 minutos.</p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/dashboard/projects"
                className="px-4 py-2 rounded-lg bg-[#7B5EF8] text-white text-sm font-semibold hover:bg-[#7B5EF8]/90 transition-colors"
              >
                Crear proyecto
              </Link>
              <Link
                href="https://github.com/mescobar996/Healify"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[#E8F0FF]/70 text-sm font-medium hover:bg-white/10 transition-colors"
              >
                Ver en GitHub
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
