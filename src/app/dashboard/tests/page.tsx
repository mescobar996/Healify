"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Play,
  Pause,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronRight,
  FileCode,
  ArrowUpDown,
  AlertTriangle,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, formatRelativeTime } from "@/lib/api";
import { TestRunsSkeleton } from "@/components/ui/skeletons";
import { toast } from "sonner";
import type { TestRun, TestRunStatus } from "@/types";

// ============================================
// LINEAR STYLE COMPONENTS
// ============================================

function StatusBadge({ status }: { status: TestRunStatus }) {
  const variants: Record<TestRunStatus, { bg: string; text: string; icon: React.ElementType }> = {
    PASSED: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      icon: CheckCircle2,
    },
    FAILED: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      icon: XCircle,
    },
    HEALED: {
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      icon: Zap,
    },
    RUNNING: {
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      icon: RefreshCw,
    },
    PENDING: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      icon: Clock,
    },
    CANCELLED: {
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      icon: XCircle,
    },
    PARTIAL: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      icon: AlertTriangle,
    },
  };

  const variant = variants[status] || variants.PENDING;
  const Icon = variant.icon;

  const labelMap: Record<TestRunStatus, string> = {
    PASSED: "Pasado",
    FAILED: "Fallido",
    HEALED: "Curado",
    RUNNING: "Ejecutando",
    PENDING: "Pendiente",
    CANCELLED: "Cancelado",
    PARTIAL: "Parcial",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
        variant.bg,
        variant.text
      )}
    >
      <Icon className={cn("w-3 h-3", status === "RUNNING" && "animate-spin")} />
      {labelMap[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconColor: string;
}) {
  return (
    <div className="group relative p-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-all duration-150">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
            {label}
          </p>
          <p className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn("p-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-3 rounded-full bg-[var(--bg-elevated)] mb-3">
        <FileCode className="w-5 h-5 text-[var(--text-tertiary)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <div className="p-3 rounded-full bg-red-500/10">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-[var(--text-secondary)] text-sm">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className=""
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reintentar
      </Button>
    </div>
  );
}

// ============================================
// MAIN TEST RUNS COMPONENT
// ============================================

function TestsContent() {
  const searchParams = useSearchParams();
  const projectIdFilter = searchParams.get("project");

  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [hasMore, setHasMore] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runTags, setRunTags] = useState<Record<string, string[]>>({})
  const [branchComparison, setBranchComparison] = useState<{
    branches: string[]
    base: { branch: string; runs: number; failedTests: number; failureRate: number; healedRuns: number }
    compare: { branch: string; runs: number; failedTests: number; failureRate: number; healedRuns: number } | null
    delta: { failedTests: number; failureRate: number; healedRuns: number } | null
  } | null>(null)
  const [compareBranch, setCompareBranch] = useState<string>('')

  const fetchBranchComparison = async (branchToCompare?: string) => {
    try {
      const params = new URLSearchParams({ base: 'main' })
      if (branchToCompare) params.set('compare', branchToCompare)

      const response = await fetch(`/api/analytics/branch-comparison?${params.toString()}`, {
        credentials: 'include',
      })
      if (!response.ok) return

      const data = await response.json()
      setBranchComparison(data)
      if (!branchToCompare && data?.compare?.branch) {
        setCompareBranch(data.compare.branch)
      }
    } catch {
    }
  }

  const fetchTestRuns = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getTestRuns({
        limit: 20,
        projectId: projectIdFilter || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        q: searchQuery.trim() || undefined,
      });
      setTestRuns(response.testRuns);
      setHasMore(response.pagination.hasMore);
    } catch (err) {
      console.error("Error fetching test runs:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los tests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestRuns();
  }, [projectIdFilter, statusFilter, searchQuery]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('healify_test_run_tags')
      if (saved) {
        setRunTags(JSON.parse(saved))
      }
    } catch {
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('healify_test_run_tags', JSON.stringify(runTags))
    } catch {
    }
  }, [runTags])

  const addTagToRun = (runId: string) => {
    const rawTag = window.prompt('Nueva etiqueta para este test run (ej: flaky, login, checkout):')
    if (!rawTag) return

    const tag = rawTag.trim().toLowerCase()
    if (!tag) return

    setRunTags((previous) => {
      const current = previous[runId] || []
      if (current.includes(tag)) return previous
      return {
        ...previous,
        [runId]: [...current, tag],
      }
    })
  }

  const removeTagFromRun = (runId: string, tag: string) => {
    setRunTags((previous) => ({
      ...previous,
      [runId]: (previous[runId] || []).filter((existing) => existing !== tag),
    }))
  }

  useEffect(() => {
    void fetchBranchComparison()
  }, [])

  // Filter test runs by search query
  const allTags = useMemo(() => {
    return Array.from(new Set(Object.values(runTags).flat())).sort()
  }, [runTags])

  const filteredTestRuns = useMemo(() => {
    if (selectedTag === 'all') return testRuns
    return testRuns.filter((run) => (runTags[run.id] || []).includes(selectedTag))
  }, [testRuns, runTags, selectedTag]);

  // Calculate stats from test runs
  const stats = useMemo(() => {
    const passed = testRuns.filter((r) => r.status === "PASSED" || r.status === "HEALED").length;
    const failed = testRuns.filter((r) => r.status === "FAILED").length;
    const healed = testRuns.reduce((acc, r) => acc + (r.healedTests || 0), 0);
    const running = testRuns.filter((r) => r.status === "RUNNING").length;
    return { passed, failed, healed, running };
  }, [testRuns]);

  // Handler: Export CSV
  const handleExport = () => {
    const projectId = projectIdFilter || (filteredTestRuns[0]?.project?.id ?? '')
    if (!projectId) {
      toast.error('Seleccioná un proyecto para exportar')
      return
    }
    const url = `/api/test-runs/export?projectId=${projectId}&format=csv`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Descargando CSV...')
  }

  // Handler: Run all tests
  const handleRunAllTests = async () => {
    // Obtener proyectos únicos de los test runs visibles
    const uniqueProjectIds = Array.from(
      new Set(filteredTestRuns.map(r => r.project?.id).filter(Boolean) as string[])
    )
    if (uniqueProjectIds.length === 0) {
      toast.error("No hay proyectos con tests para ejecutar")
      return
    }
    setIsRunningAll(true)
    toast.info(`Ejecutando tests en ${uniqueProjectIds.length} proyecto(s)...`)
    let success = 0, failed = 0
    await Promise.allSettled(
      uniqueProjectIds.map(async (projectId) => {
        try {
          await fetch(`/api/projects/${projectId}/run`, {
            method: "POST",
            credentials: "include",
          })
          success++
        } catch {
          failed++
        }
      })
    )
    if (success > 0) toast.success(`${success} proyecto(s) iniciados`, {
      description: failed > 0 ? `${failed} fallaron al iniciar` : "Los tests están en la cola del worker"
    })
    else toast.error("No se pudo iniciar ningún test")
    setIsRunningAll(false)
    setTimeout(fetchTestRuns, 2000)
  };

  // Loading State
  if (loading && testRuns.length === 0) {
    return <TestRunsSkeleton />;
  }

  // Error State
  if (error && testRuns.length === 0) {
    return <ErrorState message={error} onRetry={fetchTestRuns} />;
  }

  return (
    <div className="space-y-4">
      {/* Page Header - Linear Style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            Test Runs
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Historial de ejecuciones y autocuraciones
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsPaused(!isPaused);
              toast.success(isPaused ? "Cola reanudada" : "Cola pausada");
            }}
            className={cn(
              "",
              isPaused && "bg-amber-500/10 border-amber-500/20 text-amber-300"
            )}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Reanudar Cola
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                Pausar Cola
              </>
            )}
          </Button>
          <Button 
            size="sm" 
            onClick={handleRunAllTests}
            disabled={isRunningAll}
            className="disabled:opacity-50"
          >
            {isRunningAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Ejecutar Todos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards - Linear Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Pasados"
          value={stats.passed}
          icon={CheckCircle2}
          iconColor="text-emerald-400"
        />
        <StatCard
          label="Fallidos"
          value={stats.failed}
          icon={XCircle}
          iconColor="text-red-400"
        />
        <StatCard
          label="Curados"
          value={stats.healed}
          icon={Zap}
          iconColor="text-violet-400"
        />
        <StatCard
          label="En Progreso"
          value={stats.running}
          icon={RefreshCw}
          iconColor="text-blue-400"
        />
      </div>

      {/* Branch Comparison */}
      {branchComparison && (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Branch comparison</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">main vs feature (últimos 30 días)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">Comparar con:</span>
              <select
                value={compareBranch}
                onChange={(event) => {
                  const value = event.target.value
                  setCompareBranch(value)
                  void fetchBranchComparison(value)
                }}
                className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)]"
              >
                {(branchComparison.branches || [])
                  .filter((branch) => branch !== 'main')
                  .map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {branchComparison.compare ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Fallos en tests</p>
                <p className="text-sm text-[var(--text-primary)] mt-1">
                  {branchComparison.base.branch}: <span className="text-[var(--text-secondary)]">{branchComparison.base.failedTests}</span>
                </p>
                <p className="text-sm text-[var(--text-primary)]">
                  {branchComparison.compare.branch}: <span className="text-[var(--text-secondary)]">{branchComparison.compare.failedTests}</span>
                </p>
                <p className={cn('text-xs mt-1', (branchComparison.delta?.failedTests || 0) <= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  Δ {branchComparison.delta?.failedTests || 0}
                </p>
              </div>

              <div className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Failure rate</p>
                <p className="text-sm text-[var(--text-primary)] mt-1">{branchComparison.base.branch}: {branchComparison.base.failureRate}%</p>
                <p className="text-sm text-[var(--text-primary)]">{branchComparison.compare.branch}: {branchComparison.compare.failureRate}%</p>
                <p className={cn('text-xs mt-1', (branchComparison.delta?.failureRate || 0) <= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  Δ {branchComparison.delta?.failureRate || 0}%
                </p>
              </div>

              <div className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-3">
                <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-wide">Runs curados</p>
                <p className="text-sm text-[var(--text-primary)] mt-1">{branchComparison.base.branch}: {branchComparison.base.healedRuns}</p>
                <p className="text-sm text-[var(--text-primary)]">{branchComparison.compare.branch}: {branchComparison.compare.healedRuns}</p>
                <p className={cn('text-xs mt-1', (branchComparison.delta?.healedRuns || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  Δ {branchComparison.delta?.healedRuns || 0}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">No hay branch secundaria para comparar todavía.</p>
          )}
        </div>
      )}

      {/* Filters - Linear Style */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <Input
            placeholder="Buscar por test name, branch, commit..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "Todos" },
            { value: "PASSED", label: "Pasados" },
            { value: "FAILED", label: "Fallidos" },
            { value: "HEALED", label: "Curados" },
            { value: "RUNNING", label: "En Progreso" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 border",
                statusFilter === f.value
                  ? "bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              )}
            >
              {f.label}
            </button>
          ))}
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]"
          >
            <option value="all">Todas las etiquetas</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Test List - Linear Data Grid Style */}
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
        {/* List Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-[var(--text-primary)]">Ejecuciones</h2>
            <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
              {filteredTestRuns.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
              title="Exportar como CSV"
            >
              <Download className="w-3 h-3" />
              CSV
            </button>
              <span className="text-[var(--text-tertiary)]">·</span>
            <button
              onClick={fetchTestRuns}
              className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Actualizar
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase border-b border-[var(--border-subtle)]">
          <div className="col-span-3">Test</div>
          <div className="col-span-2">Proyecto</div>
          <div className="col-span-1">Estado</div>
          <div className="col-span-1 text-center">Tests</div>
          <div className="col-span-1 text-center">Pasados</div>
          <div className="col-span-1 text-center">Fallidos</div>
          <div className="col-span-1 text-center">Curados</div>
          <div className="col-span-1">Branch</div>
          <div className="col-span-1">Fecha</div>
        </div>

        {/* List Items */}
        {filteredTestRuns.length === 0 ? (
          <EmptyState
            title="No hay test runs"
            description={searchQuery ? "No se encontraron resultados para tu búsqueda" : "Los test runs aparecerán cuando se ejecuten tests"}
          />
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredTestRuns.map((run) => (
              <Link
                key={run.id}
                href={`/dashboard/tests/${run.id}`}
                className="group hidden md:grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors duration-150"
              >
                {/* Test Name */}
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <FileCode className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--text-primary)] truncate transition-colors">
                      {run.project?.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                      {run.commitMessage || run.commitSha?.slice(0, 7) || "Manual run"}
                    </p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {(runTags[run.id] || []).map((tag) => (
                        <button
                          key={`${run.id}-${tag}`}
                          onClick={(event) => {
                            event.preventDefault()
                            removeTagFromRun(run.id, tag)
                          }}
                          className="px-1.5 py-0.5 rounded bg-[rgba(94,106,210,0.10)] text-[var(--accent-primary)] text-[10px]"
                          title="Quitar etiqueta"
                        >
                          {tag}
                        </button>
                      ))}
                      <button
                        onClick={(event) => {
                          event.preventDefault()
                          addTagToRun(run.id)
                        }}
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
                      >
                        <Tag className="w-3 h-3" />
                        tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* Project */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-[var(--text-secondary)] truncate">
                    {run.project?.name}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-1 flex items-center">
                  <StatusBadge status={run.status} />
                </div>

                {/* Total Tests */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {run.totalTests}
                  </span>
                </div>

                {/* Passed */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-medium text-emerald-400">
                    {run.passedTests}
                  </span>
                </div>

                {/* Failed */}
                <div className="col-span-1 flex items-center justify-center">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      run.failedTests > 0 ? "text-red-400" : "text-[var(--text-tertiary)]"
                    )}
                  >
                    {run.failedTests}
                  </span>
                </div>

                {/* Healed */}
                <div className="col-span-1 flex items-center justify-center">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      run.healedTests > 0 ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
                    )}
                  >
                    {run.healedTests}
                  </span>
                </div>

                {/* Branch */}
                <div className="col-span-1 flex items-center">
                  <code className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded truncate max-w-full">
                    {run.branch || "—"}
                  </code>
                </div>

                {/* Date */}
                <div className="col-span-1 flex items-center">
                  <span className="text-[11px] text-[var(--text-tertiary)]">
                    {formatRelativeTime(run.startedAt)}
                  </span>
                </div>
              </Link>
            ))}

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-[var(--border-subtle)]">
              {filteredTestRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/tests/${run.id}`}
                  className="group flex flex-col gap-2 px-4 py-3.5 hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)] transition-colors duration-150"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-sm text-[var(--text-primary)] block truncate leading-tight">
                          {run.project?.name}
                        </span>
                        {run.branch && (
                          <span className="text-[10px] text-[var(--text-tertiary)] font-mono truncate block mt-0.5">
                            {run.branch}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] pl-6">
                    <span className="text-emerald-400 font-medium">{run.passedTests}✓</span>
                    {run.failedTests > 0 && <span className="text-red-400 font-medium">{run.failedTests}✗</span>}
                    {run.healedTests > 0 && <span className="text-violet-400 font-medium">{run.healedTests}⚡</span>}
                    <span className="ml-auto">{formatRelativeTime(run.startedAt)}</span>
                  </div>
                  <div className="pl-6 flex items-center gap-1 flex-wrap mt-1">
                    {(runTags[run.id] || []).map((tag) => (
                      <button
                        key={`${run.id}-mobile-${tag}`}
                        onClick={(event) => {
                          event.preventDefault()
                          removeTagFromRun(run.id, tag)
                        }}
                        className="px-1.5 py-0.5 rounded bg-[rgba(94,106,210,0.10)] text-[var(--accent-primary)] text-[10px]"
                      >
                        {tag}
                      </button>
                    ))}
                    <button
                      onClick={(event) => {
                        event.preventDefault()
                        addTagToRun(run.id)
                      }}
                      className="inline-flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]"
                    >
                      <Tag className="w-3 h-3" />
                      tag
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Load More */}
        {hasMore && filteredTestRuns.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
            <button className="flex items-center justify-center gap-1 w-full text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Cargar más
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// EXPORT DEFAULT WITH SUSPENSE
// ============================================

export default function TestsPage() {
  return (
    <Suspense fallback={<TestRunsSkeleton />}>
      <TestsContent />
    </Suspense>
  );
}
