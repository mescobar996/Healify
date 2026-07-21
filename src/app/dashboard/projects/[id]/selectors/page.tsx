'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Target, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface AnalyzedSelector {
  selector: string
  type: string
  score: number
  recommendation?: string
}

// ── Grade bucket, matches SelectorAnalyzer.getRecommendation()'s cutoffs (0.85 / 0.65 / 0.40) ──
function grade(score: number): { letter: string; label: string; color: string; bg: string } {
  if (score >= 0.85) return { letter: 'A', label: 'Excelente', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (score >= 0.65) return { letter: 'B', label: 'Aceptable', color: 'text-amber-400', bg: 'bg-amber-500/10' }
  if (score >= 0.40) return { letter: 'C', label: 'Riesgo medio', color: 'text-orange-400', bg: 'bg-orange-500/10' }
  return { letter: 'D', label: 'Riesgo crítico', color: 'text-red-400', bg: 'bg-red-500/10' }
}

const TYPE_LABEL: Record<string, string> = {
  TESTID: 'data-testid',
  ROLE: 'role/aria',
  TEXT: 'texto',
  CSS: 'CSS',
  XPATH: 'XPath',
  MIXED: 'mixto',
  UNKNOWN: 'desconocido',
}

export default function ProjectSelectorsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id

  const [selectors, setSelectors] = useState<AnalyzedSelector[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSelectors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/selectors?projectId=${projectId}`, { credentials: 'include' })
      if (res.ok) {
        setSelectors(await res.json())
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'No se pudieron cargar los selectores')
      }
    } catch {
      setError('Error inesperado al cargar los selectores')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchSelectors() }, [fetchSelectors])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <p className="text-sm text-gray-500">{error}</p>
        <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/projects')}>
          Volver
        </Button>
      </div>
    )
  }

  const avgScore = selectors && selectors.length > 0
    ? selectors.reduce((sum, s) => sum + s.score, 0) / selectors.length
    : null

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-500" />
            <h1 className="text-sm font-semibold text-[#E8F0FF]">Estabilidad de selectores</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {selectors?.length ?? 0} selector{selectors?.length === 1 ? '' : 'es'} rastreado{selectors?.length === 1 ? '' : 's'}, ordenados por más fallidos
          </p>
        </div>
        {avgScore !== null && (
          <div className={cn('px-2.5 py-1 rounded-md text-xs font-mono font-semibold', grade(avgScore).bg, grade(avgScore).color)}>
            Promedio {grade(avgScore).letter} · {Math.round(avgScore * 100)}%
          </div>
        )}
      </div>

      {/* List */}
      {!selectors || selectors.length === 0 ? (
        <div className="rounded-xl bg-[#111318] border border-white/5 p-8 text-center">
          <Target className="w-6 h-6 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Todavía no hay selectores rastreados en este proyecto.</p>
          <p className="text-xs text-gray-600 mt-1">Aparecen acá a medida que corren tests y Healify los observa.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#111318] border border-white/5 divide-y divide-white/5">
          {selectors.map((s, i) => {
            const g = grade(s.score)
            return (
              <div key={`${s.selector}-${i}`} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide bg-white/5 text-gray-400">
                      {TYPE_LABEL[s.type] ?? s.type}
                    </span>
                  </div>
                  <code className="text-xs font-mono text-gray-300 break-all">{s.selector}</code>
                  {s.recommendation && (
                    <p className="text-xs text-gray-500 mt-1.5">{s.recommendation}</p>
                  )}
                </div>
                <div className={cn('shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-lg', g.bg)}>
                  <span className={cn('text-lg font-bold leading-none', g.color)}>{g.letter}</span>
                  <span className={cn('text-[10px] font-mono mt-0.5', g.color)}>{Math.round(s.score * 100)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
