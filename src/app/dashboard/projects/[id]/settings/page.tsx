'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Settings, ArrowLeft, Sliders, GitPullRequest, Bell, BellOff, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface ProjectConfig {
  id: string
  name: string
  autoHealThreshold: number
  autoPrEnabled: boolean
  notifyOnHeal: boolean
  notifyOnFail: boolean
}

// ── Threshold slider labels ────────────────
const thresholdLabel = (t: number) => {
  if (t >= 0.9) return { label: 'Alta (≥ 90%)', color: 'text-emerald-400' }
  if (t >= 0.7) return { label: 'Media (≥ 70%)', color: 'text-amber-400' }
  return { label: 'Baja (≥ 50%)', color: 'text-red-400' }
}

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-white/5 last:border-none">
      <div className="flex gap-3 items-start min-w-0">
        <div className="mt-0.5 p-1.5 rounded-md bg-white/5 shrink-0">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm text-[#E8F0FF] font-medium">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id

  const [config, setConfig] = useState<ProjectConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, { credentials: 'include' })
      if (res.ok) setConfig(await res.json())
    } catch {
      toast.error('Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const save = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoHealThreshold: config.autoHealThreshold,
          autoPrEnabled: config.autoPrEnabled,
          notifyOnHeal: config.notifyOnHeal,
          notifyOnFail: config.notifyOnFail,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setConfig(updated)
        setSaved(true)
        toast.success('Configuración guardada')
        setTimeout(() => setSaved(false), 2500)
      } else {
        const { error } = await res.json()
        toast.error(error || 'Error al guardar')
      }
    } catch {
      toast.error('Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  const update = (patch: Partial<ProjectConfig>) =>
    setConfig(prev => prev ? { ...prev, ...patch } : prev)

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-sm text-gray-500">Proyecto no encontrado</p>
        <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/projects')}>
          Volver
        </Button>
      </div>
    )
  }

  const { label: tLabel, color: tColor } = thresholdLabel(config.autoHealThreshold)

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-md hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" />
            <h1 className="text-sm font-semibold text-[#E8F0FF]">Configuración del Proyecto</h1>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{config.name}</p>
        </div>
      </div>

      {/* Config card */}
      <div className="rounded-xl bg-[#111318] border border-white/5 p-5 space-y-1">
        {/* Threshold */}
        <SettingRow
          icon={Sliders}
          title="Umbral de autocuración"
          description="Confianza mínima de la IA para aplicar automáticamente un fix de selector."
        >
          <div className="flex flex-col items-end gap-2 w-40">
            <span className={cn('text-xs font-mono font-semibold', tColor)}>{tLabel}</span>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={config.autoHealThreshold}
              onChange={e => update({ autoHealThreshold: parseFloat(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <span className="text-[10px] text-gray-600 font-mono">
              {Math.round(config.autoHealThreshold * 100)}%
            </span>
          </div>
        </SettingRow>

        {/* Auto-PR */}
        <SettingRow
          icon={GitPullRequest}
          title="Auto Pull Request"
          description="Crear un PR automáticamente cuando un selector es curado."
        >
          <Switch
            checked={config.autoPrEnabled}
            onCheckedChange={v => update({ autoPrEnabled: v })}
          />
        </SettingRow>

        {/* Notify on heal */}
        <SettingRow
          icon={Bell}
          title="Notificar al curar"
          description="Recibir notificación email y Slack cuando un test es autocurado."
        >
          <Switch
            checked={config.notifyOnHeal}
            onCheckedChange={v => update({ notifyOnHeal: v })}
          />
        </SettingRow>

        {/* Notify on fail */}
        <SettingRow
          icon={BellOff}
          title="Notificar fallos"
          description="Recibir notificación cuando un test falla y no puede ser curado."
        >
          <Switch
            checked={config.notifyOnFail}
            onCheckedChange={v => update({ notifyOnFail: v })}
          />
        </SettingRow>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={save}
          disabled={saving}
          size="sm"
          className={cn(
            'gap-2 transition-all',
            saved && 'bg-emerald-600 hover:bg-emerald-600'
          )}
        >
          {saving ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando…</>
          ) : saved ? (
            <><Check className="w-3.5 h-3.5" /> Guardado</>
          ) : (
            'Guardar configuración'
          )}
        </Button>
      </div>
    </div>
  )
}
