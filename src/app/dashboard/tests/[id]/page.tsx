"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  FileCode,
  Loader2,
  RefreshCw,
  Play,
  Calendar,
  Hash,
  ChevronRight,
  Camera,
  ScanLine,
  GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api, formatRelativeTime } from "@/lib/api";
import { TestRunsSkeleton } from "@/components/ui/skeletons";
import { TestDetailSheet } from "@/components/TestDetailSheet";
import { JobProgressCard } from "@/components/JobProgressCard";
import type { TestRun, TestRunStatus, HealingStatus, HealingHistoryItem } from "@/types";

type TeardownEvent = HealingHistoryItem & {
  createdAt?: string;
  statusRaw?: string;
  screenshotBefore?: string | null;
  screenshotAfter?: string | null;
  prUrl?: string | null;
};

// ============================================
// LINEAR STYLE COMPONENTS
// ============================================

function StatusBadge({ status }: { status: TestRunStatus }) {
  const config: Record<TestRunStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    PASSED: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2, label: "Pasado" },
    FAILED: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircle, label: "Fallido" },
    HEALED: { bg: "bg-violet-500/10", text: "text-violet-400", icon: Zap, label: "Curado" },
    RUNNING: { bg: "bg-blue-500/10", text: "text-blue-400", icon: RefreshCw, label: "Ejecutando" },
    PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock, label: "Pendiente" },
    CANCELLED: { bg: "bg-gray-500/10", text: "text-gray-400", icon: XCircle, label: "Cancelado" },
      PARTIAL: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      icon: AlertTriangle,
      label: "Parcial",
    },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.PENDING;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", bg, text)}>
      <Icon className={cn("w-3.5 h-3.5", status === "RUNNING" && "animate-spin")} />
      {label}
    </span>
  );
}

function HealingStatusBadge({ status }: { status: HealingStatus }) {
  const config: Record<HealingStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    curado: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2, label: "Curado" },
    fallido: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircle, label: "Fallido" },
    pendiente: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock, label: "Pendiente" },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.pendiente;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium", bg, text)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-300", confidence >= 80 ? "bg-emerald-500" : confidence >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${confidence}%` }} />
      </div>
      <span className="text-[11px] text-gray-500 font-mono">{confidence}%</span>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-white/5 mb-3">
        <FileCode className="w-5 h-5 text-gray-500" />
      </div>
      <p className="text-sm text-gray-400">{title}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TestRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [healingEvents, setHealingEvents] = useState<TeardownEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HealingHistoryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const id = params.id;
        // Fetch test run details
        const runResponse = await fetch(`/api/test-runs/${id}`);
        if (!runResponse.ok) throw new Error(runResponse.status === 404 ? "Test run no encontrado" : "Error al cargar");
        const runData = await runResponse.json();
        setTestRun(runData);

        // Fetch healing events for this test run
        const eventsResponse = await fetch(`/api/healing-events?testRunId=${id}`);
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          const mappedEvents: TeardownEvent[] = (eventsData.healingEvents || eventsData || []).map((event: any) => ({
            id: event.id,
            testName: event.testName,
            testFile: event.testFile || undefined,
            status:
              event.status === 'HEALED_AUTO' || event.status === 'HEALED_MANUAL'
                ? 'curado'
                : event.status === 'NEEDS_REVIEW' || event.status === 'ANALYZING'
                  ? 'pendiente'
                  : 'fallido',
            confidence: Math.round((event.confidence || 0) * 100),
            timestamp: event.createdAt || testRun?.startedAt || new Date().toISOString(),
            oldSelector: event.failedSelector || '—',
            newSelector: event.newSelector || null,
            errorMessage: event.errorMessage || null,
            reasoning: event.reasoning || null,
            createdAt: event.createdAt,
            statusRaw: event.status,
            screenshotBefore: event.screenshotBefore || null,
            screenshotAfter: event.screenshotAfter || null,
            prUrl: event.prUrl || null,
          }))
          setHealingEvents(mappedEvents);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchData();
  }, [params.id]);

  const handleRerun = async () => {
    toast.info("Re-ejecutando test run...");
    setTimeout(() => toast.success("Test run re-ejecutado"), 2000);
  };

  const handleOpenDetail = (event: HealingHistoryItem) => {
    setSelectedEvent(event);
    setSheetOpen(true);
  };

  const handleApproveHealing = async (id: string) => {
    toast.promise(new Promise((r) => setTimeout(r, 1000)), {
      loading: "Aprobando curación...",
      success: () => {
        setHealingEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: "curado" as HealingStatus } : e));
        setSheetOpen(false);
        return "Curación aprobada";
      },
      error: "Error al aprobar",
    });
  };

  const handleRejectHealing = async (id: string) => {
    toast.promise(new Promise((r) => setTimeout(r, 1000)), {
      loading: "Rechazando curación...",
      success: () => {
        setHealingEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: "fallido" as HealingStatus } : e));
        setSheetOpen(false);
        return "Curación rechazada";
      },
      error: "Error al rechazar",
    });
  };

  if (loading) {
    return <TestRunsSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/tests"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Link>
        </Button>
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" />Reintentar</Button>
        </div>
      </div>
    );
  }

  if (!testRun) return null;

  const duration = testRun.duration ? `${Math.floor(testRun.duration / 60000)}m ${Math.floor((testRun.duration % 60000) / 1000)}s` : "—";
  const teardownSteps = healingEvents.flatMap((event) => {
    const baseTime = event.createdAt || event.timestamp
    const steps = [
      {
        key: `${event.id}-detected`,
        label: `Fallo detectado: ${event.testName}`,
        detail: event.errorMessage || `Selector roto: ${event.oldSelector}`,
        time: baseTime,
        tone: 'text-red-400',
        icon: AlertTriangle,
      },
      {
        key: `${event.id}-analyzing`,
        label: 'Healify analizando DOM',
        detail: event.reasoning || 'Comparando estructura y atributos del DOM para proponer selector robusto.',
        time: baseTime,
        tone: 'text-amber-400',
        icon: ScanLine,
      },
      {
        key: `${event.id}-proposal`,
        label: event.newSelector ? 'Selector propuesto' : 'Sin selector sugerido',
        detail: event.newSelector
          ? `${event.oldSelector} → ${event.newSelector} (${event.confidence}%)`
          : 'No se pudo encontrar selector alternativo confiable.',
        time: baseTime,
        tone: event.newSelector ? 'text-violet-400' : 'text-gray-400',
        icon: Zap,
      },
    ]

    if (event.prUrl) {
      steps.push({
        key: `${event.id}-pr`,
        label: 'PR automático abierto',
        detail: event.prUrl,
        time: baseTime,
        tone: 'text-[#00F5C8]',
        icon: GitPullRequest,
      })
    }

    return steps
  })

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Button variant="ghost" size="sm" className="w-fit" asChild>
            <Link href="/dashboard/tests"><ArrowLeft className="w-4 h-4 mr-2" />Volver a Test Runs</Link>
          </Button>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <FileCode className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold text-white">{testRun.project?.name}</h1>
                  <StatusBadge status={testRun.status} />
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                  {testRun.branch && <><GitBranch className="w-3 h-3" />{testRun.branch}</>}
                  {testRun.commitSha && <><Hash className="w-3 h-3" />{testRun.commitSha.slice(0, 7)}</>}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleRerun} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Re-ejecutar
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-lg glass-elite">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">Total Tests</p>
            <p className="text-xl sm:text-2xl font-semibold text-white mt-1">{testRun.totalTests}</p>
          </div>
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-[11px] text-emerald-400 uppercase tracking-wide">Pasados</p>
            <p className="text-2xl font-semibold text-emerald-400 mt-1">{testRun.passedTests}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
            <p className="text-[11px] text-red-400 uppercase tracking-wide">Fallidos</p>
            <p className="text-2xl font-semibold text-red-400 mt-1">{testRun.failedTests}</p>
          </div>
          <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/10">
            <p className="text-[11px] text-violet-400 uppercase tracking-wide">Curados</p>
            <p className="text-2xl font-semibold text-violet-400 mt-1">{testRun.healedTests}</p>
          </div>
          <div className="p-4 rounded-lg glass-elite">
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">Duración</p>
            <p className="text-xl sm:text-2xl font-semibold text-white mt-1">{duration}</p>
          </div>
        </div>

        {/* Worker Progress — shown when job is active */}
        {(testRun.status === "PENDING" || testRun.status === "RUNNING") && (
          <JobProgressCard
            testRunId={testRun.id}
            pollInterval={3000}
            onComplete={() => {
              // Reload page data when worker finishes
              setTimeout(() => window.location.reload(), 1500)
            }}
          />
        )}

        {/* Visual Test Teardown */}
        <div className="rounded-lg glass-elite">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Visual Test Teardown</h2>
            <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
              {teardownSteps.length} pasos
            </span>
          </div>

          {teardownSteps.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                title="Sin timeline todavía"
                description="Los pasos aparecerán cuando Healify detecte y analice un fallo en este test run"
              />
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {teardownSteps.map((step) => {
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex items-start gap-3 p-3 rounded-md bg-white/[0.02] border border-white/5">
                    <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className={cn('w-3.5 h-3.5', step.tone)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn('text-sm font-medium', step.tone)}>{step.label}</p>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">{formatRelativeTime(step.time)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 break-all">{step.detail}</p>
                    </div>
                  </div>
                )
              })}

              {healingEvents.some((event) => event.screenshotBefore || event.screenshotAfter) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {healingEvents.map((event) => (
                    <React.Fragment key={`${event.id}-shots`}>
                      {event.screenshotBefore && (
                        <a href={event.screenshotBefore} target="_blank" rel="noopener noreferrer" className="block rounded-md border border-white/10 overflow-hidden">
                          <div className="px-3 py-2 text-[11px] text-gray-400 border-b border-white/10 flex items-center gap-1.5">
                            <Camera className="w-3 h-3" />
                            Screenshot before
                          </div>
                          <img src={event.screenshotBefore} alt="Screenshot before" className="w-full h-40 object-cover" />
                        </a>
                      )}
                      {event.screenshotAfter && (
                        <a href={event.screenshotAfter} target="_blank" rel="noopener noreferrer" className="block rounded-md border border-white/10 overflow-hidden">
                          <div className="px-3 py-2 text-[11px] text-gray-400 border-b border-white/10 flex items-center gap-1.5">
                            <Camera className="w-3 h-3" />
                            Screenshot after
                          </div>
                          <img src={event.screenshotAfter} alt="Screenshot after" className="w-full h-40 object-cover" />
                        </a>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="rounded-lg glass-elite">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium text-white">Detalles</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Proyecto</p>
              <p className="text-sm text-gray-200">{testRun.project?.name}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Branch</p>
              <p className="text-sm text-gray-200 flex items-center gap-1">
                <GitBranch className="w-3 h-3" />{testRun.branch || "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Iniciado</p>
              <p className="text-sm text-gray-200 flex items-center gap-1">
                <Calendar className="w-3 h-3" />{formatRelativeTime(testRun.startedAt)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Commit</p>
              <code className="text-sm text-violet-400">{testRun.commitSha?.slice(0, 7) || "—"}</code>
            </div>
          </div>
          {testRun.commitMessage && (
            <div className="px-4 pb-4">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Mensaje</p>
              <p className="text-sm text-gray-300">{testRun.commitMessage}</p>
            </div>
          )}
        </div>

        {/* Healing Events */}
        <div className="rounded-lg glass-elite">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-white">Eventos de Curación</h2>
              <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">{healingEvents.length}</span>
            </div>
          </div>

          {healingEvents.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState title="No hay eventos de curación" description="Los eventos aparecerán cuando se detecten tests fallidos durante la ejecución" />
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {healingEvents.map((event, index) => (
                <button
                  key={event.id}
                  onClick={() => handleOpenDetail(event)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors duration-150 text-left"
                >
                  <div className="flex-shrink-0">
                    {event.status === "curado" ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      </div>
                    ) : event.status === "fallido" ? (
                      <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center">
                        <XCircle className="w-3 h-3 text-red-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{event.testName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[11px] text-gray-500 font-mono truncate max-w-[200px]">{event.oldSelector}</code>
                      {event.newSelector && (
                        <>
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <code className="text-[11px] text-emerald-400 font-mono truncate max-w-[200px]">{event.newSelector}</code>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <ConfidenceBar confidence={event.confidence} />
                    <HealingStatusBadge status={event.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Test Detail Sheet */}
      <TestDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        data={selectedEvent ? {
          id: selectedEvent.id,
          testName: selectedEvent.testName,
          testFile: selectedEvent.testName,
          status: selectedEvent.status,
          confidence: selectedEvent.confidence,
          timestamp: selectedEvent.timestamp,
          errorMessage: null,
          oldSelector: selectedEvent.oldSelector,
          newSelector: selectedEvent.newSelector,
          reasoning: null,
        } : null}
        onApprove={handleApproveHealing}
        onReject={handleRejectHealing}
      />
    </>
  );
}