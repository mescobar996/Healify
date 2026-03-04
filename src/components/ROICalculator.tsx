'use client'

import { useState, useEffect } from 'react'
import { DollarSign, Clock, TrendingUp, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MINUTES_PER_FIX = 30
const DEFAULT_RATE    = 65

interface RoiSettings {
  devHourlyRate: number
}

export default function ROICalculator() {
  const [hourlyRate, setHourlyRate]         = useState(DEFAULT_RATE)
  const [failuresPerMonth, setFailures]     = useState(20)
  const [autoHealPct, setAutoHealPct]       = useState(80)
  const [saved, setSaved]                   = useState(false)
  const [loading, setLoading]               = useState(true)

  // Load persisted rate from API
  useEffect(() => {
    fetch('/api/user/roi-settings')
      .then((r) => r.json() as Promise<RoiSettings>)
      .then((d) => {
        if (d?.devHourlyRate) setHourlyRate(d.devHourlyRate)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const autoHealed       = Math.round(failuresPerMonth * (autoHealPct / 100))
  const minutesSaved     = autoHealed * MINUTES_PER_FIX
  const hoursSaved       = minutesSaved / 60
  const costSaved        = hoursSaved * hourlyRate
  const annualCostSaved  = costSaved * 12

  async function saveRate() {
    setSaved(false)
    await fetch('/api/user/roi-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devHourlyRate: hourlyRate }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="glass-elite rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/5 rounded w-full" />
      </div>
    )
  }

  return (
    <div className="glass-elite rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#EDEDED] font-heading flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-white/70" />
          ROI Calculator
        </h3>
        <span className="text-xs text-[#EDEDED]/40">Personalizado para tu equipo</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Hourly rate */}
        <div className="space-y-2">
          <label className="text-xs text-[#EDEDED]/60 font-medium">
            Tarifa de desarrollador (USD/hr)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1000}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Math.max(1, Number(e.target.value)))}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-[#EDEDED] focus:outline-none focus:border-white/30"
            />
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-white/60 hover:text-white"
              onClick={saveRate}
              title="Guardar tarifa"
            >
              {saved ? '✓' : <Save className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Failures per month */}
        <div className="space-y-2">
          <label className="text-xs text-[#EDEDED]/60 font-medium">
            Tests que fallan por mes
          </label>
          <input
            type="number"
            min={1}
            max={10000}
            value={failuresPerMonth}
            onChange={(e) => setFailures(Math.max(1, Number(e.target.value)))}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-[#EDEDED] focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Auto-heal rate */}
        <div className="space-y-2">
          <label className="text-xs text-[#EDEDED]/60 font-medium">
            Tasa de autocuración (%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={autoHealPct}
            onChange={(e) => setAutoHealPct(Number(e.target.value))}
            className="w-full accent-white"
          />
          <span className="text-xs text-[#EDEDED]/50">{autoHealPct}% autocurado por IA</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
        <ResultCard
          icon={<Clock className="w-4 h-4" />}
          label="Horas ahorradas/mes"
          value={hoursSaved.toFixed(1) + 'h'}
        />
        <ResultCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Ahorro mensual"
          value={'$' + costSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        />
        <ResultCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Ahorro anual"
          value={'$' + annualCostSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          highlight
        />
        <ResultCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Tests autocurados/mes"
          value={String(autoHealed)}
        />
      </div>

      <p className="text-xs text-[#EDEDED]/30">
        Asume {MINUTES_PER_FIX} min de trabajo manual por test fallido. Ajustá los parámetros para tu contexto.
      </p>
    </div>
  )
}

function ResultCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 space-y-1 ${highlight ? 'bg-white/10 border border-white/20' : 'bg-white/5'}`}>
      <div className="flex items-center gap-1.5 text-[#EDEDED]/60">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-xl font-bold font-heading ${highlight ? 'text-white' : 'text-[#EDEDED]'}`}>
        {value}
      </div>
    </div>
  )
}
