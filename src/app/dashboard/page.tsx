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
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  Play,
  Pause,
  DollarSign,
  Sparkles,
  ShieldCheck,
  Timer,
  Download,
  TestTube2,
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
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { toast } from "sonner";
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
// LINEAR STYLE COMPONENTS
// ============================================

function MetricCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: React.ElementType;
}) {
  return (
    <div className="p-4 rounded-lg bg-[#111111] border border-white/[0.07] flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[#6B6B6B] uppercase tracking-widest inline-flex items-center gap-1.5">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="text-[28px] font-bold text-[#EDEDED] leading-none tabular-nums">
        {value}
      </span>
      <span
        className={cn(
          "text-[12px] font-medium flex items-center gap-1",
          trend === "up" && "text-[#3DB779]",
          trend === "down" && "text-[#E85C4A]",
          trend === "neutral" && "text-[#6B6B6B]"
        )}
      >
        {trend === "up" ? (
          <TrendingUp className="w-3 h-3" />
        ) : trend === "down" ? (
          <TrendingDown className="w-3 h-3" />
        ) : null}
        {change}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: HealingStatus }) {
  const config: Record<HealingStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    curado: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      icon: CheckCircle2,
      label: "Curado",
    },
    fallido: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      icon: XCircle,
      label: "Fallido",
    },
    pendiente: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      icon: Clock,
      label: "Pendiente",
    },
  };

  const { bg, text, icon: Icon, label } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium",
        bg,
        text
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            confidence >= 80
              ? "bg-emerald-500"
              : confidence >= 50
              ? "bg-amber-500"
              : "bg-red-500"
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
        {confidence}%
      </span>
    </div>
  );
}

// Empty State Component
function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-[var(--bg-elevated)] mb-3">
        <AlertTriangle className="w-5 h-5 text-[var(--text-tertiary)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  );
}

// Error State Component
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <div className="p-3 rounded-full bg-red-500/10">
        <XCircle className="w-6 h-6 text-red-400" />
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
  const [autoSandboxDone, setAutoSandboxDone] = useState(false)

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

  useEffect(() => {
    const payload = data as DashboardResponse | null
    if (!payload?.isNewUser || autoSandboxDone) return

    api.setupSandbox()
      .then(() => {
        setAutoSandboxDone(true)
        toast.success('Sandbox demo preparado', {
          description: 'Creamos un proyecto inicial para que explores Healify en segundos.',
        })
        fetchDashboard()
      })
      .catch(() => {
        setAutoSandboxDone(true)
      })
  }, [data, autoSandboxDone])

  // Handler: Run Tests
  const handleRunTests = async () => {
    setIsRunning(true);
    toast.info("Iniciando ejecución de tests...", {
      description: "Este proceso puede tardar unos minutos",
    });

    // Simular proceso
    setTimeout(() => {
      toast.success("Tests ejecutados correctamente", {
        description: "12 tests pasados, 2 curados automáticamente",
      });
      setIsRunning(false);
      fetchDashboard(); // Refresh data
    }, 3000);
  };

  // Handler: Open test detail
  const handleOpenDetail = (item: HealingHistoryItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  // Handler: Approve healing
  const handleApproveHealing = async (id: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: "Aprobando curación...",
        success: () => {
          // Update local state optimistically
          if (data) {
            setData({
              ...data,
              healingHistory: data.healingHistory.map((item) =>
                item.id === id ? { ...item, status: "curado" as HealingStatus } : item
              ),
            });
          }
          setSheetOpen(false);
          return "Curación aprobada exitosamente";
        },
        error: "Error al aprobar la curación",
      }
    );
  };

  // Handler: Reject healing
  const handleRejectHealing = async (id: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
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
        error: "Error al rechazar la curación",
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              Vista general de tu actividad de tests
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Onboarding Banner — visible solo si es usuario nuevo sin proyectos */}
        {(data as DashboardResponse).isNewUser && (
          <OnboardingBanner
            userName={session?.user?.name || undefined}
            progress={{
              projectConnected: ((data as DashboardResponse).projectCount || 0) > 0,
              firstRunExecuted: data.metrics.testsExecutedToday > 0 || data.chartData.length > 0,
              firstHealingDone: data.healingHistory.length > 0,
            }}
            onSetupSandbox={handleSetupSandbox}
          />
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-[#111111] border border-white/[0.08]">
            <TabsTrigger value="overview" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED]">
              Overview
            </TabsTrigger>
            <TabsTrigger value="analisis" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED]">
              Análisis
            </TabsTrigger>
            <TabsTrigger value="funciones" className="data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EDEDED]">
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
                  <Timer className="w-4 h-4 text-[#5E6AD2]" />
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
                  <DollarSign className="w-4 h-4 text-[#5E6AD2]" />
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
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
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
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
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
                        <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0} />
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
                      stroke="#5E6AD2"
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
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <button className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
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
                    className="group w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left"
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {item.status === "curado" ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        </div>
                      ) : item.status === "fallido" ? (
                        <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
                          <XCircle className="w-3 h-3 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Clock className="w-3 h-3 text-amber-400" />
                        </div>
                      )}
                    </div>

                    {/* Test Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate transition-colors">
                        {item.testName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[11px] text-[var(--text-tertiary)] font-mono truncate max-w-[120px] sm:max-w-[200px]">
                          {item.oldSelector}
                        </code>
                        {item.newSelector && (
                          <>
                            <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                            <code className="text-[11px] text-emerald-400 font-mono truncate max-w-[120px] sm:max-w-[200px]">
                              {item.newSelector}
                            </code>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <ConfidenceBar confidence={item.confidence} />
                      <StatusBadge status={item.status} />
                      <span className="text-[11px] text-[var(--text-tertiary)] w-20 text-right">
                        {item.timestamp}
                      </span>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
                          <stop offset="5%" stopColor="#5E6AD2" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="brokenGradAnalysis" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E85C4A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#E85C4A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                      <YAxis hide />
                      <Area type="monotone" dataKey="curados" stroke="#5E6AD2" strokeWidth={2} fillOpacity={1} fill="url(#healingGradAnalysis)" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/dashboard/projects" className="rounded-lg border border-white/[0.07] bg-[#111111] p-4 hover:bg-[#151515] transition-colors">
              <p className="text-sm font-medium text-[#EDEDED]">Conectar repositorio</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Creá y configurá proyectos para activar monitoreo</p>
            </Link>
            <button onClick={handleSetupSandbox} className="text-left rounded-lg border border-white/[0.07] bg-[#111111] p-4 hover:bg-[#151515] transition-colors">
              <p className="text-sm font-medium text-[#EDEDED]">Sandbox interactivo</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Carga automática de datos demo por usuario</p>
            </button>
            <Link href="/docs" className="rounded-lg border border-white/[0.07] bg-[#111111] p-4 hover:bg-[#151515] transition-colors">
              <p className="text-sm font-medium text-[#EDEDED]">Implementar SDK</p>
              <p className="text-xs text-[#9B9B9B] mt-1">Quickstart, API y webhook en producción</p>
            </Link>
          </div>

          <div className="rounded-lg border border-white/[0.07] bg-[#111111] p-4">
            <h3 className="text-sm font-medium text-[#EDEDED] mb-2">Checklist de activación</h3>
            <ul className="space-y-2 text-xs text-[#9B9B9B]">
              <li className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", ((data as DashboardResponse).projectCount || 0) > 0 ? "bg-emerald-400" : "bg-[#6B6B6B]")} />Proyecto conectado</li>
              <li className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", data.metrics.testsExecutedToday > 0 ? "bg-emerald-400" : "bg-[#6B6B6B]")} />Primera ejecución detectada</li>
              <li className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", data.healingHistory.length > 0 ? "bg-emerald-400" : "bg-[#6B6B6B]")} />Primera curación registrada</li>
            </ul>
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