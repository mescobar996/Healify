"use client"

import { CheckCircle2, XCircle, Clock, Zap, RefreshCw, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HealingStatus, TestRunStatus } from "@/types"

// ── HealingStatus Badge (curado/fallido/pendiente) ────────────────────

const HEALING_CONFIG: Record<
  HealingStatus,
  { bg: string; text: string; icon: React.ElementType; label: string }
> = {
  curado: { bg: "bg-violet-500/10", text: "text-violet-400", icon: CheckCircle2, label: "Curado" },
  fallido: { bg: "bg-red-500/10",     text: "text-red-400",     icon: XCircle,      label: "Fallido" },
  pendiente: { bg: "bg-amber-500/10", text: "text-amber-400",   icon: Clock,        label: "Pendiente" },
}

// ── TestRunStatus Badge (PASSED/FAILED/HEALED/etc.) ──────────────────

const TEST_RUN_CONFIG: Record<
  TestRunStatus,
  { bg: string; text: string; icon: React.ElementType; label: string }
> = {
  PASSED:    { bg: "bg-green-500/10",  text: "text-green-400",  icon: CheckCircle2, label: "Pasado" },
  FAILED:    { bg: "bg-red-500/10",    text: "text-red-400",    icon: XCircle,      label: "Fallido" },
  HEALED:    { bg: "bg-violet-500/10", text: "text-violet-400", icon: Zap,          label: "Curado" },
  RUNNING:   { bg: "bg-white/10",      text: "text-white",      icon: RefreshCw,    label: "Ejecutando" },
  PENDING:   { bg: "bg-white/10",      text: "text-white",      icon: Clock,        label: "Pendiente" },
  CANCELLED: { bg: "bg-gray-500/10",   text: "text-gray-400",   icon: XCircle,      label: "Cancelado" },
  PARTIAL:   { bg: "bg-white/10",      text: "text-white",      icon: AlertTriangle, label: "Parcial" },
}

// ── Healing Status Badge ──────────────────────────────────────────────

interface HealingStatusBadgeProps {
  status: HealingStatus
}

export function HealingStatusBadge({ status }: HealingStatusBadgeProps) {
  const { bg, text, icon: Icon, label } = HEALING_CONFIG[status]
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
  )
}

// ── Test Run Status Badge ─────────────────────────────────────────────

interface TestRunStatusBadgeProps {
  status: TestRunStatus
}

export function TestRunStatusBadge({ status }: TestRunStatusBadgeProps) {
  const config = TEST_RUN_CONFIG[status] || TEST_RUN_CONFIG.PENDING
  const { bg, text, icon: Icon, label } = config
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        bg,
        text
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", status === "RUNNING" && "animate-spin")} />
      {label}
    </span>
  )
}

// ── Backward-compatible alias ─────────────────────────────────────────
// Keeps existing imports working during migration
export { HealingStatusBadge as StatusBadge }
