'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, GitPullRequest, Terminal } from 'lucide-react'

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

export function HealingDemo() {
  const elapsedMs = useDemoTimeline()

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

  return (
    <section className="relative py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-elite rounded-2xl sm:rounded-3xl border border-white/10 overflow-hidden"
        >
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
                  <div>$ playwright test login.spec.ts</div>
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
                        <div className="text-[#FF5D7A] font-semibold">FAILED login.spec.ts:23</div>
                        <div className="text-[#FF5D7A]">Element not found: #btn-login</div>
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
                        PASSED ✅
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0F1528] p-4 sm:p-5 font-mono text-xs sm:text-sm min-h-[220px] relative">
                <div className="flex items-center gap-2 text-[#E8F0FF]/80 mb-3">
                  <GitPullRequest className="w-4 h-4" />
                  <span>GitHub PR abierto</span>
                </div>

                <div className="space-y-2 text-[#E8F0FF]/75">
                  <div className="text-[#00F5C8]">healify-fix/abc123</div>
                  <div className="border-t border-white/10 pt-2">selector diff</div>
                  <div className={timeline.showDiff ? 'text-[#FF5D7A]' : 'text-[#E8F0FF]/35'}>
                    - selector: '#btn-login'
                  </div>
                  <div className={timeline.showDiff ? 'text-[#00F5C8]' : 'text-[#E8F0FF]/35'}>
                    + selector: '[data-testid="login-btn"]'
                  </div>
                  <div className={timeline.showDiff ? 'text-[#00F5C8]' : 'text-[#E8F0FF]/35'}>
                    Confianza: 97% ✅
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
                      PR #42 abierto en GitHub
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
                    Healify analizando DOM...
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
                  ? 'Healify detectó el cambio en 3.2 segundos'
                  : 'Detectando cambios de UI en tiempo real...'}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
