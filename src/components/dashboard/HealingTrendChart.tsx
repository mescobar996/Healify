"use client"

import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { EmptyState } from "@/components/dashboard/EmptyState"

interface ChartDataPoint {
  date: string
  testsRotos: number
  curados: number
}

interface HealingTrendChartProps {
  chartData: ChartDataPoint[]
  /** Unique suffix for gradient IDs to avoid SVG clashes when rendered twice */
  gradientSuffix?: string
  /** Show legend row above the chart (default: true) */
  showLegend?: boolean
}

export function HealingTrendChart({
  chartData,
  gradientSuffix = "",
  showLegend = true,
}: HealingTrendChartProps) {
  const healGradId = `healingGrad${gradientSuffix}`
  const brokenGradId = `brokenGrad${gradientSuffix}`

  return (
    <>
      {showLegend && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-[var(--text-primary)]">
              Tendencia de Curación
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Últimos 7 días</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-white" />
              <span className="text-[var(--text-secondary)]">Curados</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-[var(--text-secondary)]">Rotos</span>
            </div>
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <EmptyState
          title="Sin datos de gráfico"
          description="Los datos aparecerán cuando se ejecuten tests"
        />
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={healGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={brokenGradId} x1="0" y1="0" x2="0" y2="1">
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
                stroke="#FFFFFF"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${healGradId})`}
              />
              <Area
                type="monotone"
                dataKey="testsRotos"
                stroke="#E85C4A"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${brokenGradId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  )
}
