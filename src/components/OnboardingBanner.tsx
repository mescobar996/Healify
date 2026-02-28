"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import {
  Github,
  Zap,
  CheckCircle2,
  ArrowRight,
  X,
  FolderPlus,
  Webhook,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ═══════════════════════════════════════════════════════════════════════
// ONBOARDING BANNER — Se muestra cuando el usuario tiene 0 proyectos
// Guía al usuario en 3 pasos para conectar su primer repo y ver Healify
// en acción.
// ═══════════════════════════════════════════════════════════════════════

const STEPS = [
  {
    step: 1,
    icon: FolderPlus,
    title: "Crear tu primer proyecto",
    description: "Dale un nombre y pegá la URL de tu repositorio de GitHub.",
    action: "Crear proyecto",
    color: "text-[#00F5C8]",
    bg: "bg-[#00F5C8]/10",
    border: "border-[#00F5C8]/20",
  },
  {
    step: 2,
    icon: Webhook,
    title: "Conectar el Webhook",
    description:
      "Healify escucha cada push. Cada commit dispara los tests automáticamente.",
    action: "Ver instrucciones",
    color: "text-[#7B5EF8]",
    bg: "bg-[#7B5EF8]/10",
    border: "border-[#7B5EF8]/20",
  },
  {
    step: 3,
    icon: Zap,
    title: "Healify autocura tus tests",
    description:
      "Cuando un selector se rompe, la IA detecta el nuevo selector y crea un PR automático.",
    action: null,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
]

function StepCard({
  step,
  index,
  isCompleted,
}: {
  step: (typeof STEPS)[0]
  index: number
  isCompleted: boolean
}) {
  const Icon = step.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "flex-1 min-w-0 rounded-xl border p-4 transition-all duration-200",
        isCompleted
          ? "border-emerald-500/30 bg-emerald-500/5"
          : step.border + " " + step.bg
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            isCompleted ? "bg-emerald-500/20" : step.bg
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Icon className={cn("w-4 h-4", step.color)} />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                isCompleted ? "text-emerald-400" : step.color
              )}
            >
              Paso {step.step}
            </span>
          </div>
          <p className="text-[13px] font-medium text-white leading-tight">
            {step.title}
          </p>
          <p className="text-[11px] text-[#E8F0FF]/50 mt-1 leading-relaxed">
            {step.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

interface OnboardingBannerProps {
  userName?: string
  onDismiss?: () => void
  progress?: {
    projectConnected: boolean
    firstRunExecuted: boolean
    firstHealingDone: boolean
  }
  onSetupSandbox?: () => Promise<void> | void
}

export function OnboardingBanner({
  userName,
  onDismiss,
  progress,
  onSetupSandbox,
}: OnboardingBannerProps) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [sandboxLoading, setSandboxLoading] = useState(false)

  const completedByStep = {
    1: progress?.projectConnected ?? false,
    2: progress?.firstRunExecuted ?? false,
    3: progress?.firstHealingDone ?? false,
  }

  const completedCount = Object.values(completedByStep).filter(Boolean).length

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
    // Guardar preferencia en localStorage
    try {
      localStorage.setItem("healify_onboarding_dismissed", "true")
    } catch {}
  }

  const handleSetupSandbox = async () => {
    if (!onSetupSandbox) return
    try {
      setSandboxLoading(true)
      await onSetupSandbox()
    } finally {
      setSandboxLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="relative rounded-2xl overflow-hidden border border-[#00F5C8]/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,245,200,0.04) 0%, rgba(123,94,248,0.06) 50%, rgba(10,14,26,0.8) 100%)",
          }}
        >
          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-[#E8F0FF]/30 hover:text-[#E8F0FF]/70 hover:bg-white/5 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-5">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F5C8]/20 to-[#7B5EF8]/20 flex items-center justify-center shrink-0 border border-[#00F5C8]/20">
                <Zap className="w-4 h-4 text-[#00F5C8]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white leading-tight">
                  {userName
                    ? `Bienvenido, ${userName.split(" ")[0]} 👋`
                    : "Bienvenido a Healify 👋"}
                </h2>
                <p className="text-[12px] text-[#E8F0FF]/50 mt-0.5">
                  Conectá tu primer repositorio para que Healify empiece a
                  autocurar tus tests.
                </p>
                <p className="text-[11px] text-[#00F5C8]/70 mt-1">
                  Progreso: {completedCount}/3 pasos completados
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {STEPS.map((step, i) => (
                <StepCard
                  key={step.step}
                  step={step}
                  index={i}
                  isCompleted={completedByStep[step.step as 1 | 2 | 3]}
                />
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Button
                onClick={() => router.push("/dashboard/projects")}
                className="bg-[#00F5C8] hover:bg-[#00F5C8]/90 text-[#0A0E1A] font-semibold text-sm h-9 px-5 w-full sm:w-auto"
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Crear mi primer proyecto
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>

              <Button
                variant="ghost"
                onClick={handleSetupSandbox}
                className="text-[#E8F0FF]/50 hover:text-[#E8F0FF] text-sm h-9 px-4 w-full sm:w-auto"
                disabled={sandboxLoading}
              >
                <Github className="w-4 h-4 mr-2" />
                {sandboxLoading ? "Creando sandbox..." : "Activar sandbox demo"}
              </Button>

              <button
                onClick={handleDismiss}
                className="text-[11px] text-[#E8F0FF]/25 hover:text-[#E8F0FF]/50 transition-colors sm:ml-auto whitespace-nowrap"
              >
                Saltar por ahora
              </button>
            </div>

            {/* Demo shortcut */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2">
              <Play className="w-3 h-3 text-[#E8F0FF]/25 shrink-0" />
              <p className="text-[10px] text-[#E8F0FF]/30">
                ¿Querés ver cómo funciona sin configurar nada?{" "}
                <button
                  onClick={() => router.push("/api/seed")}
                  className="text-[#00F5C8]/50 hover:text-[#00F5C8] transition-colors underline underline-offset-2"
                >
                  Cargar datos de demo
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
