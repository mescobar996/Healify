"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: string | number
  change: string
  trend: "up" | "down" | "neutral"
  icon: React.ElementType
}

export function MetricCard({ label, value, change, trend, icon: Icon }: MetricCardProps) {
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
  )
}
