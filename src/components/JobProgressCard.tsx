"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle2, XCircle, Clock, Zap, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════
// JOB PROGRESS CARD
// Componente que hace polling a /api/job-status/[id] y muestra el
// estado real del Railway worker procesando un TestRun.
// ═══════════════════════════════════════════════════════════════════════

interface JobStatus {
  testRunId: string
  dbStatus: string
  jobId: string | null
  workerStatus: {
    state: string
    progress: number
    failedReason?: string
  } | null
  results: {
    passed: number
    failed: number
    healed: number
    total: number
  }
  timing: {
    startedAt: string | null
    finishedAt: string | null
  }
  error: string | null
}

interface JobProgressCardProps {
  testRunId: string
  /** Intervalo de polling en ms. Default: 3000 */
  pollInterval?: number
  /** Callback cuando el job termina (success o fail) */
  onComplete?: (status: JobStatus) => void
  className?: string
}

const STATUS_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  animate: boolean
}> = {
  PENDING:  { label: "En cola",     icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10",  animate: false },
  RUNNING:  { label: "Ejecutando",  icon: Loader2,       color: "text-blue-400",    bg: "bg-blue-500/10",   animate: true  },
  PASSED:   { label: "Pasado",      icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10",animate: false },
  FAILED:   { label: "Fallido",     icon: XCircle,       color: "text-red-400",     bg: "bg-red-500/10",    animate: false },
  HEALED:   { label: "Curado",      icon: Zap,           color: "text-violet-400",  bg: "bg-violet-500/10", animate: false },
  // BullMQ states
  active:   { label: "Procesando",  icon: Loader2,       color: "text-blue-400",    bg: "bg-blue-500/10",   animate: true  },
  waiting:  { label: "En cola",     icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10",  animate: false },
  completed:{ label: "Completado",  icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10",animate: false },
  failed:   { label: "Fallido",     icon: XCircle,       color: "text-red-400",     bg: "bg-red-500/10",    animate: false },
  delayed:  { label: "Demorado",    icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/10",  animate: false },
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#00F5C8] to-[#7B5EF8] rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function JobProgressCard({
  testRunId,
  pollInterval = 3000,
  onComplete,
  className,
}: JobProgressCardProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isTerminal = useCallback((s: JobStatus | null) => {
    if (!s) return false
    const terminalDbStates = ["PASSED", "FAILED", "HEALED"]
    const terminalWorkerStates = ["completed", "failed"]
    return (
      terminalDbStates.includes(s.dbStatus) ||
      (s.workerStatus ? terminalWorkerStates.includes(s.workerStatus.state) : false)
    )
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-status/${testRunId}`, { credentials: "include" })
      if (!res.ok) {
        if (res.status === 404) {
          setError("Test run no encontrado")
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data: JobStatus = await res.json()
      setStatus(data)
      setError(null)

      if (isTerminal(data) && onComplete) {
        onComplete(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setLoading(false)
    }
  }, [testRunId, isTerminal, onComplete])

  useEffect(() => {
    fetchStatus()

    const interval = setInterval(() => {
      if (!isTerminal(status)) {
        fetchStatus()
      }
    }, pollInterval)

    return () => clearInterval(interval)
  }, [fetchStatus, pollInterval, status, isTerminal])

  if (loading && !status) {
    return (
      <div className={cn("rounded-lg border border-white/8 bg-white/[0.02] p-4", className)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-white/5 rounded animate-pulse w-1/3" />
            <div className="h-2 bg-white/5 rounded animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-500/20 bg-red-500/5 p-4", className)}>
        <p className="text-xs text-red-400">{error}</p>
      </div>
    )
  }

  if (!status) return null

  // Determinar el estado efectivo (worker tiene prioridad si está disponible)
  const effectiveState = status.workerStatus?.state || status.dbStatus
  const config = STATUS_CONFIG[effectiveState] || STATUS_CONFIG["PENDING"]
  const Icon = config.icon
  const progress = status.workerStatus?.progress || 0
  const isActive = !isTerminal(status)
  const { passed, failed, healed, total } = status.results

  return (
    <div className={cn(
      "rounded-lg border transition-colors duration-300",
      isActive ? "border-blue-500/20 bg-blue-500/[0.03]" : "border-white/8 bg-white/[0.02]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0", config.bg)}>
          <Icon className={cn("w-3.5 h-3.5", config.color, config.animate && "animate-spin")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Worker Railway</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", config.bg, config.color)}>
              {config.label}
            </span>
          </div>
          {status.jobId && (
            <p className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
              Job: {status.jobId}
            </p>
          )}
        </div>
        {isActive && (
          <button
            onClick={fetchStatus}
            className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Progress bar — solo cuando está activo y hay progreso */}
      {isActive && (
        <div className="px-4 pt-3">
          <ProgressBar value={progress} />
          <p className="text-[10px] text-gray-500 mt-1">{progress}% completado</p>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="text-center p-2 rounded bg-white/[0.02]">
          <p className="text-sm font-semibold text-emerald-400">{passed}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pasados</p>
        </div>
        <div className="text-center p-2 rounded bg-white/[0.02]">
          <p className="text-sm font-semibold text-red-400">{failed}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Fallidos</p>
        </div>
        <div className="text-center p-2 rounded bg-white/[0.02]">
          <p className="text-sm font-semibold text-violet-400">{healed}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Curados</p>
        </div>
        <div className="text-center p-2 rounded bg-white/[0.02]">
          <p className="text-sm font-semibold text-gray-300">{total}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total</p>
        </div>
      </div>

      {/* Error detail */}
      {status.error && (
        <div className="px-4 pb-3">
          <div className="p-2.5 rounded bg-red-500/5 border border-red-500/10">
            <p className="text-[11px] text-red-400 font-mono break-all">{status.error}</p>
          </div>
        </div>
      )}

      {/* No Redis fallback */}
      {!status.jobId && status.dbStatus === "PENDING" && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-amber-400/70">
            ⚠️ Sin REDIS_URL — el job no fue encolado. Configuralo en Railway para procesamiento automático.
          </p>
        </div>
      )}
    </div>
  )
}
