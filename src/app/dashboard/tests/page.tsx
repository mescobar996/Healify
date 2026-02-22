"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronRight,
  FileCode,
  ArrowUpDown,
  AlertTriangle,
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
    <div className="group relative p-4 rounded-lg bg-[#111113] border border-white/5 hover:border-white/10 transition-all duration-150">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-widest text-gray-500 uppercase">
            {label}
          </p>
          <p className="text-2xl font-semibold text-white tracking-tight">
            {value}
          </p>
        </div>
        <div className={cn("p-2 rounded-md bg-white/5", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-3 rounded-full bg-white/5 mb-3">
        <FileCode className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <div className="p-3 rounded-full bg-red-500/10">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-gray-400 text-sm">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
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
  const [hasMore, setHasMore] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const fetchTestRuns = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getTestRuns({
        limit: 20,
        projectId: projectIdFilter || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
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
  }, [projectIdFilter, statusFilter]);

  // Filter test runs by search query
  const filteredTestRuns = useMemo(() => {
    if (!searchQuery.trim()) return testRuns;
    const query = searchQuery.toLowerCase();
    return testRuns.filter(
      (run) =>
        run.project.name.toLowerCase().includes(query) ||
        run.branch?.toLowerCase().includes(query)
    );
  }, [testRuns, searchQuery]);

  // Calculate stats from test runs
  const stats = useMemo(() => {
    const passed = testRuns.filter((r) => r.status === "PASSED" || r.status === "HEALED").length;
    const failed = testRuns.filter((r) => r.status === "FAILED").length;
    const healed = testRuns.reduce((acc, r) => acc + (r.healedTests || 0), 0);
    const running = testRuns.filter((r) => r.status === "RUNNING").length;
    return { passed, failed, healed, running };
  }, [testRuns]);

  // Handler: Run all tests
  const handleRunAllTests = async () => {
    setIsRunningAll(true);
    toast.info("Iniciando ejecución de todos los tests...", {
      description: "Este proceso puede tardar varios minutos",
    });

    // Simular proceso
    setTimeout(() => {
      toast.success("Todos los tests ejecutados", {
        description: `${stats.passed} pasados, ${stats.failed} fallidos`,
      });
      setIsRunningAll(false);
      fetchTestRuns();
    }, 3000);
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
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Test Runs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
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
              "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10",
              isPaused && "bg-amber-500/10 border-amber-500/20 text-amber-400"
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
            className="bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50"
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

      {/* Filters - Linear Style */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <Input
            placeholder="Buscar tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#111113] border-white/5 text-gray-200 placeholder:text-gray-500 focus:border-white/10"
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
                "px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150",
                statusFilter === f.value
                  ? "bg-white/5 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Test List - Linear Data Grid Style */}
      <div className="rounded-lg bg-[#111113] border border-white/5">
        {/* List Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-white">Ejecuciones</h2>
            <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
              {filteredTestRuns.length}
            </span>
          </div>
          <button
            onClick={fetchTestRuns}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Actualizar
          </button>
        </div>

        {/* Column Headers */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-medium tracking-widest text-gray-500 uppercase border-b border-white/5">
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
          <div className="divide-y divide-white/5">
            {filteredTestRuns.map((run) => (
              <Link
                key={run.id}
                href={`/dashboard/tests/${run.id}`}
                className="group hidden md:grid grid-cols-12 gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150"
              >
                {/* Test Name */}
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <FileCode className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate group-hover:text-white transition-colors">
                      {run.project.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {run.commitMessage || run.commitSha?.slice(0, 7) || "Manual run"}
                    </p>
                  </div>
                </div>

                {/* Project */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-gray-400 truncate">
                    {run.project.name}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-1 flex items-center">
                  <StatusBadge status={run.status} />
                </div>

                {/* Total Tests */}
                <div className="col-span-1 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-300">
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
                      run.failedTests > 0 ? "text-red-400" : "text-gray-500"
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
                      run.healedTests > 0 ? "text-violet-400" : "text-gray-500"
                    )}
                  >
                    {run.healedTests}
                  </span>
                </div>

                {/* Branch */}
                <div className="col-span-1 flex items-center">
                  <code className="text-[11px] text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded truncate max-w-full">
                    {run.branch || "—"}
                  </code>
                </div>

                {/* Date */}
                <div className="col-span-1 flex items-center">
                  <span className="text-[11px] text-gray-500">
                    {formatRelativeTime(run.startedAt)}
                  </span>
                </div>
              </Link>
            ))}

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-white/5">
              {filteredTestRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/dashboard/tests/${run.id}`}
                  className="group flex flex-col gap-2 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-sm text-gray-200 truncate group-hover:text-white">
                        {run.project.name}
                      </span>
                    </div>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatRelativeTime(run.startedAt)}</span>
                    <span>
                      {run.passedTests}/{run.totalTests} pasados
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Load More */}
        {hasMore && filteredTestRuns.length > 0 && (
          <div className="px-4 py-3 border-t border-white/5">
            <button className="flex items-center justify-center gap-1 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors">
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
