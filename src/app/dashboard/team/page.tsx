"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Activity, ShieldCheck, FolderKanban, RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string
  name: string
  email: string | null
  projects: number
  runs30d: number
  healed30d: number
}

type TeamPayload = {
  isAdmin: boolean
  totalMembers: number
  totalProjects: number
  totalRuns30d: number
  members: TeamMember[]
}

type ConversionPayload = {
  days: number
  scope: 'global' | 'self'
  funnel: {
    registered: number
    repoConnected: number
    firstHealing: number
    paid: number
    conversionRegisteredToRepoPct: number
    conversionRepoToHealingPct: number
    conversionHealingToPaidPct: number
  }
  onboardingSteps: {
    step1: number
    step2: number
    step3: number
  }
  kpiTargets: {
    activation24hPct: number
    timeToFirstHealingMinutes: number
    autoPrRatePct: number
  }
  kpiActuals: {
    activation24hPct: number
    timeToFirstHealingMinutes: number | null
    autoPrRatePct: number
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ElementType
}) {
  return (
    <div className="group relative p-4 rounded-lg glass-elite hover:border-white/10 transition-all duration-150">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-medium tracking-widest text-gray-500 uppercase">{label}</p>
          <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
        </div>
        <div className="p-2 rounded-md bg-white/5">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  )
}

export default function TeamDashboardPage() {
  const [data, setData] = useState<TeamPayload | null>(null)
  const [conversion, setConversion] = useState<ConversionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeam = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/dashboard/team', { credentials: 'include' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || `HTTP ${response.status}`)
      }
      const payload = await response.json()
      setData(payload)

      const conversionResponse = await fetch('/api/analytics/conversion?days=30', { credentials: 'include' })
      if (conversionResponse.ok) {
        const conversionPayload = await conversionResponse.json()
        setConversion(conversionPayload)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equipo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchTeam()
  }, [])

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando dashboard de equipo...</div>
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-400">{error || 'No hay datos disponibles'}</p>
        <Button onClick={fetchTeam} variant="outline" size="sm" className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Dashboard de Equipo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data.isAdmin ? 'Vista multi-usuario (últimos 30 días)' : 'Vista de tu equipo/proyectos (últimos 30 días)'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTeam} className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Miembros" value={data.totalMembers} icon={Users} />
        <StatCard label="Proyectos" value={data.totalProjects} icon={FolderKanban} />
        <StatCard label="Runs (30d)" value={data.totalRuns30d} icon={Activity} />
      </div>

      {conversion && (
        <div className="rounded-lg glass-elite overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium text-white">Conversión y KPI (30 días)</h2>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Funnel interno</p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300">Registro: <span className="text-white">{conversion.funnel.registered}</span></p>
                <p className="text-gray-300">Repo conectado: <span className="text-white">{conversion.funnel.repoConnected}</span> ({conversion.funnel.conversionRegisteredToRepoPct}%)</p>
                <p className="text-gray-300">Primer healing: <span className="text-white">{conversion.funnel.firstHealing}</span> ({conversion.funnel.conversionRepoToHealingPct}%)</p>
                <p className="text-gray-300">Pago: <span className="text-white">{conversion.funnel.paid}</span> ({conversion.funnel.conversionHealingToPaidPct}%)</p>
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Objetivos KPI</p>
              <div className="space-y-1 text-sm">
                <p className="text-gray-300">
                  Activación 24h: <span className={cn(conversion.kpiActuals.activation24hPct >= conversion.kpiTargets.activation24hPct ? 'text-emerald-400' : 'text-amber-400')}>{conversion.kpiActuals.activation24hPct}%</span>
                  <span className="text-gray-500"> (target &gt; {conversion.kpiTargets.activation24hPct}%)</span>
                </p>
                <p className="text-gray-300">
                  Time-to-first-healing: <span className={cn((conversion.kpiActuals.timeToFirstHealingMinutes ?? 9999) < conversion.kpiTargets.timeToFirstHealingMinutes ? 'text-emerald-400' : 'text-amber-400')}>{conversion.kpiActuals.timeToFirstHealingMinutes ?? 'N/A'} min</span>
                  <span className="text-gray-500"> (target &lt; {conversion.kpiTargets.timeToFirstHealingMinutes})</span>
                </p>
                <p className="text-gray-300">
                  Auto-PR rate: <span className={cn(conversion.kpiActuals.autoPrRatePct >= conversion.kpiTargets.autoPrRatePct ? 'text-emerald-400' : 'text-amber-400')}>{conversion.kpiActuals.autoPrRatePct}%</span>
                  <span className="text-gray-500"> (target &gt; {conversion.kpiTargets.autoPrRatePct}%)</span>
                </p>
              </div>
              <p className="text-[11px] text-gray-500 mt-3">Onboarding events: paso1={conversion.onboardingSteps.step1}, paso2={conversion.onboardingSteps.step2}, paso3={conversion.onboardingSteps.step3}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg glass-elite overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Actividad por miembro</h2>
          <Link href="/dashboard/projects" className="text-xs text-[#00F5C8]/70 hover:text-[#00F5C8] inline-flex items-center gap-1">
            Ver proyectos
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-white/5">
          {data.members.map((member) => (
            <div key={member.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{member.name}</p>
                <p className="text-xs text-gray-500 truncate">{member.email || 'sin email'}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-400">Proyectos: <span className="text-white">{member.projects}</span></span>
                <span className="text-gray-400">Runs: <span className="text-white">{member.runs30d}</span></span>
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full', member.healed30d > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400')}>
                  <ShieldCheck className="w-3 h-3" />
                  Curados: {member.healed30d}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
