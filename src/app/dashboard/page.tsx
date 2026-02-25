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
  DollarSign,
  Sparkles,
  ShieldCheck,
  Timer,
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
  isNewUser?: boolean;
  projectCount?: number;
}

// ============================================
// LINEAR-STYLE COMPONENTS (Unified Design Tokens)
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
    <div className="group relative rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-sm hover:border-white/10 transition-all duration-200">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#E8F0FF]/35 uppercase">
              {label}
            </p>
            <p className="text-[28px] font-bold text-[#E8F0FF] tracking-tight leading-none">
              {value}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] group-hover:border-white/10 transition-colors">
            <Icon className="w-4 h-4 text-[#E8F0FF]/30 group-hover:text-[#E8F0FF]/50 transition-colors" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {trend === "up" ? (
            <TrendingUp className="w-3.5 h-3.5 text-[#00F5C8]" />
          ) : trend === "down" ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          ) : null}
          <span
            className={cn(
              "text-xs font-medium",
              trend === "up" && "text-[#00F5C8]",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-[#E8F0FF]/30"
            )}
          >
            {change}
          </span>
          <span className="text-xs text-[#E8F0FF]/20">vs ayer</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: HealingStatus }) {
  const config: Record<
    HealingStatus,
    { bg: string; text: string; icon: React.ElementType; label: string }
  > = {
    curado: {
      bg: "bg-emerald-500/10 border border-emerald-500/20",
      text: "text-emerald-400",
      icon: CheckCircle2,
      label: "Curado",
    },
    fallido: {
      bg: "bg-red-500/10 border border-red-500/20",
      text: "text-red-400",
      icon: XCircle,
      label: "Fallido",
    },
    pendiente: {
      bg: "bg-amber-500/10 border border-amber-500/20",
      text: "text-amber-400",
      icon: Clock,
      label: "Pendiente",
    },
  };

  const { bg, text, icon: Icon, label } = config[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium",
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
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            confidence >= 80
              ? "bg-[#00F5C8]"
              : confidence >= 50
              ? "bg-amber-400"
              : "bg-red-400"
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-[11px] text-[#E8F0FF]/30 font-mono">
        {confidence}%
      </span>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="p-3 rounded-full bg-white/[0.04] border border-white/[0.06] mb-3">
        <AlertTriangle className="w-5 h-5 text-[#E8F0FF]/25" />
      </div>
      <p className="text-sm text-[#E8F0FF]/40">{title}</p>
      <p className="text-xs text-[#E8F0FF]/20 mt-1">{description}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
        <XCircle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-[#E8F0FF]/40 text-sm">{message}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="bg-white/[0.04] border-white/[0.08] text-[#E8F0FF]/60 hover:bg-white/[0.08] hover:text-[#E8F0FF]"
      >
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Reintentar
      </Button>
    </div>
  );
}

// Custom chart tooltip matching Healify palette
function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#0D1117] border border-white/10 px-3 py-2.5 shadow-xl shadow-black/40">
      <p className="text-[11px] font-medium text-[#E8F0FF]/60 mb-1.5">
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          className="flex items-center gap-2 text-xs"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color }}
          />
          <span className="text-[#E8F0FF]/50 capitalize">
            {entry.dataKey === "testsRotos" ? "Rotos" : entry.dataKey}
          </span>
          <span className="text-[#E8F0FF] font-medium ml-auto">
            {entry.value}
          </span>
        </div>
      ))}
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HealingHistoryItem | null>(
    null
  );

  interface ROIData {
    timeSavedHours: number;
    totalCostSaved: number;
    autoHealedMonth: number;
    bugsDetectedMonth: number;
    healingRate: number;
    healedToday: number;
  }
  const { data: session } = useSession();
  const [roi, setRoi] = useState<ROIData | null>(null);
  useEffect(() => {
    fetch("/api/analytics", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && "timeSavedHours" in d) setRoi(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const canceled = searchParams.get("canceled");
    if (canceled === "true") {
      toast.info("Pago cancelado", {
        description: "Podes intentarlo de nuevo cuando estes listo.",
      });
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboardData = await api.getDashboard();
      setData(dashboardData);
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      setError(
        err instanceof Error ? err.message : "Error al cargar los datos"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunTests = async () => {
    setIsRunning(true);
    toast.info("Iniciando ejecucion de tests...", {
      description: "Este proceso puede tardar unos minutos",
    });
    setTimeout(() => {
      toast.success("Tests ejecutados correctamente", {
        description: "12 tests pasados, 2 curados automaticamente",
      });
      setIsRunning(false);
      fetchDashboard();
    }, 3000);
  };

  const handleOpenDetail = (item: HealingHistoryItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  const handleApproveHealing = async (id: string) => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
      loading: "Aprobando curacion...",
      success: () => {
        if (data) {
          setData({
            ...data,
            healingHistory: data.healingHistory.map((item) =>
              item.id === id
                ? { ...item, status: "curado" as HealingStatus }
                : item
            ),
          });
        }
        setSheetOpen(false);
        return "Curacion aprobada exitosamente";
      },
      error: "Error al aprobar la curacion",
    });
  };

  const handleRejectHealing = async (id: string) => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
      loading: "Rechazando curacion...",
      success: () => {
        if (data) {
          setData({
            ...data,
            healingHistory: data.healingHistory.map((item) =>
              item.id === id
                ? { ...item, status: "fallido" as HealingStatus }
                : item
            ),
          });
        }
        setSheetOpen(false);
        return "Curacion rechazada";
      },
      error: "Error al rechazar la curacion",
    });
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;
  if (!data)
    return (
      <ErrorState message="No se encontraron datos" onRetry={fetchDashboard} />
    );

  return (
    <>
      <div className="space-y-5">
        {/* ── Page Header ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#E8F0FF] tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-[#E8F0FF]/35 mt-1">
              Vista general de tu actividad de tests
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              className="bg-white/[0.04] border-white/[0.08] text-[#E8F0FF]/60 hover:bg-white/[0.08] hover:text-[#E8F0FF] hover:border-white/[0.12] h-9 px-4"
            >
              <RefreshCw
                className={cn(
                  "w-3.5 h-3.5 mr-2",
                  loading && "animate-spin"
                )}
              />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={handleRunTests}
              disabled={isRunning}
              className="btn-neon text-[#0A0E1A] disabled:opacity-50 h-9 px-5"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-2" />
                  Ejecutar Tests
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Onboarding Banner ─────────────────────────── */}
        {(data as DashboardResponse).isNewUser && (
          <OnboardingBanner userName={session?.user?.name || undefined} />
        )}

        {/* ── Metrics Grid ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Tests Hoy"
            value={formatNumber(data.metrics.testsExecutedToday)}
            change={data.metrics.testsExecutedTodayChange}
            trend={
              data.metrics.testsExecutedTodayChange.startsWith("+")
                ? "up"
                : data.metrics.testsExecutedTodayChange.startsWith("-")
                ? "down"
                : "neutral"
            }
            icon={Zap}
          />
          <MetricCard
            label="Autocuracion"
            value={`${data.metrics.autoHealingRate}%`}
            change={data.metrics.autoHealingRateChange}
            trend={
              data.metrics.autoHealingRateChange.startsWith("-")
                ? "down"
                : "up"
            }
            icon={CheckCircle2}
          />
          <MetricCard
            label="Bugs Detectados"
            value={data.metrics.bugsDetected}
            change={data.metrics.bugsDetectedChange}
            trend={
              data.metrics.bugsDetectedChange === "0.0" ||
              data.metrics.bugsDetectedChange === "0"
                ? "neutral"
                : "down"
            }
            icon={AlertTriangle}
          />
          <MetricCard
            label="Tiempo Promedio"
            value={data.metrics.avgHealingTime}
            change={data.metrics.avgHealingTimeChange}
            trend="up"
            icon={Clock}
          />
        </div>

        {/* ── ROI Strip ──────────────────────────────────── */}
        {roi && (
          <div
            className="rounded-xl border border-white/[0.06] overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,245,200,0.03), rgba(123,94,248,0.03))",
            }}
          >
            <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00F5C8]" />
              <span className="text-[11px] font-semibold tracking-[0.12em] text-[#E8F0FF]/30 uppercase">
                ROI de Healify -- acumulado historico
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">
              {[
                {
                  icon: Timer,
                  color: "#00F5C8",
                  value:
                    roi.timeSavedHours > 0
                      ? `${roi.timeSavedHours}h`
                      : "--",
                  label: "horas ahorradas",
                },
                {
                  icon: DollarSign,
                  color: "#7B5EF8",
                  value:
                    roi.totalCostSaved > 0
                      ? `$${roi.totalCostSaved.toLocaleString()}`
                      : "--",
                  label: "ahorro estimado",
                },
                {
                  icon: ShieldCheck,
                  color: "#10b981",
                  value:
                    roi.autoHealedMonth > 0
                      ? String(roi.autoHealedMonth)
                      : "--",
                  label: "curados este mes",
                },
                {
                  icon: TrendingUp,
                  color: "#EAB308",
                  value:
                    roi.healingRate > 0 ? `${roi.healingRate}%` : "--",
                  label: "tasa autocuracion",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="px-5 py-4 flex items-center gap-3.5"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${item.color}12` }}
                  >
                    <item.icon
                      className="w-4 h-4"
                      style={{ color: item.color }}
                    />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#E8F0FF] leading-none">
                      {item.value}
                    </p>
                    <p className="text-[10px] text-[#E8F0FF]/30 mt-0.5">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {roi.timeSavedHours === 0 && roi.autoHealedMonth === 0 && (
              <div className="px-5 py-3 border-t border-white/[0.06]">
                <p className="text-[11px] text-[#E8F0FF]/20 text-center">
                  Los datos de ROI apareceran cuando Healify cure su primer
                  test --{" "}
                  <a
                    href="/dashboard/projects"
                    className="text-[#00F5C8]/40 hover:text-[#00F5C8] transition-colors"
                  >
                    Conecta tu primer repo
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Chart + Fragile Selectors ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart */}
          <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-[#E8F0FF]">
                  Tendencia de Curacion
                </h2>
                <p className="text-xs text-[#E8F0FF]/25 mt-0.5">
                  Ultimos 7 dias
                </p>
              </div>
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00F5C8]" />
                  <span className="text-[#E8F0FF]/40">Curados</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-[#E8F0FF]/40">Rotos</span>
                </div>
              </div>
            </div>

            {data.chartData.length === 0 ? (
              <EmptyState
                title="Sin datos de grafico"
                description="Los datos apareceran cuando se ejecuten tests"
              />
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData}>
                    <defs>
                      <linearGradient
                        id="colorCurados"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#00F5C8"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor="#00F5C8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorRotos"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f87171"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f87171"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(232,240,255,0.25)", fontSize: 11 }}
                    />
                    <YAxis hide />
                    <Tooltip
                      content={<ChartTooltipContent />}
                      cursor={{
                        stroke: "rgba(232,240,255,0.08)",
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="curados"
                      stroke="#00F5C8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCurados)"
                    />
                    <Area
                      type="monotone"
                      dataKey="testsRotos"
                      stroke="#f87171"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRotos)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Fragile Selectors */}
          <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-[#E8F0FF]">
                Selectores Fragiles
              </h2>
              <span className="text-[10px] text-[#E8F0FF]/25 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md font-medium">
                TOP {data.fragileSelectors.length}
              </span>
            </div>

            {data.fragileSelectors.length === 0 ? (
              <div className="px-5">
                <EmptyState
                  title="No hay selectores fragiles"
                  description="Todos los selectores funcionan correctamente"
                />
              </div>
            ) : (
              <div className="px-2 py-2">
                {data.fragileSelectors.map((selector, index) => (
                  <motion.div
                    key={selector.selector}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors duration-150"
                  >
                    {/* Dot indicator */}
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        selector.failures > 5
                          ? "bg-red-400"
                          : selector.failures > 2
                          ? "bg-amber-400"
                          : "bg-[#00F5C8]"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-[#E8F0FF]/70 font-mono truncate block">
                        {selector.selector}
                      </code>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-red-400 font-medium">
                          {selector.failures} fallos
                        </span>
                        <span className="text-[10px] text-[#E8F0FF]/15">
                          --
                        </span>
                        <span className="text-[10px] text-[#E8F0FF]/30">
                          {selector.successRate}% exito
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-[#E8F0FF]/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Activity Feed & Healing History ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityFeed limit={5} />

          {/* Healing History */}
          <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-[#E8F0FF]">
                  Ultimas Curaciones
                </h2>
                <span className="text-[10px] text-[#E8F0FF]/25 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md font-medium">
                  {data.healingHistory.length}
                </span>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-[#E8F0FF]/25 hover:text-[#E8F0FF]/60 transition-colors">
                <ArrowUpDown className="w-3 h-3" />
                Ordenar
              </button>
            </div>

            {data.healingHistory.length === 0 ? (
              <div className="px-5 py-8">
                <EmptyState
                  title="No hay eventos de curacion"
                  description="Los eventos apareceran cuando se ejecuten tests con fallos"
                />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {data.healingHistory.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <button
                      onClick={() => handleOpenDetail(item)}
                      className="group w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                    >
                      <div className="flex-shrink-0">
                        {item.status === "curado" ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          </div>
                        ) : item.status === "fallido" ? (
                          <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <XCircle className="w-3 h-3 text-red-400" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Clock className="w-3 h-3 text-amber-400" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#E8F0FF]/70 truncate group-hover:text-[#E8F0FF] transition-colors">
                          {item.testName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] text-[#E8F0FF]/25 font-mono truncate max-w-[120px] sm:max-w-[200px]">
                            {item.oldSelector}
                          </code>
                          {item.newSelector && (
                            <>
                              <ChevronRight className="w-3 h-3 text-[#E8F0FF]/15 flex-shrink-0" />
                              <code className="text-[11px] text-[#00F5C8]/70 font-mono truncate max-w-[120px] sm:max-w-[200px]">
                                {item.newSelector}
                              </code>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <ConfidenceBar confidence={item.confidence} />
                        <StatusBadge status={item.status} />
                        <span className="text-[11px] text-[#E8F0FF]/20 w-20 text-right">
                          {item.timestamp}
                        </span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#E8F0FF]/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {data.healingHistory.length > 0 && (
              <div className="px-5 py-3 border-t border-white/[0.06]">
                <Link
                  href="/dashboard/tests"
                  className="flex items-center justify-center gap-1.5 text-xs text-[#E8F0FF]/25 hover:text-[#00F5C8] transition-colors"
                >
                  Ver todos los tests
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <TestDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        data={
          selectedItem
            ? {
                id: selectedItem.id,
                testName: selectedItem.testName,
                testFile: selectedItem.testName.replace(
                  ".spec.ts",
                  ".test.ts"
                ),
                status: selectedItem.status,
                confidence: selectedItem.confidence,
                timestamp: selectedItem.timestamp,
                errorMessage: null,
                oldSelector: selectedItem.oldSelector,
                newSelector: selectedItem.newSelector,
                reasoning: null,
              }
            : null
        }
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
