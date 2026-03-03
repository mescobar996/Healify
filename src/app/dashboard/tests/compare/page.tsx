'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  GitCompare,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ── Types ──────────────────────────────────────────────────────────────────

interface TestRunSnapshot {
  id: string
  status: string
  branch: string | null
  commitSha: string | null
  commitMessage: string | null
  startedAt: string
  duration: number | null
  totalTests: number
  passedTests: number
  failedTests: number
  healedTests: number
  error: string | null
  project: { id: string; name: string }
  healingEvents: {
    id: string
    testName: string
    status: string
    failedSelector: string | null
    newSelector: string | null
    confidence: number | null
    errorMessage: string | null
  }[]
}

interface CompareResult {
  a: TestRunSnapshot
  b: TestRunSnapshot
  delta: {
    totalTests: number
    passedTests: number
    failedTests: number
    healedTests: number
    duration: number
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  switch (s) {
    case 'PASSED': return 'text-emerald-400 bg-emerald-500/10'
    case 'HEALED': return 'text-violet-400 bg-violet-500/10'
    case 'PARTIAL': return 'text-amber-400 bg-amber-500/10'
    case 'FAILED': return 'text-red-400 bg-red-500/10'
    default: return 'text-gray-400 bg-gray-500/10'
  }
}

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  if (value === 0) return <span className="text-gray-500 flex items-center gap-0.5"><Minus className="w-3 h-3" /> 0</span>
  const positive = invert ? value < 0 : value > 0
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-mono', positive ? 'text-emerald-400' : 'text-red-400')}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value}
    </span>
  )
}

function RunCard({ run, label }: { run: TestRunSnapshot; label: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-[#111318] border border-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{label}</span>
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', statusColor(run.status))}>
          {run.status}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-[#E8F0FF]">{run.project.name}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-mono">
          {run.branch ?? 'N/A'} · {run.commitSha?.slice(0, 8) ?? 'N/A'}
        </p>
        {run.commitMessage && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{run.commitMessage}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total', value: run.totalTests, icon: null, color: 'text-gray-300' },
          { label: 'Passed', value: run.passedTests, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Failed', value: run.failedTests, icon: XCircle, color: 'text-red-400' },
          { label: 'Healed', value: run.healedTests, icon: Sparkles, color: 'text-violet-400' },
        ].map(({ label: l, value, icon: Icon, color }) => (
          <div key={l} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <p className="text-[10px] text-gray-500 mb-1">{l}</p>
            <div className={cn('flex items-center gap-1.5 text-lg font-bold font-mono', color)}>
              {Icon && <Icon className="w-4 h-4" />}
              {value}
            </div>
          </div>
        ))}
      </div>

      {run.duration !== null && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {(run.duration / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

function ComparePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [aId, setAId] = useState(searchParams.get('a') ?? '')
  const [bId, setBId] = useState(searchParams.get('b') ?? '')
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compare = useCallback(async (a: string, b: string) => {
    if (!a || !b) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/test-runs/compare?a=${a}&b=${b}`, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Error al comparar')
        return
      }
      setResult(await res.json())
    } catch {
      setError('Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-compare if both IDs present in URL
  useEffect(() => {
    const a = searchParams.get('a')
    const b = searchParams.get('b')
    if (a && b) compare(a, b)
  }, [searchParams, compare])

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-gray-500" />
            <h1 className="text-sm font-semibold text-[#E8F0FF]">Comparar Test Runs</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Compará los resultados de dos ejecuciones de tests</p>
        </div>
      </div>

      {/* ID inputs */}
      <div className="rounded-xl bg-[#111318] border border-white/5 p-5 space-y-4">
        <p className="text-xs text-gray-500">Ingresá los IDs de los test runs a comparar</p>
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48 space-y-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Run A (Base)</label>
            <Input
              value={aId}
              onChange={e => setAId(e.target.value)}
              placeholder="Run ID base..."
              className="text-sm font-mono"
            />
          </div>
          <div className="flex-1 min-w-48 space-y-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Run B (Comparar)</label>
            <Input
              value={bId}
              onChange={e => setBId(e.target.value)}
              placeholder="Run ID a comparar..."
              className="text-sm font-mono"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => compare(aId, bId)}
              disabled={!aId || !bId || loading}
              size="sm"
              className="gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
              Comparar
            </Button>
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Side-by-side run cards */}
          <div className="flex gap-4 flex-wrap md:flex-nowrap">
            <RunCard run={result.a} label="Run A — Base" />
            <RunCard run={result.b} label="Run B — Comparación" />
          </div>

          {/* Delta summary */}
          <div className="rounded-xl bg-[#111318] border border-white/5 p-5 space-y-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Δ Diferencia (B − A)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total tests', value: result.delta.totalTests },
                { label: 'Passed', value: result.delta.passedTests },
                { label: 'Failed', value: result.delta.failedTests, invert: true },
                { label: 'Healed', value: result.delta.healedTests },
                { label: 'Duration (ms)', value: result.delta.duration, invert: true },
              ].map(({ label, value, invert }) => (
                <div key={label} className="rounded-lg bg-white/[0.02] border border-white/5 p-3 space-y-1">
                  <p className="text-[10px] text-gray-500">{label}</p>
                  <Delta value={value} invert={invert} />
                </div>
              ))}
            </div>
          </div>

          {/* Healing events comparison */}
          {(result.a.healingEvents.length > 0 || result.b.healingEvents.length > 0) && (
            <div className="rounded-xl bg-[#111318] border border-white/5 p-5 space-y-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                Healing Events
              </p>
              <div className="flex gap-4 flex-wrap md:flex-nowrap">
                {[
                  { events: result.a.healingEvents, label: 'Run A' },
                  { events: result.b.healingEvents, label: 'Run B' },
                ].map(({ events, label }) => (
                  <div key={label} className="flex-1 min-w-0 space-y-2">
                    <p className="text-[10px] text-gray-500">{label} — {events.length} evento{events.length !== 1 ? 's' : ''}</p>
                    {events.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">Sin healing events</p>
                    ) : (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {events.map(e => (
                          <div key={e.id} className="rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
                            <p className="text-xs text-[#E8F0FF] truncate">{e.testName}</p>
                            <p className={cn('text-[10px] mt-0.5', e.status === 'HEALED' ? 'text-violet-400' : 'text-red-400')}>
                              {e.status}
                              {e.confidence !== null && ` · ${e.confidence}%`}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  )
}
