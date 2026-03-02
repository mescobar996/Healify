"use client"

import { CheckCircle2, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { HealingStatus } from "@/types"

interface StatusBadgeProps {
  status: HealingStatus
}

const STATUS_CONFIG: Record<
  HealingStatus,
  { bg: string; text: string; icon: React.ElementType; label: string }
> = {
  curado: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2, label: "Curado" },
  fallido: { bg: "bg-red-500/10",     text: "text-red-400",     icon: XCircle,      label: "Fallido" },
  pendiente: { bg: "bg-amber-500/10", text: "text-amber-400",   icon: Clock,        label: "Pendiente" },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { bg, text, icon: Icon, label } = STATUS_CONFIG[status]
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
