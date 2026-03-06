"use client"

import React from "react"
import {
  Sparkles,
  Timer,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  Download,
} from "lucide-react"
import { ShareSavings } from "@/components/ShareSavings"

interface ROIData {
  timeSavedHours: number
  totalCostSaved: number
  autoHealedMonth: number
  healingRate: number
}

interface RoiStripProps {
  roi: ROIData
  onExport: (format: "csv" | "pdf") => void
}

export function RoiStrip({ roi, onExport }: RoiStripProps) {
  const isEmpty = roi.timeSavedHours === 0 && roi.autoHealedMonth === 0

  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#111111] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
        <span className="text-[11px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
          ROI de Healify — acumulado histórico
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onExport("csv")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={() => onExport("pdf")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
          >
            <Download className="w-3 h-3" />
            PDF
          </button>
          <ShareSavings
            timeSavedHours={roi.timeSavedHours}
            totalCostSaved={roi.totalCostSaved}
            healingRate={roi.healingRate}
            autoHealedMonth={roi.autoHealedMonth}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-y md:divide-y-0 divide-x-0 md:divide-x divide-[var(--border-subtle)]">
        <RoiCell
          icon={<Timer className="w-4 h-4 text-white" />}
          value={roi.timeSavedHours > 0 ? `${roi.timeSavedHours}h` : "—"}
          label="horas ahorradas"
        />
        <RoiCell
          icon={<DollarSign className="w-4 h-4 text-white" />}
          value={roi.totalCostSaved > 0 ? `$${roi.totalCostSaved.toLocaleString()}` : "—"}
          label="ahorro estimado"
        />
        <RoiCell
          icon={<ShieldCheck className="w-4 h-4 text-white" />}
          value={roi.autoHealedMonth > 0 ? String(roi.autoHealedMonth) : "—"}
          label="curados este mes"
        />
        <RoiCell
          icon={<TrendingUp className="w-4 h-4 text-yellow-400" />}
          value={roi.healingRate > 0 ? `${roi.healingRate}%` : "—"}
          label="tasa autocuración"
        />
      </div>

      {/* Empty-state hint */}
      {isEmpty && (
        <div className="px-5 py-3 border-t border-[var(--border-subtle)]">
          <p className="text-[11px] text-[var(--text-tertiary)] text-center">
            Los datos de ROI aparecerán cuando Healify cure su primer test ·{" "}
            <a
              href="/dashboard/projects"
              className="text-[var(--accent-primary)]/70 hover:text-[var(--accent-primary)] transition-colors ml-1"
            >
              Conectá tu primer repo →
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Internal cell helper ─────────────────────────────────────────── */
function RoiCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "#1A1A1A" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--text-primary)] leading-none">
          {value}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{label}</p>
      </div>
    </div>
  )
}
