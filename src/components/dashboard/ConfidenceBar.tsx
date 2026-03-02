"use client"

import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  confidence: number
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
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
      <span className="text-[11px] text-[var(--text-tertiary)] font-mono">{confidence}%</span>
    </div>
  )
}
