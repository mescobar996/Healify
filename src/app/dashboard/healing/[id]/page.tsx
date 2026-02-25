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
  Copy,
  CheckCheck,
  ExternalLink,
  GitBranch,
  FileCode,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

// ============================================
// TYPES
// ============================================

interface HealingDiffData {
  id: string;
  testName: string;
  testFile: string;
  status: "curado" | "fallido" | "pendiente";
  confidence: number;
  timestamp: string;
  errorMessage: string | null;
  oldSelector: string;
  newSelector: string | null;
  oldDomSnapshot: string | null;
  newDomSnapshot: string | null;
  reasoning: string | null;
  branch: string | null;
  commitSha: string | null;
  prUrl: string | null;
  prBranch: string | null;
}

// ============================================
// LINEAR STYLE COMPONENTS
// ============================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    curado: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2, label: "Curado" },
    fallido: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircle, label: "Fallido" },
    pendiente: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Clock, label: "Pendiente" },
  };
  const { bg, text, icon: Icon, label } = config[status] || config.pendiente;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", bg, text)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Confidence</span>
        <span className={cn("text-lg font-bold font-mono", confidence >= 80 ? "text-emerald-400" : confidence >= 50 ? "text-amber-400" : "text-red-400")}>
          {confidence}%
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", confidence >= 80 ? "bg-emerald-500" : confidence >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${confidence}%` }} />
      </div>
    </div>
  );
}

function CodeBlock({ label, code, type }: { label: string; code: string; type: "old" | "new" }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); toast.success("Copiado"); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="rounded-lg overflow-hidden border border-[#1C1C1C]">
      <div className={cn("flex items-center justify-between px-4 py-2.5 border-b border-[#1C1C1C]", type === "old" ? "bg-red-500/5" : "bg-emerald-500/5")}>
        <div className="flex items-center gap-2">
          {type === "old" ? <XCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span className={cn("text-xs font-medium", type === "old" ? "text-red-400" : "text-emerald-400")}>{label}</span>
        </div>
        <button onClick={handleCopy} className="p-1 rounded hover:bg-[#111111] transition-colors">
          {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
      <pre className="p-3 sm:p-4 bg-gray-900/50 text-xs sm:text-sm overflow-x-auto">
        <code className={cn("font-mono", type === "old" ? "text-red-300" : "text-emerald-300")}>{code}</code>
      </pre>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function HealingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<HealingDiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const id = params.id;
        const response = await fetch(`/api/healing-events/${id}/diff`);
        if (!response.ok) throw new Error(response.status === 404 ? "Evento no encontrado" : "Error al cargar");
        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchData();
  }, [params.id]);

  const handleApprove = async () => {
    setActionLoading(true);
    toast.promise(new Promise(r => setTimeout(r, 1000)), {
      loading: "Aprobando curación...",
      success: () => { setActionLoading(false); toast.success("Curación aprobada"); return "Listo"; },
      error: () => { setActionLoading(false); return "Error"; },
    });
  };

  const handleReject = async () => {
    setActionLoading(true);
    toast.promise(new Promise(r => setTimeout(r, 1000)), {
      loading: "Rechazando...",
      success: () => { setActionLoading(false); toast.success("Curación rechazada"); return "Listo"; },
      error: () => { setActionLoading(false); return "Error"; },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild><Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Volver</Link></Button>
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" />Reintentar</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Volver al Dashboard</Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileCode className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">{data.testName}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="text-xs text-gray-500">{data.testFile}</p>
            </div>
          </div>
          {data.status === "pendiente" && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleReject} disabled={actionLoading} className="bg-[#111111] border-[#1C1C1C] text-gray-300">
                <X className="w-4 h-4 mr-1.5" />Rechazar
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700">
                <Check className="w-4 h-4 mr-1.5" />Aprobar
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Left - Diff */}
        <div className="lg:col-span-2 space-y-4">
          {/* Error */}
          {data.errorMessage && (
            <div className="rounded-lg bg-[#0F0F0F] border border-[#1C1C1C]">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1C1C1C]">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-200">Error Original</span>
              </div>
              <pre className="p-3 sm:p-4 text-xs sm:text-sm overflow-x-auto">
                <code className="text-red-300 font-mono">{data.errorMessage}</code>
              </pre>
            </div>
          )}

          {/* Selectors */}
          <div className="rounded-lg bg-[#0F0F0F] border border-[#1C1C1C]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1C1C1C]">
              <FileCode className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-gray-200">Cambios Propuestos</span>
            </div>
            <div className="p-4 space-y-4">
              <CodeBlock label="Selector Anterior (Roto)" code={data.oldSelector} type="old" />
              {data.newSelector && <CodeBlock label="Selector Sugerido (IA)" code={data.newSelector} type="new" />}

              {/* Auto-PR Banner — Bloque 8 */}
              {data.prUrl && (
                <a
                  href={data.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <ExternalLink className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-400">Pull Request abierto automáticamente</p>
                    <p className="text-[10px] text-[#E6E6E6]/40 truncate mt-0.5">{data.prUrl}</p>
                  </div>
                  <span className="text-[10px] text-emerald-400/60 group-hover:text-emerald-400 transition-colors shrink-0">Ver PR →</span>
                </a>
              )}
            </div>
          </div>

          {/* DOM Snapshots */}
          {(data.oldDomSnapshot || data.newDomSnapshot) && (
            <div className="rounded-lg bg-[#0F0F0F] border border-[#1C1C1C]">
              <div className="px-4 py-3 border-b border-[#1C1C1C]">
                <span className="text-sm font-medium text-gray-200">Contexto del DOM</span>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.oldDomSnapshot && (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Antes</p>
                    <pre className="p-3 bg-gray-900/50 rounded text-xs overflow-x-auto">
                      <code className="text-gray-300">{data.oldDomSnapshot}</code>
                    </pre>
                  </div>
                )}
                {data.newDomSnapshot && (
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Después</p>
                    <pre className="p-3 bg-gray-900/50 rounded text-xs overflow-x-auto">
                      <code className="text-gray-300">{data.newDomSnapshot}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right - Info */}
        <div className="space-y-4">
          {/* AI Analysis */}
          <div className="rounded-lg bg-[#0F0F0F] border border-[#1C1C1C]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1C1C1C]">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-gray-200">Análisis de IA</span>
            </div>
            <div className="p-4 space-y-4">
              <ConfidenceMeter confidence={data.confidence} />
              {data.reasoning && (
                <>
                  <div className="h-px bg-[#111111]" />
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Razonamiento</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{data.reasoning}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-lg bg-[#0F0F0F] border border-[#1C1C1C]">
            <div className="px-4 py-3 border-b border-[#1C1C1C]">
              <span className="text-sm font-medium text-gray-200">Detalles</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Archivo</span>
                <code className="text-gray-300">{data.testFile}</code>
              </div>
              <div className="h-px bg-[#111111]" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Timestamp</span>
                <span className="text-gray-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{data.timestamp}</span>
              </div>
              {data.branch && (
                <>
                  <div className="h-px bg-[#111111]" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Branch</span>
                    <span className="text-gray-300 flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" />{data.branch}</span>
                  </div>
                </>
              )}
              {data.commitSha && (
                <>
                  <div className="h-px bg-[#111111]" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Commit</span>
                    <code className="text-violet-400">{data.commitSha.slice(0, 7)}</code>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Info */}
          {data.status === "curado" && (
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">Curación Aplicada</p>
                  <p className="text-xs text-gray-500">Este selector fue autocurado exitosamente</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}