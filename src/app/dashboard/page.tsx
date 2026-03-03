"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Play,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Timer,
  Download,
  TestTube2,
  FolderKanban,
  BookOpen,
  Code2,
  BarChart3,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatNumber } from "@/lib/api";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { TestDetailSheet } from "@/components/TestDetailSheet";
import { ActivityFeed } from "@/components/ActivityFeed";
// OnboardingBanner moved to /dashboard/projects empty state
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { ConfidenceBar } from "@/components/dashboard/ConfidenceBar";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
import { toast } from "sonner";
import { executeTestRun } from "@/lib/actions";
import type {
  DashboardData,
  HealingStatus,
  HealingHistoryItem,
} from "@/types";

interface DashboardResponse extends DashboardData {
  isNewUser?: boolean
  projectCount?: number
}

interface WeeklyReportStatus {
  enabled: boolean
  scheduleUtc: string
  nextScheduledAt: string
  currentWeekKey: string
  sentThisWeek: boolean
  recentReports: number
  lastReport: {
    id: string
    weekKey: string | null
    sentAt: string
    message: string
  } | null
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

function DashboardContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  
  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HealingHistoryItem | null>(null);

  // ── ROI state ──────────────────────────────────────────────────────────────
  interface ROIData {
    timeSavedHours: number
    totalCostSaved: number
    autoHealedMonth: number
    bugsDetectedMonth: number
    healingRate: number
    healedToday: number
  }
  const { data: session } = useSession()
  const [roi, setRoi] = useState<ROIData | null>(null);
  const [weeklyStatus, setWeeklyStatus] = useState<WeeklyReportStatus | null>(null)
  const [sendingWeeklyReport, setSendingWeeklyReport] = useState(false)


  const fetchWeeklyStatus = async () => {
    try {
      const response = await fetch('/api/cron/weekly-report/status', { credentials: 'include' })
      if (!response.ok) return

      const payload = await response.json()
      if (payload && 'enabled' in payload) {
        setWeeklyStatus(payload as WeeklyReportStatus)
      }
    } catch {
    }
  }

  useEffect(() => {
    fetch('/api/analytics', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && 'timeSavedHours' in d) setRoi(d) })
      .catch(() => {})
  }, []);

  useEffect(() => {
    void fetchWeeklyStatus()
  }, [])

  const handleManualWeeklyReport = async () => {
    try {
      setSendingWeeklyReport(true)
      const response = await fetch('/api/cron/weekly-report', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || 'No se pudo ejecutar el weekly report')
      }

      const result = await response.json()
      toast.success('Weekly report ejecutado', {
        description: `Enviados: ${result.sent} · Omitidos: ${result.skipped}`,
      })
      void fetchWeeklyStatus()
    } catch (error) {
      toast.error('Error al ejecutar weekly report', {
        description: error instanceof Error ? error.message : 'Inténtalo nuevamente',
      })
    } finally {
      setSendingWeeklyReport(false)
    }
  }

  const handleExportRoi = (format: 'csv' | 'pdf') => {
    const a = document.createElement('a')
    a.href = `/api/analytics/export?format=${format}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Export ${format.toUpperCase()} iniciado`)
  }

  // Stripe success ahora se maneja en /dashboard/upgrade-success
  // canceled desde /pricing?canceled=true — mostrar toast informativo
  useEffect(() => {
    const canceled = searchParams.get('canceled')
    if (canceled === 'true') {
      toast.info('Pago cancelado', {
        description: 'Podés intentarlo de nuevo cuando estés listo.',
      })
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const dashboardData = await api.getDashboard();
      setData(dashboardData);
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);



  // Handler: Run Tests
  const handleRunTests = async () => {
    setIsRunning(true);
    try {
      // Get projects to find one with a connected repository
      const res = await fetch('/api/projects', { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo obtener los proyectos');
      const projects: Array<{ id: string; name: string; repository: string | null }> = await res.json();

      if (!projects?.length) {
        toast.error('No tenés proyectos', {
          description: 'Creá un proyecto primero en /dashboard/projects',
        });
        return;
      }

      const projectWithRepo = projects.find(p => p.repository);
      if (!projectWithRepo) {
        toast.error('Ningún proyecto tiene repositorio conectado', {
          description: 'Editá un proyecto y agregá su URL de repositorio.',
        });
        return;
      }

      toast.info(`Encolando tests para "${projectWithRepo.name}"...`, {
        description: 'El worker de Railway tomará el job en segundos',
      });

      const result = await executeTestRun(projectWithRepo.id);
      if (!result.success) {
        toast.error('Error al iniciar tests', { description: result.error });
        return;
      }

      toast.success('Tests encolados correctamente', {
        description: 'El worker está procesando. Revisá /dashboard/tests para el estado.',
      });
      await fetchDashboard();
    } catch (error) {
      toast.error('Error inesperado', {
        description: error instanceof Error ? error.message : 'Intentá de nuevo',
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Handler: Open test detail
  const handleOpenDetail = (item: HealingHistoryItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  // Handler: Approve healing — calls real PATCH /api/healing-events/:id
  const handleApproveHealing = async (id: string) => {
    toast.promise(
      fetch(`/api/healing-events/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', appliedBy: session?.user?.name || 'user' }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Error al aprobar');
        return r.json();
      }),
      {
        loading: "Aprobando curación...",
        success: () => {
          if (data) {
            setData({
              ...data,
              healingHistory: data.healingHistory.map((item) =>
                item.id === id ? { ...item, status: "curado" as HealingStatus } : item
              ),
            });
          }
          setSheetOpen(false);
          return "Curación aprobada y guardada";
        },
        error: (err) => `Error al aprobar: ${err?.message || 'Inténtalo nuevamente'}`,
      }
    );
  };

  // Handler: Reject healing — calls real PATCH /api/healing-events/:id
  const handleRejectHealing = async (id: string) => {
    toast.promise(
      fetch(`/api/healing-events/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', appliedBy: session?.user?.name || 'user' }),
      }).then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || 'Error al rechazar');
        return r.json();
      }),
      {
        loading: "Rechazando curación...",
        success: () => {
          if (data) {
            setData({
              ...data,
              healingHistory: data.healingHistory.map((item) =>
                item.id === id ? { ...item, status: "fallido" as HealingStatus } : item
              ),
            });
          }
          setSheetOpen(false);
          return "Curación rechazada";
        },
        error: (err) => `Error al rechazar: ${err?.message || 'Inténtalo nuevamente'}`,
      }
    );
  };

  // Loading State
  if (loading) {
    return <DashboardSkeleton />;
  }

  // Error State
  if (error) {
    return <ErrorState message={error} onRetry={fetchDashboard} />;
  }

  // No Data State
  if (!data) {
    return <ErrorState message="No se encontraron datos" onRetry={fetchDashboard} />;
  }

  const monitoredTests = data.chartData.reduce((acc, day) => acc + day.curados + day.testsRotos, 0);

  const handleSetupSandbox = async () => {
    try {
      const response = await api.setupSandbox();
      toast.success("Sandbox activado", {
        description: response.created
          ? "Creamos tu proyecto demo con datos iniciales"
          : "Tu sandbox ya estaba listo",
      });
      await fetchDashboard();
    } catch (sandboxError) {
      toast.error("No se pudo crear el sandbox", {
        description: sandboxError instanceof Error ? sandboxError.message : "Inténtalo nuevamente",
      });
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Vista general de tu actividad de tests
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {session?.user && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className=""
              >
                <Link href="/dashboard/team">Equipo</Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              className=""
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={handleRunTests}
              disabled={isRunning}
              className="disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Ejecutar Tests
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-[#111111] border border-white/[0.08] h-10 w-full sm:w-fit justify-start overflow-x-auto">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED] gap-1.5 text-[13px]">
              <BarChart3 className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analisis" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED] gap-1.5 text-[13px]">
              <TrendingUp className="w-3.5 h-3.5" />
              Análisis
            </TabsTrigger>
            <TabsTrigger value="funciones" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED] gap-1.5 text-[13px]">
              <Wrench className="w-3.5 h-3.5" />
              Funciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Tests monitoreados"
            value={formatNumber(monitoredTests)}
            change={monitoredTests > 0 ? "+activo" : "Sin actividad"}
            trend={monitoredTests > 0 ? "up" : "neutral"}
            icon={TestTube2}
          />
          <MetricCard
            label="Tests Hoy"
            value={formatNumber(data.metrics.testsExecutedToday)}
            change={data.metrics.testsExecutedTodayChange}
            trend={data.metrics.testsExecutedTodayChange.startsWith("+") ? "up" : "down"}
            icon={Zap}
          />
          <MetricCard
            label="Autocuración"
            value={`${data.metrics.autoHealingRate}%`}
            change={data.metrics.autoHealingRateChange}
            trend="up"
            icon={CheckCircle2}
          />
          <MetricCard
            label="Bugs detectados"
            value={data.metrics.bugsDetected}
            change={data.metrics.bugsDetectedChange}
            trend="down"
            icon={AlertTriangle}
          />
        </div>

        {/* ROI Strip — Bloque 7 */}
        {roi && (
          <div className="rounded-lg border border-white/[0.07] bg-[#111111] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span className="text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
                ROI de Healify — acumulado histórico
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => handleExportRoi('csv')}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button
                  onClick={() => handleExportRoi('pdf')}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  PDF
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 divide-x-0 md:divide-x divide-[var(--border-subtle)]">
              {/* Horas ahorradas */}
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#1A1A1A' }}>
                  <Timer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
                    {roi.timeSavedHours > 0 ? `${roi.timeSavedHours}h` : '—'}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">horas ahorradas</p>
                </div>
              </div>
              {/* Ahorro en $ */}
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#1A1A1A' }}>
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
                    {roi.totalCostSaved > 0 ? `$${roi.totalCostSaved.toLocaleString()}` : '—'}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">ahorro estimado</p>
                </div>
              </div>
              {/* Tests autocurados este mes */}
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#1A1A1A' }}>
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
                    {roi.autoHealedMonth > 0 ? roi.autoHealedMonth : '—'}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">curados este mes</p>
                </div>
              </div>
              {/* Tasa de autocuración */}
              <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: '#1A1A1A' }}>
                  <TrendingUp className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
                    {roi.healingRate > 0 ? `${roi.healingRate}%` : '—'}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">tasa autocuración</p>
                </div>
              </div>
            </div>
            {/* Empty state si no hay datos todavía */}
            {roi.timeSavedHours === 0 && roi.autoHealedMonth === 0 && (
              <div className="px-5 py-3 border-t border-[var(--border-subtle)]">
                <p className="text-[11px] text-[var(--text-tertiary)] text-center">
                  Los datos de ROI aparecerán cuando Healify cure su primer test · 
                  <a href="/dashboard/projects" className="text-[var(--accent-primary)]/70 hover:text-[var(--accent-primary)] transition-colors ml-1">
                    Conectá tu primer repo →
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Weekly Report Status */}
        {weeklyStatus && (
          <div className="rounded-xl border border-[var(--border-default)] px-4 py-3 bg-[var(--bg-card)]">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
                  Weekly report automático
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {weeklyStatus.sentThisWeek
                    ? `Enviado esta semana (${weeklyStatus.currentWeekKey})`
                    : `Pendiente de envío esta semana (${weeklyStatus.currentWeekKey})`}
                </p>
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Próximo envío: {new Date(weeklyStatus.nextScheduledAt).toLocaleString()}
              </div>
            </div>

            {session?.user?.role === 'admin' && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sendingWeeklyReport}
                  onClick={handleManualWeeklyReport}
                  className=""
                >
                  <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', sendingWeeklyReport && 'animate-spin')} />
                  {sendingWeeklyReport ? 'Enviando...' : 'Enviar ahora'}
                </Button>
                <span className="text-[11px] text-[var(--text-tertiary)]">Solo admin/fundador</span>
              </div>
            )}

            <div className="mt-2 text-[11px] text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
              <span>Frecuencia: {weeklyStatus.scheduleUtc} (UTC)</span>
              <span>Reportes enviados: {weeklyStatus.recentReports}</span>
              <span>
                Último envío:{' '}
                {weeklyStatus.lastReport
                  ? new Date(weeklyStatus.lastReport.sentAt).toLocaleString()
                  : 'sin envíos todavía'}
              </span>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Chart Section */}
          <div className="lg:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
                  Tendencia de Curación
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">Últimos 7 días</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-[var(--text-secondary)]">Curados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-[var(--text-secondary)]">Rotos</span>
                </div>
              </div>
            </div>

            {data.chartData.length === 0 ? (
              <EmptyState
                title="Sin datos de gráfico"
                description="Los datos aparecerán cuando se ejecuten tests"
              />
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData}>
                    <defs>
                      <linearGradient id="healingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="brokenGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E85C4A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#E85C4A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a1c",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="curados"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#healingGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="testsRotos"
                      stroke="#E85C4A"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#brokenGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Fragile Selectors */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                Selectores Frágiles
              </h2>
              <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                TOP {data.fragileSelectors.length}
              </span>
            </div>

            {data.fragileSelectors.length === 0 ? (
              <EmptyState
                title="No hay selectores frágiles"
                description="Todos los selectores funcionan correctamente"
              />
            ) : (
              <div className="space-y-2">
                {data.fragileSelectors.map((selector, index) => (
                  <motion.div
                    key={selector.selector}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-[var(--text-primary)] font-mono truncate block">
                        {selector.selector}
                      </code>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-red-400">
                          {selector.failures} fallos
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">•</span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {selector.successRate}% éxito
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed & Healing History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          {/* Activity Feed */}
          <ActivityFeed limit={5} />

          {/* Healing History List - Linear Style */}
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)]">
          {/* List Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                Últimas Curaciones
              </h2>
              <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">
                {data.healingHistory.length}
              </span>
            </div>
            <button className="min-h-[44px] px-2 inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <ArrowUpDown className="w-3 h-3" />
              Ordenar
            </button>
          </div>

          {/* List Items */}
          {data.healingHistory.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                title="No hay eventos de curación"
                description="Los eventos aparecerán cuando se ejecuten tests con fallos"
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {data.healingHistory.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <button
                    onClick={() => handleOpenDetail(item)}
                    className="group w-full px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {item.status === "curado" ? (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                          </div>
                        ) : item.status === "fallido" ? (
                          <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
                            <XCircle className="w-3 h-3 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                            <Clock className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate transition-colors">
                          {item.testName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] text-[var(--text-tertiary)] font-mono truncate max-w-[100px] sm:max-w-[200px]">
                            {item.oldSelector}
                          </code>
                          {item.newSelector && (
                            <>
                              <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                              <code className="text-[11px] text-white font-mono truncate max-w-[100px] sm:max-w-[200px]">
                                {item.newSelector}
                              </code>
                            </>
                          )}
                        </div>

                        <div className="flex md:hidden items-center gap-2 mt-1.5">
                          <StatusBadge status={item.status} />
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                            {item.confidence}%
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)]">{item.timestamp}</span>
                        </div>
                      </div>

                      {/* Desktop Metadata */}
                      <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                        <ConfidenceBar confidence={item.confidence} />
                        <StatusBadge status={item.status} />
                        <span className="text-[11px] text-[var(--text-tertiary)] w-20 text-right">
                          {item.timestamp}
                        </span>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="hidden md:block w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* List Footer */}
          {data.healingHistory.length > 0 && (
            <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
              <Link
                href="/dashboard/tests"
                className="flex items-center justify-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Ver todos los tests
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          </div>
        </div>
        </TabsContent>

        <TabsContent value="analisis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#6B6B6B]">Tests monitoreados</p>
              <p className="text-2xl font-semibold text-[#EDEDED] mt-1">{formatNumber(monitoredTests)}</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Últimos 7 días</p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#6B6B6B]">Curaciones recientes</p>
              <p className="text-2xl font-semibold text-[#EDEDED] mt-1">{data.healingHistory.length}</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Eventos con IA y revisión</p>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-4">
              <p className="text-[11px] uppercase tracking-widest text-[#6B6B6B]">Tiempo promedio</p>
              <p className="text-2xl font-semibold text-[#EDEDED] mt-1">{data.metrics.avgHealingTime}</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Cambio {data.metrics.avgHealingTimeChange}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
            <div className="lg:col-span-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">Tendencia de Curación</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Últimos 7 días</p>
                </div>
              </div>

              {data.chartData.length === 0 ? (
                <EmptyState title="Sin datos de análisis" description="Ejecutá tests para activar insights" />
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.chartData}>
                      <defs>
                        <linearGradient id="healingGradAnalysis" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="brokenGradAnalysis" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E85C4A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#E85C4A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <YAxis hide />
                      <Area type="monotone" dataKey="curados" stroke="#FFFFFF" strokeWidth={2} fillOpacity={1} fill="url(#healingGradAnalysis)" />
                      <Area type="monotone" dataKey="testsRotos" stroke="#E85C4A" strokeWidth={2} fillOpacity={1} fill="url(#brokenGradAnalysis)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <h2 className="text-sm font-medium text-[var(--text-primary)] mb-4">Selectores frágiles</h2>
              {data.fragileSelectors.length === 0 ? (
                <EmptyState title="Sin fragilidad detectada" description="Tus selectores están estables" />
              ) : (
                <div className="space-y-2">
                  {data.fragileSelectors.slice(0, 6).map((selector) => (
                    <div key={selector.selector} className="p-2 rounded-md bg-[var(--bg-hover)]">
                      <code className="text-xs text-[var(--text-primary)] font-mono truncate block">{selector.selector}</code>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{selector.failures} fallos · {selector.successRate}% éxito</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="funciones" className="space-y-4">
          {/* Activation Progress Bar */}
          {(() => {
            const steps = [
              { label: 'Proyecto conectado', done: ((data as DashboardResponse).projectCount || 0) > 0 },
              { label: 'Primera ejecución', done: data.metrics.testsExecutedToday > 0 || data.chartData.length > 0 },
              { label: 'Primera curación', done: data.healingHistory.length > 0 },
            ]
            const doneCount = steps.filter(s => s.done).length
            const pct = Math.round((doneCount / steps.length) * 100)
            return (
              <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Progreso de activación</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{doneCount}/3 pasos completados</p>
                  </div>
                  <span className="text-lg font-bold text-white">{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden mb-4">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-white to-[#BEBEBE] transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {steps.map((step, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg border transition-colors",
                      step.done 
                        ? "bg-white/5 border-white/20" 
                        : "bg-[var(--bg-elevated)] border-white/[0.05]"
                    )}>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        step.done ? "bg-white/20 text-white" : "bg-white/15 text-white"
                      )}>
                        {step.done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                      </div>
                      <span className={cn("text-[12px]", step.done ? "text-white" : "text-[var(--text-secondary)]")}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/dashboard/projects" className="group rounded-lg border border-white/[0.07] bg-[#111111] p-5 hover:bg-[#151515] hover:border-white/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <FolderKanban className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-[#EDEDED]">Conectar repositorio</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Creá y configurá proyectos para activar monitoreo</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Ir a proyectos <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <button onClick={handleSetupSandbox} className="group text-left rounded-lg border border-white/[0.07] bg-[#111111] p-5 hover:bg-[#151515] hover:border-white/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <Play className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-[#EDEDED]">Sandbox interactivo</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Carga automática de datos demo — 5 test runs y 5 curaciones</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Activar sandbox <ChevronRight className="w-3 h-3" />
              </span>
            </button>
            <Link href="/docs" className="group rounded-lg border border-white/[0.07] bg-[#111111] p-5 hover:bg-[#151515] hover:border-white/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-[#EDEDED]">Implementar SDK</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Quickstart, API Reference y webhook en producción</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Ver documentación <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          {/* SDK Quick Start */}
          <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Code2 className="w-4 h-4 text-white" />
              <h3 className="text-sm font-medium text-[#EDEDED]">SDK Quick Start</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md bg-black/40 border border-white/[0.05] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-2">1. Instalar</p>
                <code className="text-xs text-white font-mono">npm i -D @healify/test-runner</code>
              </div>
              <div className="rounded-md bg-black/40 border border-white/[0.05] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mb-2">2. Configurar</p>
                <code className="text-[11px] text-white font-mono block leading-relaxed">
                  {"HEALIFY_API_KEY=hk_live_..."}
                </code>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-3">
              Configuración completa en{' '}
              <Link href="/docs" className="text-white hover:text-[#EDEDED]/80 underline underline-offset-2">
                docs →
              </Link>
            </p>
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {/* Test Detail Sheet */}
      <TestDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        data={selectedItem ? {
          id: selectedItem.id,
          testName: selectedItem.testName,
          testFile: selectedItem.testName.replace(".spec.ts", ".test.ts"),
          status: selectedItem.status,
          confidence: selectedItem.confidence,
          timestamp: selectedItem.timestamp,
          errorMessage: null,
          oldSelector: selectedItem.oldSelector,
          newSelector: selectedItem.newSelector,
          reasoning: null,
        } : null}
        onApprove={handleApproveHealing}
        onReject={handleRejectHealing}
      />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}