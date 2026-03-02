"use client"

import Link from "next/link"
import { AlertTriangle, Sparkles, FolderKanban, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title: string
  description: string
  variant?: "inline" | "full"
}

const STEPS = [
  { step: "1", label: "Crear proyecto", desc: "Conectá tu repo" },
  { step: "2", label: "Instalar SDK", desc: "3 líneas de config" },
  { step: "3", label: "Ver curaciones", desc: "IA autocura tests" },
]

export function EmptyState({ title, description, variant = "inline" }: EmptyStateProps) {
  if (variant === "full") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-[#5E6AD2]/10 blur-2xl rounded-full" />
          <div className="relative w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] border border-white/[0.08] flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-[#5E6AD2]" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mb-6">{description}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="sm" asChild className="bg-[#5E6AD2] hover:bg-[#5E6AD2]/90">
            <Link href="/dashboard/projects">
              <FolderKanban className="w-3.5 h-3.5 mr-1.5" />
              Conectar repositorio
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/docs">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
              Ver documentación
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 max-w-md w-full">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[var(--bg-card)] border border-white/[0.05]"
            >
              <div className="w-6 h-6 rounded-full bg-[#5E6AD2]/15 flex items-center justify-center text-[10px] font-bold text-[#5E6AD2]">
                {s.step}
              </div>
              <p className="text-[11px] font-medium text-[var(--text-primary)]">{s.label}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-full bg-[var(--bg-elevated)] mb-3">
        <AlertTriangle className="w-5 h-5 text-[var(--text-tertiary)]" />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  )
}
