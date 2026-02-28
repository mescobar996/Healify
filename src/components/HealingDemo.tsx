'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle2, GitPullRequest, ShieldAlert, Terminal } from 'lucide-react'

const LOOP_DURATION_MS = 7000
const TICK_MS = 100

function useDemoTimeline() {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs((previous) => (previous + TICK_MS) % LOOP_DURATION_MS)
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [])

  return elapsedMs
}

type DemoScenario = {
  id: 'healing-pr' | 'flaky-retry' | 'bug-detected'
  label: string
  testCommand: string
  failedTitle: string
  failedMessage: string
  successTitle: string
  branch: string
  oldSelector: string
  newSelector: string | null
  confidenceLine: string
  overlayText: string
  footerReadyText: string
  toastText: string
  rightPanelTitle: string
  rightPanelSubtitle: string
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'healing-pr',
    label: 'Autocuración + PR',
    testCommand: 'playwright test login.spec.ts',
    failedTitle: 'FAILED login.spec.ts:23',
    failedMessage: 'Element not found: #btn-login',
    successTitle: 'PASSED ✅',
    branch: 'healify-fix/abc123',
    oldSelector: '#btn-login',
    newSelector: '[data-testid="login-btn"]',
    confidenceLine: 'Confianza: 97% ✅',
    overlayText: 'Healify analizando DOM para autocuración...',
    footerReadyText: 'Healify detectó el cambio y abrió un PR en 3.2s',
    toastText: 'PR #42 abierto en GitHub',
    rightPanelTitle: 'GitHub PR abierto',
    rightPanelSubtitle: 'selector diff',
  },
  {
    id: 'flaky-retry',
    label: 'Flaky retry',
    testCommand: 'playwright test cart.spec.ts --retries=1',
    failedTitle: 'FAILED cart.spec.ts:18 (attempt 1)',
    failedMessage: 'Timeout in network wait · transient issue',
    successTitle: 'PASSED on retry ✅',
    branch: 'main',
    oldSelector: '.cart-total',
    newSelector: null,
    confidenceLine: 'Clasificación: flaky test',
    overlayText: 'Healify evaluando estabilidad y patrón de flaky...',
    footerReadyText: 'Healify clasificó flaky y reintentó automáticamente',
    toastText: 'Retry automático ejecutado',
    rightPanelTitle: 'Diagnóstico de ejecución',
    rightPanelSubtitle: 'resultado del retry',
  },
  {
    id: 'bug-detected',
    label: 'Bug detectado',
    testCommand: 'playwright test checkout.spec.ts',
    failedTitle: 'FAILED checkout.spec.ts:51',
    failedMessage: 'HTTP 500 on /api/checkout',
    successTitle: 'BUG DETECTED ⚠️',
    branch: 'main',
    oldSelector: 'button.pay-now',
    newSelector: null,
    confidenceLine: 'Clasificación: bug real (no autocurar)',
    overlayText: 'Healify validando si es bug real o problema de selector...',
    footerReadyText: 'Healify creó alerta accionable para revisión humana',
    toastText: 'Ticket Jira sugerido',
    rightPanelTitle: 'Alerta de bug',
    rightPanelSubtitle: 'evidencia y recomendación',
  },
]

interface HealingDemoProps {
  embedded?: boolean
  title?: string
  subtitle?: string
}

export function HealingDemo({
  embedded = false,
  title = 'Demo interactivo',
  subtitle = 'Seleccioná qué flujo querés ver: autocuración, flaky retry o bug detectado.',
}: HealingDemoProps) {
  const elapsedMs = useDemoTimeline()
  const [selectedDemo, setSelectedDemo] = useState<DemoScenario['id']>('healing-pr')

  const scenario = useMemo(
    () => DEMO_SCENARIOS.find((item) => item.id === selectedDemo) || DEMO_SCENARIOS[0],
    [selectedDemo]
  )

  const timeline = useMemo(() => {
    const seconds = elapsedMs / 1000
    const hasFailure = seconds >= 1.5 && seconds < 5.5
    const isAnalyzing = seconds >= 2.5 && seconds < 3.5
    const showDiff = seconds >= 3.5
    const showPullRequestToast = seconds >= 4.5 && seconds < 6.9
    const hasPassed = seconds >= 5.5

    return {
      hasFailure,
      isAnalyzing,
      showDiff,
      showPullRequestToast,
      hasPassed,
    }
  }, [elapsedMs])

  const demoContent = (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-elite rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden"
        >
          <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-3 border-b border-white/10">
            <h3 className="text-lg sm:text-xl font-semibold text-[#E8F0FF]">{title}</h3>
            <p className="text-xs sm:text-sm text-[#E8F0FF]/60 mt-1">{subtitle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {DEMO_SCENARIOS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedDemo(item.id)}
                  className={
                    item.id === selectedDemo
                      ? 'px-2.5 py-1 rounded-md text-xs bg-[#1A1A1A] border border-[#00F5C8]/40 text-[#00F5C8]'
                      : 'px-2.5 py-1 rounded-md text-xs bg-[#101010] border border-white/[0.1] text-[#9B9B9B] hover:text-[#E8F0FF]'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-white/10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 text-sm font-semibold tracking-wide uppercase">
              <div className="text-[#FF5D7A]">Antes: tu test falla</div>
              <div className="text-[#00F5C8]">Después: Healify lo cura</div>
            </div>
          </div>

          <div className="relative px-5 sm:px-8 py-5 sm:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="rounded-xl border border-white/10 bg-[#0F1528] p-4 sm:p-5 font-mono text-xs sm:text-sm min-h-[220px]">
                <div className="flex items-center gap-2 text-[#E8F0FF]/80 mb-3">
                  <Terminal className="w-4 h-4" />
                  <span>Terminal</span>
                </div>

                <div className="space-y-2 text-[#E8F0FF]/75">
                  <div>$ {scenario.testCommand}</div>
                  <div>{timeline.hasPassed ? '✓ 1 passed (5.5s)' : 'running tests...'}</div>

                  <AnimatePresence mode="wait">
                    {timeline.hasFailure && !timeline.hasPassed && (
                      <motion.div
                        key="failed-state"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="pt-2 space-y-1"
                      >
                        <div className="text-[#FF5D7A] font-semibold">{scenario.failedTitle}</div>
                        <div className="text-[#FF5D7A]">{scenario.failedMessage}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    {timeline.hasPassed && (
                      <motion.div
                        key="passed-state"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="pt-2 text-[#00F5C8] font-semibold"
                      >
                        {scenario.successTitle}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0F1528] p-4 sm:p-5 font-mono text-xs sm:text-sm min-h-[220px] relative">
                <div className="flex items-center gap-2 text-[#E8F0FF]/80 mb-3">
                  {scenario.id === 'bug-detected' ? <ShieldAlert className="w-4 h-4" /> : <GitPullRequest className="w-4 h-4" />}
                  <span>{scenario.rightPanelTitle}</span>
                </div>

                <div className="space-y-2 text-[#E8F0FF]/75">
                  <div className="text-[#00F5C8]">{scenario.branch}</div>
                  <div className="border-t border-white/10 pt-2">{scenario.rightPanelSubtitle}</div>
                  <div className={timeline.showDiff ? 'text-[#FF5D7A]' : 'text-[#E8F0FF]/35'}>
                    - selector/error: {scenario.oldSelector}
                  </div>
                  {scenario.newSelector ? (
                    <div className={timeline.showDiff ? 'text-[#00F5C8]' : 'text-[#E8F0FF]/35'}>
                      + selector: {scenario.newSelector}
                    </div>
                  ) : (
                    <div className={timeline.showDiff ? 'text-[#E8F0FF]/85' : 'text-[#E8F0FF]/35'}>
                      + acción: revisión humana / retry
                    </div>
                  )}
                  <div className={timeline.showDiff ? 'text-[#00F5C8]' : 'text-[#E8F0FF]/35'}>
                    {scenario.confidenceLine}
                  </div>
                </div>

                <AnimatePresence>
                  {timeline.showPullRequestToast && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-3 top-3 rounded-lg border border-[#00F5C8]/30 bg-[#00F5C8]/10 px-3 py-2 text-[11px] text-[#00F5C8]"
                    >
                      {scenario.toastText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {timeline.isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 m-5 sm:m-8 rounded-xl border border-[#00F5C8]/40 bg-[#00F5C8]/10 backdrop-blur-[1px] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#00F5C8]/20 to-transparent animate-pulse" />
                  <div className="relative h-full flex items-center justify-center text-[#00F5C8] font-semibold tracking-wide">
                    {scenario.overlayText}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-white/10 px-5 sm:px-8 py-4 text-sm text-center text-[#00F5C8]">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {timeline.showDiff
                  ? scenario.footerReadyText
                  : 'Detectando cambios de UI en tiempo real...'}
              </span>
            </div>
          </div>
        </motion.div>
  )

  if (embedded) {
    return demoContent
  }

  return (
    <section id="demo-section" className="relative py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {demoContent}
      </div>
    </section>
  )
}
