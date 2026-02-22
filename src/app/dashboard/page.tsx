"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { toast } from "sonner";
import type {
  DashboardData,
  HealingStatus,
  HealingHistoryItem,
} from "@/types";

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
    <div className="group relative p-4 rounded-lg glass-elite hover:border-white/10 transition-all duration-150">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-widest text-gray-500 uppercase">
            {label}
          </p>
          <p className="text-2xl font-semibold text-white tracking-tight">
            {value}
          </p>
        </div>
        <div className="p-2 rounded-md bg-white/5">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {trend === "up" ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        ) : trend === "down" ? (
          <TrendingDown className="w-3.5 h-3.5 text-red-500" />
        ) : null}
        <span
          className={cn(
            "text-xs font-medium",
            trend === "up" && "text-emerald-500",
            trend === "down" && "text-red-500",
            trend === "neutral" && "text-gray-500"
          )}
        >
          {change}
        </span>
        <span className="text-xs text-gray-600">vs ayer</span>
      </div>
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
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
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
      <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
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
      <span className="text-[11px] text-gray-500 font-mono">
        {confidence}%
      </span>
    </div>
  );
}

// Empty State Component
function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-white/5 mb-3">
        <AlertTriangle className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
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

  // Show success toast after Stripe payment
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    
    if (success === 'true') {
      toast.success('🎉 ¡Pago exitoso!', {
        description: 'Tu suscripción está activa. Bienvenido a Healify Pro.',
        duration: 6000,
      })
      // Clean URL
      window.history.replaceState({}, '', '/dashboard')
    }
    
    if (canceled === 'true') {
      toast.info('Pago cancelado', {
        description: 'Puedes intentar de nuevo cuando estés listo.',
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

  return (
    <>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Vista general de tu actividad de tests
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={handleRunTests}
              disabled={isRunning}
              className="btn-neon text-[#0A0E1A] disabled:opacity-50"
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
            label="Bugs Detectados"
            value={data.metrics.bugsDetected}
            change={data.metrics.bugsDetectedChange}
            trend="down"
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Chart Section */}
          <div className="lg:col-span-2 rounded-lg glass-elite p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-medium text-white">
                  Tendencia de Curación
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Últimos 7 días</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-400">Curados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-gray-400">Rotos</span>
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
                      <linearGradient id="colorCurados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRotos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCurados)"
                    />
                    <Area
                      type="monotone"
                      dataKey="testsRotos"
                      stroke="#ef4444"
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
          <div className="rounded-lg glass-elite p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white">
                Selectores Frágiles
              </h2>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
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
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors duration-150"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-gray-300 font-mono truncate block">
                        {selector.selector}
                      </code>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-red-400">
                          {selector.failures} fallos
                        </span>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] text-gray-500">
                          {selector.successRate}% éxito
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Feed & Healing History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Activity Feed */}
          <ActivityFeed limit={5} />

          {/* Healing History List - Linear Style */}
          <div className="rounded-lg glass-elite">
          {/* List Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-white">
                Últimas Curaciones
              </h2>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                {data.healingHistory.length}
              </span>
            </div>
            <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
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
            <div className="divide-y divide-white/5">
              {data.healingHistory.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <button
                    onClick={() => handleOpenDetail(item)}
                    className="group w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 text-left"
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
                      <p className="text-sm text-gray-200 truncate group-hover:text-white transition-colors">
                        {item.testName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[11px] text-gray-500 font-mono truncate max-w-[200px]">
                          {item.oldSelector}
                        </code>
                        {item.newSelector && (
                          <>
                            <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                            <code className="text-[11px] text-emerald-400 font-mono truncate max-w-[200px]">
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
                      <span className="text-[11px] text-gray-500 w-20 text-right">
                        {item.timestamp}
                      </span>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* List Footer */}
          {data.healingHistory.length > 0 && (
            <div className="px-4 py-3 border-t border-white/5">
              <Link
                href="/dashboard/tests"
                className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Ver todos los tests
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
          </div>
        </div>
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