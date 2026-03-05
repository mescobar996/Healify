"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Play,
  TestTube2,
  FolderKanban,
  BookOpen,
  Code2,
  BarChart3,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatNumber } from "@/lib/api";
import { DashboardSkeleton } from "@/components/ui/skeletons";
// P-L1: Lazy-load heavy below-the-fold components
const TestDetailSheet = dynamic(() => import("@/components/TestDetailSheet").then(m => ({ default: m.TestDetailSheet })), { ssr: false });
const ActivityFeed = dynamic(() => import("@/components/ActivityFeed").then(m => ({ default: m.ActivityFeed })), { ssr: false });
// OnboardingBanner moved to /dashboard/projects empty state
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { ErrorState } from "@/components/dashboard/ErrorState";
const HealingTrendChart = dynamic(() => import("@/components/dashboard/HealingTrendChart").then(m => ({ default: m.HealingTrendChart })), { ssr: false });
import { HealingHistoryList } from "@/components/dashboard/HealingHistoryList";
import { RoiStrip } from "@/components/dashboard/RoiStrip";
import { toast } from "sonner";
import { trackEvent } from "@/lib/track";
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
    trackEvent("roi_export", { format });
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
    trackEvent("dashboard_view");
  }, []);



  // Handler: Run Tests
  const handleRunTests = async () => {
    setIsRunning(true);
    trackEvent("run_tests_click");
    try {
      // Get projects to find one with a connected repository
      const res = await fetch('/api/projects', { credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo obtener los proyectos');
      const raw = await res.json();
      const projects: Array<{ id: string; name: string; repository: string | null }> = Array.isArray(raw) ? raw : (raw?.data ?? []);

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
    trackEvent("healing_detail_open", { itemId: item.id, status: item.status });
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

        <Tabs defaultValue="overview" className="space-y-4" onValueChange={(tab) => trackEvent("dashboard_tab", { tab })}>
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
        {roi && <RoiStrip roi={roi} onExport={handleExportRoi} />}

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
            <HealingTrendChart chartData={data.chartData} />
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
          <HealingHistoryList items={data.healingHistory} onOpenDetail={handleOpenDetail} />
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
              <HealingTrendChart chartData={data.chartData} gradientSuffix="Analysis" />
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Ir a proyectos <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
            <button onClick={handleSetupSandbox} className="group text-left rounded-lg border border-white/[0.07] bg-[#111111] p-5 hover:bg-[#151515] hover:border-white/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <Play className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-[#EDEDED]">Sandbox interactivo</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Carga automática de datos demo — 5 test runs y 5 curaciones</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Activar sandbox <ChevronRight className="w-3 h-3" />
              </span>
            </button>
            <Link href="/docs" className="group rounded-lg border border-white/[0.07] bg-[#111111] p-5 hover:bg-[#151515] hover:border-white/30 transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mb-3 group-hover:bg-white/20 transition-colors">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-medium text-[#EDEDED]">Implementar SDK</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Quickstart, API Reference y webhook en producción</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-white mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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